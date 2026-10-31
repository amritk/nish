// A clause that the one above falls into is reached with either variant, so
// the tag test of its own label does not narrow `s` there: reading `side`
// is refused as it would be by TypeScript.
enum Kind {
  Circle,
  Square,
}

class Circle {
  readonly kind: Kind.Circle = Kind.Circle;
  r: i32;
  constructor(r: i32) {
    this.r = r;
  }
}

class Square {
  readonly kind: Kind.Square = Kind.Square;
  side: i32;
  constructor(side: i32) {
    this.side = side;
  }
}

type Shape = Circle | Square;

function size(s: Shape): i32 {
  let n: i32 = 0;
  switch (s.kind) {
    case Kind.Circle:
      n += 1;
    case Kind.Square:
      n += s.side;
      break;
  }
  return n;
}

export function test(): number {
  return size(new Square(3));
}
