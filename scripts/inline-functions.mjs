#!/usr/bin/env node
// WP22 stage C, for the Nish programs the JavaScript test harnesses carry as
// string literals: refuse a top-level `function` definition in one.
//
//   node scripts/inline-functions.mjs [--root <dir>]
//
// `tests/run.js`'s arrow-corpus check reads `tests/**/*.ts` and the allowlist;
// it cannot see a program written inside `tests/run.js`, `tests/ffi-*.js` or
// `tests/differential/fuzz.js`, so a new inline `function` program passed CI
// until a later PR spelled it as an arrow by hand (#1743, #1748). This script
// reads every tracked `tests/**/*.{js,mjs,cjs}` under `<root>` (default: the
// checkout it lives in) with TypeScript's parser, takes the text of each
// string and template literal, and reports a line of that text that opens a
// `function` definition: `function name(` or `export function name<`, at the
// start of the text or after a newline, or a template's literal part that ends
// in `function ` before a substitution. `declare function`, `async function`
// and `export default function` are not definitions here, the same as for
// `scripts/arrowify.mjs`.
//
// A literal that must keep the spelling (a host module, which
// `src/host-module.ts` reads as `export function`; one of arrowify's own unit
// cases; a syntax-error source) is exempt only when a comment that starts with
// `nish-function:` and a reason leads the literal, or one of its enclosing
// nodes up to and including its innermost statement. Everything else fails:
// an unmarked definition, a marker with no reason, a marker that covers no
// definition (so the exemptions only shrink), and a file the parser cannot
// read. Exit 0 when clean, 1 with one `file:line: ...` problem per line.

import { execFileSync } from "node:child_process"
import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const ts = require("typescript")

const MARKER = /^\/[/*]\s*nish-function:(.*?)(\*\/)?$/s
// The words a definition line may open with, then the name and its `(` or `<`;
// comments may sit between the keyword, the name and the bracket.
const COMMENT = String.raw`(?:\/\*.*?\*\/\s*)*`
const OPENS = new RegExp(String.raw`^\s*(?:export\s+${COMMENT})?function\s*${COMMENT}[\w$]+\s*${COMMENT}[(<]`)
const OPENS_BEFORE_SUBSTITUTION = new RegExp(String.raw`^\s*(?:export\s+${COMMENT})?function\s+$`)

const FIX =
  "spell it `const name = (...): T => { ... };` (`node scripts/arrowify.mjs <file.ts>` rewrites a copy), " +
  "or, if it must keep `function` (a host module, an arrowify unit case, a syntax-error source), " +
  "lead the literal or its statement with a `// nish-function: <reason>` comment"

/**
 * Every problem in one harness file's text, as `file:line: ...` strings.
 * @param {string} file the path to name in each problem
 * @param {string} text the file's contents
 * @returns {string[]}
 */
const inlineFunctionProblems = (file, text) => {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  // Lines as an editor and `grep -n` count them: TypeScript's own line map also
  // breaks at U+2028 and U+2029, which `tests/run.js` holds.
  const breaks = []
  for (let i = text.indexOf("\n"); i >= 0; i = text.indexOf("\n", i + 1)) {
    breaks.push(i)
  }
  const lineOf = (pos) => {
    let lo = 0
    let hi = breaks.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (breaks[mid] < pos) {
        lo = mid + 1
      } else {
        hi = mid
      }
    }
    return lo + 1
  }
  if (sf.parseDiagnostics.length > 0) {
    const d = sf.parseDiagnostics[0]
    return [
      `${file}:${lineOf(d.start ?? 0)}: the parser cannot read it, so it cannot be checked: fix the syntax`,
    ]
  }

  // Every comment in the file, by its start, from the trivia before each token.
  const comments = new Map()
  const collect = (node) => {
    for (const range of ts.getLeadingCommentRanges(text, node.getFullStart()) ?? []) {
      comments.set(range.pos, text.slice(range.pos, range.end))
    }
    if (node.kind === ts.SyntaxKind.EndOfFileToken) {
      return
    }
    for (const child of node.getChildren(sf)) {
      collect(child)
    }
  }
  collect(sf)
  const markers = new Map()
  for (const [pos, comment] of comments) {
    const m = MARKER.exec(comment)
    if (m) {
      markers.set(pos, { reason: m[1].trim(), used: false })
    }
  }

  const problems = []
  // The marker leading `node` or an ancestor, up to its innermost statement.
  const markerFor = (node) => {
    for (let n = node; n && n.kind !== ts.SyntaxKind.SourceFile; n = n.parent) {
      for (const range of ts.getLeadingCommentRanges(text, n.getFullStart()) ?? []) {
        const marker = markers.get(range.pos)
        if (marker) {
          return marker
        }
      }
      if (ts.isStatement(n) || ts.isBlock(n)) {
        break
      }
    }
    return null
  }
  const visit = (node) => {
    const literal =
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    if (literal) {
      const substitutes = ts.isTemplateHead(node) || ts.isTemplateMiddle(node)
      const lines = node.text.split("\n")
      const opens = lines.some(
        (line, i) =>
          OPENS.test(line) || (substitutes && i === lines.length - 1 && OPENS_BEFORE_SUBSTITUTION.test(line))
      )
      if (opens) {
        const marker = markerFor(node)
        if (marker) {
          marker.used = true
        } else {
          const at = lines.findIndex((l) => OPENS.test(l) || OPENS_BEFORE_SUBSTITUTION.test(l))
          const raw = text.slice(node.getStart(sf), node.getEnd()).split("\n")
          // The literal's own line breaks place the definition; an escaped `\n`
          // keeps it on the literal's first line.
          const line = lineOf(node.getStart(sf)) + (raw.length > 1 ? Math.max(at, 0) : 0)
          problems.push(`${file}:${line}: an inline Nish program defines a top-level \`function\`: ${FIX}`)
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  for (const [pos, marker] of markers) {
    if (marker.reason === "") {
      problems.push(
        `${file}:${lineOf(pos)}: a \`nish-function:\` marker gives no reason: say why the literal keeps \`function\``
      )
    } else if (!marker.used) {
      problems.push(
        `${file}:${lineOf(pos)}: a \`nish-function:\` marker covers no inline \`function\` definition: drop it`
      )
    }
  }
  return problems.sort((a, b) => Number(a.split(":")[1]) - Number(b.split(":")[1]))
}

/**
 * The tracked and untracked (not ignored) harness files under `root`.
 * @param {string} root the checkout to read
 * @returns {string[]} paths relative to `root`
 */
const harnessFiles = (root) =>
  execFileSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "--",
      "tests/*.js",
      "tests/*.mjs",
      "tests/*.cjs",
    ],
    { cwd: root, encoding: "utf8" }
  )
    .split("\n")
    .filter((f) => f !== "" && fs.existsSync(path.join(root, f)))
    .sort()

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  let root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
  if (args[0] === "--root" && args.length === 2) {
    root = path.resolve(args[1])
  } else if (args.length > 0) {
    process.stderr.write("usage: node scripts/inline-functions.mjs [--root <dir>]\n")
    process.exit(2)
  }
  const files = harnessFiles(root)
  const problems = files.flatMap((f) =>
    inlineFunctionProblems(f, fs.readFileSync(path.join(root, f), "utf8"))
  )
  if (files.length === 0) {
    problems.push(`no tests/**/*.{js,mjs,cjs} file under ${root}: nothing was checked`)
  }
  if (problems.length > 0) {
    process.stderr.write(`${problems.join("\n")}\n`)
    process.exit(1)
  }
  process.stdout.write(`inline-functions: no inline \`function\` program in ${files.length} harness files\n`)
}
