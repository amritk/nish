// Field number 0, which protobuf reserves, and the tag 2^32 + 8, field
// number 2^29 + 1 of wire type 0, past the largest. A reader that kept only a
// tag's low 32 bits would see field 1 there, so the refusal is the upper
// bound's. Each answers PROTO_ERR_FIELD (-4) at next().
import { ProtoReader } from "nish/net/protobuf"

const firstField = (buf: readonly u8[]): string => {
  const r = new ProtoReader(buf, 0, toI32(buf.length))
  const more = r.next()
  return `${more} ${r.failed}`
}

export const main = (): i32 => {
  const zero: u8[] = [0, 1]
  const past: u8[] = [136, 128, 128, 128, 16, 1]
  const last: u8[] = [248, 255, 255, 255, 15, 1]
  console.log(`field 0: ${firstField(zero)}`)
  console.log(`field 2^29 + 1: ${firstField(past)}`)
  console.log(`field 2^29 - 1: ${firstField(last)}`)
  return 0
}
