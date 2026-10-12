// A task's arrow does not capture either: only the data-parallel forms' do.
import { scope } from "nish/threads";

export const main = (): i32 => {
  const k: i32 = 3;
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn((x: i32): i32 => x + k, 1, out, 0);
  }
  return out[0];
};
