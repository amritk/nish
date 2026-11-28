// YAML loaded as JSON (std/yaml-json.ts) under an instruction count, grown from
// empty: about 1 MiB of generated YAML, 3,000 jobs that each merge an anchored
// mapping and alias a second one, parsed by `parseYaml` and loaded by a fresh
// `YamlJsonLoader` into a fresh `JsonDocument` `n` times, so every round pays
// the scanner, the event tree and the document's growth from nothing. Beside
// std-yaml-json, which loads one small parsed stream many times into one
// document, it counts the parse and the growth a real load pays. It prints the
// text's length and the sum of the member counts it read.
import { JsonLimits } from "nish/json-tokenizer"
import { JsonDocument } from "nish/json-value"
import { parseYaml } from "nish/yaml"
import { YamlJsonLoader } from "nish/yaml-json"

const JOBS: i32 = 3000

const document = (): string => {
  const lines: string[] = [
    "# a generated deployment",
    "base: &base",
    "  retries: 5",
    "  timeout: 30.5",
    "  verbose: false",
    "  owner: ~",
    "  tags: [alpha, \"beta\", 'gamma']",
    "limits: &limits {cpu: 2, memory: 0x200, burst: +7, ratio: .5}",
  ]
  for (let i: i32 = 0; i < JOBS; i++) {
    lines.push(`job${i}:`)
    lines.push("  <<: *base")
    lines.push(`  retries: ${i}`)
    lines.push("  limits: *limits")
    lines.push(`  "quoted key ${i}": "text with \\u00e9 and \\t"`)
    lines.push(`  plain: some words for job ${i} of the generated document`)
    lines.push("  steps:")
    lines.push(`    - run: make target${i}`)
    lines.push("      env: {CC: clang, LEVEL: 2}")
    lines.push("    - run: make check")
    lines.push(`      when: 1e${i % 5}`)
    lines.push("  script: |")
    lines.push("    first line")
    lines.push(`    second line ${i}`)
  }
  return `${lines.join("\n")}\n`
}

export const main = (): i32 => {
  const n: i32 = 1 // bench:n
  const text = document()
  let sum: i64 = 0
  for (let round: i32 = 0; round < n; round++) {
    const stream = parseYaml(text)
    const doc = new JsonDocument(new JsonLimits())
    doc.maxValues = 4194304
    const loader = new YamlJsonLoader()
    const root = loader.load(stream, 0, doc)
    if (root < 0) {
      console.log(`failed ${loader.failed} at ${loader.errorStart}`)
      return 1
    }
    const keys: i32 = doc.length(root)
    sum += toI64(keys)
    for (let k: i32 = 0; k < keys; k++) {
      sum += toI64(doc.length(doc.at(root, k)))
    }
  }
  console.log(`${text.length} ${sum}`)
  return 0
}
