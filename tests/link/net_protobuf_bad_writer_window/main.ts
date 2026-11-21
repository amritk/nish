// ProtoWriter.bytes copies a window of its source, which must lie inside it.
// A negative offset, a negative count, a count past the source's end and an
// offset plus count past 2^31 - 1 are a caller's bug: nothing is written and
// `failed` is PROTO_ERR_WINDOW (-10), sticky until `reset`.
import { ProtoWriter } from "nish/net/protobuf"

export const main = (): i32 => {
  const src: u8[] = [104, 105]
  const w = new ProtoWriter([])
  w.bytes(1, src, 0, 2)
  console.log(`a window of 2 bytes: ${w.end} ${w.failed}`)
  w.bytes(1, src, -1, 2)
  console.log(`a negative offset: ${w.end} ${w.failed}`)
  w.uint64(2, toU64(1))
  console.log(`and the fault is sticky: ${w.end} ${w.failed}`)
  w.reset()
  w.bytes(1, src, 0, -1)
  console.log(`a negative count: ${w.end} ${w.failed}`)
  w.reset()
  w.bytes(1, src, 1, 2)
  console.log(`a count past the end: ${w.end} ${w.failed}`)
  w.reset()
  w.bytes(1, src, 2147483647, 2)
  console.log(`an offset plus count past 2^31 - 1: ${w.end} ${w.failed}`)
  w.reset()
  w.bytes(1, src, 2, 0)
  console.log(`an empty window at the end: ${w.end} ${w.failed}`)
  return 0
}
