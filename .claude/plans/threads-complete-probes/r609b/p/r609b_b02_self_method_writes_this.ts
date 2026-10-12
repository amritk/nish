import { parallelMap } from "nish/threads";
class S {
  hits: i32 = 0;
  bump(x: i32): i32 { this.hits = this.hits + 1; return x + this.hits; }
  run(xs: i32[]): i32 {
    const self = this;
    const ys = parallelMap(xs, (x) => self.bump(x));
    return ys[ys.length - 1] + this.hits;
  }
}
export const main = (): i32 => {
  const n: i32 = 3000000;
  const xs = new Array<i32>(n);
  for (let i: i32 = 0; i < n; i++) xs[i] = i;
  console.log(`${new S().run(xs)}`);
  return 0;
};
