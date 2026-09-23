// WP18 G6, the correctness trap: at `T = Point`, a `T` and a `Point` have one
// type, and only the one that came from `T` is refused. `sum` refuses `p.x`
// and accepts `q.x`; `mirror` is the same template with the parameters
// swapped, so it refuses `b.x` and accepts `a.x`. Two templates, two
// diagnostics — the `2 errors` in the `.err` is what says neither `Point`
// read was refused as well.
interface Point {
  x: i32;
  y: i32;
}

const sum = <T>(p: T, q: Point): i32 => {
  const fromQ = q.x;
  return p.x + fromQ;
};

const mirror = <T>(a: Point, b: T): i32 => {
  const fromA = a.x;
  return b.x + fromA;
};

export const test = (): number => {
  const p: Point = { x: 1, y: 2 };
  return sum(p, p) + mirror(p, p);
};
