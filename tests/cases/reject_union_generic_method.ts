// A generic method's type parameter binds to a union no more than a
// function's does.
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

class Keeper {
  keep<T>(x: T): T {
    return x;
  }
}

const same = (k: Keeper, s: Shape): Shape => k.keep(s);
