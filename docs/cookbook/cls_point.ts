class Point {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  manhattan(): number {
    return this.x + this.y;
  }
}

const origin = (): number => {
  const p = new Point(3, 4);
  p.x = 0;
  return p.manhattan();
};
