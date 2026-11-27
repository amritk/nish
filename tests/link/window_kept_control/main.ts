// The control for the `window_kept_*` negatives (docs/LANGUAGE.md, "Panic
// sites"): each function here is one of theirs with nothing between the test
// and the call, and each `window` site is listed as proven
// (`expected.panics`). A negative that stops being refused while its control
// still proves is a change it no longer sees. `window_kept_field` has no
// control here: a window read from fields is never proven.
import { Sink } from "./sink"

const send = (s: Sink, buf: u8[]): i32 => {
  if (buf.length >= 3) {
    return s.write(buf, 1, 2)
  }
  return 0
}

const sendRebound = (s: Sink, first: u8[]): i32 => {
  let buf: u8[] = first
  if (buf.length >= 3) {
    return s.write(buf, 1, 2)
  }
  buf = first
  return 0
}

export const main = (): i32 => {
  const s = new Sink()
  console.log(`${send(s, [1, 2, 3, 4])}`)
  console.log(`${sendRebound(s, [1, 2, 3, 4])}`)
  return 0
}
