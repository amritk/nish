// Packs the yaml-test-suite's cases into `cases.txt`, one case per line, so the
// corpus keeps its upstream IDs without putting 350 directories and files whose
// inputs hold tabs, CRs, NULs and invalid UTF-8 into the tree
// (`.claude/linting.md`). A line is `<key> <error> <yaml> <json>`; the format is
// specified in tests/yaml-suite/README.md. The reader in `std_yaml_conformance`
// and the check below decode it.
//
//   node tests/yaml-suite/pack.js            fetch the pinned tarball (or take the cached one), rewrite cases.txt
//   node tests/yaml-suite/pack.js --check    verify cases.txt; nothing is fetched or written
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { gunzipSync } from "node:zlib"

// The `yaml-test-suite` npm package, which is the yaml-test-suite's data release
// (https://github.com/yaml/yaml-test-suite) as one JavaScript module per case file.
const PACKAGE = "yaml-test-suite@0.1.0"
const TARBALL_URL = "https://registry.npmjs.org/yaml-test-suite/-/yaml-test-suite-0.1.0.tgz"
const TARBALL_SHA256 = "0f39975dd3410d889837a0ed530008707b009a74ea4450d0be1ff53e2c6e3f32"
const CASE_COUNT = 402

// The notice the packed file carries, split in two so that this script, which
// copies nothing, does not carry it itself (`third-party-licence` in tests/run.js).
const NOTICE = [
  "Test cases from the yaml-test-suite (https://github.com/yaml/yaml-test-suite).",
  "Copyright (c) 2016-2020 Ingy döt Net. Used under the MIT licence; see tests/yaml-suite/LICENSE-yaml-test-suite.",
].join(" ")

const here = import.meta.dirname
const casesFile = path.join(here, "cases.txt")
const cacheFile = path.join(here, "..", "..", "build", "yaml-suite", "yaml-test-suite-0.1.0.tgz")

const sha256 = (data) => createHash("sha256").update(data).digest("hex")

/** A field's bytes in the packed spelling: every byte outside `!` to `~`, and every `%`, as `%XX`. */
const encode = (text) => {
  let out = ""
  for (const b of Buffer.from(text, "utf8")) {
    out +=
      b > 0x20 && b < 0x7f && b !== 0x25
        ? String.fromCharCode(b)
        : `%${b.toString(16).toUpperCase().padStart(2, "0")}`
  }
  // A lone `-` spells an absent field, so a present one is escaped.
  return out === "-" ? "%2D" : out
}

/** The file's entries from a gzip-compressed ustar archive, as [name, bytes]. */
const untar = (gz) => {
  const tar = gunzipSync(gz)
  const entries = []
  for (let at = 0; at + 512 <= tar.length && tar[at] !== 0; ) {
    const field = (from, len) => tar.toString("latin1", at + from, at + from + len).replace(/\0.*$/s, "")
    const size = Number.parseInt(field(124, 12).trim(), 8)
    if (field(156, 1) === "0" || field(156, 1) === "") {
      entries.push([field(0, 100), tar.subarray(at + 512, at + 512 + size)])
    }
    at += 512 + Math.ceil(size / 512) * 512
  }
  return entries
}

/** Every case of the tarball as `{ key, error, yaml, json }`, in ID order. */
const readCases = (tarball) => {
  const files = untar(tarball)
    .filter(([name]) => /^package\/data\/[0-9A-Z]{4}\.js$/.test(name))
    .sort(([a], [b]) => (a < b ? -1 : 1))
  const cases = []
  for (const [name, bytes] of files) {
    // Each module is `export default {...}` followed by a re-export of its name; the object is JSON.
    const text = bytes.toString("utf8")
    const entry = JSON.parse(text.slice(text.indexOf("export default {") + 15, text.lastIndexOf("}") + 1))
    if (!/^[0-9A-Z]{4}$/.test(entry.id) || name !== `package/data/${entry.id}.js`) {
      throw new Error(`${name} holds the case ${entry.id}`)
    }
    entry.cases.forEach((c, i) => {
      cases.push({
        key: entry.cases.length > 1 ? `${entry.id}/${i}` : entry.id,
        error: c.fail === true,
        yaml: c.yaml,
        json: c.json ?? null,
      })
    })
  }
  return cases
}

