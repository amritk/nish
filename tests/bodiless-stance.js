#!/usr/bin/env node
/**
 * Every bodiless instance states its write facts (#1328).
 *
 *   node tests/bodiless-stance.js               check the live src/attributes.ts
 *   node tests/bodiless-stance.js --src <dir>   check a copy
 *   node tests/bodiless-stance.js --self-test   check that each rule below fails its mutant
 *
 * An instance whose code is not its walked source body (a typed-JSON route, a
 * channel's `send`, an atomic, a lock, a wipe, a region or shm intrinsic, a
 * parallel or spawn entry, a routed `nish/map` method) gets its facts from a
 * `mark*` helper in `src/attributes.ts`. Facts start pure, so a helper that
 * forgets a write leaves the instance writing nothing, and a task handed
 * shared memory through it is let through: #1307's fourth round found
 * `reserve` and `jsonDecode` doing exactly that. The guard is a type: every
 * helper answers a `BodilessStance` whose fields are all constructor
 * arguments, and `applyStance` is the one writer of those facts. `tsc` and the
 * seed refuse a helper that answers nothing. What a type cannot refuse is a
 * helper that sets the facts itself and answers an empty stance beside them,
 * or a call site that drops the answer; this file refuses both, by reading
 * the source as `tests/capabilities.js` does. A shape it cannot read is a
 * failure, so a refactor cannot quietly turn it off. What slips past it
 * anyway fails closed: `collectFacts` gives an instance on `needsStance`'s
 * list that stated no stance the unknown one, which a task is refused for
 * (`tests/run.js`'s "bodiless" section pins that on the compiler).
 *
 * A bodiless helper is named `mark*` (a capital after it) and declared in the
 * section; that name is how rules 1 and 3 find it, so a helper named
 * otherwise is checked by rule 2 and the fallback only.
 *
 *   1. Every `const mark* =` between "What a bodiless instance states" and
 *      "The fixpoint" answers `BodilessStance`.
 *   2. Nothing in that section but `applyParamStance` and `applyStance` sets a
 *      stance-owned fact (the parameter write, keep and pollute facts and
 *      `resizesArray`).
 *   3. Every call of one of those helpers in the file is the argument of
 *      `applyStance(facts, ...)`.
 *   4. Every predicate `src/emit.ts`'s function-body dispatch asks (the
 *      `if (pred(` chain before the walked block) is asked by `needsStance`,
 *      so an emitter-written body cannot miss the fallback.
 */
import fs from "node:fs"
import path from "node:path"

const root = path.resolve(import.meta.dirname, "..")
const at = process.argv.indexOf("--src")
const srcDir = at >= 0 ? path.resolve(process.argv[at + 1]) : path.join(root, "src")

const SECTION_START = "// ---- What a bodiless instance states"
// The whole rule line, matched after the start, so a mention of the fixpoint
// in a comment or another banner cannot end the section early.
const SECTION_END = /^\/\/ ---- The fixpoint -+$/m
const DISPATCH_START = "has a body only the emitter can write"
const DISPATCH_END = "} else if (body.kind === N_BLOCK) {"
const STANCE_FACTS =
  /\.(writesThrough|writesShared|writesReach|writesDeep|captured|outlives|polluted|resizesArray)\s*=[^=]/
const WRITERS = new Set(["applyParamStance", "applyStance"])

/** Split a section into its top-level `const name = ...` declarations, by name. */
const declarations = (section) => {
  const out = []
  const re = /^const (\w+)\b/gm
  const starts = [...section.matchAll(re)]
  for (let i = 0; i < starts.length; i++) {
    const end = i + 1 < starts.length ? starts[i + 1].index : section.length
    out.push({ name: starts[i][1], text: section.slice(starts[i].index, end) })
  }
  return out
}

