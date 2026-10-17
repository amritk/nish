// A union is read-only, even where every variant has the field: write to the variant itself.
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
  x: i32 = 0;
}

type Shape = Circle | Square;

const pick = (n: i32): Shape => (n > 0 ? new Circle() : new Square());

class Spot {
  readonly kind: Kind.Tri = Kind.Tri;
  x: i32 = 0;
}

const reset = (s: Spot | Square): void => {
  s.x = 1;
};
