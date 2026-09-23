// The edge of `arr_header_hoist_record_class_root`: a path rooted at a class
// can still reach inline storage through a later link. `c.rec` was set to
// `rs[0]`, so `c.rec.xs` is read off a `Rec` inside `rs`, and `rs[0] = short`
// replaces it. Its header is not hoisted and its proof does not survive the
// store. Run by tests/run.js: exits 1 with "index out of range: 1 >= 1".
interface Rec {
  xs: i32[];
}

class C {
  rec: Rec;
  constructor(rec: Rec) {
    this.rec = rec;
  }
}

const sum = (c: C, rs: Rec[], short: Rec): i32 => {
  let t = 0;
  let i = 0;
  while (i < c.rec.xs.length) {
    if (i === 1) {
      rs[0] = short;
    }
    t = t + c.rec.xs[i];
    i = i + 1;
  }
  return t;
};

export const main = (): number => {
  const rs: Rec[] = [{ xs: [1, 2, 3] }];
  const c = new C(rs[0]);
  console.log(`${sum(c, rs, { xs: [7] })}`);
  return 0;
};
