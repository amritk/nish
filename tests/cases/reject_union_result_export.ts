// A `Result` over a union crosses no C boundary either.
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

export const measure = (n: i32): Result<Shape, string> => (n === 0 ? Err("zero") : Ok(pick(n)));
