// A task of one scope reading the answer another scope's task returns: natively
// `t` joins first and reads `out` before `s` stores it, under Node after. The
// capture hands `out` on, which no destination may be.
import { scope } from "nish/threads";
const f = (x: i32): i32 => x * 10;
export const main = (): i32 => {
  const out: i32[] = [0];
  const seen: i32[] = [0];
  {
    using s = scope(), t = scope();
    s.spawn(f, 1, out, 0);
    t.spawn((n: i32): i32 => out[0] + n, 0, seen, 0);
  }
  console.log(`${seen[0]} ${out[0]}`);
  return 0;
};
