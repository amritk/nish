// An object literal has no one variant to build when the want is a
// union, so it is annotated as the interface it builds.
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

type Shape = Circle | Square;

const pick = (n: i32): Shape => (n > 0 ? new Circle() : new Square());

interface Tri {
  readonly kind: Kind.Tri;
  base: i32;
}

const area = (s: Circle | Tri): Kind => s.kind;

const go = (): Kind => area({ kind: Kind.Tri, base: 2 });
