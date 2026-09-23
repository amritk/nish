// arr_bounds_generic_instances through a generic class method: `Store<Box>`
// and `Store<Rec>` share the template's tree, and each is judged against its
// own verdicts, so `Store<Box>`'s proof of `r.xs[i]` does not drop the check in
// `Store<Rec>`, whose whole-record store replaces the array under `r`. Run by
// tests/run.js: prints 15, then exits 1 with "index out of range: 1 >= 1".
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

class Store<T> {
  rs: T[];
  constructor(rs: T[]) {
    this.rs = rs;
  }
  walk(x: T, h: H): i32 {
    let t = 0;
    let i = 0;
    const r = h.r;
    while (i < r.xs.length) {
      if (i === 1) {
        this.rs[0] = x;
      }
      t = t + r.xs[i];
      i = i + 1;
    }
    return t;
  }
}

export const main = (): number => {
  const boxes = new Store<Box>([new Box(1)]);
  console.log(`${boxes.walk(new Box(2), new H({ xs: [4, 5, 6] }))}`);
  const rs: Rec[] = [{ xs: [1, 2, 3] }];
  const recs = new Store<Rec>(rs);
  const short: Rec = { xs: [7] };
  const h = new H(rs[0]);
  console.log(`${recs.walk(short, h)}`);
  return 0;
};
