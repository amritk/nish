// A union's tag read through a literal index, `xs[0].kind`, narrows in
// TypeScript.
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

type Shape = Circle | Square;

const pick = (n: i32): Shape => (n > 0 ? new Circle() : new Square());

const f = (xs: Shape[]): i32 => {
  if (xs[0].kind === Kind.Circle) {
    if (xs[0].kind === Kind.Square) {
      return 2;
    }
    return 1;
  }
  return 0;
};

export const main = (): void => {
  console.log(f([pick(1)]));
};
