// A fault nothing rules out (docs/LANGUAGE.md, "Panic sites"). `new Pool(limits)`
// is a `fault` site (`fault_contract_proven`), and `open` never runs
// `limitsFault` on `limits` first, so the site stays unproven and
// `--deny-panics` (`args`) refuses it at the call, with the check that would
// prove it.
import { Limits, Pool } from "./pool"

const open = (limits: Limits): i32 => {
  const pool = new Pool(limits)
  return pool.slots
}

export const main = (): i32 => open(new Limits(4))
