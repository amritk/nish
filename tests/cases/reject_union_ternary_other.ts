// A ternary arm that is not a variant does not enter the union.
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

class Other {
  readonly kind: Kind.Tri = Kind.Tri;
}

export const main = (): void => {
  const s: Shape = 1 > 0 ? pick(1) : new Other();
  console.log(s.kind === Kind.Circle);
};
