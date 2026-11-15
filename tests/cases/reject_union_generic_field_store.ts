// A variant stored into a generic instance's union field is refused as it is
// into any union field (NL2534): TypeScript narrows `b.value` to `Square`
// from there on, which this version does not track.
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

class Box<T> {
  value: T;
  constructor(value: T) {
    this.value = value;
  }
}

export const main = (): void => {
  const b = new Box<Shape>(pick(1));
  b.value = new Square();
  console.log(b.value.kind === Kind.Circle ? "circle" : "square");
};
