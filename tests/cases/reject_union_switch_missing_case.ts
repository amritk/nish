// One variant has no `case` and there is no `default`, so `Kind.Tri`
// falls past the switch and `area` ends without a return, which tsc
// --noImplicitReturns reports as TS2366.
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

const area = (s: Shape): i32 => {
  switch (s.kind) {
    case Kind.Circle:
      return s.r;
    case Kind.Square:
      return s.side;
  }
};
