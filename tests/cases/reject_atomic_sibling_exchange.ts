// R7 across the two scopes of one `using`, with an exchange: the task of `t`
// takes the count natively before `s`'s tasks add to it, under Node after.
import { AtomicI32, scope } from "nish/threads";
const bump = (a: AtomicI32): i32 => {
  for (let i: i32 = 0; i < 100000; i++) {
    a.add(1);
  }
  return 0;
};
const peek = (a: AtomicI32): i32 => a.exchange(0);
export const main = (): i32 => {
  const a = new AtomicI32(0);
  const out: i32[] = [0, 0];
  {
    using s = scope(), t = scope();
    s.spawn(bump, a, out, 0);
    t.spawn(peek, a, out, 1);
  }
  console.log(`${out[1]} ${a.load()}`);
  return 0;
};
