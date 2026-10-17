// A value that is not a variant is not stored into a union array element.
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
  const shapes: Shape[] = [new Circle()];
  shapes[0] = b;
  console.log(shapes.length);
};
