// An enum `const` captured by a data-parallel arrow holds there what it held
// where it was declared, so a member it is not never matches.
import { parallelMap } from "nish/threads";
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

const pick = (n: i32): Shape => {
  if (n % 3 === 0) {
    return new Circle(n);
  }
  if (n % 3 === 1) {
    return new Square(n);
  }
  const t: Tri = { kind: Kind.Tri, base: n };
  return t;
};
const f = (n: i32): i32 => {
  const k: Kind = Kind.Circle;
  const xs: i32[] = [1, 2, 3];
  return parallelMap(xs, (x) => (k === Kind.Tri ? x : 0))[2];
};
export const main = (): void => { console.log(f(3)); };
