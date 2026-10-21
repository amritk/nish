// WP40 B1.2: C writes through a `u8[]` it is passed, so `fill`'s `b` is
// written, and a task that fills the array the parent is reading races it.
// The task is refused: a C body is unseen, so a call that reaches one may
// write memory its caller can see.
import { scope } from "nish/threads";

declare function read(fd: i32, buf: u8[], n: u64): i64;

function fill(b: u8[]): i64 {
  return read(0, b, toU64(b.length));
}

export function main(): i32 {
  const b = new Array<u8>(8);
  let seen = 0;
  {
    using s = scope();
    s.spawn(() => {
      fill(b);
    });
    seen = toI32(b[0]);
  }
  return seen;
}
