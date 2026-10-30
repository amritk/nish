// A program importing `nish/regex` without a property escape, for the linked
// size bench/regex/measure.mjs --size reports.
import { regexCompile } from "nish/regex"

export const main = (): number => {
  const compiled = regexCompile("[0-9]+", "")
  if (compiled.isErr()) {
    return 1
  }
  console.log(`${compiled.value.count(process.argv.length > 1 ? process.argv[1] : "12 34")}`)
  return 0
}
