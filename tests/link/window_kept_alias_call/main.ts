// A window test a later change undoes proves nothing (docs/LANGUAGE.md, "Panic
// sites"): `drain(buf)` between the test and the call empties `buf` through
// its own name for it, so the `window` site is not proven and `--deny-panics`
// (`args`) refuses it. `window_kept_control` is the same test with nothing
// between, proven.
import { Sink } from "./sink"

const drain = (b: u8[]): void => {
  while (b.length > 0) {
    b.pop()
  }
}

const send = (s: Sink, buf: u8[]): i32 => {
  if (buf.length >= 3) {
    drain(buf)
    return s.write(buf, 1, 2)
  }
  return 0
}

export const main = (): i32 => send(new Sink(), [1, 2, 3, 4])
