// `orReturn` inside a scope's region returned without the join a `return` or
// the block's end makes. The task stayed filed, and the next scope's join ran
// it through pointers into memory this function's arena scope had released,
// overwriting another function's array. docs/security/codegen.md, CG-6.
import { scope } from "nish/threads";

const sumOf = (xs: i32[]): i32 => {
  let t: i32 = 0;
  for (const x of xs) {
    t = t + x;
  }
  return t;
};

const check = (ok: boolean): Result<i32, string> => {
  if (ok) {
    return Ok(1);
  }
  return Err("bad");
};

export const failing = (ok: boolean): Result<i32, string> => {
  const out: i32[] = [0];
  const xs: i32[] = [7, 7, 7];
  {
    using s = scope();
    s.spawn(sumOf, xs, out, 0);
    const v = check(ok).orReturn();
    if (v < 0) {
      return Err("negative");
    }
  }
  return Ok(out[0]);
};
