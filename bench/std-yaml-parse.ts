// A YAML parse (std/yaml.ts) under an instruction count: one fixed document of
// block mappings and sequences, flow collections, plain, quoted and block
// scalars, comments, and an anchor with its aliases, parsed `n` times. It
// reaches the scanner and parser whose panic sites the std/ ratchet counts, so
// a fix to one of them shows here as a count that holds or falls. It prints
// the sum of the node counts, scalar widths and integers it read.
import { YAML_ALIAS, YAML_INT, YAML_PAIR, YAML_SCALAR, YamlStream, parseYaml } from "nish/yaml"

/** The node count, scalar widths and integers under `root`, walked with a stack. */
const walk = (stream: YamlStream, root: i32): i64 => {
  let sum: i64 = 0
  const pending: i32[] = [root]
  while (pending.length > 0) {
    const node: i32 = pending[pending.length - 1]
    pending.pop()
    if (node < 0) {
      continue
    }
    sum += 1
    const kind: i32 = stream.kind(node)
    if (kind === YAML_SCALAR) {
      sum += toI64(stream.end(node) - stream.start(node))
      if (stream.type(node) === YAML_INT) {
        sum += stream.intValue(node)
      }
    } else if (kind === YAML_PAIR) {
      pending.push(stream.key(node))
      pending.push(stream.value(node))
    } else if (kind !== YAML_ALIAS) {
      for (let i: i32 = 0; i < stream.count(node); i++) {
        pending.push(stream.child(node, i))
      }
    }
  }
  return sum
}

const document = (): string => {
  const lines: string[] = [
    "# a service description",
    "name: bench",
    "version: 3",
    "ratio: 0.75",
    "enabled: true",
    "nothing: ~",
    "defaults: &defaults",
    "  retries: 5",
    "  timeout: 30",
    "  tags: [alpha, \"beta\", 'gamma']",
  ]
  for (let i: i32 = 0; i < 24; i++) {
    lines.push(`service${i}:`)
    lines.push("  base: *defaults")
    lines.push(`  port: ${8000 + i}`)
    lines.push(`  host: "host-${i}.example\\tinternal"`)
    lines.push(`  label: 'it''s number ${i}'`)
    lines.push("  limits: {cpu: 2, memory: 512, burst: 0x1f}")
    lines.push("  routes:")
    lines.push(`    - path: /api/v${i}`)
    lines.push("      methods: [GET, POST]")
    lines.push("    - path: /health # probed")
    lines.push("      methods: [GET]")
    lines.push("  notes: |")
    lines.push(`    line one of ${i}`)
    lines.push("    line two")
    lines.push("  summary: >-")
    lines.push("    folded text")
    lines.push(`    over ${i} lines`)
  }
  return `${lines.join("\n")}\n`
}

export const main = (): i32 => {
  const n: i32 = 100 // bench:n
  const text = document()
  let sum: i64 = 0
  for (let round: i32 = 0; round < n; round++) {
    const stream = parseYaml(text)
    if (stream.errorCount() !== 0) {
      console.log(`failed: ${stream.diagnosticMessage(0)} at ${stream.diagnosticStart(0)}`)
      return 1
    }
    sum += walk(stream, stream.documentRoot(0))
  }
  console.log(`${sum}`)
  return 0
}
