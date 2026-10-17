// A constructor's union parameter takes a variant or the union.
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

class Other {
  readonly kind: Kind.Tri = Kind.Tri;
}

class Holder {
  shape: Shape;
  constructor(shape: Shape) {
    this.shape = shape;
  }
}

const go = (): Holder => new Holder(new Other());
