// A discriminated union, `Circle | Square | Tri`: tagged classes and an
// interface whose first field is a member of one enum. A union is stored,
// passed, returned, held in an array, a field and a nullable slot, and read
// for its tag, which is the one member it has. In IR it is
// `%union.tagged*`: a variant converts by `bitcast`, and the tag is the
// `i32` at field 0 of every variant.
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

const pick = (n: i32): Shape => {
  if (n % 3 === 0) {
    return new Circle(n);
  }
  if (n % 3 === 1) {
    return new Square(n);
  }
  const t: Tri = { kind: Kind.Tri, base: n };
  return t;
};

const label = (s: Shape): string => {
  if (s.kind === Kind.Circle) {
    return "circle";
  }
  if (s.kind === Kind.Square) {
    return "square";
  }
  return "tri";
};

const weight = (s: Shape): i32 => {
  switch (s.kind) {
    case Kind.Circle:
      return 1;
    case Kind.Square:
      return 10;
    default:
      return 100;
  }
};

class Holder {
  shape: Shape;
  constructor(shape: Shape) {
    this.shape = shape;
  }
  swap(next: Shape): Shape {
    const old: Shape = this.shape;
    this.shape = next;
    return old;
  }
}

const first = (m: Shape | null, n: i32): Shape => m ?? pick(n);

export const main = (): void => {
  const shapes: Shape[] = [new Circle(3), new Square(4), pick(2)];
  shapes.push(pick(6));
  let total = 0;
  for (const s of shapes) {
    total = total + weight(s);
  }
  console.log(total);
  const h = new Holder(shapes[1]);
  const old = h.swap(total > 100 ? shapes[2] : shapes[0]);
  console.log(`${label(old)} ${label(h.shape)}`);
  let s: Shape = pick(4);
  s = first(null, 5);
  console.log(label(s));
  console.log(label(first(shapes[0], 0)));
  console.log(s.kind === shapes[2].kind);
  const k: Kind = s.kind;
  console.log(k === Kind.Tri);
};
