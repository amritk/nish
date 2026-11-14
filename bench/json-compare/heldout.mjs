#!/usr/bin/env node
// Held-out JSON payloads for the tokenizer, and the instructions a compiler's
// `nish/json-tokenizer` spends on each: documents the tokenizer was never
// tuned on, standing for what real programs read.
//
//   metrics   about 1 MB of small objects, short floats and integers
//             ({"ts":...,"host":...,"cpu":0.4375,"lat_ms":[...],"ok":true})
//   api       about 1 MB, an array of GitHub-API-shaped user and issue objects
//             of 20 to 40 keys: URLs, ISO dates, nulls, a `body` of 50 to 800
//             bytes, a third of them non-ASCII (CJK, accented Latin, emoji),
//             some with \n and \" escapes
//   small     bench/json-tokenizer's 242-byte request body
//
// Each is generated from a fixed seed by an LCG and held to a pinned SHA-256
// by --check, so the documents never drift from the figures taken on them.
//
//   node bench/json-compare/heldout.mjs --check
//   node bench/json-compare/heldout.mjs [--compiler build/nish] [--base <nish>] [--only metrics,api,small]
//
// The second form builds bench/json-compare/main.ts `--link --profile speed`
// with the compiler (each compiler links its own `std/`), runs the tokenize
// workload under callgrind at N=1 and N=10 (small: N=200 and N=2000) and prints
// instructions per document, (Ir(N) - Ir(1)) / (N - 1), with the checksum
// line; with --base it prints both compilers and the change. Equal checksums
// are the proof the two read the same tokens. Needs valgrind.
// biome-ignore-all lint/style/useNamingConvention: the payloads spell their keys as the GitHub API does, in snake_case
import { spawnSync } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import { compilerFrom } from "../compiler.mjs"

const here = import.meta.dirname
const root = path.resolve(here, "..", "..")
const outDir = path.join(root, "build", "heldout")

/** The SHA-256 each generated document must have; a generator change updates these in the same commit. */
const PINNED = {
  metrics: "fa1abf8795f2c3daed2cf262a720ac33a7fea36db7e70ff5013500fa4a719a35",
  api: "ba67c9115143e1aab0631f5d8f860e020134da71127fc687c5e8d4d9a90d47ee",
  small: "740d337d8a4804c8b2fa6bb0d3dae372a0416798074f61d54a86248268acba04",
}

/** A seeded linear congruential generator: `next()` is a u32, `below(n)` a value in [0, n). */
const lcg = (seed) => {
  let s = seed >>> 0
  const next = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s
  }
  // The high bits: an LCG's low bits cycle with a short period.
  return { next, below: (n) => Math.floor((next() / 4294967296) * n) }
}

/** `n` rounded to `decimals` places, as the digits a client would print. */
const fixed = (n, decimals) => n.toFixed(decimals)

const metrics = () => {
  const r = lcg(0x6d657472)
  const parts = []
  let size = 2
  let ts = 1731571200123
  while (size < 1_000_000) {
    ts += 1 + r.below(900)
    const lat = []
    for (let j = 1 + r.below(4); j > 0; j--) {
      lat.push(fixed((r.below(2_000_000) + 1) / 2 ** r.below(8), 1 + r.below(6)))
    }
    const host = `web-${String(r.below(40)).padStart(2, "0")}`
    const cpu = fixed(r.below(1_000_000) / 1_000_000, 1 + r.below(6))
    const ok = r.below(10) > 0 ? "true" : "false"
    const row = `{"ts":${ts},"host":"${host}","cpu":${cpu},"lat_ms":[${lat.join(",")}],"ok":${ok}}`
    parts.push(row)
    size += row.length + 1
  }
  return `[${parts.join(",")}]`
}

const WORDS = [
  "the",
  "build",
  "fails",
  "when",
  "a",
  "token",
  "is",
  "read",
  "twice",
  "and",
  "cache",
  "miss",
  "on",
  "retry",
]
const NON_ASCII = [
  "日本語のテキスト",
  "中文内容测试",
  "한국어 텍스트",
  "café crème brûlée",
  "naïve façade",
  "Ünïcödé strïng",
  "😀 rocket 🚀",
  "señor, ¿qué tal?",
]
const LOGINS = ["octocat", "hubot", "ada-l", "grace-h", "linus", "dmr", "bk", "ken-t"]

const sentence = (r, bytes) => {
  let text = ""
  while (Buffer.byteLength(text) < bytes) {
    text += `${r.below(3) === 0 ? NON_ASCII[r.below(NON_ASCII.length)] : WORDS[r.below(WORDS.length)]} `
  }
  return text.trim()
}

