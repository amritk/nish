// A leading `panic` guard no caller proves stays the callee's
// (docs/LANGUAGE.md, "Panic sites"). `checked`'s argument comes from the
// command line (`input.ts`), so nothing bounds it: its `panic` stays unproven
// and the call reaches it as any call does (`call` via `panic`).
// `tests/cases/panics_panic` is the same callee with a literal argument,
// proven at the call.
import { argument } from "./input"

const checked = (n: i32): i32 => {
  if (n < 0) {
    panic("negative")
  }
  return n * 2
}

export const main = (): number => {
  console.log(checked(argument()))
  return 0
}
