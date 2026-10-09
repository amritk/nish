#!/usr/bin/env node
/**
 * Random-program fuzzer for the differential harness (WP13).
 *
 * Generates straight-line Nish programs over 32-bit integers and
 * booleans: locals, `+ - * / %` (divisors go through `nz(x)`, which maps any
 * value into [2, 1001], so no division by zero and no INT_MIN / -1), unary
 * minus, `Math.abs/min/max`, comparisons, `&&`/`||`/`!`, ternaries, `++`/`--`
 * (prefix and postfix, also inside expressions for their side effects),
 * compound assignment, `if`/`else`, a few `for`/`while` loops with fixed trip
 * counts, helper functions, and `console.log` of numbers, booleans, and
 * template literals. Every program is deterministic and prints its locals at
 * the end.
 *
 * Most programs also declare generics (WP18): a generic function `pick<T>`, a
 * generic class `Cell<T>`, sometimes a generic function over it, `trade<T>`,
 * and a plain class `Pt` to instantiate them at. Each is instantiated at two
 * or three of `i32`, `boolean`, `string` and `Pt`, and the calls are
 * interleaved with the rest of `main`. They are drawn from a second random
 * stream of their own, so the straight-line program a seed printed before the
 * generics existed is still there, statement for statement, with the generic
 * lines woven into it.
 *
 * Each program is compiled with two compilers and the emitted IR compared
 * byte for byte, module set included (WP14, repointed by WP19 G2.2), reusing
 * the comparison of `tests/nish-cmp.js` so that the generated corpus is held
 * to exactly what the checked-in one is. The pair is the seed release
 * (`NISH_BOOTSTRAP`, or `--reference`) against HEAD, linked once per run. Both
 * compile with `--wrapping` while the seed predates checked signed arithmetic,
 * which changed the IR of every `+ - *` by design (see `stage1Run`).
 *
 * **An intended change is declared, not waved through.** HEAD is meant to
 * differ from the seed when a release changes what the emitter writes, and
 * such a change shows up in random programs exactly as it does in the
 * corpus. `DECLARED` below is this mode's counterpart of `tests/nish-cmp.js`'s
 * list, narrowed to what a generated program can reach: one function's
 * attribute group, keyed by the group's text on each side rather than by its
 * `#N`, because the numbers are assigned in order of first use and say nothing
 * about what changed. A difference an entry covers is reported and passes;
 * anything else still fails; and an entry that covers nothing in a run fails
 * as stale, so that the reseed after the release that ships the change is
 * what retires it. `explainDifference` decides, and `selfCheckDeclarations`
 * drives it over fabricated modules on every `npm test`. A change that
 * removes instructions rather than attributes, such as a check a new proof
 * leaves out, is a `DECLARED_CHECKS` entry instead, which states its
 * direction as a predicate over the two modules.
 *
 * There used to be a second, default mode that ran each program natively and
 * under Node through the live rewrite. The rewriter was stage0's checker and
 * went with it (R6), and a generated program has nothing a frozen store could
 * hold, so that comparison is gone rather than frozen; `--stage1` is kept as a
 * spelling of the one mode left, because `tests/run.js` passes it.
 *
 * Usage: node tests/differential/fuzz.js [--stage1] [--count N] [--seed S] [--depth D]
 *                                        [--reference <compiler>] [--candidate <compiler>]
 *        node tests/differential/fuzz.js --print --seed S
 *
 * Program i of a run uses seed S + i; a disagreeing program is saved as
 * build/test/differential/fuzz-stage1-fail-<S + i>.ts and reproduces with
 * `node tests/differential/fuzz.js --seed <S + i> --count 1`.
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import * as lib from "./lib.js"
import * as cmp from "../nish-cmp.js"
import ts from "typescript"
import { fileURLToPath } from "node:url"
import { root } from "../self/corpus.js"

/** mulberry32: small, seedable, good enough for program shapes. */
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
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (xs) => xs[Math.floor(next() * xs.length)],
    chance: (p) => next() < p,
  }
}

/** The type arguments a generic is instantiated at: a scalar, a flag, a string and a class. */
const GENERIC_TYPES = ["i32", "boolean", "string", "Pt"]
const STRINGS = ["", "a", "xy", "hello", "Z9"]

const LITERALS = [
  0, 1, -1, 2, 3, 7, 10, 100, 1000, 65536, 46341, 1000000000, 2147483647, -2147483647, 2147483646,
]

