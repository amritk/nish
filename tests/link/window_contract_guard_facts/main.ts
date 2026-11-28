// What a guard's call records once it returns (docs/LANGUAGE.md, "Panic
// sites"). Every function here is exported, so a host may call it with any
// buffer and no caller proves an index for it: each index below is proven by
// the guard's call before it or not at all (`expected.panics`).
// `probe`: after a count of 4, `b[off]` to `b[off + 3]` are proven, and
// `b[off + 4]`, one past the window, and `b[off - 1]`, one before it, are not.
// `moved`: an assignment to `at` after the call undoes what it recorded, so
// `b[at]` is not proven. `span`: after a count that is no constant, `len` and
// `off` are each at most `b.length`, which proves `b[i]` under `i < len` and
// under `i < off`. `done.ts` is only the cross-module call every
// linked case makes.
import { done } from "./done"

const checkWindow = (what: string, buf: readonly u8[], off: i32, len: i32): void => {
  const size: i32 = toI32(buf.length)
  if (off < 0 || len < 0 || off > size || len > size - off) {
    panic(`${what}: the window is outside the buffer`)
  }
}

export const probe = (b: readonly u8[], off: i32): i32 => {
  checkWindow("probe", b, off, 4)
  const inside = toI32(b[off]) + toI32(b[off + 1]) + toI32(b[off + 2]) + toI32(b[off + 3])
  const past = toI32(b[off + 4])
  const before = toI32(b[off - 1])
  return inside + past + before
}

export const moved = (b: readonly u8[], off: i32): i32 => {
  let at = off
  checkWindow("moved", b, at, 4)
  at = at + 4
  return toI32(b[at])
}

export const span = (b: readonly u8[], off: i32, len: i32): i32 => {
  checkWindow("span", b, off, len)
  let total = 0
  for (let i = 0; i < len; i++) {
    total = total + toI32(b[i])
  }
  for (let i = 0; i < off; i++) {
    total = total + toI32(b[i])
  }
  return total
}

export const main = (): void => {
  const buf: u8[] = [1, 2, 3, 4, 5, 6]
  console.log(`${probe(buf, 1)}`)
  console.log(`${moved(buf, 1)}`)
  console.log(`${span(buf, 2, 3)}`)
  console.log(done())
}
