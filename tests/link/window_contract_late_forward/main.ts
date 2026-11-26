// A method that does anything before it hands its window to the guard makes
// no window contract (docs/LANGUAGE.md, "Panic sites"). `Sink.write` sets a
// field first, so a caller's window is not what the guard is first handed:
// its call is no `window` site, and it reaches the `panic` inside although the
// caller passes the whole buffer (`expected.panics`). `window_contract_proven`
// forwards first. `checkWindow` itself is still a guard, and its call inside
// `Sink.write` is a `window` site, unproven there.
import { Sink } from "./sink"

export const main = (): i32 => {
  const s = new Sink()
  const buf: u8[] = [1, 2, 3, 4]
  s.write(buf, 0, toI32(buf.length))
  console.log(`${s.total}`)
  return 0
}
