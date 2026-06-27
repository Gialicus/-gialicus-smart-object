import { describe, expect, expectTypeOf, it } from "vitest";
import z from "zod";
import type { Operation, SmartObjectInstance } from "../src/index.ts";
import { SmartObject } from "../src/index.ts";

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

type PersonInstance = SmartObjectInstance<typeof personSchema>;

const initial = {
  name: "Mario",
  age: 30,
  address: { street: "Via Roma 1", city: "Milano" },
  skills: [
    { name: "Programming", level: 10 },
    { name: "Design", level: 8 },
  ],
};

describe("SmartObject", () => {
  describe("construction", () => {
    it("populates getters without accumulating operations", () => {
      const person = new Person(initial);

      expect(person.name).toBe("Mario");
      expect(person.age).toBe(30);
      expect(person.address).toEqual({ street: "Via Roma 1", city: "Milano" });
      expect(person.skills).toEqual(initial.skills);
      expect(person.operations).toEqual([]);
    });

    it("throws when constructed with no arguments and all fields are required", () => {
      expect(() => new Person()).toThrow();
    });

    it("throws on partial initial input", () => {
      expect(() => new Person({ name: "Mario" } as typeof initial)).toThrow();
    });

    it("accepts constructor with no arguments when schema allows it", () => {
      const optionalSchema = z.object({
        name: z.string().optional(),
        age: z.number().optional(),
      });
      const OptionalPerson = SmartObject(optionalSchema);
      const person = new OptionalPerson();

      expect(person.name).toBeUndefined();
      expect(person.age).toBeUndefined();
      expect(person.operations).toEqual([]);
    });
  });

  describe("getter", () => {
    it("reads primitives, nested objects, and arrays", () => {
      const person = new Person(initial);

      expect(person.name).toBe("Mario");
      expect(person.age).toBe(30);
      expect(person.address.street).toBe("Via Roma 1");
      expect(person.skills[0]?.name).toBe("Programming");
    });
  });

  describe("set*", () => {
    it("updates the getter and accumulates a replace operation", () => {
      const person = new Person(initial);

      person.setName("Luigi");

      expect(person.name).toBe("Luigi");
      expect(person.operations).toEqual([{ op: "replace", path: "/name", value: "Luigi" }]);
    });

    it("does not accumulate operations when the value is unchanged", () => {
      const person = new Person(initial);

      person.setName("Mario");

      expect(person.name).toBe("Mario");
      expect(person.operations).toEqual([]);
    });

    it("throws on invalid value without altering state or operations", () => {
      const person = new Person(initial);

      expect(() => person.setAge("invalid" as unknown as number)).toThrow();
      expect(person.age).toBe(30);
      expect(person.operations).toEqual([]);
    });

    it("produces patch on nested objects", () => {
      const person = new Person(initial);
      const newAddress = { street: "Via Roma 2", city: "Milano" };

      person.setAddress(newAddress);

      expect(person.address).toEqual(newAddress);
      expect(person.operations).toContainEqual({
        op: "replace",
        path: "/address/street",
        value: "Via Roma 2",
      });
    });

    it("produces operations on array with different value", () => {
      const person = new Person(initial);
      const newSkills = [{ name: "Testing", level: 5 }];

      person.setSkills(newSkills);

      expect(person.skills).toEqual(newSkills);
      expect(person.operations).toEqual([
        { op: "remove", path: "/skills/1" },
        { op: "replace", path: "/skills/0/level", value: 5 },
        { op: "replace", path: "/skills/0/name", value: "Testing" },
      ]);
    });

    it("does not accumulate operations when the array is equal", () => {
      const person = new Person(initial);

      person.setSkills([...initial.skills]);

      expect(person.operations).toEqual([]);
    });

    it("accumulates operations in chronological order", () => {
      const person = new Person(initial);

      person.setName("Luigi");
      person.setAge(31);

      expect(person.operations).toEqual([
        { op: "replace", path: "/name", value: "Luigi" },
        { op: "replace", path: "/age", value: 31 },
      ]);
    });
  });

  describe("clearOperations", () => {
    it("clears the accumulator without altering state", () => {
      const person = new Person(initial);

      person.setName("Luigi");
      person.clearOperations();

      expect(person.name).toBe("Luigi");
      expect(person.operations).toEqual([]);
    });
  });

  describe("fromOperations", () => {
    it("replays operations on initial and copies them into the accumulator", () => {
      const source = new Person(initial);

      source.setName("Luigi");
      source.setAge(31);

      const operations = [...source.operations];
      const replayed = Person.fromOperations(initial, operations);

      expect(replayed.name).toBe("Luigi");
      expect(replayed.age).toBe(31);
      expect(replayed.operations).toEqual(operations);
    });

    it("throws on partial initial baseline", () => {
      expect(() => Person.fromOperations({ name: "Mario" } as typeof initial, [])).toThrow();
    });
  });
});

describe("SmartObject types", () => {
  it("infers getters, set*, operations, and fromOperations", () => {
    expectTypeOf<PersonInstance>().toHaveProperty("name");
    expectTypeOf<PersonInstance>().toHaveProperty("age");
    expectTypeOf<PersonInstance>().toHaveProperty("address");
    expectTypeOf<PersonInstance>().toHaveProperty("skills");

    expectTypeOf<PersonInstance["setName"]>().parameter(0).toEqualTypeOf<string>();
    expectTypeOf<PersonInstance["setAge"]>().parameter(0).toEqualTypeOf<number>();
    expectTypeOf<PersonInstance["setAddress"]>()
      .parameter(0)
      .toEqualTypeOf<{ street: string; city: string }>();
    expectTypeOf<PersonInstance["setSkills"]>()
      .parameter(0)
      .toEqualTypeOf<{ name: string; level: number }[]>();

    expectTypeOf<PersonInstance["operations"]>().toEqualTypeOf<readonly Operation[]>();
    expectTypeOf<PersonInstance["clearOperations"]>().toBeFunction();

    expectTypeOf<ConstructorParameters<typeof Person>[0]>().toEqualTypeOf<
      z.input<typeof personSchema> | undefined
    >();

    expectTypeOf(Person.fromOperations(initial, [])).toEqualTypeOf<PersonInstance>();
  });
});
