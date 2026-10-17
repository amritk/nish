// A union is not a type argument: `Box<Shape>` is refused.
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

class Box<T> {
  value: T;
  constructor(value: T) {
    this.value = value;
  }
}

const open = (b: Box<Shape>): Kind => b.value.kind;
