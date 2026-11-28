// A caller that tests its window before a fixed-width read (std/bytes.ts,
// "Byte windows"): `getU32BE` checks its 4 bytes through `bytesWindow`, a
// guard the compiler forwards to each call. `read4` tests `off` against
// `b.length - 4` first, so its call's window site is proven and the build
// needs no `--allow-panics`. `done.ts` is only the cross-module call every
// linked case makes.
import { getU32BE } from "nish/bytes"
import { done } from "./done"

const read4 = (b: u8[], off: i32): u32 => {
  if (off < 0 || off > toI32(b.length) - 4) {
    return 0
  }
  return getU32BE(b, off)
}

export const main = (): void => {
  const buf: u8[] = [1, 2, 3, 4, 5]
  console.log(`${read4(buf, 0)}`)
  console.log(`${read4(buf, 1)}`)
  console.log(`${read4(buf, 2)}`)
  console.log(done())
}
