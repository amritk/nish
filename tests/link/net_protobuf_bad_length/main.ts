// A length-delimited field that claims five bytes with two left. The
// reader answers PROTO_ERR_LENGTH (-3) when the field is read, and never
// indexes past the span.
import { ProtoReader } from "nish/net/protobuf"

export const main = (): i32 => {
  const buf: u8[] = [10, 5, 1, 2]
  const r = new ProtoReader(buf, 0, toI32(buf.length))
  console.log(`next: ${r.next()}, field ${r.field}`)
  console.log(`read: ${r.len()}, failed: ${r.failed}`)
  console.log(`then next: ${r.next()}`)
  return 0
}
