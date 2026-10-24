#!/usr/bin/env node
/**
 * The proof-shaped program generator: random Nish programs built around the
 * accesses the bounds-check elision reasons about, each one in an in-bounds
 * and a one-past variant, so a checked build of the one-past variant must
 * panic and an unchecked build of it reads a byte the address sanitizer sees.
 *
 * Usage:
 *   node tests/differential/proofgen.js --self-test [--seed S] [--count N] [--compiler PATH]
 *   node tests/differential/proofgen.js --print [--seed S] [--index I]
 *
 * `generate(seed, index)` answers `{ source, shapes, expectPanic }`: the
 * program, the shapes it holds (`family:kind`, with `!` after a one-past one)
 * and whether a checked build of it exits through a panic. At most one shape
 * in a program is one-past and it runs last, so what the shapes before it
 * print is checked too. The families, their kinds in `KINDS`:
 *
 * - `derived` — an index derived from the counter: `i + c` (bounded by
 *   `a.length` or by a literal), `i * k`, `i >> 1`, `i & m`,
 *   and a `u8` and a `u16` index over an array of 256 or 65536. Each reads
 *   under the `a.length >= L` guard the prover needs to know the length.
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
 * `ASAN_BLIND` names the shapes whose one-past read stays inside the array's
 * block, which AddressSanitizer cannot see; `LIBRARY_CHECKED` the ones the
 * library, not the program, checks; `PROOF_MISSES` the ones the prover proves
 * nothing in.
 *
 * `--self-test` takes `--compiler`, else `build/nish` when it is there (the
 * compiler built from `src/`), else the seed `lib.compilerFor` resolves
 * (`NISH_BOOTSTRAP`, then the fetched release), and needs clang. It first builds
 * the catalogue: every `family:kind` in both variants as a program of its own,
 * without the loop that pads it, where the in-bounds variant must prove one
 * of its own accesses (none, for a `PROOF_MISSES` shape), the one-past variant
 * must keep the site for the access it moved, and each must panic exactly when
 * it is one past. Then it builds and runs the corpus: the checker must accept every
 * program, each must panic exactly when `expectPanic` says so, every family
 * must occur in both variants, and a second process must generate the same
 * programs. It reports the check sites (`nish_panic_index`, `nish_panic_slice`)
 * left in each program's IR against its checked accesses: the difference is
 * what the elision proved. Exits 1 on a failure and 2 on a bad option or a
 * missing toolchain.
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

/** The kinds of each family, in the order `generate` picks from. */
const KINDS = {
  derived: ["add", "addlit", "mul", "shr", "mask", "u8", "u16"],
  bounds: ["lt", "n", "rev", "step"],
  pushpop: ["push", "pop"],
  slice: ["set", "str", "bytes"],
  alias: ["names", "field", "grow", "shrink", "shrinkloop"],
  closure: ["from", "offset"],
  arena: ["fill", "push"],
  threads: ["mapinto"],
}

/**
 * Each family answers `{ lines, pad, helpers, threads }` for one kind in an
 * in-bounds (`past` false) or a one-past (`past` true) variant: the statements
 * of one block that adds what it reads to the outer `s`. A one-past variant
 * reaches index `length` (or a range ending at `length + 1`) and no further,
 * so the first out-of-range access is the one the checked build panics on.
 * `pad`, when there is one, reads the block's result after `lines`.
 *
 * Every in-bounds variant bar the `PROOF_MISSES` holds an access of its own
 * the elision proves, which the self-test's catalogue checks shape by shape. The prover knows an
 * array's length only from a test on it (`docs/LANGUAGE.md`, bounds checks), so
 * a shape whose index is not bounded by `a.length` itself reads under
 * `if (a.length >= L)`, `L` the length the array was filled to; the one-past
 * variant keeps the same guard and lets the index reach `L`, which a sound
 * prover must leave checked.
 */
