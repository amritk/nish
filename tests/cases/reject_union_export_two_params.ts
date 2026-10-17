// --emit-header refuses an exported function with two union parameters once:
// the first union found is the one reported, and the walk stops there.
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

export const same = (a: Shape, b: Shape): boolean => a.kind === b.kind;
