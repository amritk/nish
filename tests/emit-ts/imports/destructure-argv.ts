// A pattern over `process.argv` reads the program's command line, as the
// hand-written `process.argv[0]` does: `--emit-ts` writes both as the
// runtime's `argv()`, never Node's own global, which holds `node` first.
// Each read of `argv()` is a fresh copy, so `pair`'s guard proves nothing
// about the copy its pattern reads: both patterns are checked, as their
// hand-written reads are (the launcher passes no arguments, so `pair`
// answers `short` on both sides).
const pair = (): string => {
  if (process.argv.length < 2) {
    return "short"
  }
  const [program, first] = process.argv
  return `${program === process.argv[0]} ${first === process.argv[1]}`
}

export const main = (): number => {
  const [program] = process.argv
  console.log(`${program === process.argv[0]} ${process.argv.length}`)
  console.log(pair())
  return 0
}
