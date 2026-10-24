// A `--sandbox` probe whose main reaches ffi, fs.read and the thread pool:
// tests/run.js builds it with `--threads`, so the map below runs on the pool,
// and `<exe> status` then prints the Threads line of /proc/self/status that
// says how many threads the pool started under the sandbox.
import { parallelMapInto } from "nish/threads"

declare function sb_probe(op: string, path: string): i32

const double = (x: f64): f64 => x * 2.0

export const main = (): number => {
  const args = process.argv
  if (args.length > 9) console.log(readFileSync(args[3]))
  const src: f64[] = []
  for (let i = 0; i < 1000000; i++) src.push(toF64(i))
  const dst: f64[] = []
  for (let i = 0; i < 1000000; i++) dst.push(0.0)
  parallelMapInto(src, dst, double)
  console.log(`${dst[999999]}`)
  return sb_probe(args[1], args.length > 2 ? args[2] : "")
}
