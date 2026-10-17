// A method is a member, and is called on the variant.
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
  size(): i32 {
    return 1;
  }
}

const size = (s: Ball | Square): i32 => s.size();
