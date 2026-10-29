// A value flag last on the line, with no `=`, is a usage error: `exitUsage`
// writes the program's name, the message and a usage line to stderr and exits
// 2, and nothing reaches stdout.
import { FlagTable } from "nish/cli-flags"

export const main = (): i32 => {
  const flags = new FlagTable("tool")
  flags.string("output", "<file>", "where to write")
  const args: string[] = ["--output"]
  const got = flags.parse(args)
  if (!got.ok) {
    got.exitUsage()
  }
  console.log("not reached")
  return 0
}
