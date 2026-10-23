// NL2558: a variant field read through a property path, which a tag test does not narrow.
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
class H {
  node: Shape;
  constructor(node: Shape) {
    this.node = node;
  }
}
const f = (h: H): i32 => {
  if (h.node.kind === Kind.Circle) {
    return h.node.r;
  }
  return 0;
};
export const main = (): void => {
  console.log(f(new H(pick(0))));
};
