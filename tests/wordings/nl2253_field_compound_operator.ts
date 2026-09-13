// NL2253: A compound assignment to a field takes the five arithmetic operators, and names one that is not.
class Point {
  x: i32 = 0;
}

export const main = (): i32 => {
  const p = new Point();
  p.x **= 2;
  return p.x;
};
