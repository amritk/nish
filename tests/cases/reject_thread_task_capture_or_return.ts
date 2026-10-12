// NL2394 beside an arrow task: `orReturn` would leave the block without the
// join, and the task holds its captures until then.
import { scope } from "nish/threads";

const half = (n: i32): Result<i32, string> => (n % 2 === 0 ? Ok(n / 2) : Err("odd"));
const twice = (n: i32): i32 => n * 2;

const run = (n: i32): Result<i32, string> => {
  const out: i32[] = [0];
  const k: i32 = 3;
  {
    using s = scope();
    s.spawn((m: i32): i32 => twice(m) + k, 1, out, 0);
    const h = half(n).orReturn();
  }
  return Ok(out[0]);
};

export const main = (): i32 => (run(4).isOk() ? 0 : 1);
