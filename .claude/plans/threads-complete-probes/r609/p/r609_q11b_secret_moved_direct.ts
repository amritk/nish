import { secret, expose } from "nish:secret";
export const main = (): i32 => {
  const raw: u8[] = [toU8(1), toU8(2), toU8(3)];
  const key = secret(raw);
  const y = toI32(raw[2]);
  const s = expose(key, (k: u8[]): i32 => toI32(k[0]));
  console.log(`${y} ${s}`);
  return 0;
};
