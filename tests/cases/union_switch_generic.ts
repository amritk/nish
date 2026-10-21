// A complete `switch` on a union's tag inside a generic function, checked once
// per instantiation, and inside an arrow lifted into a function-typed
// argument: each ends its function, and each IR default is `unreachable`.
enum Kind {
  Circle,
  Square,
  Tri,
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

interface Tri {
  readonly kind: Kind.Tri;
  base: i32;
}

type Shape = Circle | Square | Tri;

const pick = <T>(s: Shape, a: T, b: T): T => {
  switch (s.kind) {
    case Kind.Circle:
      return a;
    case Kind.Square:
      return b;
    case Kind.Tri:
      return a;
  }
};

const apply = (s: Shape, f: (s: Shape) => i32): i32 => f(s);

export const main = (): void => {
  const shapes: Shape[] = [new Circle(1), new Square(2), new Circle(3)];
  const n: i32 = apply(shapes[1], (s: Shape): i32 => {
    switch (s.kind) {
      case Kind.Circle:
        return 1;
      case Kind.Square:
        return 2;
      case Kind.Tri:
        return 3;
    }
  });
  console.log(pick(shapes[1], 10, 20) + pick(shapes[0], "x", "y").length + n);
};
