// A chain evaluates as Node does: its receiver once, each link in order, and
// nothing after a `null` link, an argument included, before the default.
// Interfaces, strings, arrays, a method that answers a nullable, and a
// parenthesised `??` as the receiver.
interface Named {
  name: string;
}

class Node {
  value: i32;
  next: Node | null = null;
  constructor(value: i32) {
    this.value = value;
  }
  after(): Node | null {
    return this.next;
  }
}

class Count {
  calls: i32 = 0;
}

const make = (count: Count, v: i32): Node | null => {
  count.calls = count.calls + 1;
  return v > 0 ? new Node(v) : null;
};

const tick = (count: Count): i32 => {
  count.calls = count.calls + 100;
  return 1;
};

const nothing = (): Node | null => null;

const nameOf = (n: Named | null): string => n?.name ?? "anon";

const lengthOf = (s: string | null): number => s?.length ?? -1;

const sizeOf = (xs: number[] | null): number => xs?.length ?? -1;

const secondNext = (n: Node | null): i32 => n?.after()?.after()?.value ?? 0;

const either = (a: Node | null, b: Node | null): i32 => (a ?? b)?.value ?? -1;

export const main = (): i32 => {
  const count = new Count();
  // The receiver is a call, evaluated once whatever the chain does.
  console.log(`${make(count, 5)?.value ?? 0} ${make(count, 0)?.value ?? 0} ${count.calls}`);
  // An argument of a link after a `null` receiver is never evaluated.
  const none = nothing();
  const some = make(count, 3);
  const skipped = none?.next?.value ?? tick(count);
  console.log(`${skipped} ${count.calls}`);
  console.log(`${nameOf(null)} ${nameOf({ name: "ada" })} ${lengthOf(null)} ${lengthOf("four")} ${sizeOf(null)} ${sizeOf([1, 2])}`);
  const a = new Node(1);
  const b = new Node(2);
  a.next = b;
  b.next = new Node(3);
  console.log(`${secondNext(a)} ${secondNext(b)} ${secondNext(null)} ${either(null, some)} ${either(null, null)}`);
  return 0;
};
