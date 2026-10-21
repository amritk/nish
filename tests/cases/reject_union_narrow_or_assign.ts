// The right side of a `||` that assigns `t` and tests it joins the variant it tested with the left
// side's: `t` is a Circle or a Square, never a Tri, as tsc's TS2367 says.
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

const f = (s: Shape, n: i32): i32 => {
  let t: Shape = s;
  if (t.kind === Kind.Circle || (t = pick(n)).kind === Kind.Square) {
    return t.kind === Kind.Tri ? 1 : 0;
  }
  return 2;
};

export const main = (): void => {
  console.log(f(pick(0), 1));
};
