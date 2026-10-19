// A value that is not a variant does not enter a nullable union either.
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

export const main = (): void => {
  const b = new Blob();
  const s: Shape | null = b;
  console.log(s === null);
};