/** Build one program from a seed; returns its source text. */
const buildProgram = (seed, label, opts = {}) => {
  const base = rng(seed)
  // The generic lines draw from their own stream: `r` is `base` except while
  // `withStream` has swapped it, so every draw the plain program makes is the
  // one it made before generics existed.
  const gen = rng((seed ^ 0x2545f491) >>> 0)
  let r = base
  const withStream = (stream, build) => {
    const saved = r
    r = stream
    const out = build()
    r = saved
    return out
  }
  const maxDepth = opts.depth ?? 3
  const nLocals = r.int(3, 6)
  const nBools = r.int(1, 3)
  const helpers = r.int(1, 3)
  const locals = Array.from({ length: nLocals }, (_, i) => `v${i}`)
  const bools = Array.from({ length: nBools }, (_, i) => `b${i}`)

  const literal = () => {
    const v = r.chance(0.6) ? r.pick(LITERALS) : r.int(-2147483647, 2147483647)
    return v < 0 ? `(${v})` : String(v)
  }

  /**
   * Integer expression. `env` lists readable int names, `mutable` those `++` may
   * touch, `boolEnv` the boolean locals already declared, `callable` how many
   * helpers (`h0..h<callable-1>`) may be called.
   */
  let boolEnv = []
  let callable = 0
  const intExpr = (d, env, mutable) => {
    if (d <= 0 || r.chance(0.2)) {
      return env.length > 0 && r.chance(0.6) ? r.pick(env) : literal()
    }
    const sub = () => intExpr(d - 1, env, mutable)
    switch (r.int(0, 13)) {
      case 0:
        return `(${sub()} + ${sub()})`
      case 1:
        return `(${sub()} - ${sub()})`
      case 2:
        return `(${sub()} * ${sub()})`
      case 3:
        return `(${sub()} / nz(${sub()}))`
      case 4:
        return `(${sub()} % nz(${sub()}))`
      case 5:
        return `(-(${sub()}))` // the inner parens keep `-` and `--x` from fusing into `---x`
      case 6:
        return `Math.abs(${sub()})`
      case 7:
        return `Math.min(${sub()}, ${sub()})`
      case 8:
        return `Math.max(${sub()}, ${sub()})`
      case 9:
        return `(${boolExpr(d - 1, env, mutable)} ? ${sub()} : ${sub()})`
      case 10:
        // Helpers may only call lower-numbered helpers, so there is no recursion.
        if (callable > 0) {
          return `h${r.int(0, callable - 1)}(${sub()}, ${sub()})`
        }
        return sub()
      case 11:
        if (mutable.length > 0) {
          return `${r.pick(mutable)}${r.pick(["++", "--"])}`
        }
        return sub()
      case 12:
        if (mutable.length > 0) {
          return `${r.pick(["++", "--"])}${r.pick(mutable)}`
        }
        return sub()
      default:
        return `(${sub()} - ${literal()})`
    }
  }

  const boolExpr = (d, env, mutable) => {
    const sub = () => intExpr(d, env, mutable)
    if (d <= 0 || r.chance(0.15)) {
      if (boolEnv.length > 0 && r.chance(0.5)) {
        return r.pick(boolEnv)
      }
      return r.pick(["true", "false"])
    }
    switch (r.int(0, 8)) {
      case 0:
        return `(${sub()} < ${sub()})`
      case 1:
        return `(${sub()} <= ${sub()})`
      case 2:
        return `(${sub()} > ${sub()})`
      case 3:
        return `(${sub()} >= ${sub()})`
      case 4:
        return `(${sub()} === ${sub()})`
      case 5:
        return `(${sub()} !== ${sub()})`
      case 6:
        return `(${boolExpr(d - 1, env, mutable)} && ${boolExpr(d - 1, env, mutable)})`
      case 7:
        return `(${boolExpr(d - 1, env, mutable)} || ${boolExpr(d - 1, env, mutable)})`
      default:
        return `!${boolExpr(d - 1, env, mutable)}`
    }
  }

  const lines = []
  lines.push("// Generated by tests/differential/fuzz.js; seed " + label)
  lines.push("function nz(x: number): number {")
  lines.push("  let r = x % 1000;")
  lines.push("  if (r < 0) {")
  lines.push("    r = -r;")
  lines.push("  }")
  lines.push("  return r + 2;")
  lines.push("}")
  for (let h = 0; h < helpers; h++) {
    callable = h
    lines.push("")
    lines.push(`function h${h}(a: number, b: number): number {`)
    if (r.chance(0.5)) {
      lines.push(`  if (${boolExpr(2, ["a", "b"], [])}) {`)
      lines.push(`    return ${intExpr(maxDepth - 1, ["a", "b"], [])};`)
      lines.push("  }")
    }
    lines.push(`  return ${intExpr(maxDepth - 1, ["a", "b"], [])};`)
    lines.push("}")
  }

  // Which generics this program has, and the types each is instantiated at.
  const generics = withStream(gen, () => {
    if (!r.chance(0.75)) {
      return null
    }
    const typesOf = () => {
      const shuffled = [...GENERIC_TYPES]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = r.int(0, i)
        ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      return shuffled.slice(0, r.int(2, 3))
    }
    return { pick: typesOf(), cell: typesOf(), trade: r.chance(0.6) }
  })
  if (generics !== null) {
    lines.push("")
    lines.push("class Pt {")
    lines.push("  n: number;")
    lines.push("  constructor(n: number) {")
    lines.push("    this.n = n;")
    lines.push("  }")
    lines.push("}")
    lines.push("")
    lines.push("class Cell<T> {")
    lines.push("  v: T;")
    lines.push("  constructor(v: T) {")
    lines.push("    this.v = v;")
    lines.push("  }")
    lines.push("  get(): T {")
    lines.push("    return this.v;")
    lines.push("  }")
    lines.push("  set(w: T): void {")
    lines.push("    this.v = w;")
    lines.push("  }")
    lines.push("  swap(w: T): T {")
    lines.push("    const old = this.v;")
    lines.push("    this.v = w;")
    lines.push("    return old;")
    lines.push("  }")
    lines.push("}")
    lines.push("")
    lines.push("const pick = <T>(c: boolean, a: T, b: T): T => (c ? a : b);")
    if (generics.trade) {
      lines.push("const trade = <T>(cell: Cell<T>, w: T): T => cell.swap(w);")
    }
  }
  lines.push("")
  lines.push("export function main(): number {")
  callable = helpers
  for (const v of locals) {
    lines.push(`  let ${v} = ${literal()};`)
  }
  for (const b of bools) {
    lines.push(`  let ${b} = ${boolExpr(2, locals, [])};`)
    boolEnv = [...boolEnv, b]
  }

  /** A value of generic argument type `t`, reading `env` and bumping `mutable`. */
  const valueAt = (t, env, mutable) => {
    switch (t) {
      case "i32":
        return intExpr(maxDepth - 1, env, mutable)
      case "boolean":
        return boolExpr(maxDepth - 1, env, mutable)
      case "string":
        if (r.chance(0.4)) {
          return "s0"
        }
        if (r.chance(0.5)) {
          return JSON.stringify(r.pick(STRINGS))
        }
        return `\`${r.pick(STRINGS)}\${${intExpr(1, env, mutable)}}\``
      default:
        return r.chance(0.4) ? "p0" : `new Pt(${intExpr(maxDepth - 1, env, mutable)})`
    }
  }
  /** A local of type `t` that a generic result may be stored in. */
  const targetOf = (t) => {
    switch (t) {
      case "i32":
        return r.pick(locals)
      case "boolean":
        return r.pick(bools)
      case "string":
        return "s0"
      default:
        return "p0"
    }
  }
  /** `expr` of type `t` as something `console.log` prints. */
  const shown = (t, expr) => (t === "Pt" ? `${expr}.n` : expr)
  const cellTypes = generics === null ? [] : generics.cell
  const cellOf = (t) => `g${cellTypes.indexOf(t)}`

  if (generics !== null) {
    withStream(gen, () => {
      const used = [...generics.pick, ...generics.cell]
      if (used.includes("string")) {
        lines.push(`  let s0 = ${JSON.stringify(r.pick(STRINGS))};`)
      }
      if (used.includes("Pt")) {
        lines.push(`  let p0 = new Pt(${literal()});`)
      }
      for (const t of cellTypes) {
        lines.push(`  const ${cellOf(t)} = new Cell<${t}>(${valueAt(t, locals, [])});`)
      }
    })
  }

  /** One statement that calls a generic, at the top level of `main`. */
  const genericStatement = (env, mutable) => {
    if (r.chance(0.4)) {
      const t = r.pick(generics.pick)
      const call = `pick(${boolExpr(maxDepth - 1, env, mutable)}, ${valueAt(t, env, mutable)}, ${valueAt(t, env, mutable)})`
      if (r.chance(0.5)) {
        lines.push(`  ${targetOf(t)} = ${call};`)
      } else {
        lines.push(`  console.log(${shown(t, call)});`)
      }
      return
    }
    const t = r.pick(cellTypes)
    const cell = cellOf(t)
    switch (r.int(0, 3)) {
      case 0:
        lines.push(`  ${cell}.set(${valueAt(t, env, mutable)});`)
        break
      case 1:
        lines.push(`  ${targetOf(t)} = ${cell}.get();`)
        break
      case 2:
        lines.push(`  console.log(${shown(t, `${cell}.swap(${valueAt(t, env, mutable)})`)});`)
        break
      default:
        if (generics.trade) {
          lines.push(`  ${targetOf(t)} = trade(${cell}, ${valueAt(t, env, mutable)});`)
        } else {
          lines.push(`  console.log(${shown(t, `${cell}.get()`)});`)
        }
        break
    }
  }

  let loopId = 0
  const statement = (indent, env, mutable, depth) => {
    const pad = " ".repeat(indent)
    const target = r.pick(locals)
    switch (r.int(0, 11)) {
      case 0:
      case 1:
        lines.push(`${pad}${target} = ${intExpr(maxDepth, env, mutable)};`)
        break
      case 2:
        lines.push(`${pad}${target} ${r.pick(["+=", "-=", "*="])} ${intExpr(maxDepth - 1, env, mutable)};`)
        break
      case 3:
        lines.push(`${pad}${target} ${r.pick(["/=", "%="])} nz(${intExpr(maxDepth - 1, env, mutable)});`)
        break
      case 4:
        lines.push(`${pad}${r.pick(bools)} = ${boolExpr(maxDepth - 1, env, mutable)};`)
        break
      case 5:
        lines.push(`${pad}${target}${r.pick(["++", "--"])};`)
        break
      case 6:
        lines.push(`${pad}console.log(${intExpr(maxDepth, env, mutable)});`)
        break
      case 7:
        lines.push(`${pad}console.log(${boolExpr(maxDepth - 1, env, mutable)});`)
        break
      case 8:
        lines.push(
          `${pad}console.log(\`${target}=\${${target}} ${r.pick(bools)}=\${${r.pick(bools)}} e=\${${intExpr(1, env, mutable)}}\`);`
        )
        break
      case 9:
        if (depth > 0) {
          lines.push(`${pad}if (${boolExpr(maxDepth - 1, env, mutable)}) {`)
          statement(indent + 2, env, mutable, depth - 1)
          lines.push(`${pad}} else {`)
          statement(indent + 2, env, mutable, depth - 1)
          lines.push(`${pad}}`)
        } else {
          lines.push(`${pad}${target} = ${intExpr(2, env, mutable)};`)
        }
        break
      case 10:
        if (depth > 0) {
          const i = `i${loopId++}`
          lines.push(`${pad}for (let ${i} = 0; ${i} < ${r.int(1, 8)}; ${i}++) {`)
          statement(indent + 2, [...env, i], mutable, depth - 1)
          if (r.chance(0.5)) {
            statement(indent + 2, [...env, i], mutable, depth - 1)
          }
          lines.push(`${pad}}`)
        } else {
          lines.push(`${pad}${target} = ${intExpr(2, env, mutable)};`)
        }
        break
      default:
        if (depth > 0) {
          const c = `c${loopId++}`
          lines.push(`${pad}let ${c} = ${r.int(1, 6)};`)
          lines.push(`${pad}while (${c} > 0) {`)
          statement(indent + 2, [...env, c], mutable, depth - 1)
          if (r.chance(0.3)) {
            lines.push(`${pad}  if (${boolExpr(1, env, [])}) {`)
            lines.push(`${pad}    ${c}--;`)
            lines.push(`${pad}    continue;`)
            lines.push(`${pad}  }`)
          }
          lines.push(`${pad}  ${c}--;`)
          lines.push(`${pad}}`)
        } else {
          lines.push(`${pad}${target} = ${intExpr(2, env, mutable)};`)
        }
        break
    }
  }
  const nStatements = r.int(8, 16)
  for (let s = 0; s < nStatements; s++) {
    if (generics !== null && gen.chance(0.35)) {
      withStream(gen, () => genericStatement(locals, locals))
    }
    statement(2, locals, locals, 2)
  }
  if (generics !== null) {
    // Every instantiation is used at least once, whatever the draws above did.
    withStream(gen, () => {
      for (const t of generics.pick) {
        const call = `pick(${boolExpr(1, locals, [])}, ${valueAt(t, locals, [])}, ${valueAt(t, locals, [])})`
        lines.push(`  console.log(${shown(t, call)});`)
      }
      for (const t of cellTypes) {
        if (generics.trade) {
          lines.push(`  console.log(${shown(t, `trade(${cellOf(t)}, ${valueAt(t, locals, [])})`)});`)
        }
        lines.push(`  console.log(${shown(t, `${cellOf(t)}.get()`)});`)
      }
    })
  }
  for (const v of locals) {
    lines.push(`  console.log(${v});`)
  }
  for (const b of bools) {
    lines.push(`  console.log(${b});`)
  }
  lines.push("  return 0;")
  lines.push("}")
  return `${lines.join("\n")}\n`
}

