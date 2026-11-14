// A pattern over `process.argv` reads the program's command line, as the
// hand-written `process.argv[0]` does: `--emit-ts` writes both as the
// runtime's `argv()`, never Node's own global, which holds `node` first.
// Each read of `argv()` is a fresh copy, so `pair`'s guard proves nothing
// about the copy its pattern reads: both patterns are checked, as their
// hand-written reads are (the launcher passes no arguments, so `pair`
// answers `short` on both sides).
import { argv, idx } from "nish/runtime"
const pair = (): string => {
  if (argv().length < 2) {
    return "short"
  }
  const [program, first] = ((__t0) => (idx(__t0, 0), idx(__t0, 1), __t0))(argv())
  return `${program === idx(argv(), 0)} ${first === idx(argv(), 1)}`
}

export const main = (): number => {
  const [program] = ((__t1) => (idx(__t1, 0), __t1))(argv())
  console.log(`${program === idx(argv(), 0)} ${argv().length}`)
  console.log(pair())
  return 0
}
