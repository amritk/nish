// WP15 §8: an allocation assigned over an allocation. The local was declared
// holding one, so the value it held is unreachable after the assignment and
// nothing frees it — and because assigning a local is what takes WP6's proof
// away, the function loses its arena scope and *both* allocations live until
// the program exits.
class Point {
  x: i32;
  constructor(x: i32) {
    this.x = x;
  }
}

export function test(): number {
  let p = new Point(1);
  p = new Point(2);
  let xs = [1, 2];
  xs = [3, 4];
  // Outside any loop, so the quadratic-string rule says nothing and this one
  // is the only warning on the line.
  let s = "a" + "b";
  s = s + "c";
  return p.x + xs[0] + s.length;
}
