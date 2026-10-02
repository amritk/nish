// Instantiates the probe module once per probe, since a probe that returns
// has left that instance's arena in whatever state the bug left it in, and
// prints what each did: `trap` is the sound answer, and `returned 1` for
// `probe_array_max`, which asks for no more than the limit.
import { readFileSync } from "node:fs"

const bytes = readFileSync(process.argv[2])
for (const name of ["probe_wrap", "probe_truncate", "probe_array", "probe_array_max", "probe_grow"]) {
  const { instance } = await WebAssembly.instantiate(bytes, {})
  let result
  try {
    result = `returned ${instance.exports[name]()}`
  } catch (e) {
    result = e instanceof WebAssembly.RuntimeError ? "trap" : String(e)
  }
  console.log(`${name}: ${result}`)
}
