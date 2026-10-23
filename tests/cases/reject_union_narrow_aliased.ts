// TypeScript narrows `s` through a condition stored in a `const`,
// `const round = s.kind === Kind.Circle; if (round) { s.r }`; this version
// narrows on the test itself only.
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
  const s = pick(1);
  const round = s.kind === Kind.Circle;
  if (round) {
    console.log(s.r);
  }
};
