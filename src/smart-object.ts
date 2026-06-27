import type { Operation } from "fast-json-patch";
import jsonPatch from "fast-json-patch";
import type { z } from "zod";
import type { SmartObjectConstructor, SmartObjectInstance } from "./types.js";

const { applyPatch, compare, deepClone } = jsonPatch;

/**
 * Builds a typed SmartObject class from a Zod schema.
 *
 * The goal is to offer mutable, schema-validated objects that also produce an
 * RFC 6902 operation log — useful for audit trails, client/server sync, and
 * event replay without a separate change-tracking layer.
 *
 * Zod is the single source of truth: the same schema drives runtime validation,
 * TypeScript inference, and the dynamically generated read/write API.
 *
 * Initial construction does not emit operations because that state is the baseline
 * every subsequent patch is measured against.
 *
 * @typeParam T - Zod object schema that defines the instance shape
 * @param zodSchema - A `z.object({ ... })` describing the fields
 * @returns An instantiable class with types inferred from the schema
 *
 * @example
 * ```typescript
 * const Person = SmartObject(z.object({
 *     name: z.string(),
 *     age: z.number(),
 * }));
 *
 * const person = new Person({ name: "Mario", age: 30 });
 * person.setName("Luigi");
 * // Only actual changes become operations — suitable for sync payloads
 * console.log(person.operations); // [{ op: "replace", path: "/name", value: "Luigi" }]
 * ```
 */
export function SmartObject<T extends z.ZodObject>(zodSchema: T): SmartObjectConstructor<T> {
  const shape = zodSchema.shape;
  type Output = z.infer<T>;

  class SmartObjectClass {
    // Kept private so reads/writes always go through the generated API.
    #data!: Output;
    // Append-only audit log, separate from current state — consumers replay
    // or persist deltas without treating operations as readable fields.
    #operations: Operation[] = [];

    static fromOperations(
      initial: z.input<T> | undefined,
      operations: Operation[],
    ): SmartObjectInstance<T> {
      const instance = new SmartObjectClass(initial);
      instance.#applyOperations(operations);
      // TypeScript cannot see properties defined dynamically at runtime.
      return instance as unknown as SmartObjectInstance<T>;
    }

    #applyOperations(operations: Operation[]): void {
      // Nothing to replay — skip to avoid pointless patch application.
      if (operations.length === 0) {
        return;
      }

      applyPatch(this.#data, operations, false, true);
      this.#operations.push(...operations);
    }

    get operations(): readonly Operation[] {
      // Readonly surface prevents consumers from rewriting patch history.
      return this.#operations;
    }

    clearOperations(): void {
      // Clears the audit trail only — state stays intact after sync/persist.
      this.#operations.length = 0;
    }

    constructor(initial?: z.input<T>) {
      // Schema-driven API generation: one definition, no separate codegen step.
      for (const key of Object.keys(shape)) {
        const fieldSchema = shape[key as keyof typeof shape];
        const setMethodName = `set${key.charAt(0).toUpperCase()}${key.slice(1)}`;

        Object.defineProperty(this, key, {
          get: () => this.#data[key as keyof Output],
          // Data fields are enumerable so spreads/serialization see state.
          enumerable: true,
          configurable: true,
        });

        Object.defineProperty(this, setMethodName, {
          value: (value: unknown) => {
            // Validation runs before patching so invalid writes never
            // corrupt the operation log.
            const parsed = fieldSchema.parse(value) as Output[keyof Output];
            // Immutable snapshot is required for an accurate diff.
            const beforeData = deepClone(this.#data);
            const afterData = { ...deepClone(this.#data), [key]: parsed };
            const patch = compare(beforeData, afterData);

            // Identical values must not pollute the log — keeps sync payloads minimal.
            if (patch.length === 0) {
              return;
            }

            applyPatch(this.#data, patch, false, true);
            this.#operations.push(...patch);
          },
          // Setters are behavior, not serializable data.
          enumerable: false,
          configurable: true,
          writable: true,
        });
      }

      // Bootstrap validated state without recording setup as mutations.
      this.#data = zodSchema.parse(initial ?? {}) as Output;
    }
  }

  // The runtime class shape is built dynamically; the cast documents the contract.
  return SmartObjectClass as unknown as SmartObjectConstructor<T>;
}
