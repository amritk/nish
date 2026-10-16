// R1: an atomic's word is read only through `load()`; a plain read would race.
import { AtomicI32 } from "nish/threads";
export const main = (): i32 => {
  const a = new AtomicI32(0);
  a.add(1);
  return a.value;
};
