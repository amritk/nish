// A variant's tag is `readonly`: `tsc` accepts a mutable one, and this
// version refuses it where the union is spelled.
enum Kind {
  Circle,
  Square,
}

class Circle {
  kind: Kind.Circle = Kind.Circle;
  r: i32 = 1;
}

interface Square {
  readonly kind: Kind.Square;
  side: i32;
}

type Shape = Circle | Square;

export const tagOf = (s: Shape): Kind => s.kind;
