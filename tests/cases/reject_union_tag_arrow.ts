// An arrow returning a tag would bind `T` to a union of member types.
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

const apply = <T>(f: (s: Shape) => T, s: Shape): T => f(s);

const pick = (n: i32): Shape => (n === 0 ? new Circle() : new Square());

export const main = (): void => {
  const k = apply((s: Shape) => s.kind, pick(0));
  console.log(k === Kind.Circle);
};
