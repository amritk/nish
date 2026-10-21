// The same two fields deep: `o.b.k` is a plain enum field however it was
// assigned.
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

class Box {
  k: Kind = Kind.Circle;
}


class Outer {
  b: Box;
  constructor() {
    this.b = new Box();
  }
}

const poison = (b: Box): void => {
  b.k = Kind.Tri;
};

const f = (o: Outer, s: Shape): i32 => {
  o.b.k = s.kind;
  poison(o.b);
  switch (o.b.k) {
    case Kind.Circle:
      return 1;
    case Kind.Square:
      return 2;
  }
};
