// The Nish side of bench/yaml-compare: nish/yaml over one YAML stream, in a
// loop the program times itself, with a checksum that the @amritk/yaml side
// (node-bench.mjs) must print too.
//
//   main <workload> <file> <iterations>
//
//   parse  every document of the stream parsed with `parseYaml`
//   walk   the same parse, then every node of every document visited from its
//          root and every scalar's text decoded with `text`: what a linter
//          pays, since nish/yaml decodes a scalar only when it is read
//
// The checksum line is `<workload> <documents> <scalars> <maps> <seqs>
// <aliases> <pairs> <errors>`: the nodes a walk from each document's root
// reaches, an alias counted and not followed, and the stream's errors
// (warnings are not counted). For parse it is the walk of the last
// iteration's stream, outside the clock. No offset is in it: nish/yaml's are
// bytes and @amritk/yaml's UTF-16 units. The second line is `ns <elapsed>`,
// and the third `text <bytes>`, the decoded scalars' bytes, printed so the
// reads are not optimised away and compared with nothing.
import { YAML_ALIAS, YAML_MAP, YAML_PAIR, YAML_SCALAR, YAML_SEQ, YamlStream, parseYaml } from "nish/yaml"

class Counts {
  scalars: i64 = 0
  maps: i64 = 0
  seqs: i64 = 0
  aliases: i64 = 0
  pairs: i64 = 0
  textBytes: i64 = 0
}

/** Counts node `n` and everything under it; with `read`, decodes every scalar's text. */
const visit = (s: YamlStream, n: i32, c: Counts, read: boolean): void => {
  const k: i32 = s.kind(n)
  if (k === YAML_SCALAR) {
    c.scalars += 1
    if (read) {
      c.textBytes += toI64(s.text(n).length)
    }
  } else if (k === YAML_PAIR) {
    c.pairs += 1
    visit(s, s.key(n), c, read)
    visit(s, s.value(n), c, read)
  } else if (k === YAML_MAP || k === YAML_SEQ) {
    if (k === YAML_MAP) {
      c.maps += 1
    } else {
      c.seqs += 1
    }
    const count: i32 = s.count(n)
    for (let i: i32 = 0; i < count; i += 1) {
      visit(s, s.child(n, i), c, read)
    }
  } else if (k === YAML_ALIAS) {
    c.aliases += 1
  }
}

const walk = (s: YamlStream, read: boolean): Counts => {
  const c = new Counts()
  const docs: i32 = s.documentCount()
  for (let d: i32 = 0; d < docs; d += 1) {
    visit(s, s.documentRoot(d), c, read)
  }
  return c
}

export const main = (): number => {
  if (process.argv.length < 4) {
    console.error("usage: main <parse|walk> <file> <iterations>")
    return 2
  }
  const workload: string = process.argv[1]
  if (workload !== "parse" && workload !== "walk") {
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
  const walking: boolean = workload === "walk"
  let s: YamlStream = parseYaml("")
  let c = new Counts()
  let textBytes: i64 = 0
  const t0: i64 = monotonicNanos()
  for (let r: i32 = 0; r < iterations; r += 1) {
    s = parseYaml(text)
    if (walking) {
      c = walk(s, true)
      textBytes += c.textBytes
    }
  }
  const elapsed: i64 = monotonicNanos() - t0
  if (!walking) {
    c = walk(s, false)
  }
  console.log(
    `${workload} ${s.documentCount()} ${c.scalars} ${c.maps} ${c.seqs} ${c.aliases} ${c.pairs} ${s.errors}`
  )
  console.log(`ns ${elapsed}`)
  console.log(`text ${textBytes}`)
  return 0
}
