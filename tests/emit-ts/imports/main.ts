// Two imports of one module, and two of one builtin: each specifier is
// rewritten once, and every import that names it is pointed at the rewrite.

import { write } from "nish:io"
import { write as print } from "nish:io"
import { Count } from "./lib/count"
import { bump } from "./lib/count"

export const main = (): number => {
  const c: Count = { n: 1 }
  write(`${bump(c)}\n`)
  print("done\n")
  return 0
}
