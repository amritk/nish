#!/usr/bin/env node
/**
 * The proof-shaped program generator: random Nish programs built around the
 * accesses the bounds-check elision reasons about, each one in an in-bounds
 * and a one-past variant, so a checked build of the one-past variant must
 * panic and an unchecked build of it reads a byte the address sanitizer sees.
 *
 * Usage:
 *   node tests/differential/proofgen.js --self-test [--seed S] [--count N]
 *   node tests/differential/proofgen.js --print [--seed S] [--index I]
 *
 * `generate(seed, index)` answers `{ source, shapes, expectPanic }`: the
 * program, the shapes it holds (`family:kind`, with `!` after a one-past one)
 * and whether a checked build of it exits through a panic. At most one shape
 * in a program is one-past and it runs last, so what the shapes before it
 * print is checked too. The shapes:
 *
 * - `derived` — an index derived from the counter: `i + c`, `i * k`, `i >> 1`,
 *   `i & m`, and a `u8` and a `u16` index over an array of 256 or 65536.
 * - `bounds` — the loop bounds the elision trusts: `i < a.length`, `i < n`
 *   with `n` a length read once, a reversed loop and a stepped one.
 * - `pushpop` — `push` and `pop` inside loops, the length read after each.
 * - `slice` — the range operations: `dst.set(src, at)`, `s.slice(a, b)` and
 *   `String.fromBytes(bytes, a, b)`. Nish arrays have no `slice`
 *   (`docs/AI.md`, "unknown method"), so these are its ranged accesses.
 * - `alias` — two names for one array, an array in a field, and an array a
 *   callee grows or shrinks between a length read and an access.
 * - `closure` — an arrow capturing a `const` array. The only arrow that
 *   captures in Nish is one passed to a `nish/threads` call (`docs/AI.md`,
 *   "An arrow captures nothing"), so this shape is a parallel one too.
 * - `arena` — a `using a = arena()` block filling and reading a fresh array.
 * - `threads` — `parallelMapInto` into a destination of the source's length
 *   or one short, and `parallelReduce` over the answer.
 *
 * `--self-test` compiles every program with the seed (`build/seed/bin/nish`),
 * requires the checker to accept all of them and every shape to occur in both
 * variants, then counts the `nish_panic_index` call sites left in the IR
 * against the element accesses in the source: the difference is the share of
 * accesses the elision proved. With clang it also links and runs each program
 * and requires it to panic exactly when `expectPanic` says so. Exits 1 on any
 * failure and 2 on a bad option.
 */
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import * as lib from "./lib.js"
import { classify } from "./asan.js"

/**
 * mulberry32, the generator `fuzz.js` uses. `fuzz.js` does not export its
 * `rng`, and this stage may not edit it, so the same few lines live here.
 */
const rng = (seed) => {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (xs) => xs[Math.floor(next() * xs.length)],
    chance: (p) => next() < p,
  }
}

/** The helpers a shape may call, emitted once each when a program uses them. */
const HELPERS = {
  fill: `const fill = (n: number, c: i32): i32[] => {
  const a: i32[] = [];
  for (let i = 0; i < n; i++) {
    a.push(i * 3 + c);
  }
  return a;
};`,
  box: `class Box {
  xs: i32[];
  constructor(xs: i32[]) {
    this.xs = xs;
  }
}`,
  grow: `const grow = (xs: i32[], k: number): void => {
  for (let j = 0; j < k; j++) {
    xs.push(j);
  }
};`,
  shrink: `const shrink = (xs: i32[]): void => {
  if (xs.length > 0) {
    xs.pop();
  }
};`,
}

const LETTERS = "abcdefghijklmnopqrstuvwxyz"

/**
 * Each family answers `{ kind, lines, helpers, threads }` for an in-bounds
 * (`past` false) or a one-past (`past` true) variant: the statements of one
 * block that adds what it reads to the outer `s`. A one-past variant reaches
 * index `length` (or a range ending at `length + 1`) and no further, so the
 * first out-of-range access is the one the checked build panics on.
 */
