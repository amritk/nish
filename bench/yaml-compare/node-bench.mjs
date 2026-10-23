// The JavaScript side of bench/yaml-compare: @amritk/yaml's parseAllDocuments
// over one YAML stream, the same two workloads and the same checksum as
// main.ts, whose header describes them. Run by run.mjs under Node, and under
// Bun when it is installed.
//
//   node node-bench.mjs <workload> <file> <iterations> <@amritk/yaml's index.js>
//
// A scalar's text is its `value` when that is a string and its `source`
// otherwise: @amritk/yaml resolves every scalar while it parses, so reading
// the text costs a property load where nish/yaml decodes it.
import fs from "node:fs"
import { pathToFileURL } from "node:url"

const [workload, file, iterationsArg, entry] = process.argv.slice(2)
if (!["parse", "walk"].includes(workload) || entry === undefined) {
  console.error("usage: node-bench.mjs <parse|walk> <file> <iterations> <@amritk/yaml's index.js>")
  process.exit(2)
}
const { parseAllDocuments } = await import(pathToFileURL(entry).href)
const text = fs.readFileSync(file, "utf8")
const iterations = Number(iterationsArg)

const newCounts = () => ({ scalars: 0, maps: 0, seqs: 0, aliases: 0, pairs: 0, textLength: 0 })

/** Counts `node` and everything under it, as main.ts's `visit` does. */
const visit = (node, c, read) => {
  if (node === null || node === undefined) {
    return
  }
  switch (node.kind) {
    case "scalar":
      c.scalars += 1
      if (read) {
        c.textLength += typeof node.value === "string" ? node.value.length : node.source.length
      }
      break
    case "pair":
      c.pairs += 1
      visit(node.key, c, read)
      visit(node.value, c, read)
      break
    case "map":
    case "seq":
      if (node.kind === "map") {
        c.maps += 1
      } else {
        c.seqs += 1
      }
      for (const item of node.items) {
        visit(item, c, read)
      }
      break
    case "alias":
      c.aliases += 1
      break
  }
}

const walk = (docs, read) => {
  const c = newCounts()
  for (const doc of docs) {
    visit(doc.contents, c, read)
  }
  return c
}

const walking = workload === "walk"
let stream = []
let counts = newCounts()
let textLength = 0
const t0 = process.hrtime.bigint()
for (let r = 0; r < iterations; r++) {
  stream = parseAllDocuments(text)
  if (walking) {
    counts = walk(stream, true)
    textLength += counts.textLength
  }
}
const elapsed = process.hrtime.bigint() - t0
if (!walking) {
  counts = walk(stream, false)
}
const errors = stream.reduce((n, doc) => n + doc.errors.length, 0)
console.log(
  `${workload} ${stream.length} ${counts.scalars} ${counts.maps} ${counts.seqs} ${counts.aliases} ${counts.pairs} ${errors}`
)
console.log(`ns ${elapsed}`)
console.log(`text ${textLength}`)
