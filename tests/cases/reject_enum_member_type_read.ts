// A read of a member-typed slot is its enum wherever a value is computed
// with, and an enum is not an `i32`.
enum Kind {
  Scalar,
  Array,
}

class ArrayNode {
  readonly kind: Kind.Array = Kind.Array;
}

export const test = (): number => {
  const n: i32 = new ArrayNode().kind;
  return n;
};