const render = (cases, tarballSha) => {
  const body = cases.map(
    (c) => `${c.key} ${c.error ? 1 : 0} ${encode(c.yaml)} ${c.json === null ? "-" : encode(c.json)}`
  )
  const bodySha = sha256(`${body.join("\n")}\n`)
  return (
    [
      `# ${NOTICE}`,
      `# Source ${PACKAGE} (${TARBALL_URL}), sha256 ${tarballSha}.`,
      `# Cases ${cases.length}. Body sha256 ${bodySha}.`,
      "# Packed by tests/yaml-suite/pack.js: one case per line, `<key> <error> <yaml> <json>`, with every",
      "# byte outside 0x21 to 0x7e, and every `%`, written as %XX, and a lone `-` for an absent json.",
      ...body,
    ].join("\n") + "\n"
  )
}

const fetchTarball = () => {
  if (fs.existsSync(cacheFile)) {
    const cached = fs.readFileSync(cacheFile)
    if (sha256(cached) === TARBALL_SHA256) {
      return cached
    }
  }
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true })
  const tarball = execFileSync("curl", ["-fsSL", TARBALL_URL], { maxBuffer: 1 << 28 })
  if (sha256(tarball) !== TARBALL_SHA256) {
    throw new Error(`${TARBALL_URL} is not the pinned tarball (sha256 ${TARBALL_SHA256})`)
  }
  fs.writeFileSync(cacheFile, tarball)
  return tarball
}

/** The problems with cases.txt; empty when it is the file this script writes. */
const problems = () => {
  const text = fs.readFileSync(casesFile, "utf8")
  if (fs.existsSync(cacheFile)) {
    const tarball = fs.readFileSync(cacheFile)
    if (sha256(tarball) !== TARBALL_SHA256) {
      return ["the cached tarball is not the pinned one"]
    }
    return text === render(readCases(tarball), TARBALL_SHA256)
      ? []
      : ["cases.txt is not what the cached tarball packs to"]
  }
  const out = []
  const lines = text.split("\n")
  if (lines.pop() !== "") {
    out.push("cases.txt does not end in a newline")
  }
  const head = lines.slice(0, 5)
  const body = lines.slice(5)
  if (head[0] !== `# ${NOTICE}`) {
    out.push("the notice line is wrong")
  }
  if (!head[1]?.includes(`${PACKAGE} (${TARBALL_URL}), sha256 ${TARBALL_SHA256}.`)) {
    out.push("the source pin is wrong")
  }
  const count = /^# Cases (\d+)\. Body sha256 ([0-9a-f]{64})\.$/.exec(head[2] ?? "")
  if (count === null || Number(count[1]) !== CASE_COUNT) {
    out.push(`the case count is not ${CASE_COUNT}`)
  }
  if (body.length !== CASE_COUNT) {
    out.push(`cases.txt holds ${body.length} cases, not ${CASE_COUNT}`)
  }
  if (count !== null && sha256(`${body.join("\n")}\n`) !== count[2]) {
    out.push("the body does not match its sha256")
  }
  const keys = new Set()
  for (const [i, line] of body.entries()) {
    const f = line.split(" ")
    const valid = (v) => /^(?:[!-$&-~]|%[0-9A-F]{2})*$/.test(v)
    if (
      f.length !== 4 ||
      !/^[0-9A-Z]{4}(?:\/\d+)?$/.test(f[0]) ||
      !/^[01]$/.test(f[1]) ||
      !valid(f[2]) ||
      (f[3] !== "-" && !valid(f[3]))
    ) {
      out.push(`case ${i + 1} is not a well-formed record`)
    } else if (keys.has(f[0])) {
      out.push(`case ${f[0]} is repeated`)
    }
    keys.add(f[0])
  }
  return out
}

const main = (argv) => {
  if (argv.length === 1 && argv[0] === "--check") {
    const found = problems()
    for (const problem of found) {
      process.stderr.write(`tests/yaml-suite/cases.txt: ${problem}\n`)
    }
    return found.length === 0 ? 0 : 1
  }
  if (argv.length > 0) {
    process.stderr.write("usage: node tests/yaml-suite/pack.js [--check]\n")
    return 2
  }
  const cases = readCases(fetchTarball())
  if (cases.length !== CASE_COUNT) {
    throw new Error(`the tarball holds ${cases.length} cases, not ${CASE_COUNT}`)
  }
  fs.writeFileSync(casesFile, render(cases, TARBALL_SHA256))
  return 0
}

process.exitCode = main(process.argv.slice(2))
