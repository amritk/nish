// NL2354: an interface as the value of the global `Map`: its record would be
// copied into the table rather than shared.
interface Point {
  x: i32;
}

export const main = (): i32 => {
  new Map<string, Point>();
  return 0;
};
