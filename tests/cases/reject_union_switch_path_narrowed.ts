// Stricter than TypeScript: a test narrows a path's tag for the comparisons
// that follow, but a complete `switch` needs the tag as the union declares
// it. `h.shape` may be reassigned between the test and the `switch` by a
// call, which TypeScript does not see, so `Kind.Tri` could reach the end.
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

interface Tri {
  readonly kind: Kind.Tri;
  base: i32;
}

type Shape = Circle | Square | Tri;

class Holder {
  shape: Shape;
  constructor(shape: Shape) {
    this.shape = shape;
  }
}

const area = (h: Holder): i32 => {
  if (h.shape.kind === Kind.Tri) {
    return 0;
  }
  switch (h.shape.kind) {
    case Kind.Circle:
      return 1;
    case Kind.Square:
      return 2;
  }
};
