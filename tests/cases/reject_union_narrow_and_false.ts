// Past `if (s.kind !== Kind.Circle && s.kind !== Kind.Square) return`, the false side of the `&&`,
// `s` is a Circle or a Square, so its tag cannot be `Kind.Tri`, as tsc's TS2367 says.
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
const f = (s: Shape): i32 => {
  if (s.kind !== Kind.Circle && s.kind !== Kind.Square) {
    return 2;
  }
  return s.kind === Kind.Tri ? 1 : 0;
};
export const main = (): void => {
  console.log(f(pick(0)));
};