const FAMILIES = {
  derived: (r, past) => {
    const kind = r.pick(["add", "mul", "shr", "mask", "u8", "u16"])
    const c = r.int(1, 3)
    if (kind === "add") {
      const cond = past ? `i + ${c} <= a.length` : r.pick([`i + ${c} < a.length`, `i < a.length - ${c}`])
      return {
        kind,
        helpers: ["fill"],
        lines: [
          `const a = fill(${r.int(c + 1, 12)}, ${c});`,
          `for (let i = 0; ${cond}; i++) {`,
          `  s += a[i + ${c}];`,
          "}",
        ],
      }
    }
    if (kind === "mul") {
      const n = r.int(2, 8)
      const k = r.int(2, 4)
      const len = past ? (n - 1) * k : (n - 1) * k + 1
      return {
        kind,
        helpers: ["fill"],
        lines: [
          `const a = fill(${len}, ${c});`,
          `for (let i = 0; i < ${n}; i++) {`,
          `  s += a[i * ${k}];`,
          "}",
        ],
      }
    }
    if (kind === "shr") {
      const n = 2 * r.int(2, 8)
      return {
        kind,
        helpers: ["fill"],
        lines: [
          `const a = fill(${past ? n / 2 - 1 : n / 2}, ${c});`,
          `for (let i = 0; i < ${n}; i++) {`,
          "  const h = i >> 1;",
          "  s += a[h];",
          "}",
        ],
      }
    }
    if (kind === "mask") {
      const m = r.pick([3, 7, 15])
      return {
        kind,
        helpers: ["fill"],
        lines: [
          `const a = fill(${past ? m : m + 1}, ${c});`,
          `for (let i = 0; i < ${2 * m + r.int(2, 5)}; i++) {`,
          `  const j = i & ${m};`,
          "  s += a[j];",
          "}",
        ],
      }
    }
    const [bits, top] = kind === "u8" ? ["U8", 256] : ["U16", 65536]
    return {
      kind,
      helpers: ["fill"],
      lines: [
        `const a = fill(${past ? top - 1 : top}, ${c});`,
        `for (let i = 0; i < ${top}; i++) {`,
        `  const b: ${kind} = to${bits}(i);`,
        "  s = s ^ a[b];",
        "}",
      ],
    }
  },

  bounds: (r, past) => {
    const kind = r.pick(["lt", "n", "rev", "step"])
    const n = r.int(1, 10)
    const fill = `const a = fill(${kind === "step" ? 2 * n : n}, ${r.int(0, 5)});`
    if (kind === "lt") {
      return {
        kind,
        helpers: ["fill"],
        lines: [fill, `for (let i = 0; i ${past ? "<=" : "<"} a.length; i++) {`, "  s += a[i];", "}"],
      }
    }
    if (kind === "n") {
      return {
        kind,
        helpers: ["fill"],
        lines: [
          fill,
          `const n = a.length${past ? " + 1" : ""};`,
          "for (let i = 0; i < n; i++) {",
          "  s += a[i];",
          "}",
        ],
      }
    }
    if (kind === "rev") {
      return {
        kind,
        helpers: ["fill"],
        lines: [fill, `for (let i = a.length${past ? "" : " - 1"}; i >= 0; i--) {`, "  s += a[i];", "}"],
      }
    }
    return {
      kind,
      helpers: ["fill"],
      lines: [fill, `for (let i = 0; i ${past ? "<=" : "<"} a.length; i += 2) {`, "  s += a[i];", "}"],
    }
  },

  pushpop: (r, past) => {
    const kind = r.pick(["push", "pop"])
    const n = r.int(1, 12)
    if (kind === "push") {
      return {
        kind,
        lines: [
          "const a: i32[] = [];",
          `for (let i = 0; i < ${n}; i++) {`,
          `  a.push(i * ${r.int(1, 9)});`,
          `  s += a[${past ? "i + 1" : "i"}];`,
          "}",
        ],
      }
    }
    const k = r.int(1, n)
    return {
      kind,
      helpers: ["fill"],
      lines: [
        `const a = fill(${n}, ${r.int(0, 5)});`,
        "const n = a.length;",
        `for (let i = 0; i < ${k}; i++) {`,
        "  s += a.pop();",
        "}",
        `for (let i = 0; i < ${past ? "n" : "a.length"}; i++) {`,
        "  s += a[i];",
        "}",
      ],
    }
  },

  slice: (r, past) => {
    const kind = r.pick(["set", "str", "bytes"])
    const k = r.int(1, 6)
    const m = k + r.int(0, 6)
    const extra = past ? " + 1" : ""
    if (kind === "set") {
      return {
        kind,
        helpers: ["fill"],
        lines: [
          `const src = fill(${k}, 7);`,
          `const dst = fill(${m}, 0);`,
          `dst.set(src, dst.length - src.length${extra});`,
          "s += dst[dst.length - 1];",
        ],
      }
    }
    const from = r.int(0, k)
    if (kind === "str") {
      const text = Array.from({ length: k }, () => r.pick([...LETTERS])).join("")
      return { kind, lines: [`const t = "${text}";`, `s += t.slice(${from}, t.length${extra}).length;`] }
    }
    const bytes = Array.from({ length: k }, () => 97 + r.int(0, 25)).join(", ")
    return {
      kind,
      lines: [`const b: u8[] = [${bytes}];`, `s += String.fromBytes(b, ${from}, b.length${extra}).length;`],
    }
  },

  alias: (r, past) => {
    const kind = r.pick(["names", "field", "grow", "shrink", "shrinkloop"])
    const n = r.int(1, 8)
    const fill = `const a = fill(${n}, ${r.int(0, 5)});`
    if (kind === "names") {
      return {
        kind,
        helpers: ["fill"],
        lines: [fill, "const b = a;", `b.push(${r.int(1, 99)});`, `s += a[${past ? n + 1 : n}];`],
      }
    }
    if (kind === "field") {
      return {
        kind,
        helpers: ["fill", "box"],
        lines: [
          `const box = new Box(fill(${n}, 1));`,
          `box.xs.push(${r.int(1, 99)});`,
          `for (let i = 0; i ${past ? "<=" : "<"} box.xs.length; i++) {`,
          "  s += box.xs[i];",
          "}",
        ],
      }
    }
    if (kind === "grow") {
      const k = r.int(1, 4)
      return {
        kind,
        helpers: ["fill", "grow"],
        lines: [
          fill,
          `grow(a, ${k});`,
          `for (let i = 0; i < ${past ? n + k + 1 : n + k}; i++) {`,
          "  s += a[i];",
          "}",
        ],
      }
    }
    if (kind === "shrink") {
      return {
        kind,
        helpers: ["fill", "shrink"],
        lines: [
          fill,
          "const n = a.length;",
          "shrink(a);",
          `for (let i = 0; i < ${past ? "n" : "a.length"}; i++) {`,
          "  s += a[i];",
          "}",
        ],
      }
    }
    // The callee shrinks the array between the loop's test and the access on
    // the last pass: the test proves nothing about the access after the call.
    const read = ["  s += a[i];"]
    const call = ["  if (i === a.length - 1) {", "    shrink(a);", "  }"]
    return {
      kind,
      helpers: ["fill", "shrink"],
      lines: [
        fill,
        "for (let i = 0; i < a.length; i++) {",
        ...(past ? [...call, ...read] : [...read, ...call]),
        "}",
      ],
    }
  },

  closure: (r, past) => {
    const kind = r.pick(["from", "offset"])
    const n = r.int(1, 10)
    const c = r.int(1, 3)
    if (kind === "from") {
      return {
        kind,
        threads: ["parallelFrom"],
        helpers: ["fill"],
        lines: [
          `const src = fill(${n}, ${c});`,
          `const got = parallelFrom(src.length${past ? " + 1" : ""}, (i: number): i32 => src[i] + ${c});`,
          "s += got[got.length - 1];",
        ],
      }
    }
    return {
      kind,
      threads: ["parallelFrom"],
      helpers: ["fill"],
      lines: [
        `const src = fill(${n + c}, ${c});`,
        `const got = parallelFrom(src.length - ${past ? c - 1 : c}, (i: number): i32 => src[i + ${c}]);`,
        "s += got[0];",
      ],
    }
  },

  arena: (r, past) => {
    const kind = r.pick(["fill", "push"])
    const n = r.int(1, 10)
    if (kind === "fill") {
      return {
        kind,
        helpers: ["fill"],
        lines: [
          "{",
          "  using ar = arena();",
          `  const t = fill(${n}, 2);`,
          `  for (let i = 0; i ${past ? "<=" : "<"} t.length; i++) {`,
          "    s += t[i];",
          "  }",
          "}",
        ],
      }
    }
    return {
      kind,
      lines: [
        "{",
        "  using ar = arena();",
        "  const t: i32[] = [];",
        `  for (let i = 0; i < ${n}; i++) {`,
        `    t.push(i + ${r.int(0, 9)});`,
        "  }",
        `  s += t[t.length${past ? "" : " - 1"}];`,
        "}",
      ],
    }
  },

  threads: (r, past) => {
    const n = r.int(1, 10)
    return {
      kind: "mapinto",
      threads: ["parallelMapInto", "parallelReduce"],
      helpers: ["fill"],
      lines: [
        `const src = fill(${n}, 1);`,
        `const dst = fill(${past ? n - 1 : n}, 0);`,
        `parallelMapInto(src, dst, (x: i32): i32 => x * ${r.int(2, 5)});`,
        "s += parallelReduce(dst, (p: i32, q: i32): i32 => p + q, 0);",
      ],
    }
  },
}

