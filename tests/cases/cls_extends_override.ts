class Shape {
  x: number;

  constructor(x: number) {
    this.x = x;
  }

  area(): number {
    return 0;
  }

  // Static dispatch: `this` is a Shape here, so this is always Shape.area.
  report(): number {
    return this.area() * 10 + this.x;
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

  report(): number {
    return super.report() + this.area();
  }
}

function areaOf(s: Shape): number {
  return s.area();
}

export function main(): number {
  const sq = new Square(1, 3);
  console.log(sq.area());
  console.log(areaOf(sq));
  const s: Shape = sq;
  console.log(s.area());
  console.log(sq.report());
  console.log(s.report());
  return 0;
}
