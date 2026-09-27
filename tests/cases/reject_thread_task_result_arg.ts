// A task cannot be handed a `Result`, which is passed as its parts rather than
// as one value: hand it the value the `Result` holds.
import { scope } from "nish/threads";

const orZero = (r: Result<i32, i32>): i32 => r.unwrapOr(0);

export const main = (): i32 => {
  const out: i32[] = [0];
  const r: Result<i32, i32> = Ok(3);
  {
    using s = scope();
    s.spawn(orZero, r, out, 0);
  }
  return out[0];
};
