// A caller that does not test its window before a fixed-width read
// (std/bytes.ts, "Byte windows"): nothing bounds `off` in `read4`, so its call
// into `getU32BE` keeps an unproven window site and the build needs
// `--allow-panics`. `std_bytes_window_proved` is the same read behind a test.
// `done.ts` is only the cross-module call every linked case makes.
import { getU32BE } from "nish/bytes"
import { done } from "./done"

const read4 = (b: u8[], off: i32): u32 => {
  return getU32BE(b, off)
}

export const main = (): void => {
  const buf: u8[] = [1, 2, 3, 4, 5]
  console.log(`${read4(buf, 0)}`)
  console.log(`${read4(buf, 1)}`)
  console.log(done())
}
