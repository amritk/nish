// The same through a method: `b.poison()` overwrites `b.k`.
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
}

const f = (b: Box, s: Shape): i32 => {
  b.k = s.kind;
  b.poison();
  switch (b.k) {
    case Kind.Circle:
      return 1;
    case Kind.Square:
      return 2;
  }
};
