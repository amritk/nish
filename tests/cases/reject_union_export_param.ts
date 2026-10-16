// --emit-header refuses an exported function that takes a union: a union has
// no C spelling yet, and the header would leave it out.
enum Kind {
  Circle,
  Square,
}

class Circle {
  readonly kind: Kind.Circle = Kind.Circle;
  r: i32 = 1;
}

interface Square {
  readonly kind: Kind.Square;
  side: i32;
}

type Shape = Circle | Square;

export const tagOf = (s: Shape): Kind => s.kind;
