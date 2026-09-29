// NL2395 for `fill`: a record element is a struct stored whole, and one value
// repeated into every slot would be a byte pattern the language never spells.
interface Point {
  x: i32;
  y: i32;
}

export const main = (): i32 => {
  const ps: Point[] = [{ x: 1, y: 2 }];
  ps.fill({ x: 0, y: 0 });
  return 0;
};