/**
 * A generated comparison can hit TypeScript's `a < b > (c)` ambiguity, where
 * the parser reads `<` as the start of a type-argument list: `tsc` rejects
 * such a program exactly as `nish` does, so it tests nothing. Rather
 * than teach every expression rule about it, re-roll the seed until the text
 * parses. Deterministic per seed, so a saved failure still reproduces with
 * `--seed <S> --count 1`.
 */
const generateProgram = (seed, opts = {}) => {
  let text = ""
  for (let salt = 0; salt < 32; salt++) {
    text = buildProgram((seed + salt * 0x9e3779b1) >>> 0, seed, opts)
    const sourceFile = ts.createSourceFile("fuzz.ts", text, ts.ScriptTarget.ES2020, true)
    const diagnostics = sourceFile.parseDiagnostics
    if (!diagnostics || diagnostics.length === 0) {
      return text
    }
  }
  return text // give up after 32 re-rolls and let the harness report it
}

/**
 * The seed-against-HEAD differences this mode accepts, one per function and
 * attribute group. An entry reads:
 *
 *   {
 *     function: "nish_str_concat",       // the `@name` on a `declare` or `define` line
 *     seed: "{ nounwind willreturn }",   // its attribute group's text in the seed's IR
 *     head: "{ nounwind }",              // and in HEAD's
 *     changelog: "the words the release notes carry for it",
 *     why: "one sentence somebody is willing to sign",
 *   }
 *
 * `changelog` is held to the release notes exactly as `tests/nish-cmp.js`
 * holds its own: `CHANGELOG.md`, or the section `scripts/changelog-gen.mjs`
 * would render for the commits not yet released, where a subject appears with
 * its scope dropped and its first letter raised. An entry whose words are in
 * neither fails the run.
 *
 * The list is for one release: once the seed is a release that carries the
 * change, the entry covers nothing and the run fails until it is deleted.
 * Only reachable functions belong here. It is empty while the seed carries
 * every change HEAD makes to a generated program: 0.17.0 shipped CG-8's
 * `nish_str_concat` entry, the one the example above shows, and retired it.
 */
