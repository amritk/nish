// `nish/map`'s generic helpers take a `Map` whose value is a union, and a
// variant passed for the value enters it.
import { getOrInsert, reserve } from "nish/map";

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

export const main = (): void => {
  const m = new Map<string, Shape>();
  reserve(m, 4);
  console.log(area(getOrInsert(m, "a", new Circle(2))));
  console.log(area(getOrInsert(m, "a", new Square(5))));
  console.log(area(getOrInsert(m, "b", new Square(5))));
  console.log(m.size);
};
