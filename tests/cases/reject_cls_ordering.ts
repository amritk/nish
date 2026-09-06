class Point {
  x: number = 0;
}

function test(): boolean {
  const a = new Point();
  const b = new Point();
  return a < b;
}
