// A destination is never handed on, and a task that captures one holds it:
// it would read `out` when the scope joins, before `out[0]` is stored natively
// and after it under Node.
import { scope } from "nish/threads";

const sumOf = (xs: i32[]): i32 => {
  let t: i32 = 0;
  for (const x of xs) {
    t = t + x;
  }
  return t;
};

export const main = (): i32 => {
  const out: i32[] = [0, 0];
  {
    using s = scope();
    s.spawn(sumOf, [1, 2], out, 0);
    s.spawn((n: i32): i32 => out[0] + n, 1, out, 1);
  }
  return out[1];
};
