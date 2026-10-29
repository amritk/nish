// `exitUsage` reports a usage error; on a parse that succeeded there is none,
// so calling it is a bug in the program, and it panics rather than exiting 2
// with an empty message.
import { FlagTable } from "nish/cli-flags"

export const main = (): i32 => {
  const flags = new FlagTable("tool")
  flags.boolean("verbose", "say more")
  const args: string[] = ["--verbose"]
  const got = flags.parse(args)
  got.exitUsage()
  console.log("not reached")
  return 0
}
