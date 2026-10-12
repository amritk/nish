// A `Secret` is never captured (NL2504): it is read only inside `expose`.
import { parallelFrom } from "nish/threads";
import { secret, wipe } from "nish:secret";

export const main = (): i32 => {
  const raw: u8[] = [toU8(1), toU8(2), toU8(3)];
  const key = secret(raw);
  const ys = parallelFrom(3, (i): i32 => {
    const k = key;
    return i;
  });
  wipe(key);
  return ys[2];
};
