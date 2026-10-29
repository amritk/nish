// A boolean `--dry` makes `--no-dry` its clearing, so a flag of its own
// named `no-dry` could never be told apart from it: declaring the pair, in
// either order, panics.
import { FlagTable } from "nish/cli-flags"

export const main = (): i32 => {
  const flags = new FlagTable("tool")
  flags.string("no-dry", "<why>", "why not")
  flags.boolean("dry", "only say what would change")
  console.log("not reached")
  return 0
}
