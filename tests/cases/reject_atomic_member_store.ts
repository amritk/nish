// R1: an atomic's word is written only through its methods; a plain store races.
import { AtomicI32 } from "nish/threads";
export const main = (): i32 => {
  const a = new AtomicI32(0);
  a.value = 3;
  return a.load();
};
