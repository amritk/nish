// A union a generic call would infer from its variants is refused: the
// array literal's elements differ, and nothing names `Shape` (NL2172).
enum Kind {
  Circle,
  Square,
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

const first = <T>(xs: T[]): T => xs[0];

export const main = (): void => {
  console.log(first([new Square(), new Circle()]).kind === Kind.Circle ? "circle" : "square");
};
