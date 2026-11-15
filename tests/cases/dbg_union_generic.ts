// `-g` over a generic instance whose type argument is a union: the
// monomorphised class and its methods get debug records under the name the
// source writes (`Box<Circle | Square>`), and the union field is a pointer
// to the union, as a `Shape` parameter is.
enum Kind {
  Circle,
  Square,
}

class Circle {
  readonly kind: Kind.Circle = Kind.Circle;
  r: i32 = 2;
}

class Square {
  readonly kind: Kind.Square = Kind.Square;
  side: i32 = 3;
}

type Shape = Circle | Square;

class Box<T> {
  value: T;
  constructor(value: T) {
    this.value = value;
  }
  get(): T {
    return this.value;
  }
  put(value: T): void {
    this.value = value;
  }
}

const area = (s: Shape): i32 => (s.kind === Kind.Circle ? 3 * s.r * s.r : s.side * s.side);

export const main = (): void => {
  const b = new Box<Shape>(new Circle());
  console.log(area(b.get()));
  b.put(new Square());
  console.log(area(b.get()));
};
