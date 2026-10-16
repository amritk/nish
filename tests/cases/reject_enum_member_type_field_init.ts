// A field initializer may be an enum member's constant, and on a field of a
// member type it is held to the same rule as any other slot of that type.
enum Kind {
  Scalar,
  Array,
}

class ArrayNode {
  readonly kind: Kind.Array = Kind.Scalar;
}

export const test = (): number => (new ArrayNode().kind === Kind.Array ? 1 : 0);
