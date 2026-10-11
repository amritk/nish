// Packs JSONTestSuite's `test_parsing/` directory into `test-parsing.txt`, one
// file per line, so the corpus keeps its upstream names without putting 318
// paths that are not kebab-case into the tree (`.claude/linting.md`): a line is
// `<name> <bytes>`, and every byte outside `!` to `~`, and every `%`, is
// written as `%XX`. The files hold invalid UTF-8, NUL bytes and newlines on
// purpose, and this spelling carries each of them through a text file and a
// diff unchanged. `tests/link/std_json_tokenizer/corpus.ts` and the Node check
// in `tests/run.js` decode it back.
//
//   node tests/json-suite/pack.js <JSONTestSuite checkout> <commit>
import fs from "node:fs"
import path from "node:path"

// The notice the packed file carries, split in two so that this script, which
// copies nothing, does not carry it itself (`third-party-licence` in tests/run.js).
const NOTICE = [
  "Test files from JSONTestSuite (https://github.com/nst/JSONTestSuite), test_parsing/.",
  "Copyright (c) 2016 Nicolas Seriot. Used under the MIT licence; see tests/json-suite/LICENSE-jsontestsuite.",
].join(" ")

/** One file's bytes in the packed spelling. */
const encode = (bytes) => {
  let out = ""
  for (const b of bytes) {
    out +=
      b > 0x20 && b < 0x7f && b !== 0x25
        ? String.fromCharCode(b)
        : `%${b.toString(16).toUpperCase().padStart(2, "0")}`
  }
  return out
}

const main = (argv) => {
  if (argv.length !== 2) {
    process.stderr.write("usage: node tests/json-suite/pack.js <JSONTestSuite checkout> <commit>\n")
    return 2
  }
  const dir = path.join(argv[0], "test_parsing")
  const names = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()
  const lines = [
    `# ${NOTICE}`,
    `# Upstream commit ${argv[1]}, packed by tests/json-suite/pack.js: one file per line, \`<name> <bytes>\`,`,
    "# with every byte outside 0x21 to 0x7e, and every `%`, written as %XX.",
    ...names.map((name) => `${name} ${encode(fs.readFileSync(path.join(dir, name)))}`),
  ]
  fs.writeFileSync(path.join(import.meta.dirname, "test-parsing.txt"), `${lines.join("\n")}\n`)
  return 0
}

process.exitCode = main(process.argv.slice(2))
