// The same on `this`: `this.poison()` overwrites `this.k` inside the method
// that switches on it.
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

class Box {
  k: Kind = Kind.Circle;

  poison(): void {
    this.k = Kind.Tri;
  }

  f(s: Shape): i32 {
    this.k = s.kind;
    this.poison();
    switch (this.k) {
      case Kind.Circle:
        return 1;
      case Kind.Square:
        return 2;
    }
  }
}
