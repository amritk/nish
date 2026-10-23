// The layout fixture: a root package of two modules, one in a subdirectory, a
// standard-library module and a `nish:` builtin. `--emit-ts` keeps each root
// module at its path, writes the library module under `nish/`, and points the
// imports at both and at `nish/runtime`.

import { write } from "nish:io"
import { Pair } from "nish/pair"
import { tally } from "./lib/tally"

export const main = (): number => {
  const p: Pair<string, number> = { first: "apples", second: 3 }
  write(`${tally(p.first, p.second)}\n`)
  return 0
}
