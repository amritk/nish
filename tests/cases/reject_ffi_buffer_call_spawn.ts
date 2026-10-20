// WP40 B1.2: a buffer-taking `declare function` lowers everywhere but in an
// arrow a scope spawns. A C body is unseen, so a call to any foreign function
// may write memory its caller can see, and a spawned task may not.
import { scope } from "nish/threads";

declare function write(fd: i32, buf: readonly u8[], n: u64): i64;

export function main(): i32 {
  const b: u8[] = [104, 105, 10];
  {
    using s = scope();
    s.spawn(() => {
      write(1, b, 3);
    });
  }
  return 0;
}
