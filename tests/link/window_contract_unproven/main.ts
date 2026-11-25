// A window nothing proves (docs/LANGUAGE.md, "Panic sites"). `Sink.write`
// forwards its window to `checkWindow`, and `[1, 3)` of a buffer whose length
// nothing bounds is not proven inside it, so the `window` site of the call stays
// unproven and `--deny-panics` (`args`) refuses it with the guard that would
// prove it. The guard's own `panic` is refused too: a module held to no panic
// keeps none, and its callers' proofs are what `window_contract_proven` lists.
import { Sink } from "./sink"

const send = (s: Sink, buf: u8[]): i32 => s.write(buf, 1, 2)

export const main = (): i32 => send(new Sink(), [1, 2, 3, 4])
