// The same through an element: `poison(bs[0])` overwrites the field the
// switch reads.
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

const poison = (b: Box): void => {
  b.k = Kind.Tri;
};

const f = (bs: Box[], s: Shape): i32 => {
  bs[0].k = s.kind;
  poison(bs[0]);
  switch (bs[0].k) {
    case Kind.Circle:
      return 1;
    case Kind.Square:
      return 2;
  }
};