const FAMILIES = {
  derived: (r, past, kind) => {
    const c = r.int(1, 3)
    const tag = r.int(0, 5)
    // A bound with the offset subtracted, `i < a.length - c` or `i < n - c`,
    // proves nothing in 0.20.0 even under the guard, so it is no kind here.
    if (kind === "add" || kind === "addlit") {
      const n = r.int(c + 1, 12)
      const cond = {
        add: past ? `i + ${c} <= a.length` : `i + ${c} < a.length`,
        addlit: past ? `i + ${c} <= ${n}` : `i + ${c} < ${n}`,
      }[kind]
      const loop = [`for (let i = 0; ${cond}; i++) {`, `  s += a[i + ${c}];`, "}"]
      return {
        helpers: ["fill"],
        lines: [`const a = fill(${n}, ${tag});`, ...(kind === "add" ? loop : guarded(n, loop))],
      }
    }
    if (kind === "mul") {
      const n = r.int(2, 8)
      const k = r.int(2, 4)
      const len = past ? (n - 1) * k : (n - 1) * k + 1
      return {
        helpers: ["fill"],
        lines: [
          `const a = fill(${len}, ${tag});`,
          ...guarded(len, [`for (let i = 0; i < ${n}; i++) {`, `  const j = i * ${k};`, "  s += a[j];", "}"]),
        ],
      }
    }
    if (kind === "shr") {
      const m = r.int(2, 8)
      return {
        helpers: ["fill"],
        lines: [
          `const a = fill(${m}, ${tag});`,
          ...guarded(m, [
            `for (let i = 0; i < ${past ? 2 * m + 1 : 2 * m}; i++) {`,
            "  const h = i >> 1;",
            "  s += a[h];",
            "}",
          ]),
        ],
      }
    }
    if (kind === "mask") {
      const m = r.pick([3, 7, 15])
      const len = past ? m : m + 1
      return {
        helpers: ["fill"],
        lines: [
          `const a = fill(${len}, ${tag});`,
          ...guarded(len, [
            `for (let i = 0; i < ${2 * m + r.int(2, 5)}; i++) {`,
            `  const j = i & ${m};`,
            "  s += a[j];",
            "}",
          ]),
        ],
      }
    }
    const [bits, top] = kind === "u8" ? ["U8", 256] : ["U16", 65536]
    const len = past ? top - 1 : top
    return {
      helpers: ["fill"],
      lines: [
        `const a = fill(${len}, ${tag});`,
        ...guarded(len, [
          `for (let i = 0; i < ${top}; i++) {`,
          `  const b: ${kind} = to${bits}(i);`,
          "  s = s ^ a[b];",
          "}",
        ]),
      ],
    }
  },

  bounds: (r, past, kind) => {
    const n = r.int(1, 10)
    const fill = `const a = fill(${kind === "step" ? 2 * n : n}, ${r.int(0, 5)});`
    if (kind === "lt") {
      return {
        helpers: ["fill"],
        lines: [fill, `for (let i = 0; i ${past ? "<=" : "<"} a.length; i++) {`, "  s += a[i];", "}"],
      }
    }
    if (kind === "n") {
      return {
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
        helpers: ["fill"],
        lines: [fill, `for (let i = a.length${past ? "" : " - 1"}; i >= 0; i--) {`, "  s += a[i];", "}"],
      }
    }
    return {
      helpers: ["fill"],
      lines: [fill, `for (let i = 0; i ${past ? "<=" : "<"} a.length; i += 2) {`, "  s += a[i];", "}"],
    }
  },

  pushpop: (r, past, kind) => {
    const n = r.int(1, 12)
    if (kind === "push") {
      return {
        lines: [
          "const a: i32[] = [];",
          `for (let i = 0; i < ${n}; i++) {`,
          `  a.push(i * ${r.int(1, 9)});`,
          `  s += a[${past ? "i + 1" : "i"}];`,
          "}",
        ],
        pad: sumLoop("a"),
      }
    }
    const k = r.int(1, n)
    return {
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

  slice: (r, past, kind) => {
    const k = r.int(1, 6)
    const m = k + r.int(0, 6)
    const extra = past ? " + 1" : ""
    if (kind === "set") {
      return {
        helpers: ["fill"],
        lines: [
          `const src = fill(${k}, 7);`,
          `const dst = fill(${m}, 0);`,
          `dst.set(src, dst.length - src.length${extra});`,
        ],
        pad: sumLoop("dst"),
      }
    }
    const from = r.int(0, k)
    const codes = ["for (let i = 0; i < u.length; i++) {", "  s += u.charCodeAt(i);", "}"]
    if (kind === "str") {
      const text = Array.from({ length: k }, () => r.pick([...LETTERS])).join("")
      return { lines: [`const t = "${text}";`, `const u = t.slice(${from}, t.length${extra});`], pad: codes }
    }
    const bytes = Array.from({ length: k }, () => 97 + r.int(0, 25)).join(", ")
    return {
      lines: [`const b: u8[] = [${bytes}];`, `const u = String.fromBytes(b, ${from}, b.length${extra});`],
      pad: codes,
    }
  },

  alias: (r, past, kind) => {
    const n = r.int(1, 8)
    const fill = `const a = fill(${n}, ${r.int(0, 5)});`
    if (kind === "names") {
      // In bounds the guard follows the push through the other name, so it
      // speaks of the grown array. One past, the pop through `b` comes after
      // the guard on `a`, which says nothing about `a` once `b` has shrunk it.
      return {
        helpers: ["fill"],
        lines: past
          ? [fill, "const b = a;", ...guarded(n, ["b.pop();", `s += a[${n - 1}];`])]
          : [fill, "const b = a;", `b.push(${r.int(1, 99)});`, ...guarded(n + 1, [`s += a[${n}];`])],
      }
    }
    if (kind === "field") {
      return {
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
        helpers: ["fill", "grow"],
        lines: [
          fill,
          `grow(a, ${k});`,
          ...guarded(n + k, [`for (let i = 0; i < ${past ? n + k + 1 : n + k}; i++) {`, "  s += a[i];", "}"]),
        ],
      }
    }
    if (kind === "shrink") {
      return {
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
      helpers: ["fill", "shrink"],
      lines: [
        fill,
        "for (let i = 0; i < a.length; i++) {",
        ...(past ? [...call, ...read] : [...read, ...call]),
        "}",
      ],
    }
  },

  closure: (r, past, kind) => {
    const n = r.int(1, 10)
    const c = r.int(1, 3)
    if (kind === "from") {
      return {
        threads: ["parallelFrom"],
        helpers: ["fill"],
        lines: [
          `const src = fill(${n}, ${c});`,
          `const got = parallelFrom(src.length${past ? " + 1" : ""}, (i: number): i32 => src[i] + ${c});`,
        ],
        pad: sumLoop("got"),
      }
    }
    return {
      threads: ["parallelFrom"],
      helpers: ["fill"],
      lines: [
        `const src = fill(${n + c}, ${c});`,
        `const got = parallelFrom(src.length - ${past ? c - 1 : c}, (i: number): i32 => src[i + ${c}]);`,
      ],
      pad: sumLoop("got"),
    }
  },

  arena: (r, past, kind) => {
    const n = r.int(1, 10)
    if (kind === "fill") {
      return {
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
      lines: [
        "{",
        "  using ar = arena();",
        "  const t: i32[] = [];",
        `  for (let i = 0; i < ${n}; i++) {`,
        `    t.push(i + ${r.int(0, 9)});`,
        "  }",
        ...guarded(n, [`s += t[${past ? n : n - 1}];`], "t").map((l) => `  ${l}`),
        "}",
      ],
    }
  },

  threads: (r, past) => {
    const n = r.int(1, 10)
    return {
      threads: ["parallelMapInto", "parallelReduce"],
      helpers: ["fill"],
      lines: [
        `const src = fill(${n}, 1);`,
        `const dst = fill(${past ? n - 1 : n}, 0);`,
        `parallelMapInto(src, dst, (x: i32): i32 => x * ${r.int(2, 5)});`,
        "s += parallelReduce(dst, (p: i32, q: i32): i32 => p + q, 0);",
      ],
      pad: sumLoop("dst"),
    }
  },
}

/** `lines` under a guard recording that `name` holds at least `n` elements. */
const guarded = (n, lines, name = "a") => [
  `if (${name}.length >= ${n}) {`,
  ...lines.map((l) => `  ${l}`),
  "}",
]

/**
 * A loop adding every element of `name` to `s`, so the shape's result is read.
 * A builder returns it as `pad`, apart from `lines`: its access is one the
 * elision proves, and the catalogue leaves it out so it cannot stand in for a
 * proof of the shape's own accesses.
 */
const sumLoop = (name) => [`for (let i = 0; i < ${name}.length; i++) {`, `  s += ${name}[i];`, "}"]

/**
 * The shapes whose one-past variant an unchecked build gets wrong in a way
 * AddressSanitizer cannot see, for a caller pairing this generator with
 * `asan.js`: the access lands inside the array's block, below its capacity,
 * on an element a `pop` left behind (the pop is inline IR, so nothing
 * re-poisons it) or, for `slice:str`, on a string's terminating NUL.
 */
const ASAN_BLIND = ["pushpop:pop", "alias:names", "alias:shrink", "alias:shrinkloop", "slice:str"]

/**
 * The shapes whose one-past variant panics in the library rather than at a
 * check site in the program: `parallelMapInto` compares the two lengths
 * itself, so the program's own IR keeps no site for it.
 */
const LIBRARY_CHECKED = ["threads:mapinto"]

/**
 * The shapes whose in-bounds variant the prover leaves fully checked in 0.20.0:
 * missed proofs, recorded so the catalogue fails both when another shape stops
 * proving and when one of these starts to (and should leave the list). It
 * learns nothing from a `push` about the index just written, proves no range
 * operation (`set`, `slice`, `String.fromBytes`) against the lengths it is
 * given, and nothing inside a `parallelFrom` arrow about its index;
 * `parallelMapInto` makes no access of the program's own.
 */
const PROOF_MISSES = [
  "pushpop:push",
  "slice:set",
  "slice:str",
  "slice:bytes",
  "closure:from",
  "closure:offset",
  "threads:mapinto",
]

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
    const kind = r.pick(KINDS[family])
    const shape = shapeOf(family, kind, past, r)
    for (const h of shape.helpers ?? []) {
      helpers.add(h)
    }
    for (const t of shape.threads ?? []) {
      threads.add(t)
    }
    shapes.push(`${family}:${kind}${past ? "!" : ""}`)
    const lines = [...shape.lines, ...(shape.pad ?? [])]
    blocks.push(`  // ${shapes.at(-1)}`, "  {", ...lines.map((l) => `    ${l}`), "  }", PRINT_SUM)
  }
  return { source: assemble(blocks, helpers, threads), shapes, expectPanic }
}

/**
 * One shape's block, from the family's builder. A kind `KINDS` does not list
 * throws rather than falling through to whichever builder ends the family.
 */
const shapeOf = (family, kind, past, r) => {
  if (!KINDS[family]?.includes(kind)) {
    throw new Error(`proofgen: no shape ${family}:${kind}`)
  }
  return FAMILIES[family](r, past, kind)
}

/**
 * The program holding exactly one shape, for the self-test's catalogue: every
 * `family:kind` in both variants, whatever the random corpus happened to draw.
 * It leaves out the shape's `pad`, so every access it makes is the shape's own.
 */
const single = (family, kind, past, seed) => {
  const shape = shapeOf(family, kind, past, rng(seed))
  const blocks = ["  {", ...shape.lines.map((l) => `    ${l}`), "  }", PRINT_SUM]
  return assemble(blocks, new Set(shape.helpers ?? []), new Set(shape.threads ?? []))
}

/** The whole program around `blocks`: the imports and helpers they use, then `main`. */
const assemble = (blocks, helpers, threads) => {
  const head = []
  if (threads.size > 0) {
    head.push(`import { ${[...threads].sort().join(", ")} } from "nish/threads";`, "")
  }
  for (const name of Object.keys(HELPERS)) {
    if (helpers.has(name)) {
      head.push(HELPERS[name], "")
    }
  }
  return [...head, "export const main = (): void => {", "  let s = 0;", ...blocks, "};", ""].join("\n")
}

/**
 * The checked accesses a source makes: an element read or write (a name, field
 * or call result, then `[` and an index), a `charCodeAt`, a `pop`, and a range
 * operation (`set`, `slice`, `String.fromBytes`). Each is one check site in the
 * IR unless the elision proved it.
 */
const countAccesses = (source) =>
  (source.match(/[\w)\]]\[(?!\])/g)?.length ?? 0) +
  (source.match(/\.(charCodeAt|pop|set|slice|fromBytes)\(/g)?.length ?? 0)

/** The check sites a module's IR keeps: an index or a range check that may panic. */
const countSites = (ir) => ir.match(/call void @nish_panic_(index|slice)\(/g)?.length ?? 0

/**
 * Compiles `source` as `<dir>/<name>.ts` (and links it when `link`), answering
 * `{ error }` or `{ accesses, sites, exe }`: the checked accesses in the source
 * and the check sites left in the program's own module.
 */
const build = (compiler, dir, name, source, link) => {
  const file = path.join(dir, `${name}.ts`)
  fs.writeFileSync(file, source)
  const out = path.join(dir, name)
  const flags = ["--no-warn-performance", ...(source.includes('from "nish/threads"') ? ["--threads"] : [])]
  const linking = link ? ["--link", `${out}.exe`] : []
  const compile = spawnSync(compiler.cmd, [...compiler.prefix, file, ...flags, "-o", `${out}/`, ...linking], {
    encoding: "utf8",
  })
  if (compile.status !== 0) {
    return { error: `${compiler.label} rejects or cannot link it:\n${compile.stderr.trim()}` }
  }
  const ir = fs.readFileSync(path.join(out, `${name}.ll`), "utf8")
  return { accesses: countAccesses(source), sites: countSites(ir), exe: `${out}.exe` }
}

/** What running `exe` came to: `classify`'s kind, so only a status 0 is `clean`. */
const verdictOf = (exe) => {
  const result = spawnSync(exe, [], { encoding: "utf8", timeout: 20000 })
  const { kind, detail } =
    result.error?.code === "ETIMEDOUT" ? { kind: "timeout", detail: "" } : classify(result)
  return { kind, detail: detail ?? result.stderr.trim() }
}

/**
 * Builds every `family:kind` in both variants as a program of its own, without
 * its `pad`. Each in-bounds variant must prove one of its own accesses, bar the
 * `PROOF_MISSES`, which must prove none; each one-past variant must keep more
 * check sites than the in-bounds one, and may prove at most one access fewer
 * than it (none, for a `PROOF_MISSES` shape; nothing is asked of a
 * `LIBRARY_CHECKED` one), so the site kept is the one-past access's even where
 * the one-past variant's lines differ; and, with clang, each must panic
 * exactly when it is one past.
 */
const catalogue = (compiler, dir, seed, run, failures) => {
  const rows = []
  for (const family of FAMILY_NAMES) {
    for (const kind of KINDS[family]) {
      const shape = `${family}:${kind}`
      const row = { shape }
      for (const past of [false, true]) {
        const name = `${family}-${kind}${past ? "-past" : ""}`
        const built = build(compiler, dir, name, single(family, kind, past, seed), run)
        if (built.error) {
          failures.push(`${shape}${past ? "!" : ""} alone: ${built.error}`)
          continue
        }
        row[past ? "past" : "in"] = built
        const miss = PROOF_MISSES.includes(shape)
        if (!past && miss !== built.accesses - built.sites < 1) {
          failures.push(
            miss
              ? `${shape} in bounds now proves ${built.accesses - built.sites} of its ${built.accesses} accesses: take it out of PROOF_MISSES`
              : `${shape} in bounds proves none of its ${built.accesses} accesses (${built.sites} sites)`
          )
        }
        // The one-past variant is the in-bounds one with one proven access
        // moved past the end, so it may prove at most one access fewer; a
        // `PROOF_MISSES` shape proves none, so it keeps every site.
        const proven = row.in ? row.in.accesses - row.in.sites : 1
        const floor = miss ? built.accesses : Math.max((row.in?.sites ?? 0) + 1, built.accesses - proven + 1)
        if (past && built.sites < floor && !LIBRARY_CHECKED.includes(shape)) {
          failures.push(
            `${shape}! keeps ${built.sites} check sites of its ${built.accesses} accesses, fewer than ${floor}: ` +
              "it proves more than the in-bounds variant less the one-past access, so either a proof elided " +
              "that access or the in-bounds variant stopped proving one it shares"
          )
        }
        if (run) {
          const { kind: got, detail } = verdictOf(built.exe)
          if (got !== (past ? "panic" : "clean")) {
            failures.push(
              `${shape}${past ? "!" : ""} alone: expected ${past ? "a panic" : "a clean exit"}, got ${got}: ${detail}`
            )
          }
        }
      }
      rows.push(row)
    }
  }
  return rows
}

/** The compiler `npm run bootstrap` builds from `src/`, which `--self-test` prefers to the seed. */
const BUILT = path.resolve(import.meta.dirname, "..", "..", "build", "nish")

/** `--print`'s output for one program, which the self-test also asks a child process for. */
const printed = (program) =>
  `// shapes: ${program.shapes.join(" ")}; expectPanic: ${program.expectPanic}\n${program.source}`

/**
 * Builds the catalogue, then every program of the corpus, and checks
 * acceptance, determinism, coverage, elision and, with clang, the panics.
 * Answers the exit status: 1 on a failure, 2 when the toolchain is missing.
 */
const selfTest = (seed, count, spec) => {
  const compiler = lib.compilerFor(spec ?? (fs.existsSync(BUILT) ? BUILT : null))
  if (compiler.error) {
    console.error(`proofgen: ${compiler.error}`)
    return 2
  }
  if (!lib.hasClang()) {
    console.error("proofgen: no clang on PATH, so no program can be linked and run")
    return 2
  }
  const dir = path.join(lib.buildDir, `proofgen-${process.pid}`)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  try {
    return report(compiler, dir, seed, count)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

/** The self-test's body, in the work directory `dir`, which `selfTest` removes. */
const report = (compiler, dir, seed, count) => {
  const failures = []
  const rows = catalogue(compiler, dir, seed, true, failures)
  for (const i of [0, Math.min(count - 1, 7)]) {
    const child = spawnSync(
      process.execPath,
      [fileURLToPath(import.meta.url), "--print", "--seed", String(seed), "--index", String(i)],
      { encoding: "utf8" }
    )
    if (child.stdout !== `${printed(generate(seed, i))}\n`) {
      failures.push(`#${i}: another process generates a different program for --seed ${seed}`)
    }
  }
  const seen = new Map()
  let accesses = 0
  let sites = 0
  let rejected = 0
  for (let i = 0; i < count; i++) {
    const program = generate(seed, i)
    if (generate(seed, i).source !== program.source) {
      failures.push(`#${i}: not deterministic for --seed ${seed}`)
    }
    for (const shape of program.shapes) {
      seen.set(shape, (seen.get(shape) ?? 0) + 1)
    }
    const built = build(compiler, dir, `p${i}`, program.source, true)
    if (built.error) {
      rejected++
      failures.push(`#${i} [${program.shapes.join(" ")}]: ${built.error}`)
      continue
    }
    accesses += built.accesses
    sites += built.sites
    const { kind, detail } = verdictOf(built.exe)
    if (kind !== (program.expectPanic ? "panic" : "clean")) {
      failures.push(
        `#${i} [${program.shapes.join(" ")}]: expected ${program.expectPanic ? "a panic" : "a clean exit"}, got ${kind}: ${detail}`
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
  console.log("proofgen: catalogue, each shape alone (accesses/sites in bounds, then one past):")
  for (const { shape, in: inb, past } of rows) {
    const cell = (b) => (b ? `${b.accesses}/${b.sites}` : "-")
    console.log(`proofgen:   ${shape.padEnd(18)} ${cell(inb).padStart(7)} ${cell(past).padStart(7)}`)
  }
  console.log(
    `proofgen: ${count} programs from --seed ${seed}, ${count - rejected} built and linked by ${compiler.label}`
  )
  console.log(
    `proofgen: shapes ${[...seen]
      .sort()
      .map(([s, n]) => `${s} ${n}`)
      .join(", ")}`
  )
  console.log(
    `proofgen: ${sites} check sites for ${accesses} accesses: ${proven} proven (${((100 * proven) / Math.max(accesses, 1)).toFixed(1)}%)`
  )
  console.log(`proofgen: ran the ${count - rejected} built programs against their expectPanic`)
  for (const f of failures) {
    console.error(`proofgen: FAIL ${f}`)
  }
  return failures.length > 0 ? 1 : 0
}

export { generate, KINDS, ASAN_BLIND, LIBRARY_CHECKED, PROOF_MISSES }

const USAGE =
  "usage: proofgen.js --self-test [--seed S] [--count N] [--compiler PATH] | --print [--seed S] [--index I]"

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const option = (name, fallback) => {
    const at = args.indexOf(name)
    return at === -1 ? fallback : Number(args[at + 1])
  }
  const seed = option("--seed", 1)
  const count = option("--count", 200)
  const index = option("--index", 0)
  const at = args.indexOf("--compiler")
  const spec = at === -1 ? null : args[at + 1]
  // A seed is taken mod 2^32, so only 0 to 2^32 - 1 name distinct corpora.
  const valid =
    [seed, count, index].every(Number.isInteger) &&
    seed >= 0 &&
    seed <= 0xffffffff &&
    count >= 1 &&
    index >= 0
  if (!valid || spec === undefined) {
    console.error(USAGE)
    process.exit(2)
  }
  if (args.includes("--self-test")) {
    process.exit(selfTest(seed, count, spec))
  } else if (args.includes("--print")) {
    console.log(printed(generate(seed, index)))
  } else {
    console.error(USAGE)
    process.exit(2)
  }
}
