// Exercises format-edited.mjs, the PostToolUse hook beside this file: which
// payloads name a file to format, and, end to end in a scratch project, that
// an edited file comes out formatted and the hook never fails the call.
//
//   node .claude/hooks/format-edited.test.mjs
//
// `npm test` runs it beside `no-attribution.test.mjs`.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { fileToFormat } from "./format-edited.mjs"

const here = path.dirname(fileURLToPath(import.meta.url))
const HOOK = path.join(here, "format-edited.mjs")
const ROOT = path.resolve(here, "..", "..")

const edit = (filePath) => ({ tool_name: "Edit", tool_input: { file_path: filePath } })

let failed = 0
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "pass" : "FAIL"}  ${label}${ok ? "" : `  ${detail}`}`)
  if (!ok) {
    failed++
  }
}

const cases = [
  ["a source file in the tree", edit(`${ROOT}/self/lexer.ts`), "self/lexer.ts"],
  ["a relative path", edit("scripts/build.sh.mjs"), "scripts/build.sh.mjs"],
  ["JSON", edit(`${ROOT}/biome.json`), "biome.json"],
  ["Markdown, which Biome does not read", edit(`${ROOT}/README.md`), null],
  ["a C file", edit(`${ROOT}/runtime/runtime.c`), null],
  ["a file outside the repository", edit("/etc/passwd.mjs"), null],
  ["a Bash call, which has no file_path", { tool_name: "Bash", tool_input: { command: "ls" } }, null],
  ["no payload at all", undefined, null],
]
for (const [label, payload, want] of cases) {
  const got = fileToFormat(payload, ROOT)
  check(`fileToFormat: ${label}`, got === want, `got ${got}, wanted ${want}`)
}

// End to end: a scratch project with this repository's Biome and a config of
// its own, one badly formatted file, and the hook fed the Edit that wrote it.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "format-edited-test-"))
fs.symlinkSync(path.join(ROOT, "node_modules"), path.join(tmp, "node_modules"))
fs.writeFileSync(
  path.join(tmp, "biome.json"),
  JSON.stringify({
    formatter: { indentStyle: "space", indentWidth: 2 },
    javascript: { formatter: { semicolons: "asNeeded" } },
  })
)
const file = path.join(tmp, "edited.mjs")
fs.writeFileSync(file, "const  x =  {a:1};\nexport   { x };\n")
const env = { ...process.env }
env.CLAUDE_PROJECT_DIR = tmp
const run = spawnSync(process.execPath, [HOOK], { input: JSON.stringify(edit(file)), env, encoding: "utf8" })
const after = fs.readFileSync(file, "utf8")
check("the hook exits 0", run.status === 0, `exit ${run.status}: ${run.stderr}`)
// Formatted, not a particular Biome version's exact output: the doubled spaces
// and the unspaced object are gone, and the semicolons with them.
check(
  "the edited file is formatted",
  after.startsWith("const x = { a: 1 }\n") && !after.includes("  ") && !after.includes(";"),
  JSON.stringify(after)
)

const garbage = spawnSync(process.execPath, [HOOK], { input: "not json", encoding: "utf8" })
check("unparseable stdin exits 0", garbage.status === 0, `exit ${garbage.status}`)

fs.rmSync(tmp, { recursive: true, force: true })
console.log(`# ${failed === 0 ? "pass" : "fail"} ${cases.length + 3 - failed}/${cases.length + 3}`)
process.exit(failed === 0 ? 0 : 1)
