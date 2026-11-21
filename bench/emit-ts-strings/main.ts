// The Nish side of bench/emit-ts-strings: a YAML load and a JSON parse that
// read their input as a `string`, the path a program written back out with
// `--emit-ts` takes through runtime/core/strings.mjs for every byte. The same
// source is built natively, for wasm32-wasi and with `--emit-ts`.
//
//   main <workload> <file> <iterations>
//
//   yaml  the stream parsed with `parseYaml`, document 0 loaded into a
//         `JsonDocument` with `YamlJsonLoader`
//   json  the text parsed with `JsonDocument.parseText`
//
// The first line is the checksum, `<workload> <nodes> <values>`, the second
// `ns <elapsed>` for every iteration together.
import { JsonLimits } from "nish/json-tokenizer"
import { JSON_VALUE_MAX_VALUES, JsonDocument } from "nish/json-value"
import { YamlStream, parseYaml } from "nish/yaml"
import { YamlJsonLoader } from "nish/yaml-json"

export const main = (): number => {
  if (process.argv.length < 4) {
    console.error("usage: main <yaml|json> <file> <iterations>")
    return 2
  }
  const workload: string = process.argv[1]
  if (workload !== "yaml" && workload !== "json") {
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
  const doc = new JsonDocument(new JsonLimits())
  doc.maxValues = JSON_VALUE_MAX_VALUES
  const loader = new YamlJsonLoader()
  let s: YamlStream = parseYaml("")
  let nodes: i32 = 0
  const t0: i64 = monotonicNanos()
  for (let r: i32 = 0; r < iterations; r += 1) {
    if (workload === "yaml") {
      s = parseYaml(text)
      nodes = toI32(s.kinds.length)
      if (loader.load(s, 0, doc) < 0) {
        console.error(`load failed: ${loader.failed} at ${loader.errorStart}`)
        return 1
      }
    } else {
      const root = doc.parseText(text)
      if (root < 0) {
        console.error(`parse failed: ${root} at ${doc.errorAt}`)
        return 1
      }
      nodes = doc.length(root)
    }
  }
  const elapsed: i64 = monotonicNanos() - t0
  console.log(`${workload} ${nodes} ${doc.top}`)
  console.log(`ns ${elapsed}`)
  return 0
}
