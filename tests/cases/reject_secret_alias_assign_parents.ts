// An assignment used as a value is a second name wherever its value goes: an
// array literal's element, a record literal's field, a ternary arm, a `??` arm
// and the argument of `Ok` each keep the array `raw` was given.
import { Secret, secret, wipe } from "nish:secret";
interface Box {
  buf: u8[];
}
const none = (): u8[] | null => null;
const element = (): i32 => {
  let raw: u8[] = [9];
  const rows: u8[][] = [(raw = [1, 2, 3])];
  const key: Secret<u8[]> = secret(raw);
  wipe(key);
  return toI32(rows[0][0]);
};
const field = (): i32 => {
  let raw: u8[] = [9];
  const b: Box = { buf: (raw = [1, 2, 3]) };
  const key: Secret<u8[]> = secret(raw);
  wipe(key);
  return toI32(b.buf[0]);
};
const arm = (c: boolean): i32 => {
  let raw: u8[] = [9];
  const alias: u8[] = c ? (raw = [1, 2, 3]) : [0];
  const key: Secret<u8[]> = secret(raw);
  wipe(key);
  return toI32(alias[0]);
};
const nullish = (): i32 => {
  let raw: u8[] = [9];
  const m: u8[] | null = none();
  const alias: u8[] = m ?? (raw = [1, 2, 3]);
  const key: Secret<u8[]> = secret(raw);
  wipe(key);
  return toI32(alias[0]);
};
const wrapped = (): i32 => {
  let raw: u8[] = [9];
  const r: Result<u8[], string> = Ok((raw = [1, 2, 3]));
  const key: Secret<u8[]> = secret(raw);
  wipe(key);
  return r.ok ? toI32(r.value[0]) : 0;
};
export const main = (): i32 => element() + field() + arm(true) + nullish() + wrapped();
