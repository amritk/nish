// `const k: Kind = s.kind` is an enum variable like any other: the `else` of
// `k === Kind.Circle` leaves it `Kind.Square | Kind.Tri`, so testing it
// against `Kind.Circle` again is always false, as tsc's TS2367 says.
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

class Tri {
  readonly kind: Kind.Tri = Kind.Tri;
  base: i32 = 3;
}

type Shape = Circle | Square | Tri;

const pick = (n: i32): Shape => (n === 0 ? new Circle() : n === 1 ? new Square() : new Tri());

export const main = (): void => {
  const s: Shape = pick(1);
  const k: Kind = s.kind;
  if (k === Kind.Circle) {
    console.log(0);
  } else {
    console.log(k === Kind.Circle ? 1 : 2);
  }
};
