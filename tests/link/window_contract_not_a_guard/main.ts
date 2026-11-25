// A check that is not the window's proves nothing for its callers
// (docs/LANGUAGE.md, "Panic sites"). `checkWindow` in `sink.ts` tests `len < 0`
// before `off < 0`: the same window, but not the shape the contract reads
// exactly, so it is no window guard: `Sink.write` is no contract, its call
// is no `window` site, and the call reaches the `panic` inside, listed
// although the caller passes the whole buffer (`expected.panics`). `window_contract_proven` is the guard written exactly.
import { Sink } from "./sink"

export const main = (): i32 => {
  const s = new Sink()
  const buf: u8[] = [1, 2, 3, 4]
  s.write(buf, 0, toI32(buf.length))
  console.log(`${s.total}`)
  return 0
}
