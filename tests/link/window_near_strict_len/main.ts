// A near miss of the window guard (docs/LANGUAGE.md, "Panic sites"): `sink.ts`
// is `window_contract_proven`'s but for `len <= 0` for `len < 0`, so
// `checkWindow` is no window guard and `Sink.write` no forward. The call is no
// `window` site and reaches the `panic` inside (`expected.panics`), though the
// window it passes is inside the buffer. Without `isBelowZero`'s `<`, at `len`
// it would be a guard.
import { Sink } from "./sink"

export const main = (): i32 => {
  const s = new Sink()
  const buf: u8[] = [1, 2, 3, 4]
  if (buf.length >= 3) {
    s.write(buf, 1, 2)
  }
  console.log(`${s.total}`)
  return 0
}
