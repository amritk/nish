import { parallelFrom } from "nish/threads";
import { Secret, secret, expose, wipe } from "nish:secret";
const firstByte = (k: u8[]): i32 => toI32(k[0]);
const f = (b: boolean): i32 => {
  const raw: u8[] = [toU8(1), toU8(2), toU8(3)];
  let r: i32 = 0;
  if (b) {
    const key: Secret<u8[]> = secret(raw);
    r = expose(key, firstByte);
    wipe(key);
  }
  const ys = parallelFrom(3, (i) => toI32(raw[i]));
  return r + ys[2];
};
export const main = (): i32 => { console.log(`${f(true)}`); return 0; };
