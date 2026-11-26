// A window test a later change undoes proves nothing (docs/LANGUAGE.md, "Panic
// sites"): the count argument `take(buf)`, evaluated after `buf`, empties
// `buf` before the call, so the `window` site is not proven and `--deny-panics`
// (`args`) refuses it. `window_kept_control` is the same test with nothing
// between, proven.
import { Sink } from "./sink"

const take = (b: u8[]): i32 => {
  while (b.length > 0) {
    b.pop()
  }
  return 2
}

const send = (s: Sink, buf: u8[]): i32 => {
  if (buf.length >= 3) {
    return s.write(buf, 1, take(buf))
  }
  return 0
}

export const main = (): i32 => send(new Sink(), [1, 2, 3, 4])
