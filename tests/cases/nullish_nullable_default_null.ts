// A default that may itself be `null` keeps the `T | null`, as `tsc` types
// `a ?? b` for two nullables, so the result is narrowed before it is read. An
// interface on the left takes a class that implements it as its default.
interface Named {
  name: string;
}

class Person implements Named {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
}

const firstOf = (a: string | null, b: string | null): string | null => a ?? b;

const nameOf = (n: Named | null, fallback: Person): string => (n ?? fallback).name;

export const main = (): i32 => {
  const x = firstOf(null, "b");
  const y = firstOf(null, null);
  console.log(`${x === null ? "none" : x} ${y === null ? "none" : y}`);
  console.log(`${nameOf(null, new Person("fallback"))} ${nameOf(new Person("ada"), new Person("fallback"))}`);
  return 0;
};