/** The problems with one copy of `src/attributes.ts`'s text and `src/emit.ts`'s. */
const check = (text, emit) => {
  const problems = []
  const start = text.indexOf(SECTION_START)
  const endMatch = start < 0 ? null : SECTION_END.exec(text.slice(start))
  if (start < 0 || endMatch === null) {
    return [`cannot find the "${SECTION_START}" section ending at "${SECTION_END.source}"`]
  }
  const end = start + endMatch.index
  const decls = declarations(text.slice(start, end))
  const needs = decls.find((d) => d.name === "needsStance")
  const dStart = emit.indexOf(DISPATCH_START)
  const dEnd = dStart < 0 ? -1 : emit.indexOf(DISPATCH_END, dStart)
  if (needs === undefined) {
    problems.push("the section declares no needsStance (rule 4)")
  } else if (dStart < 0 || dEnd < 0) {
    problems.push(`cannot find src/emit.ts's body dispatch between "${DISPATCH_START}" and "${DISPATCH_END}"`)
  } else {
    const preds = [...emit.slice(dStart, dEnd).matchAll(/if \((\w+)\(/g)].map((m) => m[1])
    if (preds.length === 0) {
      problems.push("src/emit.ts's body dispatch asks no predicate this can read (rule 4)")
    }
    for (const pred of preds) {
      if (!new RegExp(`\\b${pred}\\(`).test(needs.text)) {
        problems.push(`needsStance: does not ask ${pred}, which src/emit.ts writes a body for (rule 4)`)
      }
    }
  }
  const helpers = decls.filter((d) => /^mark[A-Z]/.test(d.name))
  if (helpers.length === 0) {
    return ["the section declares no mark* helper"]
  }
  for (const d of decls) {
    if (helpers.includes(d)) {
      // The answer type is the text between the parameter list's `)` and `=>`.
      const sig = /^const \w+ = \(([\s\S]*?)\):\s*(\w+)\s*=>/.exec(d.text)
      if (sig === null) {
        problems.push(`${d.name}: cannot read its signature`)
      } else if (sig[2] !== "BodilessStance") {
        problems.push(`${d.name}: answers ${sig[2]}, not BodilessStance (rule 1)`)
      }
    }
    if (!WRITERS.has(d.name)) {
      for (const line of d.text.split("\n")) {
        if (!line.trim().startsWith("*") && !line.trim().startsWith("//") && STANCE_FACTS.test(line)) {
          problems.push(`${d.name}: sets a stance fact itself: ${line.trim()} (rule 2)`)
        }
      }
    }
  }
  for (const h of helpers) {
    const calls = [...text.matchAll(new RegExp(`(^|[^\\w.])${h.name}\\(`, "gm"))]
    if (calls.length === 0) {
      problems.push(`${h.name}: never called`)
    }
    for (const call of calls) {
      const pos = call.index + call[1].length
      if (!text.slice(Math.max(0, pos - "applyStance(facts, ".length), pos).endsWith("applyStance(facts, ")) {
        const line = text.slice(text.lastIndexOf("\n", pos) + 1, text.indexOf("\n", pos)).trim()
        problems.push(`${h.name}: a call drops its stance: ${line} (rule 3)`)
      }
    }
  }
  return problems
}

const live = fs.readFileSync(path.join(srcDir, "attributes.ts"), "utf8")
const liveEmit = fs.readFileSync(path.join(srcDir, "emit.ts"), "utf8")

if (process.argv.includes("--self-test")) {
  // Each mutant is one way a helper could forget its stance; each must fail.
  const mutants = [
    [
      "a helper that answers void",
      [
        "const markLock = (facts: FunctionFacts): BodilessStance =>",
        "const markLock = (facts: FunctionFacts): void =>",
      ],
    ],
    [
      "a helper that sets a write itself",
      ["  facts.atomic = true\n", "  facts.atomic = true\n  facts.pointerParams[0].writesShared = true\n"],
    ],
    [
      "a helper that sets growth itself",
      ["  facts.usesRegion = true\n", "  facts.usesRegion = true\n  facts.resizesArray = true\n"],
    ],
    [
      "a call that drops the stance",
      ["applyStance(facts, markChannelSend(facts))", "markChannelSend(facts)"],
    ],
    ["a fallback list that misses an emitter-written body", ["  isLockMethod(sig)\n", "  false\n"]],
    [
      "a helper hidden below a mention of the fixpoint",
      [
        "const markLock = (facts: FunctionFacts): BodilessStance =>",
        "// ---- The fixpoint walk reads these.\nconst markLock = (facts: FunctionFacts): void =>",
      ],
    ],
  ]
  let failed = 0
  if (check(live, liveEmit).length > 0) {
    console.error("bodiless-stance: the live source fails, so the mutants prove nothing")
    failed++
  }
  for (const [what, [from, to]] of mutants) {
    if (!live.includes(from)) {
      console.error(`bodiless-stance: self-test cannot find the text to mutate for ${what}`)
      failed++
    } else if (check(live.replace(from, to), liveEmit).length === 0) {
      console.error(`bodiless-stance: self-test: ${what} passes the check`)
      failed++
    }
  }
  if (failed > 0) {
    process.exit(1)
  }
  console.log(`bodiless-stance: self-test: ${mutants.length} mutants refused`)
  process.exit(0)
}

const problems = check(live, liveEmit)
if (problems.length > 0) {
  for (const p of problems) {
    console.error(`bodiless-stance: ${p}`)
  }
  process.exit(1)
}
console.log("bodiless-stance: every bodiless instance states its write, keep and growth facts")
