// A negatable global `--color` answers to `--no-color` in every command, so a
// command's own `--no-color <when>` would be shadowed: the declaration panics.
import { Cli, ROOT } from "nish/cli-args"

export const main = (): i32 => {
  const cli = new Cli("api", "1.4.0", "Talk to the Example API")
  const color = cli.globalFlag("--color", "paint the output")
  cli.negatable(color)
  const list = cli.command(ROOT, "list", 1, "List users")
  cli.flag(list, "--no-color <when>", "when not to paint")
  console.log("shadowed")
  return 0
}