const DECLARED = []

/**
 * The changes a group comparison cannot state: a program whose IR loses
 * instructions, not only attributes. An entry carries the same `changelog`
 * and `why`, and `explains(reference, candidate)` decides one module from the
 * two texts. A module only an entry here explains still has to show every
 * group change it makes under a function `DECLARED` names, or it counts
 * toward none of them (`groupTransitions`).
 *
 * Empty for the same reason as `DECLARED`: 0.17.0 shipped the dropped
 * division and `pop` checks its last entry declared, with
 * `explains: (reference, candidate) => onlyDropsChecks(reference, candidate)`.
 * `onlyDropsChecks` stays, held to fabricated pairs on every `npm test`, for
 * the next release that drops a check.
 */
const DECLARED_CHECKS = []

/** How many times each runtime panic is called, and each check block opened, in an IR text. */
const panicCounts = (ir) => {
  const counts = new Map()
  const bump = (key) => counts.set(key, (counts.get(key) ?? 0) + 1)
  for (const m of ir.matchAll(/call void @(nish_panic_\w+|nish_exit)\(/g)) {
    bump(m[1])
  }
  for (const m of ir.matchAll(/^(div\.fail|pop\.empty)\d*:/gm)) {
    bump(m[1])
  }
  return counts
}

/** The functions an IR text defines, in order. */
const definedNames = (ir) => [...ir.matchAll(/^define [^@]*@([\w.$]+)\(/gm)].map((m) => m[1]).join(" ")

/**
 * The candidate defines the same functions, and differs from the reference
 * only by division and `pop` checks it no longer writes: every removed
 * `div.fail` block takes its `nish_panic_div` call with it, every removed
 * `pop.empty` block its `nish_panic_index` call, at least one is removed, and
 * every other panic is called exactly as often. A dropped bounds check
 * anywhere else is not explained by this, and stays a disagreement.
 */
const onlyDropsChecks = (reference, candidate) => {
  if (definedNames(reference) !== definedNames(candidate)) {
    return false
  }
  const ref = panicCounts(reference)
  const cand = panicCounts(candidate)
  const n = (map, key) => map.get(key) ?? 0
  const divs = n(ref, "div.fail") - n(cand, "div.fail")
  const pops = n(ref, "pop.empty") - n(cand, "pop.empty")
  if (divs < 0 || pops < 0 || divs + pops === 0) {
    return false
  }
  if (n(ref, "nish_panic_div") - n(cand, "nish_panic_div") !== divs) {
    return false
  }
  if (n(ref, "nish_panic_index") - n(cand, "nish_panic_index") !== pops) {
    return false
  }
  for (const key of new Set([...ref.keys(), ...cand.keys()])) {
    if (key !== "div.fail" && key !== "pop.empty" && key !== "nish_panic_div" && key !== "nish_panic_index") {
      if (n(ref, key) !== n(cand, key)) {
        return false
      }
    }
  }
  return true
}

const ATTRIBUTE_GROUP = /^attributes #(\d+) = (.*)$/
const GROUP_REFERENCE = / #(\d+)(?=$| )/g
const FUNCTION_LINE = /^(?:declare|define) [^@]*@("[^"]+"|[^\s(]+)\(/

/** One module's lines apart from its attribute groups, and the groups as `number -> text`. */
const splitGroups = (text) => {
  const groups = new Map()
  const body = []
  for (const line of text.split("\n")) {
    const group = ATTRIBUTE_GROUP.exec(line)
    if (group === null) {
      body.push(line)
    } else {
      groups.set(group[1], group[2])
    }
  }
  return { groups, body }
}

/**
 * The `DECLARED` entries a module shows, read off its `declare` and `define`
 * lines: each whose function carries the entry's `seed` group in the
 * reference and its `head` group in the candidate. A module a
 * `DECLARED_CHECKS` entry explains differs in its instructions, so
 * `explainDifference` cannot read it, and this is what still lets it keep an
 * attribute entry from going stale.
 */
const groupTransitions = (reference, candidate, declarations) => {
  const groupsOf = (text) => {
    const { groups, body } = splitGroups(text)
    const byFunction = new Map()
    for (const line of body) {
      const fn = FUNCTION_LINE.exec(line)?.[1]
      const ref = [...line.matchAll(GROUP_REFERENCE)].pop()?.[1]
      if (fn !== undefined && ref !== undefined) {
        byFunction.set(fn, groups.get(ref))
      }
    }
    return byFunction
  }
  const a = groupsOf(reference)
  const b = groupsOf(candidate)
  return declarations.filter((d) => a.get(d.function) === d.seed && b.get(d.function) === d.head)
}

/**
 * Whether one differing module is the declared change and nothing else.
 * `reference` and `candidate` are the two texts of one `.ll`, and
 * `declarations` is the list to judge them by (`DECLARED`, or the fabricated
 * lists of `selfCheckDeclarations`).
 *
 * Every group must be referred to, on both sides. Every line but the
 * attribute groups must be the same once each `#N` is read
 * as its group's text. A line whose group text still differs must be a
 * function's `declare` or `define`, and a declaration must name that function
 * with exactly those two texts. Renumbered groups alone, with no declared
 * change behind them, are still a difference: they are bytes the seed did not
 * write, and nothing has said why.
 *
 * Returns `{ covered, undeclared }`: the entries the module used, and the
 * reason it is not explained (null when it is).
 */
const explainDifference = (reference, candidate, declarations) => {
  const a = splitGroups(reference)
  const b = splitGroups(candidate)
  const covered = new Set()
  if (a.body.length !== b.body.length) {
    return { covered, undeclared: "the modules differ in more than their attribute groups" }
  }
  // A group no line refers to changes nothing the optimiser sees, but it is
  // still bytes the other compiler did not write, and resolving references
  // alone would never look at it.
  for (const [side, split] of [
    ["the seed", a],
    ["HEAD", b],
  ]) {
    const referenced = new Set(
      split.body.flatMap((line) => [...line.matchAll(GROUP_REFERENCE)].map((m) => m[1]))
    )
    const orphan = [...split.groups.keys()].find((n) => !referenced.has(n))
    if (orphan !== undefined) {
      return { covered, undeclared: `${side} defines attributes #${orphan} and no line refers to it` }
    }
  }
  const resolve = (line, groups) => line.replace(GROUP_REFERENCE, (ref, n) => ` #${groups.get(n) ?? ref}`)
  for (let i = 0; i < a.body.length; i++) {
    const want = a.body[i]
    const got = b.body[i]
    if (want === got) {
      continue
    }
    if (want.replace(GROUP_REFERENCE, " #") !== got.replace(GROUP_REFERENCE, " #")) {
      return { covered, undeclared: `line ${i + 1} differs in more than its attribute group` }
    }
    const seed = resolve(want, a.groups)
    const head = resolve(got, b.groups)
    if (seed === head) {
      continue // renumbered: the same group under another number
    }
    const fn = FUNCTION_LINE.exec(want)?.[1]
    const groupOf = (line, groups) => groups.get([...line.matchAll(GROUP_REFERENCE)].pop()?.[1] ?? "")
    const from = groupOf(want, a.groups)
    const to = groupOf(got, b.groups)
    const entry = declarations.find((d) => d.function === fn && d.seed === from && d.head === to)
    if (fn === undefined || entry === undefined) {
      return {
        covered,
        undeclared: `line ${i + 1}: ${fn === undefined ? "a non-function line" : `@${fn}`}'s attributes go from ${from} to ${to}, and no declaration names it`,
      }
    }
    covered.add(entry)
  }
  if (covered.size === 0) {
    return { covered, undeclared: "the attribute groups differ and no declared change explains it" }
  }
  return { covered, undeclared: null }
}

/**
 * `explainDifference` and the stale rule over modules no compiler wrote, for
 * the reason `tests/nish-cmp.js`'s `selfCheckRoots` gives: this decides
 * whether a difference is excused, and the run that uses it only happens with
 * a seed. Returns `[label, reason it failed or null]` per property.
 */
const selfCheckDeclarations = () => {
  const module = (concat, groups) =>
    [
      "define i32 @main() #0 {",
      "  ret i32 0",
      "}",
      `declare i8* @nish_str_concat(i8*, i8*) #${concat}`,
      "declare void @nish_print(i8*) #1",
      ...groups.map((g, n) => `attributes #${n} = ${g}`),
      "",
    ].join("\n")
  const seed = module(1, ["{ nounwind }", "{ nounwind willreturn }"])
  const head = module(0, ["{ nounwind }", "{ nounwind willreturn }"])
  const entry = { function: "nish_str_concat", seed: "{ nounwind willreturn }", head: "{ nounwind }" }
  const other = { function: "nish_print", seed: "{ nounwind willreturn }", head: "{ nounwind }" }
  const undeclared = explainDifference(seed, head, [other])
  const declared = explainDifference(seed, head, [entry])
  const extra = explainDifference(seed, head.replace("ret i32 0", "ret i32 1"), [entry])
  const orphan = explainDifference(seed, `${head}attributes #2 = { cold }\n`, [entry])
  const stale = staleDeclarations([entry, other], declared.covered)
  const notes = { text: "### Fixed\n\n- codegen: Close CG-8 ([#427])\n" }
  const unnamed = unnamedDeclarations(
    [
      { ...entry, changelog: "Close CG-8" },
      { ...other, changelog: "Close CG-9" },
    ],
    "## [Unreleased]\n",
    notes
  )
  let declaredFailure = null
  if (declared.undeclared !== null || !declared.covered.has(entry)) {
    declaredFailure = `it was not explained: ${declared.undeclared}`
  } else if (extra.undeclared === null) {
    declaredFailure = "a module that also differs in an instruction was explained"
  } else if (orphan.undeclared === null) {
    declaredFailure = "a module that also defines a group nothing refers to was explained"
  }
  return [
    [
      "an undeclared attribute-group difference fails",
      undeclared.undeclared === null ? "it was explained by a declaration for another function" : null,
    ],
    ["a declared attribute-group difference passes, and only that", declaredFailure],
    [
      "a declaration that matches nothing fails as stale",
      stale.length === 1 && stale[0] === other ? null : `stale: ${JSON.stringify(stale)}`,
    ],
    ["a dropped division or `pop` check is explained, and only that", checksFailure()],
    [
      "a declaration whose words the release notes do not carry fails",
      unnamed.length === 1 && unnamed[0].changelog === "Close CG-9"
        ? null
        : `unnamed: ${JSON.stringify(unnamed)}`,
    ],
  ]
}

/**
 * `onlyDropsChecks` over fabricated pairs: a dropped division or `pop` check
 * is explained, and a dropped bounds check, an added check or a function more
 * is not. Answers the first case that comes out wrong, or null.
 */
const checksFailure = () => {
  const fn = (body) => `define internal i32 @f(i32 %a) {\nentry:\n${body}}\n`
  const div =
    "  br i1 %0, label %div.fail, label %div.ok\ndiv.fail:\n  call void @nish_panic_div(i1 zeroext %0)\n  unreachable\n"
  const pop = "pop.empty:\n  call void @nish_panic_index(i64 0, i64 0)\n  unreachable\n"
  const index = "arr.oob:\n  call void @nish_panic_index(i64 %i, i64 %n)\n  unreachable\n"
  const cases = [
    [fn(div + index), fn(index), true, "a dropped division check"],
    [fn(pop + index), fn(index), true, "a dropped pop check"],
    [fn(div + index), fn(div), false, "a dropped bounds check"],
    [fn(div), fn(div), false, "no check dropped"],
    [fn(div), fn(div + pop), false, "a check added"],
    [fn(div), `${fn("")}define internal i32 @g() {\n}\n`, false, "a function more"],
  ]
  for (const [reference, candidate, want, what] of cases) {
    if (onlyDropsChecks(reference, candidate) !== want) {
      return `onlyDropsChecks is ${!want} for ${what}`
    }
  }
  return null
}

/** The declarations no difference in a run used, each of which fails it. */
const staleDeclarations = (declarations, used) => declarations.filter((d) => !used.has(d))

/**
 * The declarations whose `changelog` words neither `CHANGELOG.md`'s text nor
 * the pending notes carry, judged by `tests/nish-cmp.js`'s own `isNamed`, so
 * the two lists are held to one rule.
 */
const unnamedDeclarations = (declarations, changelogText, pending) =>
  declarations.filter((d) => !cmp.isNamed(d.changelog, changelogText, pending))

/**
 * The reference and the candidate this mode compares, resolved the way
 * `tests/nish-cmp.js` resolves them — a native binary or a `.js` entry point,
 * `NISH_BOOTSTRAP` naming the seed. With no seed there is nothing to compare
 * against, and the run refuses, naming what to set: the stage0 fallback that
 * used to stand in here went with stage0 (R6).
 *
 * Returns `{ reference, candidate }` or `{ error }`.
 */
const stage1Pair = ({ reference = null, candidate = null } = {}) => {
  const referenceSpec = reference ?? cmp.seedFromEnvironment()
  if (referenceSpec === null) {
    return { error: "no reference: pass --reference <nish> or set NISH_BOOTSTRAP to a released nish" }
  }
  let candidateSpec = candidate
  if (candidateSpec === null) {
    const built = cmp.buildCandidate(referenceSpec)
    if (built.error !== undefined) {
      return { error: built.error }
    }
    candidateSpec = built.path
  }
  return cmp.resolvePair(referenceSpec, candidateSpec)
}

/**
 * Whether every difference `compare` reported for one program is a declared
 * one. `compare` leaves the two compilers' output in `<work>/reference` and
 * `<work>/candidate` until its next call, so the texts are read from there,
 * with each side's own root and version removed as `compare` removes them. A
 * refusal, a missing module or a file that is not IR is never declared.
 *
 * Returns `{ covered, undeclared }`, as `explainDifference` does, over all of
 * the program's modules.
 */
const explainAll = (pair, work, differences) => {
  const covered = new Set()
  for (const difference of differences) {
    const read = (side) => {
      const file = path.join(work, side, difference.surface)
      return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null
    }
    const reference = read("reference")
    const candidate = read("candidate")
    if (!difference.surface.endsWith(".ll") || reference === null || candidate === null) {
      return { covered, undeclared: `${difference.surface}: only IR both compilers wrote can be declared` }
    }
    const normal = (text, compiler) =>
      cmp.withoutOwnVersion(cmp.withoutOwnRoot(text, compiler.packageRoot), compiler.version)
    const seedText = normal(reference, pair.reference)
    const headText = normal(candidate, pair.candidate)
    const one = explainDifference(seedText, headText, DECLARED)
    if (one.undeclared === null) {
      for (const d of one.covered) {
        covered.add(d)
      }
      continue
    }
    const change = DECLARED_CHECKS.find((c) => c.explains(seedText, headText))
    if (change === undefined) {
      return { covered, undeclared: `${difference.surface}: ${one.undeclared}` }
    }
    covered.add(change)
    for (const d of groupTransitions(seedText, headText, DECLARED)) {
      covered.add(d)
    }
  }
  return { covered, undeclared: null }
}

/**
 * The stage1 mode: generate `count` programs and require `IR(reference, p) ==
 * IR(candidate, p)` for each, byte for byte and module set included — the same
 * equality `tests/nish-cmp.js` asserts over the checked-in corpus, on programs
 * neither compiler has ever seen. There is no golden anywhere in this path:
 * the reference is the oracle.
 *
 * The candidate is linked once (about 15 s) and every program reuses it; the
 * programs themselves are compared one at a time, because `compare` is
 * synchronous and empties the directory it works in, so `--jobs` does not
 * apply to this mode. The sidecars are left out of the comparison: what this
 * mode is for is the emitter on shapes nobody wrote, and the WP8 generators
 * read the same checked program the corpus run already puts them through.
 *
 * Returns `{ seed, count, pair, agreed, declared, stale, files, lines,
 * disagreements }`, where `declared` counts the programs whose only
 * differences `DECLARED` names, `stale` lists the entries none of them used,
 * `unnamed` the entries whose words the release notes do not carry (with
 * `pending`, the notes they were looked for in),
 * and a disagreement is `{ seed, verdict, detail, file }` with `file` the
 * saved reproducer. `pair === null` means a compiler was missing or would not link
 * and nothing was compared.
 */
const stage1Run = ({
  count = 20,
  seed = 1,
  depth = 3,
  reference = null,
  candidate = null,
  log = () => undefined,
} = {}) => {
  const pair = stage1Pair({ reference, candidate })
  if (pair.error !== undefined) {
    return {
      seed,
      count,
      pair: null,
      error: pair.error,
      agreed: 0,
      declared: 0,
      stale: [],
      unnamed: [],
      pending: null,
      files: 0,
      lines: 0,
      disagreements: [],
    }
  }
  const dir = path.join(lib.buildDir, "fuzz")
  fs.mkdirSync(dir, { recursive: true })
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "nish-fuzz-ir-"))
  const disagreements = []
  const used = new Set()
  let agreed = 0
  let declared = 0
  let files = 0
  let lines = 0
  for (let i = 0; i < count; i++) {
    const s = (seed + i) >>> 0
    const file = path.join(dir, `fuzz-${s}.ts`)
    fs.writeFileSync(file, generateProgram(s, { depth }))
    const t0 = Date.now()
    // `--wrapping` on both sides: the seed flags every signed `+ - *` `nsw`
    // unproven and HEAD checks it (`docs/LANGUAGE.md`, "Semantics decisions"),
    // so every generated program differs in its arithmetic by design. Under
    // the flag both write the plain instruction, and the comparison keeps
    // saying something about everything else the program exercises. The
    // checked lowering itself is pinned by the `ovf_*` goldens. Drop the flag
    // once the seed is a release that checks.
    const result = cmp.compare(pair, work, file, { sidecars: false, lines: 3, extraFlags: ["--wrapping"] })
    // A generated program carries no `.args` and stays inside the language, so
    // none of the outcomes below can happen for a benign reason: every verdict
    // other than an agreement is a failure worth saving.
    const entry = { seed: s, name: `fuzz/${s}`, verdict: "agree", detail: "", ms: Date.now() - t0, file }
    const explained = result.differences === undefined ? null : explainAll(pair, work, result.differences)
    if (explained?.undeclared === null) {
      entry.verdict = "declared"
      entry.detail = [...explained.covered]
        .map((d) => (d.function === undefined ? d.why : `@${d.function} ${d.seed} -> ${d.head}`))
        .join(", ")
      for (const d of explained.covered) {
        used.add(d)
      }
      declared++
    } else if (result.differences !== undefined) {
      const first = result.differences[0]
      entry.verdict = first.surface === "exit" ? "refusal-differs" : "ir-mismatch"
      entry.detail = `${first.surface}: ${first.detail}\n${explained.undeclared}`
    } else if (result.refused !== undefined) {
      entry.verdict = "refused-by-both"
      entry.detail = result.refused
    } else {
      agreed++
      files += result.files
      lines += result.lines
    }
    if (entry.verdict !== "agree" && entry.verdict !== "declared") {
      const failFile = path.join(lib.buildDir, `fuzz-stage1-fail-${s}.ts`)
      fs.copyFileSync(file, failFile)
      entry.file = failFile
      disagreements.push(entry)
    }
    log(entry)
  }
  fs.rmSync(work, { recursive: true, force: true })
  const every = [...DECLARED, ...DECLARED_CHECKS]
  const stale = staleDeclarations(every, used)
  const changelogFile = path.join(root, "CHANGELOG.md")
  const changelogText = fs.existsSync(changelogFile) ? fs.readFileSync(changelogFile, "utf8") : ""
  const pending = every.some((d) => !changelogText.includes(d.changelog)) ? cmp.pendingNotes() : null
  const unnamed = unnamedDeclarations(every, changelogText, pending)
  return { seed, count, pair, agreed, declared, stale, unnamed, pending, files, lines, disagreements }
}

