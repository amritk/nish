// A union local narrowed before the `switch` is complete with the labels of
// the variants left to it: after `if (s.kind === Kind.Circle) return`, `s` is
// a `Square | Tri`, and two labels end the function.
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

const measure = (s: Shape): i32 => {
  if (s.kind === Kind.Circle) {
    return s.r;
  }
  switch (s.kind) {
    case Kind.Square:
      return s.side * 10;
    case Kind.Tri:
      return s.base * 100;
  }
};

export const main = (): void => {
  const shapes: Shape[] = [new Circle(), new Square(), new Tri()];
  console.log(`${measure(shapes[0])} ${measure(shapes[1])} ${measure(shapes[2])}`);
};
