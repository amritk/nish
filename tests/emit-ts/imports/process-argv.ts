// `argv` imported from `nish:process` is a value, the command line, which the
// runtime answers as a function: the import is renamed and bound once after
// it, under the name and the alias the program chose. Index 0 is the program
// on both sides, so a run with no arguments has one.
import { argv } from "nish:process"
import { argv as args, exit } from "nish:process"

export const main = (): number => {
  console.log(`${argv.length} ${args.length} ${argv[0] === args[0]}`)
  console.log(`${process.argv.length}`)
  if (argv.length !== 1) {
    exit(3)
  }
  return 0
}
