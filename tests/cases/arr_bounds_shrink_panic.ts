// WP15 §2: the negative test for the proof itself. The loop condition proves
// `i < xs.length` on the way in, but `drain` pops through the same array, so
// the fact has to die at the call — and the access after it keeps its check
// and panics. Run by the WP4 block of tests/run.js: exit 1 with "index out of
// range: 1 >= 1" on stderr, after three lines on stdout.
//
// `pop`'s result is discarded rather than returned, because `tsc` types
// `Array.prototype.pop` as `T | undefined` and this compiler types it as `T`
// (the one documented divergence in the ambient declarations); a case that
// returned it would be a second one.
const drain = (ys: i32[]): i32 => {
  ys.pop();
  return ys.length;
};

export const main = (): number => {
  const xs = [1, 2, 3];
  let i = 0;
  while (i < xs.length) {
    console.log(drain(xs));
    console.log(xs[i]);
    i = i + 1;
  }
  return 0;
};
