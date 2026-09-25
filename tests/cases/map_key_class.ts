// WP32 (docs/wp32-map.md §5.1): a class instance is a key by identity, as in
// JavaScript: its address is hashed with `fmix64`, and two objects with equal
// fields are two keys.
class Point {
  x: i32;
  y: i32;
  constructor(x: i32, y: i32) {
    this.x = x;
    this.y = y;
  }
}

export const main = (): i32 => {
  const a = new Point(1, 2);
  const b = new Point(1, 2);
  const m = new Map<Point, string>();
  m.set(a, "a");
  const same = m.has(a);
  const twin = m.has(b);
  m.set(b, "b");
  const gone = m.delete(a);
  console.log(`${same} ${twin} ${m.size} ${gone} ${m.has(a)} ${m.has(b)}`);
  return 0;
};
