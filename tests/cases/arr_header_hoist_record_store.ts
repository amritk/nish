// #180: the header hoist (#104) and a whole-record store. An array of records
// keeps its elements inline (WP15 §2a), so `r` is a pointer into `rs`'s buffer
// and `rs[0] = short` rewrites `r.xs` with no `.xs =` anywhere. With `r` bound
// by `const` the hoist used to lift `r.xs`'s header above the loop, keep it
// across the store, and print "1 2 3" from the replaced array where `--plain`
// panics. `storedFields` now counts the store the way the bounds proof does
// (`storesRecord`). Run by tests/run.js: exit 1 with
// "index out of range: 1 >= 1" on stderr, after "1" on stdout.
//
// `arr_path_record_store` is the same program with `let r`, which the hoist
// leaves alone, so it tests the bounds proof on its own.
interface Rec {
  xs: i32[];
}

export const main = (): number => {
  const rs: Rec[] = [{ xs: [1, 2, 3] }];
  const short: Rec = { xs: [7] };
  const r = rs[0];
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
