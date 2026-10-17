// A value that is not a variant is not passed for a union parameter.
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

const tagOf = (s: Shape): Kind => s.kind;

export const main = (): void => {
  const b = new Blob();
  console.log(tagOf(b) === Kind.Circle);
};
