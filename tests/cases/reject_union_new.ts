// A union is not a class: `new Shape()` names no constructor.
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
  const s = new Shape();
  console.log(s.kind === Kind.Circle);
};
