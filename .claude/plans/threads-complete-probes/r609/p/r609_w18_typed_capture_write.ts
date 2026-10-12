import { parallelFrom } from "nish/threads";
const poke = (t: Int32Array, i: i32): void => {
  t[0] = t[0] + i;
};
export const main = (): i32 => {
  const cap = new Int32Array(4);
  const ys = parallelFrom(3000000, (i): i32 => {
    poke(cap, 1);
    return i;
  });
  console.log(`${cap[0]} ${ys.length}`);
  return 0;
};
