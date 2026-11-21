// A reader's window must lie inside its buffer. A window past the end, one
// that starts below 0 and one that ends before it starts are a caller's bug,
// not hostile input: the reader holds an empty span, `next` answers false and
// `failed` is PROTO_ERR_WINDOW (-10) until a `reset` over a good window.
import { ProtoReader } from "nish/net/protobuf"

export const main = (): i32 => {
  const buf: u8[] = [8, 1]
  const r = new ProtoReader(buf, 0, 2)
  console.log(`a window of 2 bytes: ${r.next()} ${r.uint64()}`)
  const past = new ProtoReader(buf, 0, 3)
  console.log(`a window past the end: ${past.next()} ${past.failed}`)
  past.reset(buf, -1, 1)
  console.log(`a window below 0: ${past.next()} ${past.failed}`)
  past.reset(buf, 2, 1)
  console.log(`a window that ends before it starts: ${past.next()} ${past.failed}`)
  past.reset(buf, 0, 2)
  console.log(`reset over a good window: ${past.next()} ${past.uint64()} ${past.failed}`)
  return 0
}
