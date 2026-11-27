// A forward with a literal count called as a statement (docs/LANGUAGE.md,
// "Panic sites"): `need4` hands `checkWindow` its own `b` and `off` and the
// count `4`, so once `need4(b, off)` returns, `[off, off + 4)` is inside `b`
// and `sum4` lists its four indexes as proven (`expected.panics`). Nothing
// bounds `off` in `sum4`, so its call into `need4` stays an unproven window
// site. `done.ts` is only the cross-module call every linked case makes.
import { done } from "./done"

const checkWindow = (what: string, buf: readonly u8[], off: i32, len: i32): void => {
  const size: i32 = toI32(buf.length)
  if (off < 0 || len < 0 || off > size || len > size - off) {
    panic(`${what}: the window is outside the buffer`)
  }
}

const need4 = (b: readonly u8[], off: i32): void => {
  checkWindow("need4", b, off, 4)
}

const sum4 = (b: readonly u8[], off: i32): i32 => {
  need4(b, off)
  return toI32(b[off]) + toI32(b[off + 1]) + toI32(b[off + 2]) + toI32(b[off + 3])
}

export const main = (): void => {
  const buf: u8[] = [1, 2, 3, 4, 5]
  console.log(`${sum4(buf, 0)}`)
  console.log(`${sum4(buf, 1)}`)
  console.log(done())
}
