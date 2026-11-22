// `has` on a flag declared after the parse: the parse holds no answer for
// it, so asking whether it was given is a bug in the program, and it panics
// rather than answering `false`.
import { FlagTable } from "nish/cli-flags"

export const main = (): i32 => {
  const flags = new FlagTable("tool")
  flags.boolean("verbose", "say more")
  const args: string[] = ["--verbose"]
  const got = flags.parse(args)
  flags.string("output", "<file>", "where to write")
  console.log(`${got.has("output")}`)
  return 0
}
