// A `parallelMap` arrow cannot capture a holder: a task would read its key beside the thread that wipes it.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
import { parallelMap } from "nish/threads";
const sum = (k: u8[]): i32 => toI32(k.length);
const bytes = (): u8[] => [toU8(1), toU8(2)];
class Holder {
  readonly k: Secret<u8[]>;
  constructor(seed: u8) {
    this.k = secret([seed, toU8(2)]);
  }
  wipe(): void {
    wipe(this.k);
  }
}
export const main = (): i32 => {
  const h = new Holder(toU8(1));
  const xs: i32[] = [0, 1];
  const ys = parallelMap(xs, (i: i32): i32 => expose(h.k, sum) + i);
  h.wipe();
  return toI32(ys.length);
};
