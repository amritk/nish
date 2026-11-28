// A literal-count forward nothing proves (docs/LANGUAGE.md, "Panic sites").
// `readU16` hands `checkWindow` its own `b` and `off` and the count `2`, and
// `pick` calls it with an `off` nothing bounds, so the `window` site of the
// call stays unproven and `--deny-panics` (`args`) refuses it, with the test
// that would prove it: the count is `readU16`'s, so only `off` is the
// caller's to bound. `window_contract_arrow_literal` is the call proven.
// `done.ts` is only the cross-module call every linked case makes.
import { done } from "./done"

const checkWindow = (what: string, buf: readonly u8[], off: i32, len: i32): void => {
  const size: i32 = toI32(buf.length)
  if (off < 0 || len < 0 || off > size || len > size - off) {
    panic(`${what}: the window is outside the buffer`)
  }
}

const readU16 = (b: readonly u8[], off: i32): u32 => {
  checkWindow("readU16", b, off, 2)
  return toU32(b[off]) | (toU32(b[off + 1]) << 8)
}

const pick = (b: u8[], off: i32): u32 => readU16(b, off)

export const main = (): void => {
  console.log(`${pick([1, 2, 3], 1)}`)
  console.log(done())
}