const isoDate = (r) => {
  const d = new Date(Date.UTC(2015, 0, 1) + r.below(3650) * 86_400_000 + r.below(86_400) * 1000)
  return d.toISOString().replace(".000", "")
}

const user = (r, id) => {
  const login = `${LOGINS[r.below(LOGINS.length)]}${id}`
  const url = `https://api.github.com/users/${login}`
  const fields = {
    login,
    id,
    node_id: `MDQ6VXNlcjE${id}`,
    avatar_url: `https://avatars.githubusercontent.com/u/${id}?v=4`,
    gravatar_id: "",
    url,
    html_url: `https://github.com/${login}`,
    followers_url: `${url}/followers`,
    following_url: `${url}/following{/other_user}`,
    gists_url: `${url}/gists{/gist_id}`,
    starred_url: `${url}/starred{/owner}{/repo}`,
    organizations_url: `${url}/orgs`,
    repos_url: `${url}/repos`,
    events_url: `${url}/events{/privacy}`,
    type: r.below(5) === 0 ? "Organization" : "User",
    site_admin: r.below(20) === 0,
    name: r.below(4) === 0 ? null : sentence(r, 12),
    company: r.below(2) === 0 ? null : `@${LOGINS[r.below(LOGINS.length)]}`,
    blog: r.below(2) === 0 ? "" : `https://${login}.example.com`,
    location: r.below(3) === 0 ? null : NON_ASCII[r.below(NON_ASCII.length)],
    email: null,
    hireable: r.below(3) === 0 ? null : r.below(2) === 0,
    public_repos: r.below(400),
    followers: r.below(100_000),
    created_at: isoDate(r),
    updated_at: isoDate(r),
  }
  return fields
}

const issue = (r, id) => {
  const base = `https://api.github.com/repos/acme/widgets/issues/${id}`
  const bytes = 50 + r.below(751)
  let body = sentence(r, bytes)
  const kind = r.below(3)
  if (kind === 0) {
    body = body.replaceAll(" a ", " a\n")
  } else if (kind === 1) {
    body = body.replace(/ the /g, ' "the" ')
  }
  const fields = {
    url: base,
    repository_url: "https://api.github.com/repos/acme/widgets",
    labels_url: `${base}/labels{/name}`,
    comments_url: `${base}/comments`,
    events_url: `${base}/events`,
    html_url: `https://github.com/acme/widgets/issues/${id}`,
    id: 1_000_000 + id * 7,
    number: id,
    title: sentence(r, 20 + r.below(60)),
    user: user(r, 100 + r.below(5000)),
    labels: Array.from({ length: r.below(4) }, (_, i) => ({
      id: id * 10 + i,
      name: WORDS[r.below(WORDS.length)],
      color: r.below(0xffffff).toString(16).padStart(6, "0"),
      default: r.below(5) === 0,
    })),
    state: r.below(2) === 0 ? "open" : "closed",
    locked: false,
    assignee: r.below(2) === 0 ? null : user(r, 100 + r.below(5000)),
    milestone: null,
    comments: r.below(60),
    created_at: isoDate(r),
    updated_at: isoDate(r),
    closed_at: r.below(2) === 0 ? null : isoDate(r),
    author_association: r.below(2) === 0 ? "MEMBER" : "NONE",
    body,
    reactions: { total_count: r.below(30), "+1": r.below(10), "-1": r.below(3), heart: r.below(10) },
    score: null,
  }
  return fields
}

const api = () => {
  const r = lcg(0x61706921)
  const parts = []
  let size = 2
  for (let id = 1; size < 1_000_000; id++) {
    const row = JSON.stringify(r.below(4) === 0 ? user(r, id) : issue(r, id))
    parts.push(row)
    size += Buffer.byteLength(row) + 1
  }
  return `[${parts.join(",")}]`
}

/** bench/json-tokenizer/main.ts's BODY, with the same escapes its TypeScript string spells. */
const small = () =>
  '{"id":1234567,"user":{"name":"Ada Lovelace","email":"ada@example.com","verified":true},' +
  '"items":[{"sku":"A-100","qty":2,"price":19.99},{"sku":"B-205","qty":1,"price":5.5}],' +
  '"note":"caf\\u00e9 \\ud83d\\ude00 \\"quoted\\"","coupon":null,"total":45.48}'

const PAYLOADS = { metrics, api, small }

/** The last digit that follows a digit, which a run rewrites each iteration (run.mjs's `tokenizeAt`). */
const digitAt = (doc) => {
  const isDigit = (b) => b >= 48 && b <= 57
  for (let i = doc.length - 1; i > 0; i--) {
    if (isDigit(doc[i]) && isDigit(doc[i - 1])) {
      return i
    }
  }
  return -1
}

