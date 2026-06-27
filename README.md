# @gialicoletta/smart-object

Typed TypeScript objects backed by Zod schemas, with an RFC 6902 operation log for every validated change. Use them when you need mutable, type-safe state plus a portable delta trail for audit, sync, or replay — without bolting on a separate change-tracking layer.

## Installation

```bash
npm install @gialicoletta/smart-object zod
```

Dependencies: [Zod](https://zod.dev) (peer dependency — schema validation) and [fast-json-patch](https://github.com/Starcounter-Jack/JSON-Patch) (RFC 6902 patch application, bundled).

## Usage

```typescript
import z from "zod";
import { SmartObject } from "@gialicoletta/smart-object";

const Person = SmartObject(z.object({
    name: z.string(),
    age: z.number(),
}));

const person = new Person({ name: "Mario", age: 30 });

// Reads expose validated state without side effects
console.log(person.name); // "Mario"

// Writes validate first, then append patches to person.operations
person.setName("Luigi");
person.setAge(31);

console.log(person.operations);
// [
//   { op: "replace", path: "/name", value: "Luigi" },
//   { op: "replace", path: "/age", value: 31 },
// ]

person.setName("Luigi"); // Unchanged value — no operation added (keeps sync payloads minimal)

person.clearOperations(); // Drops the audit trail after persist/sync; state is unchanged

// Initial construction is the replay baseline — it never emits operations
console.log(new Person({ name: "Mario", age: 30 }).operations); // []

// Reconstruct from baseline + accumulated deltas
const initial = { name: "Mario", age: 30 };
const person2 = Person.fromOperations(initial, [...person.operations]);
```

## API

### `SmartObject(schema)`

Factory that accepts a `z.object(...)` and returns an instantiable class.

| Parameter | Type | Description |
|-----------|------|-------------|
| `schema` | `z.ZodObject` | Zod schema defining the object shape |

**Members generated for each schema field `foo`:**

| Member | Type | Description |
|--------|------|-------------|
| `foo` | getter | Exposes the current validated field value |
| `setFoo(value)` | `(value: T) => void` | Validates, updates state, and records patches only when the value actually changes |

**Instance members:**

| Member | Type | Description |
|--------|------|-------------|
| `operations` | `readonly Operation[]` | Chronological RFC 6902 patch log |
| `clearOperations()` | `() => void` | Clears the patch log without rolling back state |

`set*` method names follow camelCase with the field name capitalized (`name` → `setName`, `address` → `setAddress`).

**Static members:**

| Member | Type | Description |
|--------|------|-------------|
| `fromOperations(initial, operations)` | `(initial, Operation[]) => Instance` | Builds an instance from a baseline, replays operations, and copies them into the accumulator |

### `Operation`

RFC 6902 operation emitted by [fast-json-patch](https://github.com/Starcounter-Jack/JSON-Patch) when a field actually changes. Examples:

```typescript
{ op: "replace", path: "/name", value: "Luigi" }
{ op: "add", path: "/age", value: 30 }
```

### Exported types

- `Operation` — JSON Patch operation (re-export from `fast-json-patch`)
- `SetMethods<T>` — mapped type of inferred `set*` methods for shape `T`
- `OperationsAccessor` — `operations` and `clearOperations()`
- `SmartObjectConstructor<T>` — constructor type including `fromOperations`

## Design rationale

1. **Construction** — `new Person(initial)` validates and seeds internal state without emitting operations, because that snapshot is the baseline every later patch is measured against.
2. **Validation** — Each write is validated against the schema so the operation log only records structurally valid changes.
3. **No-op writes** — Identical values are skipped to keep the patch log minimal and suitable for network sync.
4. **Patch-based updates** — Changes are expressed as RFC 6902 operations so deltas are standard, composable, and replayable.
5. **Operation accumulation** — Patches from `compare` are appended in order, preserving causality for audit and replay.
6. **Replay** — `fromOperations(initial, operations)` requires the same baseline used when the operations were produced, enabling deterministic reconstruction on another client or after persistence.

- `SmartObjectInstance<T>` — full instance type (getters + set* + operations)

## Full example

See [`examples/person.ts`](examples/person.ts) for a demo with primitives, nested objects, and arrays.

## Project structure

```
smart-object/
├── src/
│   ├── index.ts          # Public API barrel export
│   ├── smart-object.ts   # SmartObject factory
│   └── types.ts          # Operation and inferred types
├── examples/
│   └── person.ts         # Usage demo
├── tests/
│   └── smart-object.test.ts
└── dist/                 # Build output (generated)
```
