import { parallelMap } from "nish/threads";
const put = (m: Map<string, i32>, k: string, v: i32): void => {
  m.set(k, v);
};
export const main = (): i32 => {
  const cap = new Map<string, i32>();
  const xs = parallelMap(new Array<i32>(3000000), (x) => x);
  const ys = parallelMap(xs, (x): i32 => {
    put(cap, "a", (cap.get("a") ?? 0) + 1);
    return x;
  });
  console.log(`${cap.get("a") ?? -1} ${ys.length}`);
  return 0;
};
