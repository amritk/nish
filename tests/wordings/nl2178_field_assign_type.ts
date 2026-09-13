// NL2178: assigning the wrong type to a field names both types, where the
// nearer rules (readonly, `length`, a receiver that is not a struct) do not
// apply and the general sentence is the one that fires.
class Point {
  x: i32 = 0;
}

export const main = (): i32 => {
  const p = new Point();
  p.x = "one";
  return p.x;
};
