import type { Operation } from "fast-json-patch";
import type { z } from "zod";

export type { Operation };

/**
 * Compile-time map of `set*` methods for each schema key.
 *
 * Setters are generated at runtime, so mapped types preserve type safety
 * even though the class body is built dynamically from the Zod shape.
 */
export type SetMethods<T> = {
  [K in keyof T as `set${Capitalize<string & K>}`]: (value: T[K]) => void;
};

/**
 * Read/write surface and audit trail are separate concerns in the public API.
 *
 * Grouping operations here keeps mutation methods focused on state while
 * consumers can still inspect or reset the patch history explicitly.
 */
export type OperationsAccessor = {
  /** Chronological RFC 6902 log — order matters for replay and sync */
  readonly operations: readonly Operation[];
  /** Drops accumulated patches after persist/sync without rolling back state */
  clearOperations(): void;
};

/**
 * Full instance contract: validated data shape, typed mutators, and patch log.
 *
 * Intersection types merge these concerns into one consumable surface for callers.
 */
export type SmartObjectInstance<T extends z.ZodObject> = z.infer<T> &
  SetMethods<z.infer<T>> &
  OperationsAccessor;

/**
 * Constructor type for a SmartObject class, including replay as a first-class capability.
 *
 * `fromOperations` lives on the constructor type because replay is a core use case,
 * not an optional utility added after the fact.
 */
export type SmartObjectConstructor<T extends z.ZodObject> = {
  new (initial?: z.input<T>): SmartObjectInstance<T>;
  fromOperations(initial: z.input<T> | undefined, operations: Operation[]): SmartObjectInstance<T>;
};
