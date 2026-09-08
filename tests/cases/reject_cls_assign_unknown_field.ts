class Point {
  x: number = 0;
}

export function test(): number {
  const p = new Point();
  p.z = 1;
  return p.x;
}
