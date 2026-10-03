// Two names from a missing `fs` are two NL3015s, each carrying the same edit
// of the one specifier. `nish --fix` drops the second as overlapping the
// first, which is what keeps the specifier from being rewritten twice.
import { readFileSync, writeFileSync } from 'fs'
export const main = (): number => {
  writeFileSync("out.txt", "x")
  return readFileSync("out.txt").length
}
