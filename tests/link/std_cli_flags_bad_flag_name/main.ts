// A flag name a command line could never match — here one holding `=`,
// which `--name=value` would split — is a bug in the table, so declaring it
// panics before anything is parsed.
import { FlagTable } from "nish/cli-flags"

export const main = (): i32 => {
  const flags = new FlagTable("tool")
  flags.string("out=file", "<file>", "where to write")
  console.log("not reached")
  return 0
}
