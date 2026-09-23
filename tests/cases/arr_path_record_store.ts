// #106: a whole-record store rewrites a field no statement names. An array of
// records keeps its elements inline (WP15 §2a), so `r` is a pointer into
// `rs`'s buffer, and `rs[0] = short` copies a new record over the one `r`
// points at: `r.xs` changes with no `.xs =` anywhere and no call. Run by
// tests/run.js: exit 1 with "index out of range: 1 >= 1" on stderr, after "1"
// on stdout.
//
// `r` is a `let` so that the emitter's header hoist (#104) leaves the loop
// alone and the bounds proof is the only thing under test. Spelled `const`, the
// hoist once lifted `r.xs` above the loop because its store scan did not count
// a whole-record element store, and the loop read the replaced array (#180);
// `arr_header_hoist_record_store` is that program, and pins the fix.
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
