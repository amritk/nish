// A `--sandbox` probe whose main reaches ffi alone: tests/run.js
// links it with probe.c and runs `<exe> <op> [path]`. The guarded call is never
// made; it is there so that main's capability set holds what it names.
declare function sb_probe(op: string, path: string): i32;

export const main = (): number => {
  const args = process.argv
  return sb_probe(args[1], args.length > 2 ? args[2] : "")
}
