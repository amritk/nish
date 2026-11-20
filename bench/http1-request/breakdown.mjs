#!/usr/bin/env node
// Where one request of a bench/http1-request case spends its instructions,
// by the source function each instruction belongs to: main.ts built with
// `--profile speed -g`, run under valgrind's callgrind with NISH_SIMD=base
// and glibc's string functions pinned as run.mjs --instructions pins them,
// at 2N iterations and at N, the difference over N, so start-up cancels.
//
//   npm run build && node bench/http1-request/breakdown.mjs [--case <name>]... [--lines <function>]... [--compiler <nish>]
//
// --lines also prints that function's instructions a request by source line.
//
// The optimiser inlines most of std/net into its callers, so the function
// callgrind names is not the one whose code ran. Each cost line is given
// instead to the function its debug line sits in: the line's file (`fl=`,
// `fi=`, `fe=`) and the nearest definition above it in that file's source,
// found as bench/http1-conn/stage-misses.mjs finds it. A line in C or in
// libc, with no TypeScript source, goes to the function callgrind names
// (`memcpy`, `nish_net_write`). A call's inclusive cost is skipped, since
// the callee's own lines count it. Prints a table per case: instructions a
// request by function, largest first, every function at 1 or more a request
// (a row under 1 is left out of the table but counted in its total), and
// the total of every row. Grouping the rows into components (parse,
// respond, the arena) is done by hand from this table, not by this script. That total is of this `-g` build under
// callgrind and can differ by about 1% from run.mjs --instructions' figure,
// which counts a build without debug info under cachegrind. Writes the profiles under
// build/bench/http1-request/breakdown/.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { compilerFrom } from "../compiler.mjs"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..", "..")
const nishc = compilerFrom(process.argv)

const args = process.argv.slice(2)
const only = []
const lineFns = new Set()
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === "--case") {
    only.push(args[++i])
  } else if (args[i] === "--lines") {
    lineFns.add(args[++i])
  } else if (args[i] === "--compiler") {
    i += 1
  } else {
    console.error(`breakdown.mjs: unknown option ${args[i]}`)
    process.exit(2)
  }
}
const cases = only.length > 0 ? only : ["get", "short", "fields0", "fields4", "fields10"]

/** As run.mjs pins them for --instructions. */
const PINNED_LIBC = [
  "glibc.cpu.hwcaps=-AVX_Fast_Unaligned_Load,-AVX2,-AVX512F,-AVX512VL,-ERMS,-FSRM,-SSSE3",
  "glibc.cpu.x86_non_temporal_threshold=0x0fffffffffffffff",
  "glibc.cpu.x86_rep_movsb_threshold=0x0fffffffffffffff",
  "glibc.cpu.x86_rep_stosb_threshold=0x0fffffffffffffff",
].join(":")
const PINNED_SIMD = "base"
/** The shorter run's iterations; the longer takes twice. */
const N = 500

const fail = (msg) => {
  console.error(`breakdown.mjs: ${msg}`)
  process.exit(1)
}
const run = (cmd, argv, opts = {}) => {
  const r = spawnSync(cmd, argv, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts })
  if (r.error !== undefined || r.status !== 0) {
    fail(`${cmd} ${argv.join(" ")}: ${r.error?.message ?? `exit ${r.status}`}\n${r.stdout}${r.stderr}`)
  }
  return r.stdout
}

const out = path.join(root, "build", "bench", "http1-request", "breakdown")
fs.mkdirSync(out, { recursive: true })
const exe = path.join(out, "h1")
run(
  nishc.cmd,
  [
    ...nishc.prefix,
    "bench/http1-request/main.ts",
    "-o",
    `${path.relative(root, out)}/`,
    "--link",
    path.relative(root, exe),
    "--profile",
    "speed",
    "-g",
  ],
  { cwd: root }
)

