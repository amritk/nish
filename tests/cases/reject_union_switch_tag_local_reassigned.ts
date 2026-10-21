// Stricter than TypeScript: a tag copied into a `let` enum local stays an enum
// variable, so a reassignment on another path is not tracked as a narrowing,
// and a `switch` on it is never complete, even one naming every tag.
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

const area = (s: Shape, n: i32): i32 => {
  let k: Kind = s.kind;
  if (n > 0) {
    k = Kind.Tri;
  }
  switch (k) {
    case Kind.Circle:
      return 1;
    case Kind.Square:
      return 2;
    case Kind.Tri:
      return 3;
  }
};
