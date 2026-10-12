import { parallelMapInto } from "nish/threads";
class S {
  tab: i32[];
  constructor() { this.tab = [3, 5, 7]; }
  run(xs: i32[]): i32 {
    const self = this;
    const d = new Array<i32>(xs.length);
    d.fill(1);
    this.tab = d;
    const n = xs.length;
    parallelMapInto(xs, d, (x) => self.tab[(x + 1) % n] + 1);
    let s: i32 = 0;
    for (const v of d) s = (s + v) % 1000003;
    return s;
  }
}
export const main = (): i32 => {
  const n: i32 = 3000000;
  const xs = new Array<i32>(n);
  for (let i: i32 = 0; i < n; i++) xs[i] = i;
  console.log(`${new S().run(xs)}`);
  return 0;
};