const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex")

const fail = (msg) => {
  console.error(`bench/json-compare/heldout.mjs: ${msg}`)
  process.exit(2)
}

const generate = () => {
  const docs = {}
  for (const [name, make] of Object.entries(PAYLOADS)) {
    docs[name] = Buffer.from(make(), "utf8")
  }
  return docs
}

const run = (cmd, args, what) => {
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 1 << 24 })
  if (r.error !== undefined || r.status !== 0) {
    fail(`${what} failed (${r.error?.message ?? `exit ${r.status}`})\n${r.stderr ?? ""}`)
  }
  return r
}

/** Builds main.ts with `compiler` into its own directory and answers the program's path. */
const build = (compiler, tag) => {
  const dir = path.join(outDir, tag)
  fs.mkdirSync(dir, { recursive: true })
  const exe = path.join(dir, "main")
  run(
    compiler.cmd,
    [
      ...compiler.prefix,
      path.join(here, "main.ts"),
      "-o",
      `${dir}${path.sep}`,
      "--link",
      exe,
      "--profile",
      "speed",
    ],
    `building main.ts with ${compiler.cmd}`
  )
  return exe
}

/** Callgrind's total Ir and the program's checksum line for one run. */
const measure = (exe, file, n, at) => {
  const out = path.join(outDir, "callgrind.out")
  const r = run(
    "valgrind",
    ["--tool=callgrind", `--callgrind-out-file=${out}`, exe, "tokenize", file, String(n), String(at)],
    `valgrind ${path.basename(file)} N=${n}`
  )
  const total = /^totals:\s*(\d+)/m.exec(fs.readFileSync(out, "utf8"))
  if (total === null) {
    fail("callgrind wrote no totals line")
  }
  return { ir: Number(total[1]), checksum: r.stdout.split("\n")[0].trim() }
}

/** Ir per document and the checksum, for one payload. */
const perDocument = (exe, name, file, at) => {
  const [lo, hi] = name === "small" ? [200, 2000] : [1, 10]
  const a = measure(exe, file, lo, at)
  const b = measure(exe, file, hi, at)
  return { ir: Math.round((b.ir - a.ir) / (hi - lo)), checksum: b.checksum }
}

const group = (n) => n.toLocaleString("en-US")

const main = () => {
  // --check needs no compiler, so the compiler is resolved only for a measuring run.
  const checking = process.argv.includes("--check")
  const compiler = checking ? { rest: process.argv.slice(2) } : compilerFrom(process.argv.slice(2))
  const args = compiler.rest
  let check = false
  let base = null
  let only = Object.keys(PAYLOADS)
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--check") {
      check = true
    } else if (args[i] === "--base") {
      base = args[++i]
    } else if (args[i] === "--compiler") {
      i++ // only reaches here under --check, which has no compiler to resolve
    } else if (args[i] === "--only") {
      only = String(args[++i]).split(",")
    } else {
      fail(`unknown option ${args[i]}`)
    }
  }
  const docs = generate()
  let bad = 0
  for (const [name, doc] of Object.entries(docs)) {
    const got = sha256(doc)
    const ok = got === PINNED[name]
    if (check || !ok) {
      console.log(`${ok ? "ok  " : "FAIL"} ${name} ${doc.length} bytes sha256 ${got}`)
    }
    bad += ok ? 0 : 1
  }
  if (check || bad > 0) {
    process.exit(bad === 0 ? 0 : 1)
  }
  for (const name of only) {
    if (!(name in docs)) {
      fail(`unknown payload ${name}`)
    }
  }
  fs.mkdirSync(outDir, { recursive: true })
  const exes = [["current", build(compiler, "current")]]
  if (base !== null) {
    const baseCompiler = compilerFrom(["--compiler", base])
    exes.unshift(["base", build(baseCompiler, "base")])
  }
  for (const name of only) {
    const file = path.join(outDir, `${name}.json`)
    fs.writeFileSync(file, docs[name])
    const at = name === "small" ? 12 : digitAt(docs[name])
    const got = exes.map(([tag, exe]) => ({ tag, ...perDocument(exe, name, file, at) }))
    for (const g of got) {
      console.log(`${name.padEnd(8)} ${g.tag.padEnd(8)} ${group(g.ir).padStart(14)} Ir/doc  ${g.checksum}`)
    }
    if (got.length === 2) {
      const delta = ((got[1].ir - got[0].ir) / got[0].ir) * 100
      const same = got[0].checksum === got[1].checksum ? "checksums equal" : "CHECKSUMS DIFFER"
      console.log(`${name.padEnd(8)} delta    ${delta.toFixed(2).padStart(13)}%         ${same}`)
    }
  }
}

main()
