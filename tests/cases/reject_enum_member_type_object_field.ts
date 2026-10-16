// NL2519 on an object literal: the interface field is a `Kind.Array`.
enum Kind {
  Scalar,
  Array,
}

interface ArrayNode {
  readonly kind: Kind.Array;
  items: i32;
}

export const test = (): number => {
  const n: ArrayNode = { kind: Kind.Scalar, items: 3 };
  return n.items;
};
