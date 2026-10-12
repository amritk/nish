import { parallelMapInto } from "nish/threads";
class S {
  out: i32[];
  n: i32;
  constructor(n: i32) { this.n = n; this.out = new Array<i32>(n); this.out.fill(1); }
  run(xs: i32[]): i32 {
    const self = this;
    const o = self.out;
    const n = this.n;
    parallelMapInto(xs, o, (x) => self.n + o[(x + 1) % n]);
    let s: i32 = 0;
    for (const v of this.out) s = (s + v) % 1000003;
    return s;
  }
}
export const main = (): i32 => {
  const n: i32 = 3000000;
  const xs = new Array<i32>(n);
  for (let i: i32 = 0; i < n; i++) xs[i] = i;
  console.log(`${new S(n).run(xs)}`);
  return 0;
};
