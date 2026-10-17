// An unannotated ternary over two tags would infer a union of member types.
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

const pick = (n: i32): Shape => (n === 0 ? new Circle() : new Square());

export const main = (): void => {
  const a: Shape = pick(0);
  const b: Shape = pick(1);
  const c = a.kind === Kind.Circle;
  const k = c ? a.kind : b.kind;
  console.log(k === Kind.Circle);
};
