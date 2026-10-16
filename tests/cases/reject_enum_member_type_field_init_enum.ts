// A field initializer that is another enum's member: `Level.High` is no
// `Kind`, so it is not the member `Kind.Array` either.
enum Kind {
  Scalar,
  Array,
}

enum Level {
  Low,
  High,
}

class ArrayNode {
  readonly kind: Kind.Array = Level.High;
}

export const test = (): number => (new ArrayNode().kind === Kind.Array ? 1 : 0);
