// A variable assigned in an `else` arm keeps no narrowing from the test after the `if`.
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
  let s: Shape = pick(n);
  if (s.kind !== Kind.Circle) {
    return 0;
  } else {
    s = pick(n + 1);
  }
  return s.r;
};
export const main = (): void => {
  console.log(f(0));
};
