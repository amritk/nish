// A `--sandbox` probe whose main reaches ffi alone: tests/run.js
// links it with probe.c and runs `<exe> <op> [path]`. main reaches no other
// capability, so the probe runs with every one withheld.
declare function sb_probe(op: string, path: string): i32;

export const main = (): number => {
  const args = process.argv
  return sb_probe(args[1], args.length > 2 ? args[2] : "")
}
