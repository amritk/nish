// YAML loaded as JSON (std/yaml-json.ts) under an instruction count: one fixed
// document, parsed once, whose anchors, aliases and merge keys expand, loaded
// `n` times into a `JsonDocument`, written back out as YAML (std/yaml-write.ts)
// and every value's range turned into a line and column (std/yaml-lines.ts).
// It reaches the loader, the writer and the line index whose panic sites the
// std/ ratchet counts, so a fix to one of them shows here as a count that
// holds or falls. It prints the sum of the values, text widths and positions
// it read.
import { JsonLimits } from "nish/json-tokenizer"
import { JsonDocument } from "nish/json-value"
import { parseYaml } from "nish/yaml"
import { YamlJsonLoader } from "nish/yaml-json"
import { YamlLineIndex } from "nish/yaml-lines"
import { stringifyYaml } from "nish/yaml-write"

const document = (): string => {
  const lines: string[] = [
    "# a deployment",
    "base: &base",
    "  retries: 5",
    "  timeout: 30.5",
    "  verbose: false",
    "  owner: ~",
    "  tags: [alpha, \"beta\", 'gamma']",
    "limits: &limits {cpu: 2, memory: 0x200, burst: +7, ratio: .5}",
  ]
  for (let i: i32 = 0; i < 16; i++) {
    lines.push(`job${i}:`)
    lines.push("  <<: *base")
    lines.push(`  retries: ${i}`)
    lines.push("  limits: *limits")
    lines.push(`  "quoted key ${i}": "text with \\u00e9 and \\t"`)
    lines.push(`  plain: some words for job ${i}`)
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
  const n: i32 = 150 // bench:n
  const text = document()
  const stream = parseYaml(text)
  const index = new YamlLineIndex(text)
  const doc = new JsonDocument(new JsonLimits())
  const loader = new YamlJsonLoader()
  let sum: i64 = 0
  for (let round: i32 = 0; round < n; round++) {
    const root = loader.load(stream, 0, doc)
    if (root < 0) {
      console.log(`failed ${loader.failed} at ${loader.errorStart}`)
      return 1
    }
    const out = stringifyYaml(doc, root)
    sum += toI64(out.length)
    const keys: i32 = doc.length(root)
    for (let k: i32 = 0; k < keys; k++) {
      const job = doc.at(root, k)
      const at: i32 = doc.start(job)
      sum += toI64(index.line(at)) + toI64(index.column(at)) + toI64(doc.length(job))
      const start: i32 = doc.keyStart(root, k)
      sum += toI64(index.byteColumn(start))
    }
  }
  console.log(`${sum}`)
  return 0
}
