// A lock is shared only by the rules of its own block (NL2504), so an arrow
// passed to a data-parallel form cannot capture a class object that holds
// one, even to read another of its fields.
import { Mutex, parallelFrom } from "nish/threads";

class Holder {
  m: Mutex<i32>;
  k: i32;
  constructor(m: Mutex<i32>) {
    this.m = m;
    this.k = 3;
  }
}

export const main = (): i32 => {
  const h = new Holder(new Mutex<i32>(1));
  const ys = parallelFrom(2, (i) => h.k + i);
  console.log(`${ys[1]}`);
  return 0;
};
