// A void task of a sibling scope that reaches the destination of another
// scope's task: the array is handed on, which no destination may be.
import { scope } from "nish/threads";
const f = (x: i32): i32 => x * 10;
const fill = (xs: i32[]): void => {
  xs[1] = 7;
};
export const main = (): i32 => {
  const out: i32[] = [0, 0];
  {
    using s = scope(), t = scope();
    s.spawn(f, 1, out, 0);
    t.spawn(() => fill(out));
  }
  console.log(`${out[0]} ${out[1]}`);
  return 0;
};
