// arr_bounds_generic_instances through a generic interface: `Cell<string>`
// holds strings, so its element store writes a pointer, and `Cell<Rec>` holds
// records inline, so its store replaces the array under the view `r`. The two
// instantiations of `walk` are judged against their own verdicts. Run by
// tests/run.js: prints 15, then exits 1 with "index out of range: 1 >= 1".
interface Rec {
  xs: i32[];
}

interface Cell<T> {
  items: T[];
}

class H {
  r: Rec;
  constructor(r: Rec) {
    this.r = r;
  }
}

const walk = <T>(c: Cell<T>, x: T, h: H): i32 => {
  let t = 0;
  let i = 0;
  const r = h.r;
  while (i < r.xs.length) {
    if (i === 1) {
      c.items[0] = x;
    }
    t = t + r.xs[i];
    i = i + 1;
  }
  return t;
};

export const main = (): number => {
  const words: Cell<string> = { items: ["a"] };
  console.log(`${walk(words, "b", new H({ xs: [4, 5, 6] }))}`);
  const rs: Rec[] = [{ xs: [1, 2, 3] }];
  const recs: Cell<Rec> = { items: rs };
  const short: Rec = { xs: [7] };
  const h = new H(rs[0]);
  console.log(`${walk(recs, short, h)}`);
  return 0;
};
