// A window held in an object's fields is never proven (docs/LANGUAGE.md,
// "Panic sites"): the prover keeps no fact about a field, because any call can
// write one, as `widen(w)` does here between the test and the call. The
// `window` site is not proven and `--deny-panics` (`args`) refuses it; it
// stays refused with `widen(w)` removed.
import { Sink } from "./sink"

class Window {
  off: i32 = 1
  len: i32 = 2
}

const widen = (w: Window): void => {
  w.len = 9
}

const send = (s: Sink, buf: u8[], w: Window): i32 => {
  if (buf.length >= 3 && w.off === 1 && w.len === 2) {
    widen(w)
    return s.write(buf, w.off, w.len)
  }
  return 0
}

export const main = (): i32 => send(new Sink(), [1, 2, 3, 4], new Window())
