// A required flag with a default is a declaration mistake: the default would
// never be read. It panics at the second call, whichever order they come in.
import { Cli, ROOT } from "nish/cli-args"

export const main = (): i32 => {
  const cli = new Cli("api", "1.4.0", "Talk to the Example API")
  const list = cli.command(ROOT, "list", 1, "List users")
  const limit = cli.flag(list, "-l, --limit <n>", "at most n users")
  cli.required(limit)
  cli.defaultValue(limit, "10")
  console.log("required and defaulted")
  return 0
}
