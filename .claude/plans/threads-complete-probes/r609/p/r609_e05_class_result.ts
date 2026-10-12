import { parallelMap } from "nish/threads";
class P {
  v: i32 = 0;
}
const mk = (x: i32): P => new P();
export const main = (): i32 => {
  const a = parallelMap([1, 2], mk);
  console.log(`${a.length}`);
  return 0;
};