const FAMILY_NAMES = Object.keys(FAMILIES)

/** The Nish line printing the running sum. */
// biome-ignore lint/suspicious/noTemplateCurlyInString: Nish source text; the template is the program's
const PRINT_SUM = "  console.log(`${s}`);"

/** One program: one to three shapes, the last of them one-past about half the time. */
const generate = (seed, index) => {
  const r = rng(Math.imul(seed >>> 0, 0x9e3779b1) ^ Math.imul(index + 1, 0x85ebca6b))
  const families = [...FAMILY_NAMES]
  const count = r.int(1, 3)
  const expectPanic = r.chance(0.5)
  const blocks = []
  const helpers = new Set()
  const threads = new Set()
  const shapes = []
  for (let k = 0; k < count; k++) {
    const family = families.splice(r.int(0, families.length - 1), 1)[0]
    const past = expectPanic && k === count - 1
    const shape = FAMILIES[family](r, past)
    for (const h of shape.helpers ?? []) {
      helpers.add(h)
    }
    for (const t of shape.threads ?? []) {
      threads.add(t)
    }
    shapes.push(`${family}:${shape.kind}${past ? "!" : ""}`)
    blocks.push(`  // ${shapes.at(-1)}`, "  {", ...shape.lines.map((l) => `    ${l}`), "  }", PRINT_SUM)
  }
  const head = []
  if (threads.size > 0) {
    head.push(`import { ${[...threads].sort().join(", ")} } from "nish/threads";`, "")
  }
  for (const name of Object.keys(HELPERS)) {
    if (helpers.has(name)) {
      head.push(HELPERS[name], "")
    }
  }
  const source = [...head, "export const main = (): void => {", "  let s = 0;", ...blocks, "};", ""].join(
    "\n"
  )
  return { source, shapes, expectPanic }
}

