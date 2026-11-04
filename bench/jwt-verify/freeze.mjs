#!/usr/bin/env node
// Writes bench/jwt-verify/old.ts: the decoder of std/crypto/base64url.ts at one
// commit, every `base64url` name given the prefix `b64a`, so that it links
// beside nish/crypto/base64url in one program (a module's private helpers
// share the program's flat symbol namespace).
//
//   node bench/jwt-verify/freeze.mjs [<rev>]
//
// <rev> defaults to the commit the copy was frozen from, so running it again
// rewrites the same bytes. Rerun it with another rev only to move the
// baseline the `decode-old` kernel measures against.
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..", "..")
/** main when the base64url decode work began. */
const FROZEN = "1d92417efafbc554c7dcb4d8929143c9fc24160e"
const rev = process.argv[2] ?? FROZEN

const source = execFileSync("git", ["show", `${rev}:std/crypto/base64url.ts`], {
  cwd: root,
  encoding: "utf8",
})
// The module comment is the live module's; the copy says what it is instead.
const start = source.indexOf("*/\n")
if (!source.startsWith("/**") || start < 0) {
  console.error(`freeze.mjs: ${rev}'s std/crypto/base64url.ts does not open with its module comment`)
  process.exit(2)
}
// Top-level blocks, each a doc comment and its declaration; only the decoder
// and what it calls are kept, so the copy exports nothing the kernel leaves unused.
const KEEP = ["const base64urlRangeMask ", "const base64urlSextetOf ", "export const base64urlDecode "]
const blocks = source.slice(start + 3).split(/\n\n(?=\/\*\*|\/\/ )/)
const kept = KEEP.map((decl) => {
  const block = blocks.find((b) => b.includes(decl))
  if (block === undefined) {
    console.error(`freeze.mjs: ${rev}'s std/crypto/base64url.ts has no \`${decl.trim()}\``)
    process.exit(2)
  }
  return block.trim()
})
const body = `${kept.join("\n\n")}\n`.replaceAll("base64url", "b64a")
const header =
  "// The decoder of std/crypto/base64url.ts, frozen by bench/jwt-verify/freeze.mjs\n" +
  `// at ${rev}\n` +
  "// with every name prefixed `b64a`: the `decode-old` kernel's. Do not edit;\n" +
  "// rerun freeze.mjs.\n"
fs.writeFileSync(path.join(here, "old.ts"), `${header}${body}`)
console.log(`bench/jwt-verify/old.ts from ${rev}`)
