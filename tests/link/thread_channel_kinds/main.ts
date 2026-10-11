// WP29 P3: a channel carries any scalar, each widened into an 8-byte slot and
// narrowed back: an `i64` past 2^32, an enum, a `u8` and a `boolean`, each from
// a task to the parent, which drains them after the join. Native and WASI only:
// Node's type stripping cannot run an `enum`, which needs a transform.
import { Channel, scope } from "nish/threads";

enum Level {
  Low,
  Mid,
  High,
}

class Kinds {
  wide: Channel<i64>;
  levels: Channel<Level>;
  bytes: Channel<u8>;
  flags: Channel<boolean>;

  constructor(wide: Channel<i64>, levels: Channel<Level>, bytes: Channel<u8>, flags: Channel<boolean>) {
    this.wide = wide;
    this.levels = levels;
    this.bytes = bytes;
    this.flags = flags;
  }
}

const emit = (k: Kinds): i32 => {
  for (let i: i32 = 0; i < 10; i++) {
    k.wide.send(toI64(i) * 1000000000);
    k.levels.send(i % 3 === 0 ? Level.High : Level.Low);
    k.bytes.send(toU8(250 + i));
    k.flags.send(i % 2 === 0);
  }
  return 10;
};

export const main = (): i32 => {
  const out: i32[] = [0];
  const wide = new Channel<i64>(), levels = new Channel<Level>();
  const bytes = new Channel<u8>(), flags = new Channel<boolean>();
  {
    using s = scope();
    s.spawn(emit, new Kinds(wide, levels, bytes, flags), out, 0);
  }
  let total: i64 = 0;
  for (const w of wide) {
    total = total + w;
  }
  let high: i32 = 0;
  for (const l of levels) {
    high = high + (l === Level.High ? 1 : 0);
  }
  let byteSum: i32 = 0;
  for (const b of bytes) {
    byteSum = byteSum + toI32(b);
  }
  let trues: i32 = 0;
  for (const f of flags) {
    trues = trues + (f ? 1 : 0);
  }
  console.log(`${out[0]} sent: ${total} ${high} ${byteSum} ${trues}`);
  return 0;
};
