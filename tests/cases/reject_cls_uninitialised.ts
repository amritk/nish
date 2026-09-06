class Point {
  x: number;
  y: number;
  constructor(x: number) {
    this.x = x;
    if (x > 0) {
      this.y = x;
    }
  }
}
