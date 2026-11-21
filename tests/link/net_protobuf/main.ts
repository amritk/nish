import { ProtoReader, ProtoWriter, PROTO_OK } from "nish/net/protobuf"

export const main = (): i32 => {
  const w = new ProtoWriter([])
  w.uint64(1, toU64(150))
  w.string(2, "hi")
  w.sint32(3, -2)
  w.float(4, toF32(1.5))
  w.beginMessage(5)
  w.int32(1, -1)
  w.endMessage()
  const r = new ProtoReader(w.buf, 0, w.end)
  while (r.next()) {
    if (r.field === 1) {
      console.log(`${r.uint64()}`)
    } else if (r.field === 3) {
      console.log(`${r.sint32()}`)
    } else if (r.field === 4) {
      console.log(`${toF64(r.float())}`)
    } else if (r.field === 5) {
      r.enter()
      while (r.next()) {
        console.log(`inner ${r.int32()}`)
      }
      r.leave()
    }
  }
  let hex = ""
  for (let i: i32 = 0; i < w.end; i += 1) {
    hex = `${hex} ${w.buf[i]}`
  }
  console.log(`${r.failed} ${w.end}${hex}`)
  return 0
}
