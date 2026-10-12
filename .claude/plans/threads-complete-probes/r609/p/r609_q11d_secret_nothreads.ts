import { secret, expose, wipe } from "nish:secret";
export const main = (): i32 => {
  const key = secret([toU8(1), toU8(2), toU8(3)]);
  const s = expose(key, (k: u8[]): i32 => toI32(k[0]));
  wipe(key);
  console.log(`${s}`);
  return 0;
};
