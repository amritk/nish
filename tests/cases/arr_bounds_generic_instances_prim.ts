// The primitive form of arr_bounds_generic_instances: `walk<i32>` stores an
// integer, which rewrites no record, and `walk<Rec>` stores a whole record
// under the view `r`. Each instantiation is judged against its own verdicts,
// so the `i32` proof does not drop `walk<Rec>`'s check. Run by tests/run.js:
// prints 15, then exits 1 with "index out of range: 1 >= 1" on stderr.
interface Rec {
  xs: i32[];
}

class H {
  r: Rec;
  constructor(r: Rec) {
    this.r = r;
  }
}

const walk = <T>(rs: T[], x: T, h: H): i32 => {
  let t = 0;
  let i = 0;
  const r = h.r;
  while (i < r.xs.length) {
    if (i === 1) {
      rs[0] = x;
    }
    t = t + r.xs[i];
    i = i + 1;
  }
  return t;
};

export const main = (): number => {
  const ints: i32[] = [0];
  console.log(`${walk(ints, 5, new H({ xs: [4, 5, 6] }))}`);
  const rs: Rec[] = [{ xs: [1, 2, 3] }];
  const short: Rec = { xs: [7] };
  const h = new H(rs[0]);
  console.log(`${walk(rs, short, h)}`);
  return 0;
};
