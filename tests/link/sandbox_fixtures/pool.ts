// A `--sandbox` probe whose main reaches ffi and the thread pool and nothing
// else: without fs.read the cgroup quota is unreadable once the process is
// confined, so tests/run.js reads `<exe> tasks` under a quota to see that the
// pool was sized from the count primed before confinement.
import { parallelMapInto } from "nish/threads"

declare function sb_probe(op: string, path: string): i32

const double = (x: f64): f64 => x * 2.0

export const main = (): number => {
  const args = process.argv
  const src: f64[] = []
  for (let i = 0; i < 1000000; i++) src.push(toF64(i))
  const dst: f64[] = []
  for (let i = 0; i < 1000000; i++) dst.push(0.0)
  parallelMapInto(src, dst, double)
  console.log(`${dst[999999]}`)
  return sb_probe(args[1], args.length > 2 ? args[2] : "")
}
