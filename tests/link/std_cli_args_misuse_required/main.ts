// A default then `required` on one flag is the same mistake the other way
// round: the flag could never be missing, so `required` panics.
import { Cli, ROOT } from "nish/cli-args"

export const main = (): i32 => {
  const cli = new Cli("api", "1.4.0", "Talk to the Example API")
  const list = cli.command(ROOT, "list", 1, "List users")
  const limit = cli.flag(list, "-l, --limit <n>", "at most n users")
  cli.defaultValue(limit, "10")
  cli.required(limit)
  console.log("defaulted and required")
  return 0
}
