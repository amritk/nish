// Every variant gives its tag the same name.
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

class Dot {
  readonly tag: Kind.Tri = Kind.Tri;
}

const take = (s: Circle | Dot): i32 => 0;
