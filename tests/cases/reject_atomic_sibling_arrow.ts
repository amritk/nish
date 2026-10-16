// R7 across the two scopes of one `using`, with void arrow tasks that
// capture the atomics: `t`'s store reads `a` before or after `s`'s add.
import { AtomicI32, scope } from "nish/threads";
export const main = (): i32 => {
  const a = new AtomicI32(0);
  const b = new AtomicI32(0);
  {
    using s = scope(), t = scope();
    s.spawn(() => {
      a.add(1);
    });
    t.spawn(() => {
      b.store(a.load());
    });
  }
  console.log(`${a.load()} ${b.load()}`);
  return 0;
};
