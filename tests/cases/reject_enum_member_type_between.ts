// Two member types of one enum are two types: a value of `Kind.Array` is not
// a `Kind.Scalar`, and the refusal names the value's member type.
enum Kind {
  Scalar,
  Array,
}

class ArrayNode {
  readonly kind: Kind.Array = Kind.Array;
}

const scalarTag = (n: ArrayNode): Kind.Scalar => n.kind;

export const test = (): number => (scalarTag(new ArrayNode()) === Kind.Scalar ? 1 : 0);
