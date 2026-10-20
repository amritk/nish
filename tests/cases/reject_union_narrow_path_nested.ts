// A union's tag read through a field, `h.s.kind`, narrows in TypeScript.
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

class Holder {
  s: Shape;
  constructor(s: Shape) {
    this.s = s;
  }
}

const f = (h: Holder): i32 => {
  if (h.s.kind === Kind.Circle) {
    if (h.s.kind === Kind.Square) {
      return 2;
    }
    return 1;
  }
  return 0;
};

export const main = (): void => {
  console.log(f(new Holder(pick(1))));
};
