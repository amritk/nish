// A generic's instantiations prove their own accesses. `walk<Box>` stores a
// class pointer into `rs`, which rewrites no record, so it proves `r.xs[i]`;
// `walk<Rec>` stores a whole record into the array `r` is a view into, so it
// must not. One shared proof table let the first verdict drop the second's
// check. Run by tests/run.js: prints 15, then exits 1 with
// "index out of range: 1 >= 1" on stderr.
interface Rec {
  xs: i32[];
}

class Box {
  v: i32;
  constructor(v: i32) {
    this.v = v;
  }
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
  const bs: Box[] = [new Box(1)];
  console.log(`${walk(bs, new Box(2), new H({ xs: [4, 5, 6] }))}`);
  const rs: Rec[] = [{ xs: [1, 2, 3] }];
  const short: Rec = { xs: [7] };
  const h = new H(rs[0]);
  console.log(`${walk(rs, short, h)}`);
  return 0;
};
