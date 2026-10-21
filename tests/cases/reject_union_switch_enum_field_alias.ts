// The same through an alias: `a` and `b` are one box, and `a.k = Kind.Tri`
// moves `b.k` out of the union's tags.
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


const f = (b: Box, s: Shape): i32 => {
  const a = b;
  b.k = s.kind;
  a.k = Kind.Tri;
  switch (b.k) {
    case Kind.Circle:
      return 1;
    case Kind.Square:
      return 2;
  }
};
