// A number flag's value that is not a finite number is a usage error, reported
// under the command it was given to: `exitUsage` writes the program's name,
// the message and a usage line to stderr and exits 2, and nothing reaches
// stdout.
import { FlagTable } from "nish/cli-flags"

export const main = (): i32 => {
  const flags = new FlagTable("git-lite")
  flags.command("remote add", "<name> <url>", "add a remote")
  flags.number("jobs", "<n>", "parallel jobs")
  const args: string[] = ["remote", "add", "--jobs", "four"]
  const got = flags.parse(args)
  if (!got.ok) {
    got.exitUsage()
  }
  console.log("not reached")
  return 0
}
