// A window guard that a later change undoes proves nothing (docs/LANGUAGE.md,
// "Panic sites"). `off` is tested inside `[0, end]` as `window_contract_proven`
// does, then moves past the test before the call, so `end - off` is no longer
// proven inside `buf` and `--deny-panics` (`args`) refuses the `window` site.
// Calling without the `off = off + 9` proves it.
import { Sink } from "./sink"

const send = (s: Sink, buf: u8[], start: i32, end: i32): i32 => {
  let off: i32 = start
  if (off >= 0 && off <= end && end <= buf.length) {
    off = off + 9
    return s.write(buf, off, end - off)
  }
  return 0
}

export const main = (): i32 => send(new Sink(), [1, 2, 3, 4], 1, 3)
