// The f64 seam: a native build writes each `JsonWriter.f64` through the
// runtime's `nish_json_put_f64`, straight into the writer's buffer; Node and
// --emit-ts run `jsonPutF64Walk` as written. tests/run.js (`json_f64_seam`)
// holds both to these lines, and checks the call in std/json's IR.
import { JSON_WRITE_FULL, JsonWriter } from "nish/json"

export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(64), 0)
  const half: f64 = 1.5
  const negZero: f64 = -0.0
  const big: f64 = 1e21
  const tiny: f64 = 5e-324
  const longest: f64 = -0.0000012345678901234567
  w.beginArray()
  w.f64(half)
  w.f64(negZero)
  w.f64(big)
  w.f64(tiny)
  w.f64(longest)
  w.endArray()
  console.log(w.text())
  // Five bytes hold "[" and four digits: the fifth digit is one byte short,
  // so the writer fails FULL with the cursor where the "[" left it.
  const short = new JsonWriter(new Array<u8>(5), 0)
  short.beginArray()
  short.f64(toF64(12345))
  console.log(`${short.failed === JSON_WRITE_FULL} ${short.written()}`)
  // An exact fit: "[" and five digits fill six bytes.
  const exact = new JsonWriter(new Array<u8>(6), 0)
  exact.beginArray()
  exact.f64(toF64(12345))
  console.log(`${exact.failed} ${exact.written()}`)
  return 0
}
