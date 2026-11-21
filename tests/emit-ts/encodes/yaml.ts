// The end-to-end half of the encode pin (tests/run.js, emit-ts section): a
// program written out with `--emit-ts` loads a YAML document of about 100 KB
// with `parseYaml` and `YamlJsonLoader`, under a Node that counts encodes
// (count.mjs). One scalar is not ASCII, so the document is read through its
// bytes rather than as ASCII. Prints `<units> <nodes> <values>`,
// where `<units>` is the document's length in UTF-16 code units.
import { JsonLimits } from "nish/json-tokenizer"
import { JSON_VALUE_MAX_VALUES, JsonDocument } from "nish/json-value"
import { parseYaml } from "nish/yaml"
import { YamlJsonLoader } from "nish/yaml-json"

export const main = (): number => {
  let text: string = "title: välue\nitems:\n"
  for (let i: i32 = 0; i < 2500; i += 1) {
    text = text + `  - name: item ${i}\n    tags: [a, "b c"]\n`
  }
  const doc = new JsonDocument(new JsonLimits())
  doc.maxValues = JSON_VALUE_MAX_VALUES
  const stream = parseYaml(text)
  if (new YamlJsonLoader().load(stream, 0, doc) < 0) {
    console.error("load failed")
    return 1
  }
  console.log(`${text.length} ${stream.kinds.length} ${doc.top}`)
  return 0
}
