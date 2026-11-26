// A window test a later change undoes proves nothing (docs/LANGUAGE.md, "Panic
// sites"): `buf.pop()` between the test and the call shortens `buf`, so the
// `window` site is not proven and `--deny-panics` (`args`) refuses it.
// `window_kept_control` is the same test with nothing between, proven.
import { Sink } from "./sink"

const send = (s: Sink, buf: u8[]): i32 => {
  if (buf.length >= 3) {
    buf.pop()
    return s.write(buf, 1, 2)
  }
  return 0
}

export const main = (): i32 => send(new Sink(), [1, 2, 3, 4])
