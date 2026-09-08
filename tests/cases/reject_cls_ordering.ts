class Point {
  x: number = 0;
}

export function test(): boolean {
  const a = new Point();
  const b = new Point();
  return a < b;
}
