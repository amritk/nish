// NL2514 on an assignment to a mutable field of the member type.
enum Kind {
  Scalar,
  Array,
}

class ArrayNode {
  kind: Kind.Array = Kind.Array;
}

export const test = (): number => {
  const n = new ArrayNode();
  n.kind = Kind.Scalar;
  return n.kind === Kind.Array ? 1 : 0;
};
