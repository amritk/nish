// 101 embedded messages, each the only field of the one around it: one
// past PROTO_MAX_DEPTH. enter() refuses the 101st with PROTO_ERR_DEPTH (-7),
// so a hostile nesting cannot grow the reader's stack of ends without bound.
import { PROTO_MAX_DEPTH, ProtoReader, ProtoWriter } from "nish/net/protobuf"

export const main = (): i32 => {
  let buf: u8[] = []
  for (let i: i32 = 0; i <= PROTO_MAX_DEPTH; i += 1) {
    const level = new ProtoWriter([])
    level.bytes(1, buf, 0, toI32(buf.length))
    buf = level.buf
  }
  const r = new ProtoReader(buf, 0, toI32(buf.length))
  let entered: i32 = 0
  while (r.next() && r.enter()) {
    entered += 1
  }
  console.log(`entered ${entered}, then ${r.failed}`)
  return 0
}
