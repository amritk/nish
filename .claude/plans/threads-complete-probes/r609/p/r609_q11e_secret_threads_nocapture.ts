import { parallelMapInto } from "nish/threads";
import { secret, expose, wipe } from "nish:secret";
const dbl = (x: i32): i32 => x * 2;
export const main = (): i32 => {
  const key = secret([toU8(1), toU8(2), toU8(3)]);
  const s = expose(key, (k: u8[]): i32 => toI32(k[0]));
  wipe(key);
  const out: i32[] = [0, 0];
  parallelMapInto([1, 2], out, dbl);
  console.log(`${s} ${out[1]}`);
  return 0;
};
