// NL2353: an interface as the key of the global `Map`: it is stored inline and
// has no identity to hash or compare.
interface Point {
  x: i32;
}

export const main = (): i32 => {
  new Map<Point, i32>();
  return 0;
};
