// Past an `else if` chain whose branches both return, `s` is the variant
// neither test named, a `Tri`, so it has no `r`, as TypeScript says.
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

const f = (s: Shape): i32 => {
  if (s.kind === Kind.Circle) {
    return 1;
  } else if (s.kind === Kind.Square) {
    return 2;
  }
  return s.r;
};

export const main = (): void => {
  console.log(f(pick(2)));
};
