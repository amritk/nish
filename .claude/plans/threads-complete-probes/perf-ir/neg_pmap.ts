// Probe (negative): a lock inside a parallelMapInto body — refused (NL2474).
import { Mutex, parallelMapInto } from "nish/threads";

class Box {
  m: Mutex<i32>;
  constructor(m: Mutex<i32>) {
    this.m = m;
  }
}

const bump = (b: Box): i32 => {
  using g = b.m.lock();
  g.value = g.value + 1;
  return 1;
};

export const main = (): i32 => {
  const m = new Mutex<i32>(0);
  const src: Box[] = [new Box(m), new Box(m)];
  const dst: i32[] = [0, 0];
  parallelMapInto(src, dst, bump);
  return dst[0];
};
