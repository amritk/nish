// #620 through `new`: a constructor is a call, so `new Reset(ps)`, whose body
// writes a field of an element of `ps`, is a write through `ps` like a helper
// call, and the later read of `p` sees it only in TypeScript.
interface Rec {
  v: i32;
}

class Reset {
  n: i32;
  constructor(xs: Rec[]) {
    xs[0].v = 5;
    this.n = xs.length;
  }
}

export const main = (): number => {
  const ps: Rec[] = [];
  const p: Rec = { v: 1 };
  ps.push(p);
  const r = new Reset(ps);
  console.log(p.v + r.n);
  return 0;
};
