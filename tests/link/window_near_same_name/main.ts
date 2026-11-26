// A near miss of the window forward (docs/LANGUAGE.md, "Panic sites"): `sink.ts`
// is `window_contract_proven`'s with its guard private, but it also imports
// `other.ts`'s guard, also named `checkWindow`, under another name. Two of its
// functions then have the name `Sink.write` calls, so `Sink.write` is no
// forward: the call to it is no `window` site and reaches the `panic` inside
// (`expected.panics`), though the window it passes is inside the buffer.
// Without the second-match `return null` in `windowGuardNamed` it would be a forward.
import { Sink } from "./sink"

export const main = (): i32 => {
  const s = new Sink()
  const buf: u8[] = [1, 2, 3, 4]
  if (buf.length >= 3) {
    s.write(buf, 1, 2)
  }
  s.none(buf)
  console.log(`${s.total}`)
  return 0
}
