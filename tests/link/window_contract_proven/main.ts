// A window the caller proves (docs/LANGUAGE.md, "Panic sites"). `checkWindow`
// panics exactly when `[off, off + len)` is outside `buf`, and `Sink.write`
// hands it its own window first, so each call into either is a `window` site
// of its caller, judged as the slice would be: the whole buffer, a literal
// window behind `buf.length >= 3`, and `end - off` behind its range test are
// all listed as proven. Both are exported from the root package, so a host can
// call either with any window: the guard's `panic` and `Sink.write`'s call into
// it stay unproven (`expected.panics`). `window_contract_internal` is the pair
// no host can call. `window_contract_unproven` is a
// window nothing proves.
import { checkWindow, Sink } from "./sink"

const part = (buf: u8[], off: i32, end: i32): i32 => {
  if (off >= 0 && off <= end && end <= buf.length) {
    checkWindow("part", buf, off, end - off)
    return end - off
  }
  return 0
}

export const main = (): i32 => {
  const s = new Sink()
  const buf: u8[] = [1, 2, 3, 4]
  s.write(buf, 0, toI32(buf.length))
  if (buf.length >= 3) {
    s.write(buf, 1, 2)
  }
  console.log(`${s.total}`)
  console.log(`${part(buf, 1, 3)}`)
  return 0
}
