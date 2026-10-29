// `finish` on a command line `parse` refuses: the error line and the hint on
// standard error, nothing on standard output, and exit 2. The arguments are
// made here, so the program runs the same with none given.
import { Cli, ROOT, finish } from "nish/cli-args"
import { Style } from "nish/cli"

export const main = (): i32 => {
  const cli = new Cli("api", "1.4.0", "Talk to the Example API")
  const users = cli.group(ROOT, "users", "Manage users")
  const list = cli.command(users, "list", 1, "List users")
  cli.flag(list, "-l, --limit <n>", "at most n users")
  const r = cli.parse(["api", "users", "list", "--limt", "5"], 1)
  const plain = new Style(false, false)
  finish(r, plain, plain)
  console.log("finish returned on an error")
  return 0
}
