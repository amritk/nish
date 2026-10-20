// Only the then-arm falls through, and it assigns `s` a new shape, so after
// the `if` `s` is the whole union again, not the `Circle` the test proved:
// TypeScript refuses `s.r` there too.
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

const f = (n: i32): i32 => {
  let s: Shape = pick(n);
  if (s.kind === Kind.Circle) {
    s = pick(n + 1);
  } else {
    return 0;
  }
  return s.r;
};

export const main = (): void => {
  console.log(f(0));
};
