// WP40 B1.2: the write C makes through a `u8[]` reaches the element the buffer
// was read from, `bufs[i]`, so a task that fills it while the parent reads it
// races the parent, and is refused.
import { scope } from "nish/threads";

declare function read(fd: i32, buf: u8[], n: u64): i64;

function fill(bufs: u8[][], i: i32): i64 {
  const b = bufs[i];
  return read(0, b, toU64(b.length));
}

export function main(): i32 {
  const bufs: u8[][] = [new Array<u8>(8), new Array<u8>(8)];
  let seen = 0;
  {
    using s = scope();
    s.spawn(() => {
      fill(bufs, 1);
    });
    seen = toI32(bufs[1][0]);
  }
  return seen;
}
