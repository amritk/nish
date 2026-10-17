// NL2528: a variant field read through the union.
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

class Ball {
  readonly kind: Kind.Tri = Kind.Tri;
  r: i32 = 2;
}

const radius = (s: Circle | Ball): i32 => s.r;
