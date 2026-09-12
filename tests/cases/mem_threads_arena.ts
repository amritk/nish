// WP20 T0: `--threads` (in the `.args` beside this file) gives every thread its
// own arena, and the whole of that in the IR is the storage class of
// `@nish_arena` — the inlined bump allocator GEPs the same declaration either
// way. The golden pins that one line; the `.out` says that nothing a program
// can see moved with it, because no construct in the language starts a second
// thread, so this prints exactly what it prints without the flag.
//
// It deliberately does not call `Arena.used()`: the Node shim answers 0 for
// arena introspection, so a case that printed a byte count would be a
// differential known-failure and would prove less, not more.
class Point {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

// Returned, so the points are bumped from the arena rather than turned into
// entry-block allocas by the WP6 escape analysis; a stack-allocated case would
// never reach the allocator this case exists to look at.
const makePoints = (n: number): Point[] => {
  const xs: Point[] = [];
  for (let i = 0; i < n; i++) {
    xs.push(new Point(i, i * 2));
  }
  return xs;
};

export const main = (): number => {
  const xs = makePoints(4);
  console.log(xs[3].y);
  console.log(xs.length);
  return 0;
};
