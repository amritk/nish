// Packs JSON-Schema-Test-Suite's draft 2020-12 `optional/format` cases into
// `cases.txt`, one case per line, so the std_json_format link test reads them
// with a line splitter instead of a JSON parser of its own. A line is
// `<key> <valid> <kind> <data> <description>`; the format is specified in
// tests/json-schema-suite-format/README.md.
//
//   node tests/json-schema-suite-format/pack.js            fetch the pinned files (or take the cached ones), rewrite cases.txt
//   node tests/json-schema-suite-format/pack.js --check    verify cases.txt; nothing is fetched or written
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

// GitHub's archive hosts are not reachable from every build machine and the
// suite has no current npm release, so each file is fetched from its raw URL at
// the tag and pinned by its own sha256.
const TAG = "23.2.0"
const BASE_URL = `https://raw.githubusercontent.com/json-schema-org/JSON-Schema-Test-Suite/${TAG}/tests/draft2020-12/optional/format/`
const FILES = {
  "date-time": "80ef96b964d455f02b7df19ff0009578011bbeba0369dc3397ccb0f7b932c5d1",
  date: "20435f915c7a0d94b623939153d847b31583cbe688d94ba6cf63679d7036fecf",
  duration: "a1ef3ed37b0b46f49e226a5ef3a6e4ae9e5db8dc44ad9763c24f33c6e8c9cd20",
  email: "44de293b460954991e0392eb17fbf0af7ceeaeb3d67690a007e91c35a96318b8",
  hostname: "48d93b6b4036c5da94887481a3c6227336a7d9c7aa55664300edbe3a7720d4da",
  "idn-email": "a0eac259189fe7a9439dbd0d1fd4853aec83b9c4bc3c8bda742e1c9a2781c7d5",
  "idn-hostname": "a3e0d5bf8af4addafd0c8922967f7b663ba6e96f6f4a71c5c3949ede4d87740d",
  ipv4: "471af1d2dba48fcee229d2ee0f28c7065c46c9d8e0adafab108c8ff52572ba28",
  ipv6: "d193daedb1bea81a57108831f727f64585b90a46dc4c495fe3c207aaa0e54974",
  "iri-reference": "bbf43a4d168e7f1fa8d737f37c3a61d9fdd8a423f462e639a836eb7a50a41887",
  iri: "7894ef431f5f19092b7dd837ae1d410771a83af3ca12e6b7a673109ea96af91d",
  "json-pointer": "565525f00edd74a533a6f404ee7be69d14b8ac37c8b96332789aa183e95d53f1",
  regex: "38d81f166bf22df5dba59e8360ca44f4113129e483fb4f4f3e704a2f2fd28499",
  "relative-json-pointer": "ae133bdbbf4a60f5b6393de924b5011eb7af4ff0b9358c019918eccfe26b14d9",
  time: "864292340613089d26018bfbaa51a914c7a5782b44516aa0fe5128acef8844af",
  unknown: "34278f85cf5648d5bb054fa83ee022dd6603e63eefc79bb118d9c72130acc67e",
  "uri-reference": "3c95e48e448c0e692e39038dd80ee32b4930fcc90830eb80109039207be13068",
  "uri-template": "02753aa3f3e38c29b3ed0231305ba77f0427f922aca9b974ed3351da07b6134e",
  uri: "56eafa51d31e29d993cbaa0e53d2b93d196f162317896a943231befd442835dc",
  uuid: "b9f763a03829da5037c8ddaada416b3be83b4632bcfc0ca4a4650083f2f4f05c",
}
const CASE_COUNT = 478

// The notice the packed file carries, split in two so that this script, which
// copies nothing, does not carry it itself (`third-party-licence` in tests/run.js).
const NOTICE = [
  "Test cases from JSON-Schema-Test-Suite (https://github.com/json-schema-org/JSON-Schema-Test-Suite).",
  "Copyright (c) 2012 Julian Berman. Used under the MIT licence; see tests/json-schema-suite-format/LICENSE-json-schema-test-suite.",
].join(" ")

const here = import.meta.dirname
const casesFile = path.join(here, "cases.txt")
const cacheDir = path.join(here, "..", "..", "build", "json-schema-suite-format")
const names = Object.keys(FILES).sort()

const sha256 = (data) => createHash("sha256").update(data).digest("hex")

/** The whole pin as one hash: each file's name and sha256, in name order. */
const pinSha = sha256(names.map((name) => `${name} ${FILES[name]}\n`).join(""))

