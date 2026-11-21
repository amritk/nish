// A reader's window must lie inside its buffer: a window past the end is a
// caller's bug, not hostile input, so the constructor panics, on stderr, with
//
//     ProtoReader: the window [0, 3) is outside a buffer of 2 bytes
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { ProtoReader } from "nish/net/protobuf"

export const main = (): i32 => {
  const buf: u8[] = [8, 1]
  const r = new ProtoReader(buf, 0, 2)
  console.log(`a window of 2 bytes: ${r.next()} ${r.uint64()}`)
  const bad = new ProtoReader(buf, 0, 3)
  console.log(`unreachable: ${bad.next()}`)
  return 0
}
