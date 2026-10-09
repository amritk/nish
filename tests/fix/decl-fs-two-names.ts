// Two names from a missing `fs` are one NL3015, because a statement whose
// specifier does not resolve is reported once however many names it imports
// (#434). Its one edit rewrites the specifier once, in one round.
import { readFileSync, writeFileSync } from 'fs'
export const main = (): number => {
  writeFileSync("out.txt", "x")
  return readFileSync("out.txt").length
}