/** A field's bytes in the packed spelling: every byte outside `!` to `~`, and every `%`, as `%XX`. */
const encode = (text) => {
  let out = ""
  for (const b of Buffer.from(text, "utf8")) {
    out +=
      b > 0x20 && b < 0x7f && b !== 0x25
        ? String.fromCharCode(b)
        : `%${b.toString(16).toUpperCase().padStart(2, "0")}`
  }
  return out
}

/** Every case of the files as `{ key, valid, kind, data, description }`, in name then file order. */
const readCases = (files) => {
  const cases = []
  for (const name of names) {
    const groups = JSON.parse(files[name].toString("utf8"))
    if (groups.length !== 1 || groups[0].schema.format !== name) {
      throw new Error(`${name}.json is not one group for the format ${name}`)
    }
    groups[0].tests.forEach((t, i) => {
      const isString = typeof t.data === "string"
      cases.push({
        key: `${name}/${i}`,
        valid: t.valid === true,
        kind: isString ? "s" : "j",
        data: isString ? t.data : JSON.stringify(t.data),
        description: t.description,
      })
    })
  }
  return cases
}

const render = (cases) => {
  const body = cases.map(
    (c) => `${c.key} ${c.valid ? 1 : 0} ${c.kind} ${encode(c.data)} ${encode(c.description)}`
  )
  const bodySha = sha256(`${body.join("\n")}\n`)
  return (
    [
      `# ${NOTICE}`,
      `# Source tests/draft2020-12/optional/format at tag ${TAG} (${BASE_URL}), pin sha256 ${pinSha}.`,
      `# Cases ${cases.length}. Body sha256 ${bodySha}.`,
      "# Packed by tests/json-schema-suite-format/pack.js: one case per line, `<key> <valid> <kind> <data> <description>`,",
      "# with every byte outside 0x21 to 0x7e, and every `%`, written as %XX in data and description.",
      ...body,
    ].join("\n") + "\n"
  )
}

const cacheFile = (name) => path.join(cacheDir, `${name}.json`)

const fetchFiles = () => {
  const files = {}
  fs.mkdirSync(cacheDir, { recursive: true })
  for (const name of names) {
    if (fs.existsSync(cacheFile(name))) {
      const cached = fs.readFileSync(cacheFile(name))
      if (sha256(cached) === FILES[name]) {
        files[name] = cached
        continue
      }
    }
    const url = `${BASE_URL}${name}.json`
    const bytes = execFileSync("curl", ["-fsSL", url], { maxBuffer: 1 << 24 })
    if (sha256(bytes) !== FILES[name]) {
      throw new Error(`${url} is not the pinned file (sha256 ${FILES[name]})`)
    }
    fs.writeFileSync(cacheFile(name), bytes)
    files[name] = bytes
  }
  return files
}

/** The problems with cases.txt; empty when it is the file this script writes. */
const problems = () => {
  const text = fs.readFileSync(casesFile, "utf8")
  if (names.every((name) => fs.existsSync(cacheFile(name)))) {
    const files = {}
    for (const name of names) {
      files[name] = fs.readFileSync(cacheFile(name))
      if (sha256(files[name]) !== FILES[name]) {
        return [`the cached ${name}.json is not the pinned one`]
      }
    }
    return text === render(readCases(files)) ? [] : ["cases.txt is not what the cached files pack to"]
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
  if (!head[1]?.includes(`tag ${TAG} (${BASE_URL}), pin sha256 ${pinSha}.`)) {
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
      f.length !== 5 ||
      !/^[a-z0-9-]+\/\d+$/.test(f[0]) ||
      !Object.hasOwn(FILES, f[0].split("/")[0]) ||
      !/^[01]$/.test(f[1]) ||
      !/^[sj]$/.test(f[2]) ||
      !valid(f[3]) ||
      !valid(f[4])
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
      process.stderr.write(`tests/json-schema-suite-format/cases.txt: ${problem}\n`)
    }
    return found.length === 0 ? 0 : 1
  }
  if (argv.length > 0) {
    process.stderr.write("usage: node tests/json-schema-suite-format/pack.js [--check]\n")
    return 2
  }
  const cases = readCases(fetchFiles())
  if (cases.length !== CASE_COUNT) {
    throw new Error(`the files hold ${cases.length} cases, not ${CASE_COUNT}`)
  }
  fs.writeFileSync(casesFile, render(cases))
  return 0
}

process.exitCode = main(process.argv.slice(2))
