import { parallelFrom } from "nish/threads";
import { Secret, secret, expose, wipe } from "nish:secret";
const firstByte = (k: u8[]): i32 => toI32(k[0]);
const g = <T>(tag: T[]): i32 => {
  const raw: u8[] = [toU8(1), toU8(2), toU8(3)];
  const key: Secret<u8[]> = secret(raw);
  const ys = parallelFrom(3, (i) => toI32(raw[i]) + toI32(tag.length));
  const s = expose(key, firstByte);
  wipe(key);
  return ys[2] + s;
};
export const main = (): i32 => {
  const a: f64[] = [1.0];
  const b: string[] = ["x"];
  console.log(`${g(a)} ${g(b)}`);
  return 0;
};
