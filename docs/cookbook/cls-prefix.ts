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

const originDistance = (s: Shape): number => s.x + s.y;

const describe = (sq: Square): number => originDistance(sq) + sq.area();
