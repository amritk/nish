// The same, with arrow tasks that capture a `const`: each arrow is a task of
// its own scope, and both store into `out`.
import { scope } from "nish/threads";
export const main = (): i32 => {
  const out: i32[] = [0, 0];
  const k: i32 = 3;
  {
    using s = scope(), t = scope();
    s.spawn((n: i32): i32 => n * k, 1, out, 0);
    t.spawn((n: i32): i32 => n + k, 2, out, 1);
  }
  console.log(`${out[0]} ${out[1]}`);
  return 0;
};
