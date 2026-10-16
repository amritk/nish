// Three declarators: `r` and `t` share `out` with `s` between them, which
// has a destination of its own.
import { scope } from "nish/threads";
const f = (x: i32): i32 => x * 10;
export const main = (): i32 => {
  const out: i32[] = [0, 0, 0];
  const mine: i32[] = [0];
  {
    using r = scope(), s = scope(), t = scope();
    r.spawn(f, 1, out, 0);
    s.spawn(f, 2, mine, 0);
    t.spawn(f, 3, out, 2);
  }
  console.log(`${out[0]} ${out[2]} ${mine[0]}`);
  return 0;
};
