// #106: a whole-record store rewrites a field no statement names. An array of
// records keeps its elements inline (WP15 §2a), so `r` is a pointer into
// `rs`'s buffer, and `rs[0] = short` copies a new record over the one `r`
// points at: `r.xs` changes with no `.xs =` anywhere and no call. Run by
// tests/run.js: exit 1 with "index out of range: 1 >= 1" on stderr, after "1"
// on stdout.
//
// `r` is a `let` so that the emitter's header hoist (#104) leaves the loop
// alone and the bounds proof is the only thing under test. Spelled `const`, the
// hoist lifts `r.xs` above the loop because its store scan does not count a
// whole-record element store either, and the loop reads the replaced array --
// prints "1 2 3" where `--plain` panics. That is the hoist's to fix, not this
// file's.
interface Rec {
  xs: i32[];
}

export const main = (): number => {
  const rs: Rec[] = [{ xs: [1, 2, 3] }];
  const short: Rec = { xs: [7] };
  let r = rs[0];
  let i = 0;
  while (i < r.xs.length) {
    if (i === 1) {
      rs[0] = short;
    }
    const x = r.xs[i];
    console.log(`${x}`);
    i = i + 1;
  }
  return 0;
};
