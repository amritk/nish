// NL2524: variants whose tags come from two enums.
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

enum Other {
  Dot,
}

class Dot {
  readonly kind: Other.Dot = Other.Dot;
}

const take = (s: Circle | Dot): i32 => 0;
