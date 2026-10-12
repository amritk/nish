import { Secret, secret, expose, wipe } from "nish:secret";
const firstByte = (k: u8[]): i32 => toI32(k[0]);
const f = (): i32 => {
  const raw: u8[] = [toU8(1), toU8(2), toU8(3)];
  let r: i32 = 0;
  for (let k: i32 = 0; k < 2; k++) {
    r = r + toI32(raw[2]);
    if (k === 0) {
      const key: Secret<u8[]> = secret(raw);
      r = r + expose(key, firstByte);
      wipe(key);
    }
  }
  return r;
};
export const main = (): i32 => { console.log(`${f()}`); return 0; };
