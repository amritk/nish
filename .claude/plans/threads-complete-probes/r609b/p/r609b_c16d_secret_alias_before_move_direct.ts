import { Secret, secret, expose, wipe } from "nish:secret";
const firstByte = (k: u8[]): i32 => toI32(k[0]);
export const main = (): i32 => {
  const raw: u8[] = [toU8(1), toU8(2), toU8(3)];
  const alias = raw;
  const key: Secret<u8[]> = secret(raw);
  const y = toI32(alias[2]);
  const s = expose(key, firstByte);
  wipe(key);
  console.log(`${y} ${s}`);
  return 0;
};
