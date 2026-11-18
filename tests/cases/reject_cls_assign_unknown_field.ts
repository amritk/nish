class Point {
  x: number = 0;
}

export const test = (): number => {
  const p = new Point();
  p.z = 1;
  return p.x;
};
