// Writing the tag through a union is refused like any write through it: the
// tag is `readonly` on every variant, and a union is read-only besides.
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

const retag = (s: Circle | Square): void => {
  s.kind = Kind.Circle;
};

export function run(): i32 {
  retag(new Circle());
  return 0;
}