export { generateProgram, selfCheckDeclarations, stage1Run }

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2)
  let count = 50
  let seed = (Date.now() ^ (process.pid << 8)) >>> 0
  let depth = 3
  let printOnly = false
  let reference = null
  let candidate = null
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--count") {
      count = Number(argv[++i])
    } else if (argv[i] === "--seed") {
      seed = Number(argv[++i]) >>> 0
    } else if (argv[i] === "--depth") {
      depth = Number(argv[++i])
    } else if (argv[i] === "--print") {
      printOnly = true
    } else if (argv[i] === "--stage1") {
      // Accepted for the callers that still pass it: stage1 is the only mode.
    } else if (argv[i] === "--reference") {
      reference = argv[++i]
    } else if (argv[i] === "--candidate") {
      candidate = argv[++i]
    } else {
      console.error(`unknown option: ${argv[i]}`)
      process.exit(2)
    }
  }
  if (printOnly) {
    process.stdout.write(generateProgram(seed, { depth }))
    process.exit(0)
  }
  if (!lib.hasClang()) {
    console.error("clang not installed")
    process.exit(2)
  }
  const seedName = reference ?? cmp.seedFromEnvironment() ?? "(none)"
  console.log(
    `fuzz: stage1 seed=${seed} count=${count} depth=${depth} reference=${seedName} (linking the candidate)`
  )
  const tStage1 = Date.now()
  const res = stage1Run({
    count,
    seed,
    depth,
    reference,
    candidate,
    log: (e) => {
      const tag = { agree: "ok  ", declared: "decl" }[e.verdict] ?? e.verdict.toUpperCase()
      // The detail is a bounded diff excerpt and therefore several lines;
      // indenting its continuations keeps one program to one visual block.
      const detail = e.detail ? `  ${e.detail.replace(/\n/g, "\n      ")}` : ""
      console.log(`${tag}  ${e.name}  ${e.ms} ms${detail}`)
    },
  })
  if (res.pair === null) {
    console.error(`fuzz: ${res.error}\nfuzz: nothing compared`)
    process.exit(2)
  }
  console.log(
    `\nfuzz: stage1 seed=${res.seed} count=${res.count} agree=${res.agreed} declared=${res.declared} disagreements=${res.disagreements.length} stale=${res.stale.length} (${res.files} files, ${res.lines} IR lines, ${((Date.now() - tStage1) / 1000).toFixed(1)} s, reference ${res.pair.reference.label}, candidate ${res.pair.candidate.label})`
  )
  // The pair is part of the reproduction now that it is a parameter: a
  // failure against one seed release says nothing about another, and the
  // seed a run used is the first thing somebody reading the saved program
  // will want back.
  const pairArgs = `${reference === null ? "" : ` --reference ${reference}`}${candidate === null ? "" : ` --candidate ${candidate}`}`
  for (const d of res.disagreements) {
    console.log(`  ${d.verdict}: seed ${d.seed} saved to ${d.file}`)
    console.log(`      ${d.detail.replace(/\n/g, "\n      ")}`)
    console.log(`      reproduce: node tests/differential/fuzz.js --seed ${d.seed} --count 1${pairArgs}`)
  }
  for (const d of DECLARED) {
    if (!res.stale.includes(d)) {
      console.log(`  declared: @${d.function} ${d.seed} -> ${d.head} (${d.changelog}): ${d.why}`)
    }
  }
  // A stale entry fails even a one-program reproduction that does not reach
  // it; the line says which, so it does not read as the program's own fault.
  for (const d of res.stale) {
    console.log(
      `  STALE: no program differs at @${d.function} ${d.seed} -> ${d.head}; the seed carries the change ` +
        "or the generator no longer reaches it, so the declaration goes"
    )
  }
  for (const d of res.unnamed) {
    console.log(
      `  FAIL neither CHANGELOG.md nor the pending release notes name this difference: the declaration asks for "${d.changelog}"`
    )
  }
  if (res.unnamed.length > 0 && res.pending?.error !== undefined) {
    console.log(`  FAIL the pending release notes could not be read: ${res.pending.error}`)
  }
  const failed = res.disagreements.length + res.stale.length + res.unnamed.length
  process.exit(failed === 0 ? 0 : 1)
}
