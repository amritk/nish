// One table of echoing streams, made once and shared by every slot: what a
// stream's echo could not hand its carrier yet waits in the stream's entry
// until the carrier says the stream is writable again. The HTTP/2, QUIC,
// HTTP/3 and WebTransport programs all hold their backlog here, so nothing
// they do allocates per stream or per byte.

/** What one stream entry holds back: more than any stream's credit (HTTP/2's 65,535 bytes, QUIC's 32 KiB here), so it never fills. */
const HELD: i32 = 131072;

/** The streams being echoed at once, across every slot. */
const ENTRIES: i32 = 16;

/** One echoing stream per entry: its id (-1 when free), where its echo goes, what is held, and how far it has ended. */
export class EchoTable {
  held: u8[][];
  ids: i64[];
  outs: i64[];
  slots: i32[];
  starts: i32[];
  lengths: i32[];
  ended: boolean[];
  empty: u8[];
  /** Streams that found no free entry, and bytes that found no room: never expected. */
  overflows: i32 = 0;

  constructor() {
    this.held = [];
    this.ids = new Array<i64>(ENTRIES);
    this.outs = new Array<i64>(ENTRIES);
    this.slots = new Array<i32>(ENTRIES);
    this.starts = new Array<i32>(ENTRIES);
    this.lengths = new Array<i32>(ENTRIES);
    this.ended = new Array<boolean>(ENTRIES);
    this.empty = [];
    for (let k: i32 = 0; k < ENTRIES; k++) {
      this.held.push(new Array<u8>(HELD));
      this.ids[k] = toI64(-1);
    }
  }

  /** The entry of stream `id` on `slot`, or -1. */
  find(slot: i32, id: i64): i32 {
    for (let k: i32 = 0; k < ENTRIES; k++) {
      if (this.ids[k] === id && this.slots[k] === slot) {
        return k;
      }
    }
    return -1;
  }

  /** A free entry for stream `id` on `slot`, echoing on `out`; -1, counted, when none is free. */
  claim(slot: i32, id: i64, out: i64): i32 {
    const free: i32 = this.findFree();
    if (free < 0) {
      this.overflows = this.overflows + 1;
      return -1;
    }
    this.ids[free] = id;
    this.outs[free] = out;
    this.slots[free] = slot;
    this.starts[free] = 0;
    this.lengths[free] = 0;
    this.ended[free] = false;
    return free;
  }

  /** Any free entry, or -1. */
  findFree(): i32 {
    for (let k: i32 = 0; k < ENTRIES; k++) {
      if (this.ids[k] < 0) {
        return k;
      }
    }
    return -1;
  }

  /** Frees entry `e`. */
  release(e: i32): void {
    if (e >= 0) {
      this.ids[e] = toI64(-1);
    }
  }

  /** Frees every entry of `slot`, whose connection is gone. */
  forget(slot: i32): void {
    for (let k: i32 = 0; k < ENTRIES; k++) {
      if (this.slots[k] === slot) {
        this.ids[k] = toI64(-1);
      }
    }
  }

  /** Keeps `buf[at .. at + n)` behind what entry `e` holds, moving that to the front first when it must. */
  hold(e: i32, buf: u8[], at: i32, n: i32): void {
    if (n <= 0 || e < 0) {
      return;
    }
    const held: u8[] = this.held[e];
    if (this.starts[e] + this.lengths[e] + n > HELD) {
      for (let k: i32 = 0; k < this.lengths[e]; k++) {
        held[k] = held[this.starts[e] + k];
      }
      this.starts[e] = 0;
    }
    if (this.lengths[e] + n > HELD) {
      this.overflows = this.overflows + 1;
      return;
    }
    const end: i32 = this.starts[e] + this.lengths[e];
    for (let k: i32 = 0; k < n; k++) {
      held[end + k] = buf[at + k];
    }
    this.lengths[e] = this.lengths[e] + n;
  }

  /** Marks `n` of entry `e`'s held bytes as gone. */
  took(e: i32, n: i32): void {
    this.starts[e] = this.starts[e] + n;
    this.lengths[e] = this.lengths[e] - n;
  }
}
