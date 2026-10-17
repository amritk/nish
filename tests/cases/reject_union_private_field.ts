// A sidecar refuses a union field even in a class nothing exported reaches:
// the header lays out every class and interface of the compilation, so a
// private `Holder` would still be written with a field the host could not read.
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

class Holder {
  held: Shape | null = null;
}

const peek = (h: Holder): i32 => (h.held === null ? 0 : 1);

export function run(): i32 {
  return peek(new Holder());
}
