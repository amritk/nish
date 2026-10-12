// NL2445 through a capture: `raw` belongs to the `Secret` once `secret(raw)`
// has taken it, and a body that captures it reads it after the move.
import { parallelFrom } from "nish/threads";
import { expose, secret, wipe } from "nish:secret";

export const main = (): i32 => {
  const raw: u8[] = [toU8(1), toU8(2), toU8(3)];
  const key = secret(raw);
  const ys = parallelFrom(3, (i) => toI32(raw[i]));
  const s = expose(key, (k: u8[]): i32 => toI32(k[0]));
  wipe(key);
  return ys[2] + s;
};
