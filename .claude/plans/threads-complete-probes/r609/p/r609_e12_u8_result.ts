import { parallelFrom } from "nish/threads";
export const main = (): i32 => {
  const k: u8 = toU8(3);
  const ys = parallelFrom(3000000, (i) => toU8(i % 200) + k);
  let s: i32 = 0;
  for (const y of ys) s = (s + toI32(y)) % 1000003;
  console.log(`${s}`);
  return 0;
};
