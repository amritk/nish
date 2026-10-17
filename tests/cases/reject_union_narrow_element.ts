// An element write narrows a literal index, `xs[0]`, in TypeScript.
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
  const shapes: Shape[] = [pick(0)];
  shapes[0] = new Circle();
  console.log(shapes[0].kind === Kind.Circle);
};