/** The element accesses a source reads: a name, field or call result, then `[` and an index. */
const countAccesses = (source) => source.match(/[\w)\]]\[(?!\])/g)?.length ?? 0

/** Compiles every program and checks acceptance, coverage, elision and, with clang, the panics. */
const selfTest = (seed, count) => {
  const compiler = lib.compilerFor(path.join(lib.root, "build", "seed", "bin", "nish"))
  if (compiler.error) {
    console.error(`proofgen: ${compiler.error}`)
    return 1
  }
  const run = lib.hasClang()
  const dir = path.join(lib.buildDir, "proofgen")
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  const failures = []
  const seen = new Map()
  let accesses = 0
  let sites = 0
  for (let i = 0; i < count; i++) {
    const program = generate(seed, i)
    if (generate(seed, i).source !== program.source) {
      failures.push(`#${i}: not deterministic for --seed ${seed}`)
    }
    for (const shape of program.shapes) {
      seen.set(shape, (seen.get(shape) ?? 0) + 1)
    }
    const file = path.join(dir, `p${i}.ts`)
    fs.writeFileSync(file, program.source)
    const out = path.join(dir, `p${i}`)
    const compile = spawnSync(
      compiler.cmd,
      [...compiler.prefix, file, "--no-warn-performance", "-o", `${out}/`],
      { encoding: "utf8" }
    )
    if (compile.status !== 0) {
      failures.push(`#${i} [${program.shapes.join(" ")}]: the seed rejects it:\n${compile.stderr.trim()}`)
      continue
    }
    accesses += countAccesses(program.source)
    sites +=
      fs.readFileSync(path.join(out, `p${i}.ll`), "utf8").match(/call void @nish_panic_index\(/g)?.length ?? 0
    if (!run) {
      continue
    }
    const link = spawnSync(
      compiler.cmd,
      [...compiler.prefix, file, "--no-warn-performance", "--link", `${out}.exe`],
      { encoding: "utf8" }
    )
    if (link.status !== 0) {
      failures.push(`#${i} [${program.shapes.join(" ")}]: the link fails:\n${link.stderr.trim()}`)
      continue
    }
    const result = spawnSync(`${out}.exe`, [], { encoding: "utf8", timeout: 20000 })
    const { kind } = classify(result)
    const verdict = kind === "clean" && result.status !== 0 ? `exit ${result.status}` : kind
    if (verdict !== (program.expectPanic ? "panic" : "clean")) {
      failures.push(
        `#${i} [${program.shapes.join(" ")}]: expected ${program.expectPanic ? "a panic" : "a clean exit"}, got ${verdict} (status ${result.status}):\n${result.stderr.trim()}`
      )
    }
  }
  for (const family of FAMILY_NAMES) {
    for (const past of [false, true]) {
      if (![...seen.keys()].some((s) => s.startsWith(`${family}:`) && s.endsWith("!") === past)) {
        failures.push(`shape ${family} never occurred ${past ? "one-past" : "in bounds"}; raise --count`)
      }
    }
  }
  const proven = accesses - sites
  if (proven <= 0) {
    failures.push(`no access was proven: ${sites} nish_panic_index sites for ${accesses} accesses`)
  }
  console.log(
    `proofgen: ${count} programs from --seed ${seed}, all accepted by ${compiler.label}${failures.length > 0 ? " (but see below)" : ""}`
  )
  console.log(
    `proofgen: shapes ${[...seen]
      .sort()
      .map(([s, n]) => `${s} ${n}`)
      .join(", ")}`
  )
  console.log(
    `proofgen: ${sites} nish_panic_index sites for ${accesses} accesses: ${proven} proven (${((100 * proven) / Math.max(accesses, 1)).toFixed(1)}%)`
  )
  console.log(
    run
      ? "proofgen: linked and ran every program against its expectPanic"
      : "proofgen: no clang, so nothing was run"
  )
  for (const f of failures) {
    console.error(`proofgen: FAIL ${f}`)
  }
  return failures.length > 0 ? 1 : 0
}

export { generate }

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const option = (name, fallback) => {
    const at = args.indexOf(name)
    return at === -1 ? fallback : Number(args[at + 1])
  }
  const seed = option("--seed", 1)
  const count = option("--count", 200)
  const index = option("--index", 0)
  if (![seed, count, index].every(Number.isInteger) || count < 1) {
    console.error("usage: proofgen.js --self-test [--seed S] [--count N] | --print [--seed S] [--index I]")
    process.exit(2)
  }
  if (args.includes("--self-test")) {
    process.exit(selfTest(seed, count))
  } else if (args.includes("--print")) {
    const program = generate(seed, index)
    console.log(
      `// shapes: ${program.shapes.join(" ")}; expectPanic: ${program.expectPanic}\n${program.source}`
    )
  } else {
    console.error("usage: proofgen.js --self-test [--seed S] [--count N] | --print [--seed S] [--index I]")
    process.exit(2)
  }
}
