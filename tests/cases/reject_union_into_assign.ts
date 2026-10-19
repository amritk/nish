// A value that is not a variant is not assigned to a union variable.
enum Kind {
  Circle,
  Square,
}

class Circle {
  readonly kind: Kind.Circle = Kind.Circle;
}

class Square {
  readonly kind: Kind.Square = Kind.Square;
}

class Blob {
  size: i32 = 1;
}

type Shape = Circle | Square;

const pick = (): Shape => new Circle();

export const main = (): void => {
  const b = new Blob();
  let s: Shape = pick();
  s = b;
  console.log(s.kind === Kind.Circle);
};
