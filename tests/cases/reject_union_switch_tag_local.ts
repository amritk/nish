// Stricter than TypeScript: the tag copied into an enum local is an enum
// variable, and a `switch` on one is never complete, as for any enum. Switch
// on `s.kind` itself to end the function in the `switch`.
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
  const k: Kind = s.kind;
  switch (k) {
    case Kind.Circle:
      return 1;
    case Kind.Square:
      return 2;
    case Kind.Tri:
      return 3;
  }
};
