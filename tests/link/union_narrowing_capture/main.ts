// A union `const` narrowed by a test of its tag keeps its narrowing inside a
// data-parallel arrow that captures it, because the arrow runs during the call,
// while the test still holds; so does what an enum `const` holds.
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

const scaled = (n: i32): i32 => {
  const s: Shape = pick(n);
  const xs: i32[] = [1, 2, 3];
  if (s.kind === Kind.Circle) {
    return parallelMap(xs, (x) => x * s.r)[1];
  }
  if (s.kind === Kind.Square) {
    return parallelMap(xs, (x) => x + s.side)[2];
  }
  return 0;
};

const held = (n: i32): i32 => {
  const k: Kind = pick(n).kind;
  const xs: i32[] = [4, 5, 6];
  return parallelMap(xs, (x) => (k === Kind.Tri ? x : 0))[2];
};

export const main = (): void => {
  console.log(`${scaled(3)} ${scaled(4)} ${scaled(5)}`);
  console.log(`${held(2)} ${held(3)}`);
};
