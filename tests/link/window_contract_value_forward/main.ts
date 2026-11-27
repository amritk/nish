// A forwarding function taken as a value (docs/LANGUAGE.md, "Panic sites"):
// `readU16` forwards its window to `checkWindow`, but `apply` calls it through
// `f`, so no caller's test can prove the call. The call through `f` keeps an
// unproven `window` site (`expected.panics`), which `--deny-panics` refuses.
// `window_contract_arrow_literal` is the forward called by name. `done.ts` is
// only the cross-module call every linked case makes.
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

const apply = (f: (b: readonly u8[], off: i32) => u32, b: u8[]): u32 => f(b, 0)

export const main = (): void => {
  const buf: u8[] = [1, 2, 3]
  console.log(`${apply(readU16, buf)}`)
  console.log(done())
}