// The method or function each line of a source file sits in.
const enclosing = new Map()
// A definition: a top-level `const f = (` or `function f`, a method
// `name(...) {` or `name(` with its parameters on the lines after, or a class.
const definition =
  /^(?:export\s+)?(?:(?:const|let)\s+(\w+)(?:\s*:[^=]+)?\s*=\s*(?:<[^>]*>)?\(|function\s+(\w+))|^\s+(?:(?:private|static|public|get|set)\s+)*(\w+)\s*\((?:[^)]*\)\s*(?::\s*[^={]+)?\{|)\s*$|^\s*(?:export\s+)?class\s+(\w+)/
const KEYWORDS = new Set(["if", "while", "for", "switch", "catch", "return"])
const methodsOf = (file) => {
  if (!enclosing.has(file)) {
    const names = []
    let cls = ""
    let current = ""
    const text = fs.statSync(file, { throwIfNoEntry: false })?.isFile()
      ? fs.readFileSync(file, "utf8").split("\n")
      : []
    for (const line of text) {
      const m = definition.exec(line)
      // A top-level `}` ends a class or a function: the lines after it, up to
      // the next definition, are module scope and belong to none.
      if (/^}/.test(line)) {
        cls = ""
        current = ""
      }
      if (m && m[4]) {
        cls = m[4]
      } else if (m && (m[1] ?? m[2])) {
        cls = ""
        current = m[1] ?? m[2]
      } else if (m && m[3] && cls && /^ {2}\S/.test(line) && !KEYWORDS.has(m[3])) {
        // A method: a class member, two spaces in.
        current = `${cls}.${m[3]}`
      }
      names.push(current)
    }
    enclosing.set(file, names)
  }
  return enclosing.get(file)
}

// The debug info names a file as the compiler was given it, "./" first.
const resolve = (file) => {
  const bare = file.startsWith("./") ? file.slice(2) : file
  return path.isAbsolute(bare) ? bare : path.join(root, bare)
}

/** Self instructions by source function, the whole run. */
const profile = (file) => {
  const lines = fs.readFileSync(file, "utf8").split("\n")
  const sums = new Map()
  let fn = ""
  let fl = ""
  let source = ""
  let skip = false
  for (const l of lines) {
    // `fl=` names the file of the `fn=` after it; `fi=` and `fe=` switch the
    // file of the lines after them, inlined code, until the next `fn=`.
    if (l.startsWith("fl=")) {
      fl = l.slice(3)
      source = fl
    } else if (l.startsWith("fn=")) {
      fn = l.slice(3)
      source = fl
    } else if (l.startsWith("fi=") || l.startsWith("fe=")) {
      source = l.slice(3)
    } else if (l.startsWith("calls=")) {
      skip = true
    } else if (/^\d/.test(l)) {
      if (skip) {
        skip = false
        continue
      }
      const [line, ir] = l.split(" ").map(Number)
      let key = fn
      if (source.endsWith(".ts")) {
        const full = resolve(source)
        const owner = methodsOf(full)[line - 1]
        key = `${path.relative(root, full)}:${owner || `(${fn}, no line)`}`
        if (lineFns.has(owner)) {
          const at = `${key}:${line}`
          sums.set(at, (sums.get(at) ?? 0) + (ir || 0))
        }
      }
      sums.set(key, (sums.get(key) ?? 0) + (ir || 0))
    }
  }
  return sums
}

const callgrind = (name, iterations) => {
  const file = path.join(out, `${name}-${iterations}.callgrind`)
  run(
    "valgrind",
    [
      "--tool=callgrind",
      "--compress-strings=no",
      "--compress-pos=no",
      `--callgrind-out-file=${file}`,
      exe,
      name,
      String(iterations),
    ],
    { env: { GLIBC_TUNABLES: PINNED_LIBC, NISH_SIMD: PINNED_SIMD } }
  )
  return profile(file)
}

const dirty = run("git", ["status", "--porcelain"], { cwd: root }).trim() !== ""
const commit = `${run("git", ["rev-parse", "--short=12", "HEAD"], { cwd: root }).trim()}${dirty ? "-dirty" : ""}`
console.log(
  `breakdown: callgrind, NISH_SIMD=${PINNED_SIMD}, glibc pinned, --profile speed -g, ` +
    `${2 * N} iterations less ${N}, over ${N}; bench code at ${commit}`
)
for (const name of cases) {
  const a = callgrind(name, N)
  const b = callgrind(name, 2 * N)
  const rows = []
  let total = 0
  const lines = []
  for (const [key, v] of b) {
    const d = (v - (a.get(key) ?? 0)) / N
    if (/:\d+$/.test(key)) {
      lines.push([key, d])
    } else {
      total += d
      rows.push([key, d])
    }
  }
  rows.sort((x, y) => y[1] - x[1])
  console.log(`\n${name}: ${total.toFixed(1)} instructions a request`)
  console.log("| function | Ir a request |\n| --- | ---: |")
  for (const [key, d] of rows) {
    if (Math.abs(d) >= 1) {
      console.log(`| ${key} | ${d.toFixed(1)} |`)
    }
  }
  if (lines.length > 0) {
    lines.sort((x, y) => Number(/\d+$/.exec(x[0])[0]) - Number(/\d+$/.exec(y[0])[0]))
    console.log("\n| line | Ir a request |\n| --- | ---: |")
    for (const [key, d] of lines) {
      if (Math.abs(d) >= 0.5) {
        console.log(`| ${key} | ${d.toFixed(1)} |`)
      }
    }
  }
}
