// A stack size the compiler cannot see, below the minimum: `scopeWithStack`
// panics before any task is spawned, natively and under Node alike, so the
// task never runs and nothing reaches stdout.
import { scopeWithStack } from "nish/threads";

const twice = (n: i32): i32 => n * 2;

const run = (kib: i32): i32 => {
  const out: i32[] = [0];
  {
    using s = scopeWithStack(kib * 1024);
    s.spawn(twice, 21, out, 0);
  }
  return out[0];
};

export const main = (): i32 => {
  console.log(`${run(64)}`);
  return 0;
};
