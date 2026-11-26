// A window nothing proves (docs/LANGUAGE.md, "Panic sites"). `Sink.write`
// forwards its window to `checkWindow`, and `[1, 3)` of a buffer whose length
// nothing bounds is not proven inside it, so the `window` site of the call stays
// unproven and `--deny-panics` (`args`) refuses it with the guard that would
// prove it. The guard's `panic` and `Sink.write`'s call are refused too: both
// are exports a host calls with any window (`window_contract_host_called`).
import { Sink } from "./sink"

const send = (s: Sink, buf: u8[]): i32 => s.write(buf, 1, 2)

export const main = (): i32 => send(new Sink(), [1, 2, 3, 4])
