// Member types in the containers and the debug build: a `Map` and a `Set`
// keyed by `Kind.Array`, a `Kind.Array[]` built with `push`, a zero-filled
// `new Array<Kind.Scalar>(n)` (0 is that member), an alias `type ArrayTag =
// Kind.Array`, a generic argument `Box<Kind.Array>`, and a plain `Kind` field
// initialised with a member. `Kind.List` shares `Kind.Array`'s value, so it is
// the same member type and enters a `Kind.Array[]`. Built with `-g`, every
// slot's debug type is the enum's. An arrow argument may declare a member
// return type, `(): Kind.Array => ...`, as a declared arrow may.
enum Kind {
  Scalar,
  Array,
  List = 1,
}

type ArrayTag = Kind.Array;

class Box<T> {
  value: T;
  constructor(value: T) {
    this.value = value;
  }
}

const call = (f: () => Kind.Array): Kind.Array => f();

class Node {
  readonly kind: Kind = Kind.Array;
}

export const test = (): number => {
  const counts = new Map<Kind.Array, i32>();
  counts.set(Kind.Array, 7);
  const seen = new Set<Kind.Array>();
  seen.add(Kind.Array);
  const tags: Kind.Array[] = [];
  tags.push(Kind.Array);
  tags.push(Kind.List);
  const zeros = new Array<Kind.Scalar>(2);
  const alias: ArrayTag = Kind.Array;
  const box = new Box<Kind.Array>(Kind.Array);
  const n = new Node();
  const called = call((): Kind.Array => Kind.Array);
  let total = 0;
  total = total + (counts.get(Kind.Array) ?? 0);
  total = total + (seen.has(Kind.Array) ? 10 : 0);
  total = total + tags.length * 100;
  total = total + (zeros[1] === Kind.Scalar ? 1000 : 0);
  total = total + (alias === Kind.Array ? 10000 : 0);
  total = total + (box.value === Kind.List ? 100000 : 0);
  total = total + (n.kind === Kind.Array ? 1000000 : 0);
  total = total + (called === Kind.Array ? 10000000 : 0);
  return total;
};
