// WP15 §2a: an array of records is one contiguous block, so `ps[i]` is an
// interior `getelementptr` and a field read is one more, with no pointer to
// chase in between. The golden pins the stride (8 = sizeof(Point)) and the
// absence of a load between the two GEPs.
interface Point {
  x: number;
  y: number;
}

export const test = (): number => {
  const ps: Point[] = [
    { x: 1, y: 2 },
    { x: 3, y: 4 },
  ];
  ps[1].x = 10;
  let sum = 0;
  for (const p of ps) {
    sum = sum + p.x + p.y;
  }
  return sum;
};
