// A destination two sibling scopes both name, at the same slot: natively `t`
// joins first and `s` stores last, under Node the other way round.
import { scope } from "nish/threads";
const f = (x: i32): i32 => x * 10;
const g = (x: i32): i32 => x * 100;
export const main = (): i32 => {
  const out: i32[] = [0];
  {
    using s = scope(), t = scope();
    s.spawn(f, 1, out, 0);
    t.spawn(g, 2, out, 0);
  }
  console.log(`${out[0]}`);
  return 0;
};
