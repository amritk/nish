// A field initializer naming a member the enum does not declare.
enum Kind {
  Scalar,
  Array,
}

class Node {
  readonly kind: Kind = Kind.Missing;
}

export const test = (): number => (new Node().kind === Kind.Array ? 1 : 0);
