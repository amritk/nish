// A complete `switch` on a union's tag terminates, so a statement after it
// is dead code, as after an `if` whose branches both return. `tsc` accepts
// it by default (TS7027 only under `allowUnreachableCode: false`).
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
    case Kind.Tri:
      return s.base;
  }
  return 7;
};
