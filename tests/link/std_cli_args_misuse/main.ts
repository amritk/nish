// A declaration mistake panics at the call that made it, naming the call and
// the command it was made on: here a second `--limit` on the same command.
import { Cli, ROOT } from "nish/cli-args"

export const main = (): i32 => {
  const cli = new Cli("api", "1.4.0", "Talk to the Example API")
  const list = cli.command(ROOT, "list", 1, "List users")
  cli.flag(list, "-l, --limit <n>", "at most n users")
  cli.flag(list, "--limit <n>", "the same flag again")
  console.log("declared twice")
  return 0
}
