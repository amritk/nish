// A generic function or method binds its type parameter to a union, and a
// variant passed where that parameter is already bound enters the union there:
// `fill(xs, new Square(2))` once `xs` has bound `T` to `Shape`.
enum Kind {
  Circle,
  Square,
}

class Circle {
  readonly kind: Kind.Circle = Kind.Circle;
  r: i32;
  constructor(r: i32) {
    this.r = r;
  }
}

class Square {
  readonly kind: Kind.Square = Kind.Square;
  side: i32;
  constructor(side: i32) {
    this.side = side;
  }
}

type Shape = Circle | Square;

const area = (s: Shape): i32 => {
  switch (s.kind) {
    case Kind.Circle:
      return 3 * s.r * s.r;
    case Kind.Square:
      return s.side * s.side;
  }
};

const pick = (n: i32): Shape => (n > 0 ? new Circle(n) : new Square(-n));

const identity = <T>(value: T): T => value;

const first = <T>(xs: T[]): T => xs[0];

const fill = <T>(xs: T[], value: T): i32 => {
  xs.push(value);
  return xs.length;
};

class Keeper {
  keep<T>(value: T): T {
    return value;
  }
}

export const main = (): void => {
  const s: Shape = pick(4);
  console.log(area(identity(s)));
  console.log(area(identity(new Circle(1))));

  const xs: Shape[] = [new Circle(1), new Square(2)];
  console.log(area(first(xs)));
  console.log(fill(xs, new Square(2)));
  console.log(area(xs[2]));

  const k = new Keeper();
  console.log(area(k.keep(pick(-3))));
  console.log(identity(s) === s ? "same" : "different");
};
