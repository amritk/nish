import { scope } from "nish/threads";

const work = (n: i32): i32 => {
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn((k: i32): i32 => n * 2 + k, 0, out, 0);
  }
  return out[0];
};

export const run = (n: i32): i32 => {
  return work(n);
};
