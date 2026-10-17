// --emit-header refuses a class whose field holds a union, which the header
// would lay out as a bare pointer the host could not read.
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

class Sheet {
  first: Shape | null = null;
}

export const count = (s: Sheet): i32 => (s.first === null ? 0 : 1);
