// Leading words that spell no declared command are a usage error: `exitUsage`
// writes the program's name, the message and a usage line to stderr and exits
// 2, and nothing reaches stdout.
import { FlagTable } from "nish/cli-flags"

export const main = (): i32 => {
  const flags = new FlagTable("git-lite")
  flags.command("remote add", "<name> <url>", "add a remote")
  flags.command("status", "", "show the state")
  const args: string[] = ["remote", "rename", "a"]
  const got = flags.parse(args)
  if (!got.ok) {
    got.exitUsage()
  }
  console.log("not reached")
  return 0
}
