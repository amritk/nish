// NL2445 through a task's capture: `raw` was moved into a `Secret`, and the
// task reads it where it is spawned, as an argument would be read.
import { scope } from "nish/threads";
import { secret, wipe } from "nish:secret";

const sumOf = (xs: u8[]): i32 => {
  let t: i32 = 0;
  for (const x of xs) {
    t = t + toI32(x);
  }
  return t;
};

export const main = (): i32 => {
  const raw: u8[] = [1, 2, 3];
  const key = secret(raw);
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn((n: i32): i32 => sumOf(raw) + n, 1, out, 0);
  }
  wipe(key);
  return out[0];
};
