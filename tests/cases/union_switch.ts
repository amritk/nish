// A `switch` on a union's tag that names every variant, with no `default`, is
// complete: a function may end in it, and its IR default is `unreachable`. The
// tag is read from a parameter, a field, an array element and a local narrowed
// by an earlier test; a complete switch whose clauses `break` falls through.
enum Kind {
  Circle,
  Square,
  Tri,
}

class Circle {
  readonly kind: Kind.Circle = Kind.Circle;
  r: i32;
  constructor(r: i32) {
    this.r = r;
  }
}

class Square {
  readonly kind: Kind.Square = Kind.Square;
  side: i32;
  constructor(side: i32) {
    this.side = side;
  }
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

const area = (s: Shape): i32 => {
  switch (s.kind) {
    case Kind.Circle:
      return s.r * s.r * 3;
    case Kind.Square:
      return s.side * s.side;
    case Kind.Tri:
      return s.base;
  }
};

const named = (h: Holder): string => {
  switch (h.shape.kind) {
    case Kind.Circle:
      return "circle";
    case Kind.Square:
    case Kind.Tri:
      return "polygon";
  }
};

const corners = (shapes: Shape[], i: i32): i32 => {
  switch (shapes[i].kind) {
    case Kind.Circle:
      return 0;
    case Kind.Square:
      return 4;
    case Kind.Tri:
      return 3;
  }
};

const rest = (s: Shape): i32 => {
  if (s.kind === Kind.Tri) {
    return 0;
  }
  switch (s.kind) {
    case Kind.Circle:
      return s.r;
    case Kind.Square:
      return s.side;
  }
};

const total = (shapes: Shape[]): i32 => {
  let sum = 0;
  for (const s of shapes) {
    switch (s.kind) {
      case Kind.Circle:
        sum += 1;
        break;
      case Kind.Square:
        sum += 10;
        break;
      case Kind.Tri:
        sum += 100;
        break;
    }
  }
  return sum;
};

export const main = (): void => {
  const t: Tri = { kind: Kind.Tri, base: 5 };
  const shapes: Shape[] = [new Circle(2), new Square(3), t];
  console.log(`${area(shapes[0])} ${area(shapes[1])} ${area(shapes[2])}`);
  console.log(`${named(new Holder(shapes[0]))} ${named(new Holder(t))}`);
  console.log(`${corners(shapes, 0)} ${corners(shapes, 1)} ${corners(shapes, 2)}`);
  console.log(`${rest(shapes[0])} ${rest(shapes[1])} ${rest(t)}`);
  console.log(`${total(shapes)}`);
};
