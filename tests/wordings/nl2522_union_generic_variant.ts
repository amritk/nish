// NL2522: a generic class instance named as a union variant.
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

class Ring<T> {
  readonly kind: Kind.Tri = Kind.Tri;
  item: T;
  constructor(item: T) {
    this.item = item;
  }
}

type IntRing = Ring<i32>;

const take = (s: Circle | IntRing): Kind => s.kind;
