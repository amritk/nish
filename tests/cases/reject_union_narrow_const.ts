// TypeScript narrows `s` to `Circle` from its initialiser, which this
// version does not track, so the declaration is refused.
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
  const s: Shape = new Circle();
  console.log(s.kind === Kind.Circle);
};
