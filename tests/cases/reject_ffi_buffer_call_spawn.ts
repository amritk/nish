// WP40 B1.1: a call to a buffer-taking `declare function` inside an arrow a
// scope spawns is refused as a call in a plain function is.
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
