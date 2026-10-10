// `nish --fix <files>`: apply the machine-applicable fixes the diagnostics
// carry, and compile again until nothing is left to apply.
//
// A fix is data on a diagnostic (`Edit`, in `src/diagnostics.ts`), reported by
// the site that knows the rule, so nothing here knows any rule: it collects
// the edits a compilation reported, applies them to the files they are in, and
// asks again. Several rounds are needed because a phase stops at its first
// error — Phase 0 reports one diagnostic per module — so the second loose
// equality in a file is only reported once the first one is fixed.
//
// What it may touch is narrow on purpose. Only a file named on the command
// line is rewritten, never one it imports, never one the standard library or
// a package under `node_modules` supplies, and never a file with no edit: a
// file comes back byte-identical unless a fix applied to it. Two edits in one
// file that overlap cannot both be right, so the later one in report order is
// dropped with the rest of its diagnostic's fix, and the next round, compiling
// the file the earlier one produced, reports it again if it still applies. A
// fix whose own edits overlap is dropped every round.

import { Compilation, ModuleUnit } from "./compilation"
import { Diagnostic, Edit } from "./diagnostics"
import { StringSet } from "./map"
import { Options } from "./options"
import { ROOT_PACKAGE } from "./packages"
import { StringBuilder } from "./strings"

/**
 * How many rounds of edits are applied before the driver gives up. A round
 * that applies nothing ends the loop sooner, which is the usual case; the cap
 * is what stops two fixes that undo each other from running forever.
 */
const MAX_FIX_ROUNDS: i32 = 5

/**
 * The compilation `--fix` ended on, which the driver reports exactly as a run
 * without `--fix` would report it: `loaded` false is a load failure (the
 * sink, or `unreadableRoot`), `checked` false a rejected program.
 */
export class FixOutcome {
  compilation: Compilation
  loaded: boolean
  checked: boolean

  constructor(compilation: Compilation, loaded: boolean, checked: boolean) {
    this.compilation = compilation
    this.loaded = loaded
    this.checked = checked
  }
}

/**
 * Load the roots named on the command line, in order, and answer whether all
 * of them loaded. A root is named by the path it was given, but its identity
 * is `identityOf` that path, so a root the entry already imports under another
 * spelling is found in `byPath` rather than loaded twice.
 *
 * `keepGoing` false is the plain run, which stops at the first root that fails
 * — its report names that root and nothing after it. `--fix` collects with
 * `keepGoing` true, because a Phase 0 refusal is exactly what a fix answers, so
 * every named file is loaded each round and each one's fixes are collected in
 * it; and it reports from a plain load, so what it prints is what `nish` alone
 * would print about the files it leaves behind.
 */
export const loadRoots = (compilation: Compilation, roots: string[], keepGoing: boolean): boolean => {
  let loaded = true
  for (const root of roots) {
    if (!compilation.load(root, root, "")) {
      loaded = false
      if (!keepGoing) {
        return false
      }
    }
  }
  return loaded
}

/** Load the roots, as `loadRoots` does, and check the program if they all loaded. */
const compileRoots = (opts: Options, roots: string[], keepGoing: boolean): FixOutcome => {
  const compilation = new Compilation(opts)
  const loaded = loadRoots(compilation, roots, keepGoing)
  return new FixOutcome(compilation, loaded, loaded && compilation.check())
}

/**
 * Compile, apply every fix that applies, and compile again, until a round
 * applies nothing or `MAX_FIX_ROUNDS` rounds have been applied. Answers the
 * last compilation, whose diagnostics are what is still wrong.
 *
 * `warnPerformance` says whether a performance warning would be printed, and
 * so whether its fix is applied: `--fix` applies the fixes a run without it
 * would show and no other, which is also why a warning's fix is applied only
 * once the program checks, the one time a warning is shown.
 */
export const fixProgram = (opts: Options, roots: string[], warnPerformance: boolean): FixOutcome => {
  let outcome = compileRoots(opts, roots, true)
  let round = 0
  while (round < MAX_FIX_ROUNDS && applyFixes(outcome, roots, warnPerformance) > 0) {
    round = round + 1
    outcome = compileRoots(opts, roots, true)
  }
  // Every root loaded, so a plain load would have gone the same way and the
  // last round is already the report. Otherwise the report comes from a load
  // that stops where a plain run stops.
  return outcome.loaded ? outcome : compileRoots(opts, roots, false)
}

/**
 * Apply one round: every fix the compilation reported in a file `--fix` may
 * rewrite. Answers how many files were rewritten.
 */
const applyFixes = (outcome: FixOutcome, roots: string[], warnPerformance: boolean): i32 => {
  const compilation = outcome.compilation
  // A fresh array, so the warnings can be appended to it.
  const diagnostics = compilation.sink.sorted()
  if (outcome.checked) {
    if (warnPerformance) {
      for (const warning of compilation.sink.warnings) {
        diagnostics.push(warning)
      }
    }
    for (const warning of compilation.sink.portability) {
      diagnostics.push(warning)
    }
    // A deprecation is printed whatever the flags say, so its fix is always
    // one a run without `--fix` would show.
    for (const warning of compilation.sink.deprecations) {
      diagnostics.push(warning)
    }
  }
  // The files to rewrite, collected first: each root by identity, so a file
  // named twice, or under two spellings, is rewritten once, and not the
  // standard library or a dependency even when it is named — those belong to
  // whoever installed them, and the next install would undo the edit.
  // `packageName` already knows a package reached through a link.
  const seen = new StringSet()
  const targets: FixTarget[] = []
  for (const root of roots) {
    const identity = compilation.identityOf(root)
    const at = compilation.byPath.get(identity, -1)
    if (at >= 0 && !seen.has(identity) && compilation.modules[at].packageName === ROOT_PACKAGE) {
      seen.add(identity)
      targets.push(new FixTarget(compilation.modules[at], identity))
    }
  }
  let rewritten = 0
  for (const target of targets) {
    if (rewriteFile(diagnostics, target)) {
      rewritten = rewritten + 1
    }
  }
  return rewritten
}

