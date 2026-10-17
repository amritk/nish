// `const k = s.kind` would be `Kind.Circle | Kind.Square` in TypeScript,
// a type Nish does not have, so it is annotated.
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
  const s: Shape = pick(1);
  const k = s.kind;
  console.log(k === Kind.Circle);
};
