// --emit-napi refuses an exported function that returns a nullable union.
enum Kind {
  Circle,
  Square,
}

class Circle {
  readonly kind: Kind.Circle = Kind.Circle;
  r: i32 = 1;
}

interface Square {
  readonly kind: Kind.Square;
  side: i32;
}

type Shape = Circle | Square;

export const pick = (n: i32): Shape | null => (n > 0 ? new Circle() : null);
