// An arrow given to `parallelReduce` reads the local it captures where the call runs it:
// a second name for the array, which `secret(raw)` cannot move.
import { parallelReduce } from "nish/threads";
import { Secret, secret, wipe } from "nish:secret";
export const main = (): i32 => {
  const raw: u8[] = [1, 2, 3];
  const xs: i32[] = [0, 1, 2];
  const sum = parallelReduce(xs, (acc: i32, i: i32): i32 => acc + toI32(raw[i]), 0);
  const key: Secret<u8[]> = secret(raw);
  wipe(key);
  return 0;
};
