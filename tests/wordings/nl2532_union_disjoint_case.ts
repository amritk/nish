// NL2532: a case label no variant has.
enum Kind {
  Circle,
  Square,
  Tri,
}

class Circle {
  readonly kind: Kind.Circle = Kind.Circle;
  r: i32 = 1;
}

class Square {
  readonly kind: Kind.Square = Kind.Square;
  side: i32 = 2;
}

type Shape = Circle | Square;

const pick = (n: i32): Shape => (n > 0 ? new Circle() : new Square());

const weight = (s: Shape): i32 => {
  switch (s.kind) {
    case Kind.Circle:
      return 1;
    case Kind.Tri:
      return 3;
    default:
      return 2;
  }
};
