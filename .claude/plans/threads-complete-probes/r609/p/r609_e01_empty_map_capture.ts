import { parallelMap } from "nish/threads";
export const main = (): i32 => {
  const k: i32 = 3;
  const none: i32[] = [];
  const ys = parallelMap(none, (x) => x * k);
  const zs = parallelMap(new Int32Array(0), (x) => x + k);
  console.log(`${ys.length} ${zs.length}`);
  return 0;
};
