// --emit-header refuses an interface whose field is an array of a union.
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

interface Sheet {
  all: Shape[];
}

export const count = (s: Sheet): i32 => s.all.length;
