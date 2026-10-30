// A `--sandbox` probe whose main reaches ffi, fs.read, fs.write and
// process.spawn: tests/run.js runs the rows refused whatever main reaches
// against it, so they are not read only where everything is withheld. The
// guarded calls are never made; they are there so that main's capability set
// holds what they name.
declare function sb_probe(op: string, path: string): i32;

export const main = (): number => {
  const args = process.argv
  if (args.length > 9) console.log(readFileSync(args[3]))
  if (args.length > 9) writeFileSync(args[3], "x")
  if (args.length > 9) console.log(spawnSync([args[3]]))
  return sb_probe(args[1], args.length > 2 ? args[2] : "")
}
