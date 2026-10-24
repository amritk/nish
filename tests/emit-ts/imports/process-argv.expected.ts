// `argv` imported from `nish:process` is a value, the command line, which the
// runtime answers as a function: the import is renamed and bound once after
// it, under the name and the alias the program chose. Index 0 is the program
// on both sides, so a run with no arguments has one.
import { idx, argv as __nish2_argv } from "nish/runtime"
import { argv as __nish_argv } from "nish/runtime"
const argv = __nish_argv();
import { argv as __nish_args, exit } from "nish/runtime"
const args = __nish_args();

export const main = (): number => {
  console.log(`${argv.length} ${args.length} ${idx(argv, 0) === idx(args, 0)}`)
  console.log(`${__nish2_argv().length}`)
  if (argv.length !== 1) {
    exit(3)
  }
  return 0
}
