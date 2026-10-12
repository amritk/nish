// `a ?? d` on a `T | null`: `null` is nullish, so the default runs exactly
// where `a` is `null`, as it does under Node, and the result is `T`, as `tsc`
// types it. A default that cannot have an effect (a literal or a local) is one
// `select`; a `new` or a call is a branch to `nullish.default` and a `phi`, so
// it runs only where it is needed.
class Node {
  value: i32;
  constructor(value: i32) {
    this.value = value;
  }
}

class Count {
  made: i32 = 0;
}

const make = (count: Count, value: i32): Node => {
  count.made = count.made + 1;
  return new Node(value);
};

const orFallback = (n: Node | null, fallback: Node): Node => n ?? fallback;

const orMade = (n: Node | null, count: Count): Node => n ?? make(count, -2);

const nameOr = (name: string | null): string => name ?? "anonymous";

export const main = (): i32 => {
  const one = new Node(1);
  const fallback = new Node(-1);
  console.log(`${orFallback(one, fallback).value} ${orFallback(null, fallback).value}`);
  const count = new Count();
  console.log(`${orMade(one, count).value} ${count.made}`);
  console.log(`${orMade(null, count).value} ${count.made}`);
  console.log(`${nameOr("ada")} ${nameOr(null)}`);
  return 0;
};
