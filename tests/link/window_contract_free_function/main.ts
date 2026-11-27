// A free function that forwards its window (docs/LANGUAGE.md, "Panic sites"):
// `total` hands its own `(buf, off, len)` to `checkWindow` first, so each call
// into it is a `window` site of its caller, judged as a call into the guard
// would be. The whole buffer and `end - off` behind its range test are both
// proven, so `total` lists its call into `checkWindow` as proven and
// `checkWindow` lists its own `panic` as proven (`expected.panics`). Neither
// is exported, so no host reaches them. `window_contract_arrow_literal` is the
// forward from an arrow `const` with a literal count. `done.ts` is only the
// cross-module call every linked case makes.
import { done } from "./done"

const checkWindow = (what: string, buf: readonly u8[], off: i32, len: i32): void => {
  const size: i32 = toI32(buf.length)
  if (off < 0 || len < 0 || off > size || len > size - off) {
    panic(`${what}: the window is outside the buffer`)
  }
}

function total(buf: readonly u8[], off: i32, len: i32): i32 {
  checkWindow("total", buf, off, len)
  return len
}

const part = (buf: u8[], off: i32, end: i32): i32 => {
  if (off >= 0 && off <= end && end <= buf.length) {
    return total(buf, off, end - off)
  }
  return 0
}

export const main = (): void => {
  const buf: u8[] = [1, 2, 3, 4]
  console.log(`${total(buf, 0, toI32(buf.length))}`)
  console.log(`${part(buf, 1, 3)}`)
  console.log(done())
}
