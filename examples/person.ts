import z from "zod";
import { SmartObject } from "../dist/index.js";

const personSchema = z.object({
  name: z.string(),
  age: z.number(),
  address: z.object({
    street: z.string(),
    city: z.string(),
  }),
  skills: z.array(
    z.object({
      name: z.string(),
      level: z.number(),
    }),
  ),
});

const Person = SmartObject(personSchema);

const initial = {
  name: "Mario",
  age: 30,
  address: { street: "Via Roma 1", city: "Milano" },
  skills: [
    { name: "Programming", level: 10 },
    { name: "Design", level: 8 },
  ],
};

const person = new Person(initial);

console.log("Initial state (no operations on construction):");
console.log({ name: person.name, age: person.age, operations: person.operations });

person.setName("Luigi");
person.setAge(31);
person.setAddress({ street: "Via Roma 2", city: "Milano" });
person.setSkills([{ name: "Testing", level: 5 }]);

console.log("\nAfter mutations:");
console.log({
  name: person.name,
  age: person.age,
  address: person.address,
  skills: person.skills,
  operations: person.operations,
});

person.setName("Luigi");
console.log("\nNo-op write (unchanged value):");
console.log({ operations: person.operations });

person.clearOperations();
console.log("\nAfter clearOperations (state preserved, log empty):");
console.log({ name: person.name, operations: person.operations });

const replayed = Person.fromOperations(initial, [
  { op: "replace", path: "/name", value: "Luigi" },
  { op: "replace", path: "/age", value: 31 },
]);

console.log("\nReplayed from baseline + operations:");
console.log({ name: replayed.name, age: replayed.age, operations: replayed.operations });
