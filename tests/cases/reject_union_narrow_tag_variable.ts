// `s.kind === k` with `k` holding `Kind.Circle | Kind.Square` narrows `s`
// to `Circle | Square` where they are equal, but where they differ `s` may
// still be any variant: `k` may be `Square` and `s` a `Circle`. So the false
// side reads `s.r` on the whole union, which TypeScript refuses as well.
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
    return 1;
  }
  return s.r;
};

export const main = (): void => {
  console.log(side(pick(1), Kind.Square));
};
