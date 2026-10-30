// Packs the JSON-Schema-Test-Suite's draft 2020-12 groups that the JSON
// Pointer, value equality and exact decimal modules answer into `cases.txt`,
// one group per line, each the upstream JSON with the whitespace between its
// tokens dropped and nothing else changed: a number keeps its spelling (`1.0`,
// `1e308`), which JSON.parse would lose. A line is `<file> <group>`; the format
// is specified in tests/json-schema-suite/README.md.
//
//   node tests/json-schema-suite/pack.js            clone the pinned commit (or take the cached one), rewrite cases.txt
//   node tests/json-schema-suite/pack.js --check    verify cases.txt; nothing is fetched or written
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const REPOSITORY = "https://github.com/json-schema-org/JSON-Schema-Test-Suite"
const COMMIT = "89e83a74014617ffbe79a56d83d14d054cd11417"
const DRAFT = "tests/draft2020-12"

// Each packed file, as its path under DRAFT without `.json`, and its sha256 at COMMIT.
const FILES = [
  ["const", "83a148d2589cbd211e7e64b31763290f8869d763f513de4658e8d25f0fcc025e"],
  ["enum", "1abe7eb883bde4a78c62f08e484e16f32b72ca5c1be725aa54d85cc4546b5031"],
  ["uniqueItems", "ed84ef6ddc827659e257ba64cbe9679f06932b6320bea5c07622bf3d2cc4daa5"],
  ["multipleOf", "ada35b586efe55186d35d8888a4e4954724c313253b59bd47ec03637a44cb4ad"],
  ["minimum", "f6a29cb574b76621da23636a636cf12cb31b01646b89543e6ce1a813376439a3"],
  ["maximum", "dfbc88ef4ede2966250fb2ad44076856d51481ea01ce679cca70efe47606ee90"],
  ["exclusiveMinimum", "0395a2423606d07943d3d355d1c9c4a474cc7cb544d3c8f266ceab801c5f0a6d"],
  ["exclusiveMaximum", "e37fc110c48e2a9de564579ceba3e8ab098a36f904dcc1ef02f8cf7b59dc0473"],
  ["optional/bignum", "52608148c500b3c4eeab2066317939cee5901991c38a234f4cc6179289cd8bf4"],
  ["optional/float-overflow", "bfccb3bf6e4eb6f15a572dccc0e7ad93e6ff24911991355fd9ba2d75deae02e1"],
  ["optional/format/json-pointer", "0388151d9484b9dd10b734431a8dd742b52c2495b3ba9377c941d03faf099bc1"],
  [
    "optional/format/relative-json-pointer",
    "8bbe1d6bd8a355435fdfafccf143ca338b2530fa486315ce696f109d8e1fb869",
  ],
]
const GROUP_COUNT = 60

// The notice the packed file carries, split in two so that this script, which
// copies nothing, does not carry it itself (`third-party-licence` in tests/run.js).
const NOTICE = [
  "Test cases from the JSON-Schema-Test-Suite (https://github.com/json-schema-org/JSON-Schema-Test-Suite).",
  "Copyright (c) 2012 Julian Berman. Used under the MIT licence; see tests/json-schema-suite/LICENSE-json-schema-test-suite.",
].join(" ")

const here = import.meta.dirname
const casesFile = path.join(here, "cases.txt")
const cacheDir = path.join(here, "..", "..", "build", "json-schema-suite")

const sha256 = (data) => createHash("sha256").update(data).digest("hex")

/** `text`, a JSON text, with the whitespace between its tokens dropped; strings are kept byte for byte. */
const squeeze = (text) => {
  let out = ""
  let inString = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inString) {
      out += c
      if (c === "\\") {
        out += text[++i]
      } else if (c === '"') {
        inString = false
      }
    } else if (c === '"') {
      inString = true
      out += c
    } else if (c !== " " && c !== "\t" && c !== "\n" && c !== "\r") {
      out += c
    }
  }
  return out
}

/** The elements of `text`, a squeezed JSON array, each as its own text. */
const elements = (text) => {
  if (text[0] !== "[" || text[text.length - 1] !== "]") {
    throw new Error("a suite file is not one JSON array")
  }
  const out = []
  let depth = 0
  let inString = false
  let from = 1
  for (let i = 1; i < text.length - 1; i++) {
    const c = text[i]
    if (inString) {
      if (c === "\\") {
        i += 1
      } else if (c === '"') {
        inString = false
      }
    } else if (c === '"') {
      inString = true
    } else if (c === "[" || c === "{") {
      depth += 1
    } else if (c === "]" || c === "}") {
      depth -= 1
    } else if (c === "," && depth === 0) {
      out.push(text.slice(from, i))
      from = i + 1
    }
  }
  out.push(text.slice(from, text.length - 1))
  return out
}

