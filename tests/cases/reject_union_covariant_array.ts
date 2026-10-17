// A `Circle[]` is not a `Shape[]`: tsc accepts the covariant array, and
// this version refuses it, because a push through the wider type would
// put a `Square` into an array of circles.
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
  const cs: Circle[] = [new Circle()];
  const ss: Shape[] = cs;
  console.log(ss.length);
};
