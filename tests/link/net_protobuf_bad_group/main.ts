// A start-group tag (wire type 3). Groups are deprecated and their skip is
// unbounded recursion in other readers; this one refuses them with
// PROTO_ERR_GROUP (-5) at next().
import { ProtoReader } from "nish/net/protobuf"

export const main = (): i32 => {
  const buf: u8[] = [11, 8, 1, 12]
  const r = new ProtoReader(buf, 0, toI32(buf.length))
  console.log(`next: ${r.next()}, failed: ${r.failed}`)
  return 0
}