/** Every group of the pinned files in `checkout`, as `{ file, group }`, in FILES order. */
const readGroups = (checkout) => {
  const groups = []
  for (const [file, pin] of FILES) {
    const bytes = fs.readFileSync(path.join(checkout, DRAFT, `${file}.json`))
    if (sha256(bytes) !== pin) {
      throw new Error(`${DRAFT}/${file}.json is not the pinned file (sha256 ${pin})`)
    }
    const text = bytes.toString("utf8")
    for (const group of elements(squeeze(text))) {
      const parsed = JSON.parse(group)
      if (typeof parsed.description !== "string" || !Array.isArray(parsed.tests)) {
        throw new Error(`${file}: a group is not { description, schema, tests }`)
      }
      groups.push({ file, group })
    }
  }
  return groups
}

const render = (groups) => {
  const body = groups.map((g) => `${g.file} ${g.group}`)
  const bodySha = sha256(`${body.join("\n")}\n`)
  return (
    [
      `# ${NOTICE}`,
      `# Source ${REPOSITORY} at ${COMMIT}, ${DRAFT}.`,
      `# Groups ${groups.length}. Body sha256 ${bodySha}.`,
      "# Packed by tests/json-schema-suite/pack.js: one test group per line, `<file> <group>`, the group",
      "# being upstream's JSON with the whitespace between tokens dropped, every number's spelling kept.",
      ...body,
    ].join("\n") + "\n"
  )
}

const fetchCheckout = () => {
  if (!fs.existsSync(path.join(cacheDir, ".git"))) {
    fs.mkdirSync(path.dirname(cacheDir), { recursive: true })
    execFileSync("git", ["clone", "--quiet", REPOSITORY, cacheDir], { stdio: "inherit" })
  }
  execFileSync("git", ["-C", cacheDir, "checkout", "--quiet", COMMIT], { stdio: "inherit" })
  return cacheDir
}

/** The problems with cases.txt; empty when it is the file this script writes. */
const problems = () => {
  const text = fs.readFileSync(casesFile, "utf8")
  if (fs.existsSync(path.join(cacheDir, ".git"))) {
    return text === render(readGroups(fetchCheckout()))
      ? []
      : ["cases.txt is not what the cached checkout packs to"]
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
  if (head[1] !== `# Source ${REPOSITORY} at ${COMMIT}, ${DRAFT}.`) {
    out.push("the source pin is wrong")
  }
  const count = /^# Groups (\d+)\. Body sha256 ([0-9a-f]{64})\.$/.exec(head[2] ?? "")
  if (count === null || Number(count[1]) !== GROUP_COUNT) {
    out.push(`the group count is not ${GROUP_COUNT}`)
  }
  if (body.length !== GROUP_COUNT) {
    out.push(`cases.txt holds ${body.length} groups, not ${GROUP_COUNT}`)
  }
  if (count !== null && sha256(`${body.join("\n")}\n`) !== count[2]) {
    out.push("the body does not match its sha256")
  }
  const files = new Set(FILES.map(([file]) => file))
  for (const [i, line] of body.entries()) {
    const space = line.indexOf(" ")
    let group = null
    try {
      group = JSON.parse(line.slice(space + 1))
    } catch {
      group = null
    }
    if (space < 0 || !files.has(line.slice(0, space)) || group === null || !Array.isArray(group.tests)) {
      out.push(`group ${i + 1} is not a well-formed record`)
    }
  }
  return out
}

const main = (argv) => {
  if (argv.length === 1 && argv[0] === "--check") {
    const found = problems()
    for (const problem of found) {
      process.stderr.write(`tests/json-schema-suite/cases.txt: ${problem}\n`)
    }
    return found.length === 0 ? 0 : 1
  }
  if (argv.length > 0) {
    process.stderr.write("usage: node tests/json-schema-suite/pack.js [--check]\n")
    return 2
  }
  const groups = readGroups(fetchCheckout())
  if (groups.length !== GROUP_COUNT) {
    throw new Error(`the pinned files hold ${groups.length} groups, not ${GROUP_COUNT}`)
  }
  fs.writeFileSync(casesFile, render(groups))
  return 0
}

process.exitCode = main(process.argv.slice(2))
