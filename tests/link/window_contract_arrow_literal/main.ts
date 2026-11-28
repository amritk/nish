// An arrow `const` that forwards its window with a literal count
// (docs/LANGUAGE.md, "Panic sites"): `readU32` hands `checkWindow` its own
// `b` and `off` and the count `4`, so a call into it checks `[off, off + 4)`
// of `b`, and the caller's `off + 4 <= b.length` proves it. After the guard
// returns, `b[off]` to `b[off + 3]` are inside the window it checked, so
// `readU32` lists each of its four indexes as proven (`expected.panics`).
// `window_contract_literal_unproven` is a call nothing proves.
// `done.ts` is only the cross-module call every linked case makes.
import { done } from "./done"

const checkWindow = (what: string, buf: readonly u8[], off: i32, len: i32): void => {
  const size: i32 = toI32(buf.length)
  if (off < 0 || len < 0 || off > size || len > size - off) {
    panic(`${what}: the window is outside the buffer`)
  }
}

const readU32 = (b: readonly u8[], off: i32): u32 => {
  checkWindow("readU32", b, off, 4)
  return toU32(b[off]) | (toU32(b[off + 1]) << 8) | (toU32(b[off + 2]) << 16) | (toU32(b[off + 3]) << 24)
}

const word = (b: u8[], off: i32): u32 => {
  if (off >= 0 && off + 4 <= b.length) {
    return readU32(b, off)
  }
  return 0
}

export const main = (): void => {
  const buf: u8[] = [1, 2, 3, 4, 5]
  console.log(`${word(buf, 1)}`)
  console.log(`${word(buf, 2)}`)
  console.log(done())
}
