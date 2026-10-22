// The same, with the tag read through a field: `Kind.Tri` has no `case`,
// so `area` can end without a return (TS2366).
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
  switch (h.shape.kind) {
    case Kind.Circle:
      return 1;
    case Kind.Square:
      return 2;
  }
};
