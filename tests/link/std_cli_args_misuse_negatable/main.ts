// A command's own `--no-color <when>` is declared first, so making the global
// `--color` negatable would shadow it: `negatable` panics.
import { Cli, ROOT } from "nish/cli-args"

export const main = (): i32 => {
  const cli = new Cli("api", "1.4.0", "Talk to the Example API")
  const list = cli.command(ROOT, "list", 1, "List users")
  cli.flag(list, "--no-color <when>", "when not to paint")
  const color = cli.globalFlag("--color", "paint the output")
  cli.negatable(color)
  console.log("shadowed")
  return 0
}
