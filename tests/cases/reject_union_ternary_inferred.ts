// Unannotated, a ternary over two variants is not given a union:
// the variable is annotated.
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

export const main = (): void => {
  const s = 1 > 0 ? new Circle() : new Square();
  console.log(s.kind === Kind.Circle);
};
