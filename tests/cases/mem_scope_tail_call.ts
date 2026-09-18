// WP6: a function with an automatic arena scope releases *before* a tail call
// whose arguments are all scalars, which leaves the call as the last thing the
// function does. Read the golden for the order: `@nish_arena_release` above the
// `call @sum`, not between it and the `ret`.
//
// The depth here is small because every case in this directory is also run
// under Node (WP13), and what that order buys is past V8's stack by
// construction: `tests/link/tail_call_depth` is the same shape a million levels
// deep, which is a segfault without the sink and a loop with it.
const sum = (n: number, acc: number): number => {
  if (n === 0) return acc;
  const label = `item ${n}`; // the arena temporary the scope exists to release
  return sum(n - 1, acc + label.length);
};

export const main = (): number => {
  console.log(`${sum(1000, 0)}`);
  return 0;
};
