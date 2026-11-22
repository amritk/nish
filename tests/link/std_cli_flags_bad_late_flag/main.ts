// A parse answers for the flags its table declared when it began: a flag
// declared afterwards has no value in it, so reading one is a bug in the
// program, and it panics rather than answering a default.
import { FlagTable } from "nish/cli-flags"

export const main = (): i32 => {
  const flags = new FlagTable("tool")
  flags.boolean("verbose", "say more")
  const args: string[] = ["--verbose"]
  const got = flags.parse(args)
  flags.string("output", "<file>", "where to write")
  console.log(got.str("output"))
  return 0
}
