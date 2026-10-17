// A smaller union stored where a larger one is declared narrows the
// variable in TypeScript, as one variant does, so it is refused.
enum Kind {
  Circle,
  Square,
  Tri,
}

class Circle {
  readonly kind: Kind.Circle = Kind.Circle;
}

class Square {
  readonly kind: Kind.Square = Kind.Square;
}

class Tri {
  readonly kind: Kind.Tri = Kind.Tri;
}

type Shape = Circle | Square | Tri;

const round = (): Circle | Square => new Square();

export const main = (): void => {
  const s: Shape = round();
  console.log(s.kind === Kind.Square);
};
