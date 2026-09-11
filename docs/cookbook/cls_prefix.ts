interface Shape {
  x: number;
  y: number;
}

class Square implements Shape {
  x: number;
  y: number;
  side: number;

  constructor(x: number, y: number, side: number) {
    this.x = x;
    this.y = y;
    this.side = side;
  }

  area(): number {
    return this.side * this.side;
  }
}

function originDistance(s: Shape): number {
  return s.x + s.y;
}

function describe(sq: Square): number {
  return originDistance(sq) + sq.area();
}
