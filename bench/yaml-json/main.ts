// The Nish side of bench/yaml-json: what loading a YAML document into a
// JsonDocument costs beside parsing it, in a loop the program times itself.
//
//   main <workload> <file> <iterations>
//
//   parse  the stream parsed with `parseYaml`
//   load   the same parse, then document 0 loaded with `YamlJsonLoader`
//
// The first line is `<workload> <nodes> <values>`: the stream's nodes, and
// the values the last load made (`0` for parse). The second is
// `ns <elapsed>`.
import { JsonLimits } from "nish/json-tokenizer"
import { JSON_VALUE_MAX_VALUES, JsonDocument } from "nish/json-value"
import { YamlStream, parseYaml } from "nish/yaml"
import { YamlJsonLoader } from "nish/yaml-json"

export const main = (): number => {
  if (process.argv.length < 4) {
    console.error("usage: main <parse|load> <file> <iterations>")
    return 2
  }
  const workload: string = process.argv[1]
  if (workload !== "parse" && workload !== "load") {
    console.error(`unknown workload ${workload}`)
    return 2
  }
  const read: string | null = readFileSyncOrNull(process.argv[2])
  if (read === null) {
    console.error(`cannot read ${process.argv[2]}`)
    return 1
  }
  const text: string = read
  const iterations: i32 = toI32(parseInt(process.argv[3]))
  const loading: boolean = workload === "load"
  const doc = new JsonDocument(new JsonLimits())
  doc.maxValues = JSON_VALUE_MAX_VALUES
  const loader = new YamlJsonLoader()
  let s: YamlStream = parseYaml("")
  let failed: i32 = 0
  const t0: i64 = monotonicNanos()
  for (let r: i32 = 0; r < iterations; r += 1) {
    s = parseYaml(text)
    if (loading && loader.load(s, 0, doc) < 0) {
      failed = loader.failed
    }
  }
  const elapsed: i64 = monotonicNanos() - t0
  if (failed < 0) {
    console.error(`load failed: ${failed} at ${loader.errorStart}`)
    return 1
  }
  console.log(`${workload} ${s.kinds.length} ${loading ? doc.top : 0}`)
  console.log(`ns ${elapsed}`)
  return 0
}
