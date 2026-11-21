// A varint whose tenth byte still has its continuation bit set: 2^70 does
// not fit 64 bits, and protobuf caps a varint at ten bytes. The reader
// answers PROTO_ERR_VARINT (-1) rather than reading on or wrapping.
import { ProtoReader } from "nish/net/protobuf"

export const main = (): i32 => {
  const buf: u8[] = [8, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 1]
  const r = new ProtoReader(buf, 0, toI32(buf.length))
  console.log(`next: ${r.next()}, field ${r.field}`)
  console.log(`read: ${r.uint64()}, failed: ${r.failed}`)
  console.log(`then next: ${r.next()}`)
  return 0
}
