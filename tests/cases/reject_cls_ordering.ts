class Point {
  x: number = 0;
}

export const test = (): boolean => {
  const a = new Point();
  const b = new Point();
  return a < b;
};
