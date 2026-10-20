// WP40 B1.2: the write C makes through a `u8[]` reaches the field path the
// buffer was read from, `o.bytes`, so a task that fills it while the parent
// reads it races the parent, and is refused.
import { scope } from "nish/threads";

declare function read(fd: i32, buf: u8[], n: u64): i64;

class Packet {
  bytes: u8[];
  constructor() {
    this.bytes = new Array<u8>(8);
  }
}

function fill(o: Packet): i64 {
  return read(0, o.bytes, toU64(o.bytes.length));
}

export function main(): i32 {
  const o = new Packet();
  let seen = 0;
  {
    using s = scope();
    s.spawn(() => {
      fill(o);
    });
    seen = toI32(o.bytes[0]);
  }
  return seen;
}
