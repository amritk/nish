import { parallelFrom } from "nish/threads";
import { secret, expose, wipe } from "nish:secret";
export const main = (): i32 => {
  const raw: u8[] = [toU8(1), toU8(2), toU8(3)];
  const key = secret(raw);
  const ys = parallelFrom(3, (i) => toI32(raw[i]));
  const s = expose(key, (k: u8[]): i32 => toI32(k[0]));
  wipe(key);
  console.log(`${ys[2]} ${s}`);
  return 0;
};
