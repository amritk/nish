// `s.kind === k` with `k` narrowed to `Kind.Circle | Kind.Square` narrows `s`
// to `Circle | Square` in tsc, so after ruling out `Circle` it reads
// `s.side`. This version narrows `s` only on a test against one member, so
// the union still has `Tri` and only its tag: stricter than TypeScript.
enum Kind {
  Circle,
  Square,
  Tri,
}

class Circle {
  readonly kind: Kind.Circle = Kind.Circle;
  r: i32 = 1;
}

class Square {
  readonly kind: Kind.Square = Kind.Square;
  side: i32 = 2;
}

class Tri {
  readonly kind: Kind.Tri = Kind.Tri;
  base: i32 = 3;
}

type Shape = Circle | Square | Tri;

const pick = (n: i32): Shape => (n === 0 ? new Circle() : n === 1 ? new Square() : new Tri());


const side = (s: Shape, k: Kind): i32 => {
  if (k === Kind.Tri) {
    return 0;
  }
  if (s.kind === k) {
    if (s.kind === Kind.Circle) {
      return s.r;
    }
    return s.side;
  }
  return 1;
};

export const main = (): void => {
  console.log(side(pick(1), Kind.Square));
};
