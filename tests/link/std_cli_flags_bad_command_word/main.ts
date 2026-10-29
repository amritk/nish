// A command word with a leading `-` would be read as a flag, never as the
// word, so declaring one panics.
import { FlagTable } from "nish/cli-flags"

export const main = (): i32 => {
  const flags = new FlagTable("tool")
  flags.command("remote --add", "", "add a remote")
  console.log("not reached")
  return 0
}
