// A window test a later change undoes proves nothing (docs/LANGUAGE.md, "Panic
// sites"): `buf = other` between the test and the call names another buffer, so
// the `window` site is not proven and `--deny-panics` (`args`) refuses it.
// `window_kept_control` is the same test with nothing between, proven.
import { Sink } from "./sink"

const send = (s: Sink, first: u8[], other: u8[]): i32 => {
  let buf: u8[] = first
  if (buf.length >= 3) {
    buf = other
    return s.write(buf, 1, 2)
  }
  return 0
}

export const main = (): i32 => send(new Sink(), [1, 2, 3, 4], [1])
