import { parallelMap } from "nish/threads";
class In {
  v: i32 = 4;
}
class Cfg {
  inner: In | null = null;
}
export const main = (): i32 => {
  const c = new Cfg();
  c.inner = new In();
  if (c.inner !== null) {
    const ys = parallelMap([1, 2, 3], (x) => x * c.inner.v);
    console.log(`${ys[2]}`);
  }
  return 0;
};
