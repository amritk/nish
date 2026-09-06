class Shape {
  x: number;

  constructor(x: number) {
    this.x = x;
  }

  area(): number {
    return 0;
  }
}

class Square extends Shape {
  side: number;

  constructor(x: number, side: number) {
    super(x);
    this.side = side;
  }

  area(): number {
    return this.side * this.side;
  }

  baseArea(): number {
    return super.area();
  }
}

// Static dispatch: `s` is declared a Shape, so this is always Shape.area.
function areaOf(s: Shape): number {
  return s.area() + s.x;
}

function squareArea(sq: Square): number {
  return sq.area() + areaOf(sq) + sq.baseArea();
}