/** A module `--fix` may rewrite, and the real path it is written to. */
class FixTarget {
  unit: ModuleUnit
  /**
   * The real path rather than the spelling: `writeFileSync` refuses a symbolic
   * link as the last component, and a root named through one means the file
   * it points at.
   */
  path: string

  constructor(unit: ModuleUnit, path: string) {
    this.unit = unit
    this.path = path
  }
}

/**
 * Rewrite one file with every fix that applies to it, and answer whether there
 * was one. A function of its own that answers a boolean, so the edit list and
 * the new text go back to the arena when it returns rather than piling up
 * over the files of the round.
 */
const rewriteFile = (diagnostics: Diagnostic[], target: FixTarget): boolean => {
  const unit = target.unit
  const edits = acceptedEdits(diagnostics, unit)
  if (edits.length === 0) {
    return false
  }
  writeFileSync(target.path, applyEdits(unit.source.text, edits))
  // stderr, like `wrote <file>`: stdout belongs to `--json`.
  console.error(`fixed ${unit.name} (${edits.length} edit${edits.length === 1 ? "" : "s"})`)
  return true
}

/**
 * The edits of one module that can be applied together, in source order.
 * Diagnostics are taken in report order and a fix is all or nothing: one that
 * overlaps an edit already accepted is dropped whole, and the next round will
 * report it against the text the accepted one produced, if it still applies.
 * So is one whose own edits overlap each other, which no order of applying
 * them makes right — `export { f, f }` asks for `export ` before `f` twice —
 * and the next round reports it again, so it is never applied. An edit
 * identical to one another fix already had accepted — the same span and the
 * same text — is no overlap but the same change: it counts as applied, and
 * the rest of its fix goes in with it.
 */
const acceptedEdits = (diagnostics: Diagnostic[], unit: ModuleUnit): Edit[] => {
  const accepted: Edit[] = []
  for (const diagnostic of diagnostics) {
    if (diagnostic.edits.length === 0 || diagnostic.source !== unit.source) {
      continue
    }
    let clear = true
    const own: Edit[] = []
    for (const edit of diagnostic.edits) {
      if (overlapsAny(edit, own) || (!sameAsAny(edit, accepted) && overlapsAny(edit, accepted))) {
        clear = false
        break
      }
      own.push(edit)
    }
    if (!clear) {
      continue
    }
    for (const edit of diagnostic.edits) {
      // An edit an earlier fix already made is made once: every NL7002 fix
      // carries the one import its module lacks, and taking it as applied
      // lets every site land in the round that writes it.
      if (sameAsAny(edit, accepted)) {
        continue
      }
      // A stable insertion by start, so the result is in source order.
      accepted.push(edit)
      let i = accepted.length - 1
      while (i > 0 && i < accepted.length && accepted[i - 1].start > edit.start) {
        accepted[i] = accepted[i - 1]
        i = i - 1
      }
      if (i >= 0 && i < accepted.length) {
        accepted[i] = edit
      }
    }
  }
  return accepted
}

/** Whether `list` holds an edit with `edit`'s span and text, which applying `edit` too would repeat. */
const sameAsAny = (edit: Edit, list: Edit[]): boolean => {
  for (const other of list) {
    if (edit.start === other.start && edit.end === other.end && edit.text === other.text) {
      return true
    }
  }
  return false
}

/**
 * Whether `edit` touches any of `list`. Two spans overlap when each starts
 * before the other ends; two edits at one offset collide too, because two
 * insertions there have no order and an insertion at the start of a
 * replacement could land on either side of it. An insertion at the end of a
 * replacement does not: it is after it, whichever is applied first.
 */
const overlapsAny = (edit: Edit, list: Edit[]): boolean => {
  for (const other of list) {
    if (edit.start === other.start || (edit.start < other.end && other.start < edit.end)) {
      return true
    }
  }
  return false
}

/**
 * `text` with `edits` applied — sorted by start and not overlapping, as
 * `acceptedEdits` leaves them. Each edit's offsets index the original text,
 * so the result is built front to back from the pieces between them, which is
 * the same text applying them back to front gives, in one pass.
 */
const applyEdits = (text: string, edits: Edit[]): string => {
  const out = new StringBuilder()
  let at = 0
  for (const edit of edits) {
    // `slice`, not `substring`: the offsets come from this very text, so one
    // out of range is a broken invariant to stop on, not a value to clamp.
    out.add(text.slice(at, edit.start))
    out.add(edit.text)
    at = edit.end
  }
  out.add(text.slice(at, text.length))
  return out.toText()
}
