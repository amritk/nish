// ProtoWriter.bytes copies a window of its source, which must lie inside it:
// here a negative offset. It panics, on stderr, with
//
//     ProtoWriter.bytes: the window [-1, -1 + 2) is outside a buffer of 2 bytes
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { ProtoWriter } from "nish/net/protobuf"

export const main = (): i32 => {
  const src: u8[] = [104, 105]
  const w = new ProtoWriter([])
  w.bytes(1, src, 0, 2)
  console.log(`a window of 2 bytes: ${w.end} ${w.failed}`)
  w.bytes(1, src, -1, 2)
  console.log(`unreachable: ${w.end}`)
  return 0
}
