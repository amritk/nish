// The bounds-check proof (WP15 §2.1 and §2.2). It began as the port of
// stage0's `src/checker/bounds.ts`, deleted in WP19 R6, and is now the only
// copy of every rule, guard and invalidation below; the shape is the subset's —
// parallel arrays for records, a `Fact` class for a union, and `-1` for
// `undefined`.
//
// A flow-sensitive walk decides, for every `a[i]` and every `s.charCodeAt(i)`,
// whether the index is already known to be in range. Where it is,
// `program.nodeProvenIndex` records it and the emitter writes the address and
// no check; where it is not, the runtime check stays and the WP15 §8 warning
// in `src/checker.ts` names the guard that would have proved it.
//
// The same facts answer a second question, and it is not about a check.
// `s.substring(a, b)` clamps each end into `[0, len]` the way JavaScript
// specifies — an `llvm.smin` / `llvm.smax` pair per bound, six intrinsic calls
// once the two are swapped into order — and that clamp is the semantics rather
// than a safety net, so `--unchecked-indexing` leaves it alone. A bound this
// analysis can place in `[0, s.length]` cannot be moved by the clamp, so the
// clamp is dead code: `program.nodeProvenClamp` says which bounds those are
// and `src/emit-strings.ts` writes them through. The bounds of a `s.slice`
// get the same verdict in the same table, but only from `proveSliceBounds`,
// which the WP33 portability pass calls under `--warn-portability`: `slice`
// checks rather than clamps, so nothing emitted reads them, and a compile
// without the flag never judges one. A `slice` bound has one proof more than a
// `substring` bound, the length of a receiver whose ASCII text the program
// spells out (`provesLiteralSlice`), and it stays on that side so that the
// clamps the emitter folds are exactly what they were.
//
// A third question is a range entry (WP31 §8, docs/wp31-ranged-integers.md).
// A value entering an `integer<Lo, Hi>` is compared once where it enters, and
// the same facts decide whether that compare can go: `judgeRange` writes the
// verdict to `program.nodeProvenRange`, which the emitter and the attribute
// pass read. A declared range is also a *source* of facts, read off the type
// rather than stored: `knownNonNegative` and `maxIndexOf` ask
// `TypeTable.declaredRange`, so a ranged, `u8` or `u16` local is bounded at
// every program point with nothing to forget, because every write into a
// ranged place is an entry and an unsigned one cannot hold anything else.
//
// Where LLVM finds this by itself, and where it does not. It needs the
// receiver's length to be one value it can reason about: give it a string
// literal bound to a local and a hoisted `const n = s.length`, and `opt -O3`
// folds all six calls out of the unfolded IR unaided. Where the receiver is a
// *parameter* it does not: the guard a program writes compares `i32`s and the
// clamp runs on their `sext`, the length is re-read on every pass, and
// `nish_str_new` — which every `substring` calls — is not `readnone`, so
// nothing proves the second read equals the first. All six survive there
// whether or not a dominating guard proves both ends, which is the shape §8's
// warning is written against.
//
// A bound is judged where the emitter evaluates it, not where the call ends.
// `emitSubstring` clamps argument 0 before argument 1 runs, so `walkExpression`
// interleaves the verdicts with the argument walk and drops the receiver's
// holder as soon as an argument rebinds it. Judging both ends against the
// state the whole argument list left behind folded the clamp on a negative `k`
// in `s.substring(k, (k = s.length))` and read three bytes before the string
// body.
//
// The six families of fact, keyed by *variable* — a local cannot be written
// through an alias, so no store and no call can invalidate a fact behind the
// checker's back:
//
//   nonNegative(i)   `i >= 0`
//   below(i, w)      `i < w.length`
//   atMost(i, w)     `i <= w.length`
//   maxIndex(i, n)   `i < n`, `n` a literal
//   minLength(w, n)  `w.length >= n`, `n` a literal
//   minValue(i, n)   `i >= n`, `n` a literal of 1 or more, recorded beside
//                    `nonNegative(i)`: what makes `i - 1` a valid index after
//                    `if (i !== 0)`, and what `i - c` keeps
//
// Guards and initialisers are not the only source. A checked access that
// *ran* is one too: `a[i]` and `s.charCodeAt(i)` either branch to
// `nish_panic_index`, which does not return, or continue with
// `0 <= i < a.length`, so the walk records `nonNegative(i)` and `below(i, a)`
// (or `minLength(a, n + 1)` for a literal `a[n]`) at the point the emitter
// runs the check, and a repeat of the same index on the same holder is
// proven. They are ordinary facts in the families above, so every rule below
// takes them away exactly as it takes away a guard's; `recordPassedCheck`
// holds the one argument that is theirs alone, about `a[i] = v`.
//
// `atMost` is what makes the *hoisted* length work, and it is there because
// the advice everybody gives about bounds checks is to hoist one:
// `const n = xs.length` records `n <= xs.length`, and a later `i < n` then
// proves `i < xs.length` without the loop ever mentioning `xs.length` again.
//
// What invalidates one is the whole soundness argument. For a variable holder
// the two halves that matter are these: **any call drops every array length
// fact**, because a callee holding the same array may `push` and move `len`,
// while a string's length cannot change at all once the variable holding it is
// bound; and an increment keeps its variable's lower
// bound only when `nsw` is on, because `--wrapping` *defines* the step past
// `INT_MAX` to land on `INT_MIN`. A decrement is the mirror: it keeps the upper
// bounds, under `nsw` or where the variable is known non-negative, and never
// for an unsigned variable, which wraps at zero.
//
// "Any call" is pass 2's answer, which runs before every body is checked and
// so knows no callee. `src/ranges.ts` walks each body again once the whole
// program is checked (WP15 §2.4), with a `CallSummary` per callee — the field
// names and record types it may store, and no summary at all for one that may
// resize an array — and with the facts every call site proves about the
// function's parameters as its entry state. A call with a summary drops only
// the paths its stores reach and keeps every array length; a call without one
// is "any call" still. Every rule below applies to the entry facts exactly as
// to a guard's.
//
// The length holder `w` may also be a **property path** (#106): a root local,
// parameter or `this`, then a chain of field names — `h.xs`,
// `this.state.atMostIndex`. A path is interned per body as a stand-in `Local`
// (`PathHolder`), so every family above holds it without a second copy of the
// machinery, and `h.xs.length` proves `h.xs[i]` the way `xs.length` proves
// `xs[i]`. What a local gets for free a path has to earn, because a field *can*
// be written through an alias, so a path fact is dropped by:
//
//   - a store to a field whose name is anywhere on the path, through any holder
//     at all — the name is compared, never the struct type, so an alias is
//     caught without knowing it is one;
//   - a store of a whole element into an array of inline records, which
//     rewrites a record in place and every field of it with no field name
//     written — on a path with a link read off a holder declared as that
//     record type, because that is the only memory the store can reach
//     (`recordReaches`);
//   - an assignment to the root, or its declaration running again;
//   - **any** call and any `new`, strings included, in pass 2 — and, once
//     `src/ranges.ts` knows the callee, a call whose summary has no stores
//     that reach the path and resizes nothing. Resizing alone would not be
//     enough to know: a callee that stores `h.xs = shorter` resizes nothing
//     and still rebinds the path, which is why a summary lists field names.
//     `push` and `pop` are calls with no summary, so they are in this rule
//     too;
//   - a link whose **declared** type is not a plain struct: a path is never
//     built through `T | null`, whatever a guard narrowed it to, and neither is
//     one whose last link is a nullable array. #104's first hoist miscompiled
//     on the narrowed type; the declared one is what this reads.
//
// A path is only ever a proof: an access on one that stays unproven is not
// put on the §8 warning list, because the rewrite such a warning names is the
// `const xs = h.xs` hoist, and that is advice about a local.

import { terminatesControlFlow } from "./builtins"
import { parseIntegerLiteral } from "./constants"
import { CheckContext } from "./context"
import { DiagnosticSink } from "./diagnostics"
import {
  N_ARRAY,
  N_ARROW,
  N_BINARY,
  N_BLOCK,
  N_BREAK,
  N_CALL,
  N_CASE,
  N_CONDITIONAL,
  N_CONTINUE,
  N_DO,
  N_EMPTY,
  N_EXPR_STMT,
  N_FOR,
  N_FOR_OF,
  N_IDENT,
  N_IF,
  N_INDEX,
  N_MEMBER,
  N_NEW,
  N_NUMBER,
  N_PAREN,
  N_RETURN,
  N_STRING,
  N_SWITCH,
  N_THIS,
  N_THROW,
  N_UNARY,
  N_VAR,
  N_WHILE,
  Node,
} from "./nodes"
import { StringMap } from "./map"
import { CheckedProgram, FunctionSig, ROLE_FUNCTION, ROLE_METHOD, inlineElementStruct } from "./program"
import { Options } from "./options"
import { isAsciiText } from "./strings"
import { Local, STORAGE_LOCAL, STORAGE_PARAM } from "./symbols"
import {
  DeclaredRange,
  T_BOOL,
  T_I32,
  T_I64,
  T_STRING,
  T_U16,
  T_U32,
  T_U8,
  TypeTable,
  isInteger,
  isNumeric,
  isUnsigned,
} from "./types"

/** The largest bound the fold carries; a literal past it is answered "not a bound". */
const I32_MAX: i64 = 2147483647

const FACT_NON_NEGATIVE: i32 = 0
const FACT_BELOW: i32 = 1
const FACT_AT_MOST: i32 = 2
const FACT_MAX_INDEX: i32 = 3
const FACT_MIN_LENGTH: i32 = 4
const FACT_MIN_VALUE: i32 = 5
const FACT_EXCLUDES: i32 = 6

/**
 * One fact. `v` is the index variable for every kind but `minLength`, whose `v`
 * is the length holder; `w` is the length holder of `below` and `atMost`; `n`
 * is the literal of the three constant families, and the reach of a `below`:
 * `v + n < w.length`, 0 for the plain `v < w.length`.
 */
class Fact {
  kind: i32
  v: Local
  w: Local | null
  n: i32

  constructor(kind: i32, v: Local, w: Local | null, n: i32) {
    this.kind = kind
    this.v = v
    this.w = w
    this.n = n
  }
}

/** What a condition proves where it holds, and where it does not. */
class ConditionFacts {
  whenTrue: Fact[]
  whenFalse: Fact[]

  constructor() {
    this.whenTrue = []
    this.whenFalse = []
  }
}

/**
 * The facts that hold at one program point, as parallel arrays per family,
 * because entry order is the order everything is compared in.
 */
export class State {
  /**
   * Where a declared range is read from (WP31 §8). It is not a fact: the
   * type of a ranged or unsigned local answers `v >= Lo` and `v <= Hi` at
   * every program point, so nothing about it is stored and nothing forgets it.
   */
  table: TypeTable
  nonNegative: Local[]
  belowIndex: Local[]
  belowHolder: Local[]
  /**
   * How far past the index the length is known to reach: `i + reach <
   * w.length`. A guard written as `i + 3 < n` is what records more than 0,
   * and it is what proves `w[i + 1]` through `w[i + 3]` in a loop that reads
   * four elements a pass. Every reader of the plain fact reads any reach,
   * because `i + c < w.length` with `c >= 0` is `i < w.length` or stronger.
   */
  belowOffset: i32[]
  atMostIndex: Local[]
  atMostHolder: Local[]
  maxIndexVar: Local[]
  maxIndexValue: i32[]
  minLengthVar: Local[]
  minLengthValue: i32[]
  minValueVar: Local[]
  minValueValue: i32[]
  /**
   * `v !== n`, for the two values a divisor must not take, `0` and `-1`: the
   * only family whose `n` may be negative, and read only by `provesDivisor`.
   */
  excludedVar: Local[]
  excludedValue: i32[]

  constructor(table: TypeTable) {
    this.table = table
    this.nonNegative = []
    this.belowIndex = []
    this.belowHolder = []
    this.belowOffset = []
    this.atMostIndex = []
    this.atMostHolder = []
    this.maxIndexVar = []
    this.maxIndexValue = []
    this.minLengthVar = []
    this.minLengthValue = []
    this.minValueVar = []
    this.minValueValue = []
    this.excludedVar = []
    this.excludedValue = []
  }
}

const cloneState = (s: State): State => {
  const out = new State(s.table)
  for (const v of s.nonNegative) {
    out.nonNegative.push(v)
  }
  let k = 0
  while (k < s.belowIndex.length) {
    out.belowIndex.push(s.belowIndex[k])
    out.belowHolder.push(s.belowHolder[k])
    out.belowOffset.push(s.belowOffset[k])
    k = k + 1
  }
  k = 0
  while (k < s.atMostIndex.length) {
    out.atMostIndex.push(s.atMostIndex[k])
    out.atMostHolder.push(s.atMostHolder[k])
    k = k + 1
  }
  k = 0
  while (k < s.maxIndexVar.length) {
    out.maxIndexVar.push(s.maxIndexVar[k])
    out.maxIndexValue.push(s.maxIndexValue[k])
    k = k + 1
  }
  k = 0
  while (k < s.minLengthVar.length) {
    out.minLengthVar.push(s.minLengthVar[k])
    out.minLengthValue.push(s.minLengthValue[k])
    k = k + 1
  }
  k = 0
  while (k < s.minValueVar.length) {
    out.minValueVar.push(s.minValueVar[k])
    out.minValueValue.push(s.minValueValue[k])
    k = k + 1
  }
  k = 0
  while (k < s.excludedVar.length) {
    out.excludedVar.push(s.excludedVar[k])
    out.excludedValue.push(s.excludedValue[k])
    k = k + 1
  }
  return out
}

/**
 * Overwrite `into` with `from`'s facts. The walk threads one mutable state
 * through a body. The arrays are taken rather than copied: every caller hands
 * over a state nothing reads again — a fresh `intersect`, or a branch's clone
 * whose branch is over — so copying them once more only made garbage.
 */
const copyInto = (into: State, from: State): void => {
  into.nonNegative = from.nonNegative
  into.belowIndex = from.belowIndex
  into.belowHolder = from.belowHolder
  into.belowOffset = from.belowOffset
  into.atMostIndex = from.atMostIndex
  into.atMostHolder = from.atMostHolder
  into.maxIndexVar = from.maxIndexVar
  into.maxIndexValue = from.maxIndexValue
  into.minLengthVar = from.minLengthVar
  into.minLengthValue = from.minLengthValue
  into.minValueVar = from.minValueVar
  into.minValueValue = from.minValueValue
  into.excludedVar = from.excludedVar
  into.excludedValue = from.excludedValue
}

// ---- Reading the state ------------------------------------------------------------

/**
 * `v >= 0`. A declared range answers this without any flow at all (WP31 §8):
 * `integer<Lo, Hi>` with `Lo >= 0`, and `u8`/`u16`/`u32`/`u64`, the ranged
 * types the language had first, cannot hold a negative value, so their lower
 * bound is read off the declaration.
 */
const knownNonNegative = (state: State, v: Local): boolean => {
  const declared = state.table.declaredRange(v.type)
  if (declared !== null && declared.lo >= 0) {
    return true
  }
  for (const x of state.nonNegative) {
    if (x === v) {
      return true
    }
  }
  return false
}

/**
 * The largest recorded `c` with `i + c < w.length`, or -1 when `i` is not
 * known below `w.length` at all. 0 is the plain fact.
 */
const belowReach = (state: State, i: Local, w: Local): i32 => {
  let best = -1
  let k = 0
  while (k < state.belowIndex.length) {
    if (state.belowIndex[k] === i && state.belowHolder[k] === w && state.belowOffset[k] > best) {
      best = state.belowOffset[k]
    }
    k = k + 1
  }
  return best
}

/** `i < w.length` is recorded here. */
const knownBelow = (state: State, i: Local, w: Local): boolean => belowReach(state, i, w) >= 0

/**
 * `i <= w.length`, which a strict `i < w.length` gives as well. The holders it
 * answers for are what turns `i < n` into `i < w.length` when `n` was bound to
 * a hoisted length.
 */
const knownAtMost = (state: State, i: Local, w: Local): boolean => {
  let k = 0
  while (k < state.atMostIndex.length) {
    if (state.atMostIndex[k] === i && state.atMostHolder[k] === w) {
      return true
    }
    k = k + 1
  }
  return knownBelow(state, i, w)
}

/** Every holder whose length bounds `i` from above, in the order they were recorded. */
const holdersAbove = (state: State, i: Local): Local[] => {
  const out: Local[] = []
  let k = 0
  while (k < state.atMostIndex.length) {
    if (state.atMostIndex[k] === i && !contains(out, state.atMostHolder[k])) {
      out.push(state.atMostHolder[k])
    }
    k = k + 1
  }
  k = 0
  while (k < state.belowIndex.length) {
    if (state.belowIndex[k] === i && !contains(out, state.belowHolder[k])) {
      out.push(state.belowHolder[k])
    }
    k = k + 1
  }
  return out
}

/**
 * The smallest `n` known to satisfy `i < n`, or -1 when there is none. A
 * declared `Hi` is one of the candidates (WP31 §8): `Hi + 1`, whenever it is
 * an `i32` bound at all, so `u8` and `u16` bound an index by 256 and 65536
 * and a ranged local by its own top, with nothing recorded and nothing to
 * forget. A recorded fact that is tighter still wins.
 */
const maxIndexOf = (state: State, i: Local): i32 => {
  let best = -1
  const declared = state.table.declaredRange(i.type)
  if (declared !== null && declared.hi >= toI64(-1) && declared.hi < I32_MAX) {
    best = toI32(declared.hi) + 1
  }
  let k = 0
  while (k < state.maxIndexVar.length) {
    if (state.maxIndexVar[k] === i && (best < 0 || state.maxIndexValue[k] < best)) {
      best = state.maxIndexValue[k]
    }
    k = k + 1
  }
  return best
}

/** The largest recorded `n` with `w.length >= n`, or -1. */
const minLengthOf = (state: State, w: Local): i32 => {
  let best = -1
  let k = 0
  while (k < state.minLengthVar.length) {
    if (state.minLengthVar[k] === w && state.minLengthValue[k] > best) {
      best = state.minLengthValue[k]
    }
    k = k + 1
  }
  return best
}

/** Whether `w.length >= n` is recorded. */
const knownMinLength = (state: State, w: Local, n: i32): boolean => {
  const best = minLengthOf(state, w)
  return best >= 0 && best >= n
}

/**
 * The largest `n` known to satisfy `v >= n`: a recorded floor, 0 for a
 * variable that is only known non-negative, or -1 when nothing bounds it from
 * below. The floor is what `n - 1` needs to stay non-negative, and it is how
 * `if (n !== 0)` on a non-negative `n` says `n >= 1`.
 */
const minValueOf = (state: State, v: Local): i32 => {
  let best = -1
  let k = 0
  while (k < state.minValueVar.length) {
    if (state.minValueVar[k] === v && state.minValueValue[k] > best) {
      best = state.minValueValue[k]
    }
    k = k + 1
  }
  if (best < 0 && knownNonNegative(state, v)) {
    return 0
  }
  return best
}

// ---- Writing the state ------------------------------------------------------------

/** `v !== n`, recorded by a guard (`addDisequalityFacts`). */
const knownExcludes = (state: State, v: Local, n: i32): boolean => {
  let k = 0
  while (k < state.excludedVar.length) {
    if (state.excludedVar[k] === v && state.excludedValue[k] === n) {
      return true
    }
    k = k + 1
  }
  return false
}

const addFact = (state: State, fact: Fact): void => {
  if (fact.kind === FACT_EXCLUDES) {
    if (!knownExcludes(state, fact.v, fact.n)) {
      state.excludedVar.push(fact.v)
      state.excludedValue.push(fact.n)
    }
    return
  }
  if (fact.kind === FACT_NON_NEGATIVE) {
    for (const x of state.nonNegative) {
      if (x === fact.v) {
        return
      }
    }
    state.nonNegative.push(fact.v)
    return
  }
  if (fact.kind === FACT_BELOW) {
    // A shorter reach than one already recorded changes no answer.
    const w = fact.w
    if (w !== null && belowReach(state, fact.v, w) < fact.n) {
      state.belowIndex.push(fact.v)
      state.belowHolder.push(w)
      state.belowOffset.push(fact.n)
    }
    return
  }
  if (fact.kind === FACT_AT_MOST) {
    const above = fact.w
    if (above !== null && !knownAtMost(state, fact.v, above)) {
      state.atMostIndex.push(fact.v)
      state.atMostHolder.push(above)
    }
    return
  }
  if (fact.kind === FACT_MAX_INDEX) {
    state.maxIndexVar.push(fact.v)
    state.maxIndexValue.push(fact.n)
    return
  }
  if (fact.kind === FACT_MIN_VALUE) {
    // A floor of 1 or more is a lower bound of 0 as well, and recording both
    // keeps every reader of `nonNegative` unaware of this family.
    addFact(state, new Fact(FACT_NON_NEGATIVE, fact.v, null, 0))
    if (fact.n > 0 && minValueOf(state, fact.v) < fact.n) {
      state.minValueVar.push(fact.v)
      state.minValueValue.push(fact.n)
    }
    return
  }
  // A weaker floor than one already recorded changes no answer, and a checked
  // literal index offers the same one at every access it passes.
  if (knownMinLength(state, fact.v, fact.n)) {
    return
  }
  state.minLengthVar.push(fact.v)
  state.minLengthValue.push(fact.n)
}

const addFacts = (state: State, facts: Fact[]): void => {
  for (const fact of facts) {
    addFact(state, fact)
  }
}

/**
 * Whether any fact in `state` names `v`, as an index or as a holder. The
 * `forget` family rebuilds every array it filters, and most of what it is
 * asked to forget is not there: a call forgets every path, an assignment
 * forgets its variable, whether or not either holds a fact.
 */
const mentions = (state: State, v: Local): boolean => {
  for (const x of state.nonNegative) {
    if (x === v) {
      return true
    }
  }
  for (const x of state.belowIndex) {
    if (x === v) {
      return true
    }
  }
  for (const x of state.belowHolder) {
    if (x === v) {
      return true
    }
  }
  for (const x of state.atMostIndex) {
    if (x === v) {
      return true
    }
  }
  for (const x of state.atMostHolder) {
    if (x === v) {
      return true
    }
  }
  for (const x of state.maxIndexVar) {
    if (x === v) {
      return true
    }
  }
  for (const x of state.minLengthVar) {
    if (x === v) {
      return true
    }
  }
  for (const x of state.minValueVar) {
    if (x === v) {
      return true
    }
  }
  for (const x of state.excludedVar) {
    if (x === v) {
      return true
    }
  }
  return false
}

/** Drop every `v !== n`: any write to `v` may land on the value it excluded. */
const forgetExcluded = (state: State, v: Local): void => {
  const kept: Local[] = []
  const values: i32[] = []
  let k = 0
  while (k < state.excludedVar.length) {
    if (state.excludedVar[k] !== v) {
      kept.push(state.excludedVar[k])
      values.push(state.excludedValue[k])
    }
    k = k + 1
  }
  state.excludedVar = kept
  state.excludedValue = values
}

/** Drop the upper bounds of `v` and keep its lower one: what an increment leaves behind. */
const forgetUpperBounds = (state: State, v: Local): void => {
  if (!mentions(state, v)) {
    return
  }
  const index: Local[] = []
  const holder: Local[] = []
  const reach: i32[] = []
  let k = 0
  while (k < state.belowIndex.length) {
    if (state.belowIndex[k] !== v) {
      index.push(state.belowIndex[k])
      holder.push(state.belowHolder[k])
      reach.push(state.belowOffset[k])
    }
    k = k + 1
  }
  state.belowIndex = index
  state.belowHolder = holder
  state.belowOffset = reach
  const atIndex: Local[] = []
  const atHolder: Local[] = []
  k = 0
  while (k < state.atMostIndex.length) {
    if (state.atMostIndex[k] !== v) {
      atIndex.push(state.atMostIndex[k])
      atHolder.push(state.atMostHolder[k])
    }
    k = k + 1
  }
  state.atMostIndex = atIndex
  state.atMostHolder = atHolder
  const maxVar: Local[] = []
  const maxValue: i32[] = []
  k = 0
  while (k < state.maxIndexVar.length) {
    if (state.maxIndexVar[k] !== v) {
      maxVar.push(state.maxIndexVar[k])
      maxValue.push(state.maxIndexValue[k])
    }
    k = k + 1
  }
  state.maxIndexVar = maxVar
  state.maxIndexValue = maxValue
  forgetExcluded(state, v)
}

/**
 * Forget everything that mentions `v`: its own bounds, the accesses it indexes
 * and the accesses indexed *into* it.
 */
const forget = (state: State, v: Local): void => {
  if (!mentions(state, v)) {
    return
  }
  const kept: Local[] = []
  for (const x of state.nonNegative) {
    if (x !== v) {
      kept.push(x)
    }
  }
  state.nonNegative = kept
  const index: Local[] = []
  const holder: Local[] = []
  const reach: i32[] = []
  let k = 0
  while (k < state.belowIndex.length) {
    if (state.belowIndex[k] !== v && state.belowHolder[k] !== v) {
      index.push(state.belowIndex[k])
      holder.push(state.belowHolder[k])
      reach.push(state.belowOffset[k])
    }
    k = k + 1
  }
  state.belowIndex = index
  state.belowHolder = holder
  state.belowOffset = reach
  const atIndex: Local[] = []
  const atHolder: Local[] = []
  k = 0
  while (k < state.atMostIndex.length) {
    if (state.atMostIndex[k] !== v && state.atMostHolder[k] !== v) {
      atIndex.push(state.atMostIndex[k])
      atHolder.push(state.atMostHolder[k])
    }
    k = k + 1
  }
  state.atMostIndex = atIndex
  state.atMostHolder = atHolder
  forgetUpperBounds(state, v)
  const lengthVar: Local[] = []
  const lengthValue: i32[] = []
  k = 0
  while (k < state.minLengthVar.length) {
    if (state.minLengthVar[k] !== v) {
      lengthVar.push(state.minLengthVar[k])
      lengthValue.push(state.minLengthValue[k])
    }
    k = k + 1
  }
  state.minLengthVar = lengthVar
  state.minLengthValue = lengthValue
  forgetLowerBounds(state, v)
}

/**
 * An unsigned increment wraps at the top of its range to zero, which keeps
 * `v >= 0` — its type says so anyway — and breaks any higher floor, so after
 * one only zero is left. A signed one keeps its floor under `nsw` or loses
 * everything under `--wrapping` (`keepsLowerBound`), and this leaves it alone.
 */
const forgetWrappedFloor = (state: State, v: Local): void => {
  if (isUnsigned(v.type)) {
    forgetLowerBounds(state, v)
  }
}

/**
 * Drop the lower bounds of `v` and keep its upper ones: what a decrement
 * leaves behind, where `forgetUpperBounds` is what an increment does.
 */
const forgetLowerBounds = (state: State, v: Local): void => {
  if (!mentions(state, v)) {
    return
  }
  const kept: Local[] = []
  for (const x of state.nonNegative) {
    if (x !== v) {
      kept.push(x)
    }
  }
  state.nonNegative = kept
  const floorVar: Local[] = []
  const floorValue: i32[] = []
  let k = 0
  while (k < state.minValueVar.length) {
    if (state.minValueVar[k] !== v) {
      floorVar.push(state.minValueVar[k])
      floorValue.push(state.minValueValue[k])
    }
    k = k + 1
  }
  state.minValueVar = floorVar
  state.minValueValue = floorValue
  forgetExcluded(state, v)
}

/**
 * Every length fact about an *array* goes; the string ones stay. A callee that
 * holds the same array may `push` and move `len`. A string has no such
 * operation at all, so only rebinding the variable can change `s.length`.
 */
const forgetArrayLengths = (ctx: CheckContext, state: State): void => {
  if (state.belowHolder.length === 0 && state.atMostHolder.length === 0 && state.minLengthVar.length === 0) {
    return
  }
  const index: Local[] = []
  const holder: Local[] = []
  const reach: i32[] = []
  let k = 0
  while (k < state.belowIndex.length) {
    if (!ctx.table.isArray(state.belowHolder[k].type)) {
      index.push(state.belowIndex[k])
      holder.push(state.belowHolder[k])
      reach.push(state.belowOffset[k])
    }
    k = k + 1
  }
  state.belowIndex = index
  state.belowHolder = holder
  state.belowOffset = reach
  const atIndex: Local[] = []
  const atHolder: Local[] = []
  k = 0
  while (k < state.atMostIndex.length) {
    if (!ctx.table.isArray(state.atMostHolder[k].type)) {
      atIndex.push(state.atMostIndex[k])
      atHolder.push(state.atMostHolder[k])
    }
    k = k + 1
  }
  state.atMostIndex = atIndex
  state.atMostHolder = atHolder
  const lengthVar: Local[] = []
  const lengthValue: i32[] = []
  k = 0
  while (k < state.minLengthVar.length) {
    if (!ctx.table.isArray(state.minLengthVar[k].type)) {
      lengthVar.push(state.minLengthVar[k])
      lengthValue.push(state.minLengthValue[k])
    }
    k = k + 1
  }
  state.minLengthVar = lengthVar
  state.minLengthValue = lengthValue
}

/**
 * The facts that hold on both paths of a branch. Entries keep `a`'s order so
 * that the two compilers meet the same state in the same order.
 */
const intersect = (a: State, b: State): State => {
  const out = new State(a.table)
  for (const v of a.nonNegative) {
    if (knownNonNegative(b, v)) {
      out.nonNegative.push(v)
    }
  }
  // The shorter of two reaches survives, as the weaker of two bounds does.
  let k = 0
  while (k < a.belowIndex.length) {
    const other = belowReach(b, a.belowIndex[k], a.belowHolder[k])
    if (other >= 0) {
      out.belowIndex.push(a.belowIndex[k])
      out.belowHolder.push(a.belowHolder[k])
      out.belowOffset.push(a.belowOffset[k] < other ? a.belowOffset[k] : other)
    }
    k = k + 1
  }
  k = 0
  while (k < a.atMostIndex.length) {
    if (knownAtMost(b, a.atMostIndex[k], a.atMostHolder[k])) {
      out.atMostIndex.push(a.atMostIndex[k])
      out.atMostHolder.push(a.atMostHolder[k])
    }
    k = k + 1
  }
  // The weaker of two bounds is the one that survives: `i < 3` on one path and
  // `i < 5` on the other means `i < 5` after the join.
  k = 0
  while (k < a.maxIndexVar.length) {
    const other = maxIndexOf(b, a.maxIndexVar[k])
    if (other >= 0) {
      out.maxIndexVar.push(a.maxIndexVar[k])
      out.maxIndexValue.push(a.maxIndexValue[k] > other ? a.maxIndexValue[k] : other)
    }
    k = k + 1
  }
  k = 0
  while (k < a.minLengthVar.length) {
    const other = minLengthOf(b, a.minLengthVar[k])
    if (other >= 0) {
      out.minLengthVar.push(a.minLengthVar[k])
      out.minLengthValue.push(a.minLengthValue[k] < other ? a.minLengthValue[k] : other)
    }
    k = k + 1
  }
  // The lower of two floors, as with a length's.
  k = 0
  while (k < a.minValueVar.length) {
    const other = minValueOf(b, a.minValueVar[k])
    if (other > 0) {
      out.minValueVar.push(a.minValueVar[k])
      out.minValueValue.push(a.minValueValue[k] < other ? a.minValueValue[k] : other)
    }
    k = k + 1
  }
  k = 0
  while (k < a.excludedVar.length) {
    if (knownExcludes(b, a.excludedVar[k], a.excludedValue[k])) {
      out.excludedVar.push(a.excludedVar[k])
      out.excludedValue.push(a.excludedValue[k])
    }
    k = k + 1
  }
  return out
}

// ---- Reading the syntax -----------------------------------------------------------

export const unwrapBoundsParens = (expr: Node): Node => {
  let inner = expr
  while (inner.kind === N_PAREN) {
    inner = inner.children[0]
  }
  return inner
}

/** The local a bare identifier names, or `null` for every other expression. */
const localOf = (program: CheckedProgram, expr: Node): Local | null => {
  const e = unwrapBoundsParens(expr)
  if (e.kind !== N_IDENT) {
    return null
  }
  return program.nodeLocals[e.id]
}

/** A local whose value is a thing with a `.length`: an array or a string. */
const lengthHolder = (ctx: CheckContext, expr: Node): Local | null => {
  const v = localOf(ctx.program, expr)
  if (v === null) {
    return null
  }
  return ctx.table.isArray(v.type) || v.type === T_STRING ? v : null
}

/**
 * A property path the walk holds length facts about: `root`, then `fields`
 * from the root outward. `holder` is the stand-in `Local` every fact family
 * keys on, named `root.a.b` and interned once per path per body, so two spellings of `h.xs` meet on
 * one object and `forget` drops a path's facts the way it drops a variable's.
 * It is never bound to a node: `nodeLocals` cannot hand it out, so no
 * assignment can name it and the only way its facts go is the rules in the
 * header.
 */
export class PathHolder {
  root: Local
  fields: string[]
  /** The declared type each of `fields` is read off: the root's, then each link's. */
  links: i32[]
  holder: Local

  constructor(root: Local, fields: string[], links: i32[], holder: Local) {
    this.root = root
    this.fields = fields
    this.links = links
    this.holder = holder
  }
}

/**
 * The stand-in for the path `expr` spells, or `null` when it is not one a fact
 * may be keyed by: a root local, parameter or `this`, then one or more field
 * reads, ending in an array or a string.
 *
 * Every link is resolved on the **declared** type, the root's included — the
 * type a `Local` carries rather than the one `nodeTypes` recorded at this use.
 * A `T | null` is not a struct, so a path through one is refused however a
 * guard narrowed it here, and a last link declared `T[] | null` is not an
 * array. Nothing in this walk dereferences the path, so the narrowed type would
 * not be a miscompile *here*; it is refused anyway, because a fact about a
 * path that can be `null` is one `x.next = null` away from being about no
 * array at all, and the declared type is the rule #104's hoist is held to.
 */
const pathHolder = (walk: BoundsWalk, expr: Node): Local | null => {
  let e = unwrapBoundsParens(expr)
  while (e.kind === N_MEMBER) {
    e = unwrapBoundsParens(e.children[0])
  }
  const fields: string[] = []
  const links: i32[] = []
  const type = declaredPathType(walk.ctx, expr, fields, links)
  if (fields.length === 0 || type < 0 || (!walk.ctx.table.isArray(type) && type !== T_STRING)) {
    return null
  }
  // `declaredPathType` answered, so `e` is an identifier or `this` with a local.
  const root = walk.ctx.program.nodeLocals[e.id]
  if (root === null) {
    return null
  }
  return internHolder(walk, root, fields, links, type)
}

/** The one stand-in for the path `root.fields`, made the first time it is asked for. */
const internHolder = (walk: BoundsWalk, root: Local, fields: string[], links: i32[], type: i32): Local => {
  // No field name holds a dot, so the same root and the same fields is the
  // same name, and the name is only spelled for a path seen the first time.
  for (const path of walk.paths) {
    if (path.root === root && sameFields(path.fields, fields)) {
      return path.holder
    }
  }
  const name = `${root.name}.${fields.join(".")}`
  const holder = new Local(name, type, false, STORAGE_LOCAL)
  walk.paths.push(new PathHolder(root, fields, links, holder))
  return holder
}

const sameFields = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) {
    return false
  }
  let k = 0
  while (k < a.length && k < b.length) {
    if (a[k] !== b[k]) {
      return false
    }
    k = k + 1
  }
  return true
}

/**
 * `pathHolder` for a path given as a root and its field names rather than as
 * an expression: the entry facts of `src/ranges.ts` name one that way. Every
 * link is resolved on its declared type, by the rule `declaredPathType` holds
 * an expression to, and `null` is the answer wherever that one would refuse.
 */
const internPath = (walk: BoundsWalk, root: Local, fields: string[]): Local | null => {
  const program = walk.ctx.program
  const table = walk.ctx.table
  const links: i32[] = []
  let type = root.type
  for (const name of fields) {
    if (!table.isStruct(type)) {
      return null
    }
    const info = program.struct(table.nameOf(type))
    if (info === null) {
      return null
    }
    const field = info.field(name)
    if (field === null) {
      return null
    }
    links.push(type)
    type = field.type
  }
  if (fields.length === 0 || (!table.isArray(type) && type !== T_STRING)) {
    return null
  }
  return internHolder(walk, root, fields, links, type)
}

/**
 * The declared type of the location `expr` names, pushing its field names on
 * to `fields` from the root outward and the declared type each is read off on
 * to `links`, or -1 where a link is not a plain struct
 * with that field. Recursive rather than a loop over the links, so that it
 * indexes nothing and has no bounds check of its own to prove.
 */
const declaredPathType = (ctx: CheckContext, expr: Node, fields: string[], links: i32[]): i32 => {
  const program = ctx.program
  const table = ctx.table
  const e = unwrapBoundsParens(expr)
  if (e.kind === N_IDENT || e.kind === N_THIS) {
    const root = program.nodeLocals[e.id]
    return root === null ? -1 : root.type
  }
  if (e.kind !== N_MEMBER) {
    return -1
  }
  const below = declaredPathType(ctx, e.children[0], fields, links)
  if (below < 0 || !table.isStruct(below)) {
    return -1
  }
  const info = program.struct(table.nameOf(below))
  if (info === null) {
    return -1
  }
  const field = info.field(e.text)
  if (field === null) {
    return -1
  }
  fields.push(e.text)
  links.push(below)
  return field.type
}

/** A local holder or a path holder: what a `.length` or an element access is stated against. */
const holderOf = (walk: BoundsWalk, expr: Node): Local | null => {
  const local = lengthHolder(walk.ctx, expr)
  if (local !== null) {
    return local
  }
  return pathHolder(walk, expr)
}

/** Every path fact goes: what a call or a `new` leaves. */
const forgetPaths = (walk: BoundsWalk, state: State): void => {
  for (const path of walk.paths) {
    forget(state, path.holder)
  }
}

/** Whether a whole-record store of `stored` (`recordStoreType`) can rewrite a field `path` reads. */
const recordRewritesPath = (stored: i32, path: PathHolder): boolean => {
  for (const link of path.links) {
    if (recordReaches(stored, link)) {
      return true
    }
  }
  return false
}

/** The facts of every path a whole-record store of `stored` can rewrite a link of. */
const forgetPathsRecord = (walk: BoundsWalk, state: State, stored: i32): void => {
  for (const path of walk.paths) {
    if (recordRewritesPath(stored, path)) {
      forget(state, path.holder)
    }
  }
}

/**
 * What a call leaves: every array length, a callee holding the same array may
 * move `len`; and every path, string or array, because a callee can store to
 * any field it can reach. Array-typed paths go in the first half as well,
 * which is harmless; the second is what takes the string ones.
 */
const forgetCallEffects = (walk: BoundsWalk, state: State): void => {
  forgetArrayLengths(walk.ctx, state)
  forgetPaths(walk, state)
}

/**
 * The facts of every path that names `field` on any link. By name and not by
 * struct type, so a store through a second holder of the same object is
 * caught without the walk knowing the two alias.
 */
const forgetPathsThrough = (walk: BoundsWalk, state: State, field: string): void => {
  for (const path of walk.paths) {
    if (path.fields.indexOf(field) >= 0) {
      forget(state, path.holder)
    }
  }
}

/** `v` is rebound: its own facts go, and so does every path rooted at it. */
const forgetLocal = (walk: BoundsWalk, state: State, v: Local): void => {
  forget(state, v)
  for (const path of walk.paths) {
    if (path.root === v) {
      forget(state, path.holder)
    }
  }
}

/**
 * Integer types only. An `f64` index is truncated toward zero by `fptosi`, and
 * a proof about the double is not a proof about the truncation once `NaN` and
 * the values past `2^63` are in the picture, so `--number-mode f64` gets the
 * constant-index proofs and nothing else. A ranged integer is an `i32` in
 * both modes (WP31 §5), so it keeps the proofs an `i32` gets.
 */
const isIndexType = (table: TypeTable, type: i32): boolean =>
  type === T_I32 || type === T_I64 || isUnsigned(type) || table.isRanged(type)

/** A local that can be an index: an integer, signed, unsigned or ranged. */
const indexLocal = (ctx: CheckContext, expr: Node): Local | null => {
  const v = localOf(ctx.program, expr)
  if (v === null || !isIndexType(ctx.table, v.type)) {
    return null
  }
  return v
}

/** An index local and the literal added to it: `i + c`, as `offsetIndex` reads it. */
export class Offset {
  v: Local
  c: i32

  constructor(v: Local, c: i32) {
    this.v = v
    this.c = c
  }
}

/**
 * `i + c` or `c + i`, with `c` a literal of 1 or more and `i` an index local:
 * the second, third and fourth element of a loop that reads several a pass.
 * Only where the sum is exact. A signed add is checked or proven unless
 * `--wrapping` is given, so outside it `i + c` either panics or is the true
 * sum, never a wrap to a small value, and a fact or an access stated about
 * the sum is one about `i`. Under `--wrapping`, and for an unsigned `i`, whose
 * add wraps by definition, there is no such sum, and nothing is read.
 */
export const offsetIndex = (ctx: CheckContext, expr: Node): Offset | null => {
  const e = unwrapBoundsParens(expr)
  if (ctx.wrapping || e.kind !== N_BINARY || e.text !== "+" || !checksOverflow(ctx.program, ctx.table, e)) {
    return null
  }
  const left = indexLocal(ctx, e.children[0])
  const right = indexLocal(ctx, e.children[1])
  if (left !== null && literalValue(e.children[1]) >= 1) {
    return new Offset(left, literalValue(e.children[1]))
  }
  if (right !== null && literalValue(e.children[0]) >= 1) {
    return new Offset(right, literalValue(e.children[0]))
  }
  return null
}

/**
 * Whether `call` is the builtin `toI32` itself, resolved the way the checker
 * resolved it: a plain identifier with no user function behind it
 * (`nodeCallees` is `null` only for a builtin) and no `nish:` import
 * renaming another builtin to that spelling (`nodeBuiltins` is `""`). A user
 * function called `toI32` wins over the builtin, and it may answer anything,
 * so the spelling alone is never trusted.
 */
const isBuiltinToI32 = (program: CheckedProgram, call: Node): boolean =>
  isBuiltinConversion(program, call, "toI32")

/** `isBuiltinToI32`'s question about any one-argument builtin conversion. */
const isBuiltinConversion = (program: CheckedProgram, call: Node, name: string): boolean => {
  const callee = call.children[0]
  return (
    callee.kind === N_IDENT &&
    callee.text === name &&
    program.nodeCallees[call.id] === null &&
    program.nodeBuiltins[call.id] === "" &&
    call.children[1].children.length === 1
  )
}

/**
 * The range `toI32(x)` lands in when `x`'s type declares one that fits in
 * `i32` (WP31 §8), or `null`. `u8` and `u16` widen with `zext`, and a ranged
 * value is already the `i32` it converts to, so the declaration bounds the
 * result. `u32` and `u64` declare a range past `INT_MAX`, where the
 * conversion keeps the low 32 bits and reads them signed, so they state
 * nothing here.
 */
const convertedRange = (walk: BoundsWalk, expr: Node): DeclaredRange | null => {
  const e = unwrapBoundsParens(expr)
  if (e.kind !== N_CALL || !isBuiltinToI32(walk.ctx.program, e)) {
    return null
  }
  const declared = walk.ctx.table.declaredRange(walk.ctx.program.nodeTypes[e.children[1].children[0].id])
  return declared !== null && declared.hi <= I32_MAX ? declared : null
}

/**
 * `w.length` on a local or a path: the expression a bound is stated against.
 *
 * `toI32(w.length)` is accepted as the same expression, because every fact
 * this file draws from a length needs only `0 <= value <= w.length`, and the
 * conversion keeps both. In i32 mode `.length` is already an `i32` and the
 * conversion is the identity. Under `--number-mode f64` `.length` is the
 * `sitofp` of the header's `i64`, exact below `2^53`, and `toI32` lowers it
 * with the saturating `llvm.fptosi.sat.i32.f64`: the answer is the length
 * itself, or `2^31 - 1` for a longer one — never negative and never past the
 * length. That is what lets a program, `std/text` among them, hoist
 * `const n: i32 = toI32(s.length)`, the one spelling that compiles in both
 * modes, and keep the proof `const n = s.length` gets. Only `toI32`: another
 * target changes the type the facts are stated in, and nothing asks for it.
 */
const lengthOf = (walk: BoundsWalk, expr: Node): Local | null => {
  let e = unwrapBoundsParens(expr)
  if (e.kind === N_CALL && isBuiltinToI32(walk.ctx.program, e)) {
    e = unwrapBoundsParens(e.children[1].children[0])
  }
  if (e.kind !== N_MEMBER || e.text !== "length") {
    return null
  }
  return holderOf(walk, e.children[0])
}

/**
 * The `u8`, `u16` or `u32` local `expr` reads, alone or through `toU32`: the
 * index side of the unsigned guard `toU32(i) < toU32(w.length)`, whose
 * compare is a `u32` one. `toU32` widens a `u8` or `u16` with `zext` and is
 * the identity on a `u32`, so the compared value is the index's own. A `u64`
 * is not one: `toU32` keeps its low 32 bits, which may be below the length
 * while the index is not.
 */
const unsignedIndexOf = (ctx: CheckContext, expr: Node): Local | null => {
  let e = unwrapBoundsParens(expr)
  if (e.kind === N_CALL && isBuiltinConversion(ctx.program, e, "toU32")) {
    e = e.children[1].children[0]
  }
  const v = localOf(ctx.program, e)
  if (v === null || (v.type !== T_U8 && v.type !== T_U16 && v.type !== T_U32)) {
    return null
  }
  return v
}

/**
 * `toU32(w.length)`: the length side of the unsigned guard, and the one
 * spelling of a length an unsigned index compares with in both number modes.
 * A length is a non-negative `i32` in i32 mode, which `toU32` keeps as it is,
 * and an `f64` under `--number-mode f64`, which it lowers with the saturating
 * `llvm.fptoui.sat`: never past the length, so `i < toU32(w.length)` is
 * `i < w.length` or stronger. It is accepted in the guard alone, not where
 * `lengthOf` is, because a fact stated about a `u32` copy of a length would
 * meet unsigned arithmetic that wraps at zero (`toU32(w.length) - 1`).
 */
const unsignedLengthOf = (walk: BoundsWalk, expr: Node): Local | null => {
  const e = unwrapBoundsParens(expr)
  if (e.kind !== N_CALL || !isBuiltinConversion(walk.ctx.program, e, "toU32")) {
    return null
  }
  return lengthOf(walk, e.children[1].children[0])
}

/**
 * The non-negative integer a literal denotes, or -1. Written as decimal digits
 * only: `0x10` and `1_0` are normalised differently by the two front ends, and
 * a bound that only one compiler folds is a bound that makes the two disagree
 * about a bounds check.
 */
const literalValue = (expr: Node): i32 => {
  const e = unwrapBoundsParens(expr)
  if (e.kind !== N_NUMBER) {
    return -1
  }
  const written = e.text
  if (written.length === 0) {
    return -1
  }
  let value: i64 = 0
  let k = 0
  while (k < written.length) {
    const c = written.charCodeAt(k)
    if (c < 48 || c > 57) {
      return -1
    }
    value = value * toI64(10) + toI64(c - 48)
    // Bounds live in `i32` at the source level; a literal past that is not a
    // bound anybody wrote on purpose. `INT_MAX` itself is left out too, so that
    // `n + 1`, which every caller computes from a literal, is still an `i32`:
    // the compiler's own arithmetic is checked like any program's. Bailing out here rather than after the
    // last digit is also what keeps the `i64` fold from overflowing on a long
    // run of digits, which would be undefined behaviour inside the very check
    // that is deciding whether a program is safe.
    if (value >= I32_MAX) {
      return -1
    }
    k = k + 1
  }
  return toI32(value)
}

/** `-1` as written: a minus sign before the literal `1`. */
const isMinusOne = (expr: Node): boolean => {
  const e = unwrapBoundsParens(expr)
  return e.kind === N_UNARY && e.text === "-" && literalValue(e.children[0]) === 1
}

/**
 * The values `expr` can have whatever the state says, or `null` when only a
 * fact could tell: one value for a literal, a negated literal or a folded
 * integer constant, and the declared range of a ranged or unsigned type.
 */
const declaredValueRange = (ctx: CheckContext, expr: Node): DeclaredRange | null => {
  const e = unwrapBoundsParens(expr)
  const n = literalValue(e)
  if (n >= 0) {
    return new DeclaredRange(toI64(n), toI64(n))
  }
  if (e.kind === N_UNARY && e.text === "-") {
    const negated = literalValue(e.children[0])
    if (negated >= 0) {
      return new DeclaredRange(toI64(-negated), toI64(-negated))
    }
  }
  if (e.kind === N_IDENT) {
    const constant = ctx.program.nodeConstants[e.id]
    if (constant !== null && constant.folded && isInteger(constant.type)) {
      return new DeclaredRange(constant.intValue, constant.intValue)
    }
  }
  return ctx.table.declaredRange(ctx.program.nodeTypes[e.id])
}

/** Whether no value `range` allows is `n`. */
const rangeExcludes = (range: DeclaredRange | null, n: i64): boolean =>
  range !== null && (range.lo > n || range.hi < n)

/**
 * Whether `dividend / divisor` cannot fail: the divisor is not zero, and the
 * signed overflow `MIN / -1` cannot happen because the divisor is not `-1` or
 * the dividend is not negative. Each half comes from what the expression is —
 * a literal, a constant, a declared range, which is how an unsigned divisor
 * is never `-1` — or from a guard on a local: `d > 0`, or `d !== 0` and
 * `d !== -1` (`FACT_EXCLUDES`).
 */
const provesDivisor = (walk: BoundsWalk, state: State, dividend: Node, divisor: Node): boolean => {
  const ctx = walk.ctx
  const range = declaredValueRange(ctx, divisor)
  const d = indexLocal(ctx, divisor)
  const zero: i64 = 0
  const minusOne: i64 = -1
  const nonZero =
    rangeExcludes(range, zero) || (d !== null && (minValueOf(state, d) >= 1 || knownExcludes(state, d, 0)))
  if (!nonZero) {
    return false
  }
  if (
    rangeExcludes(range, minusOne) ||
    (d !== null && (knownNonNegative(state, d) || knownExcludes(state, d, -1)))
  ) {
    return true
  }
  const top = declaredValueRange(ctx, dividend)
  const x = indexLocal(ctx, dividend)
  return (top !== null && top.lo >= zero) || (x !== null && knownNonNegative(state, x))
}

/**
 * Record the verdict for an integer `/`, `%`, `/=` or `%=` at `node`, judged
 * in the state its divisor has been evaluated in, which is where the emitter
 * writes the check. A proof goes into `nodeProvenIndex`, beside the accesses',
 * and `emitIntBinary` leaves the check out.
 */
const judgeDivision = (walk: BoundsWalk, state: State, node: Node): void => {
  // Only pass 2 judges a divisor, as only it judges a range entry: the
  // whole-program walks of `src/ranges.ts` revisit only the bodies an access
  // keeps open, so a proof drawn there would depend on which those were.
  if (walk.tables !== null) {
    return
  }
  const op = node.text
  if (op !== "/" && op !== "%" && op !== "/=" && op !== "%=") {
    return
  }
  const ctx = walk.ctx
  const left = ctx.program.nodeTypes[node.children[0].id]
  if (left < 0 || !isInteger(ctx.table.baseOf(left))) {
    return
  }
  if (!provesDivisor(walk, state, node.children[0], node.children[1])) {
    return
  }
  noteProof(walk, node)
}

/** A check proved away at `node`: into the side table, or aside until the caller commits it. */
const noteProof = (walk: BoundsWalk, node: Node): void => {
  if (!walk.ctx.program.nodeProvenIndex[node.id]) {
    walk.proved.push(node)
    if (walk.record) {
      walk.ctx.program.nodeProvenIndex[node.id] = true
    }
  }
}

/** `xs.pop()` on an array receiver, which panics on an empty array (`emitPop`). */
const isArrayPop = (ctx: CheckContext, call: Node): boolean => {
  const callee = unwrapBoundsParens(call.children[0])
  if (callee.kind !== N_MEMBER || callee.text !== "pop" || call.children[1].children.length > 0) {
    return false
  }
  return ctx.table.isArray(ctx.program.nodeTypes[callee.children[0].id])
}

/**
 * Record the verdict for a `pop`: proven where its receiver is known to hold
 * an element, which `if (xs.length > 0)` says. Pass 2 alone judges it. Under `--unchecked-indexing`
 * there is no check to leave out, and the site stays unproven
 * (`src/panics.ts`), as an index does.
 */
const judgePop = (walk: BoundsWalk, state: State, call: Node): void => {
  if (walk.tables !== null) {
    return // pass 2 only, as `judgeDivision` says
  }
  const holder = holderOf(walk, unwrapBoundsParens(call.children[0]).children[0])
  if (holder !== null && knownMinLength(state, holder, 1)) {
    noteProof(walk, call)
  }
}

// ---- Conditions -------------------------------------------------------------------

/**
 * The value of an integer literal in any radix, or -1 for anything else. The
 * overflow ranges read it; `literalValue`, which the bounds proofs read, stays
 * decimal-only so that the accesses it proves are the ones it proved before.
 * A literal the checker accepted fits its type, so a value read here past
 * `i64` (which `parseIntegerLiteral` wraps) is never one an `i32` operand holds.
 */
const anyLiteral = (expr: Node): i64 => {
  const e = unwrapBoundsParens(expr)
  if (e.kind !== N_NUMBER) {
    return toI64(-1)
  }
  return parseIntegerLiteral(e.text)
}

/** The local `v` when `expr` is `v * v` at `i32`, the shape a loop bounded by a square root is written in. */
const squaredLocal = (ctx: CheckContext, expr: Node): Local | null => {
  const e = unwrapBoundsParens(expr)
  if (e.kind !== N_BINARY || e.text !== "*" || ctx.wrapping) {
    return null
  }
  const a = indexLocal(ctx, e.children[0])
  const b = indexLocal(ctx, e.children[1])
  if (a === null || b === null) {
    return null
  }
  return a === b && ctx.table.baseOf(a.type) === T_I32 ? a : null
}

/** `floor(sqrt(n))` for `0 <= n < 2^31`, by bisection, so no float rounding decides a bound. */
const squareRootFloor = (n: i32): i32 => {
  let lo: i64 = 0
  let hi: i64 = 46341
  while (lo < hi) {
    const mid: i64 = (lo + hi + toI64(1)) >> toI64(1)
    if (mid * mid <= toI64(n)) {
      lo = mid
    } else {
      hi = mid - toI64(1)
    }
  }
  return toI32(lo)
}

/**
 * What `lo < hi` (or `lo <= hi`) proves. Four shapes carry a bound worth
 * recording; everything else says nothing this domain can hold.
 */
const orderFacts = (walk: BoundsWalk, state: State, lo: Node, hi: Node, strict: boolean): Fact[] => {
  const ctx = walk.ctx
  const out: Fact[] = []
  const loVar = indexLocal(ctx, lo)
  const hiVar = indexLocal(ctx, hi)
  const loConst = literalValue(lo)
  const hiConst = literalValue(hi)
  const hiLength = lengthOf(walk, hi)

  // `i < w.length`: the fact the whole analysis is built around.
  if (loVar !== null && hiLength !== null && strict) {
    out.push(new Fact(FACT_BELOW, loVar, hiLength, 0))
  }
  // `i + c < w.length`, `i + c < n` with `n` a hoisted length, and `i + c < N`
  // for a literal `N`: the guard of a loop that reads `c + 1` elements a pass.
  // The sum is exact (`offsetIndex`), so the bound is one on `i`, `c` short of
  // the plain one. A non-strict compare reaches one less, and nothing at all
  // past a length when `c` is 0, which `offsetIndex` does not answer.
  const loOffset = offsetIndex(ctx, lo)
  if (loOffset !== null) {
    const reach = strict ? loOffset.c : loOffset.c - 1
    if (hiLength !== null) {
      out.push(new Fact(FACT_BELOW, loOffset.v, hiLength, reach))
    }
    if (hiVar !== null) {
      // `n <= w.length` passes the reach on as it is, and `n < w.length` one further.
      for (const above of holdersAbove(state, hiVar)) {
        out.push(new Fact(FACT_BELOW, loOffset.v, above, knownBelow(state, hiVar, above) ? reach + 1 : reach))
      }
    }
    if (hiConst >= 0) {
      const bound = (strict ? hiConst : hiConst + 1) - loOffset.c
      if (bound >= 1) {
        out.push(new Fact(FACT_MAX_INDEX, loOffset.v, null, bound))
      }
    }
  }
  // `toU32(i) < toU32(w.length)`: the same fact, for the unsigned index that
  // cannot be compared with the `i32` length as it is.
  const unsignedVar = unsignedIndexOf(ctx, lo)
  const unsignedLength = unsignedLengthOf(walk, hi)
  if (unsignedVar !== null && unsignedLength !== null && strict) {
    out.push(new Fact(FACT_BELOW, unsignedVar, unsignedLength, 0))
  }
  // `i < n` / `i <= n`.
  if (loVar !== null && hiConst >= 0) {
    out.push(new Fact(FACT_MAX_INDEX, loVar, null, strict ? hiConst : hiConst + 1))
  }
  // `i < e` for any `e` at all: an `i32` that is less than another `i32` is at
  // most `INT_MAX - 1`, which is `maxIndex(i, INT_MAX)`. No access is proved
  // by a bound that large, but it is what proves `i + 1` cannot overflow in
  // `for (let i = 0; i < n; i++)` whatever `n` is (`judgeOverflow`). Only at
  // `i32`, the one width whose top fits the family; an `i64` `i < n` says
  // nothing it can hold.
  if (loVar !== null && strict && hiConst < 0 && ctx.table.baseOf(loVar.type) === T_I32) {
    out.push(new Fact(FACT_MAX_INDEX, loVar, null, toI32(I32_MAX)))
  }
  // `n < i` / `n <= i`: a lower bound. Zero is the one an access needs, and a
  // floor above it is what lets `i - 1` keep one.
  if (hiVar !== null && loConst >= 0) {
    out.push(new Fact(FACT_NON_NEGATIVE, hiVar, null, 0))
    out.push(new Fact(FACT_MIN_VALUE, hiVar, null, strict ? loConst + 1 : loConst))
  }
  // `n < w.length` / `n <= w.length`: §2.2's length guard.
  if (loConst >= 0 && hiLength !== null) {
    out.push(new Fact(FACT_MIN_LENGTH, hiLength, null, strict ? loConst + 1 : loConst))
  }
  // `i <= w.length`, which is not a proof on its own but is what a later
  // `k < i` needs to become `k < w.length`.
  if (loVar !== null && hiLength !== null && !strict) {
    out.push(new Fact(FACT_AT_MOST, loVar, hiLength, 0))
  }
  // `i * i <= n` with `n` below a literal: `|i|` is at most the square root.
  // The product was checked or proven where the condition ran, so it is the
  // true square — which is what lets a sieve's `j += i` be proven under
  // `for (let i = 2; i * i <= n; i++)`.
  const root = squaredLocal(ctx, lo)
  if (root !== null) {
    let ceiling = hiConst >= 0 ? hiConst + 1 : -1
    if (hiVar !== null) {
      ceiling = maxIndexOf(state, hiVar)
    }
    if (ceiling >= 1) {
      // `i * i < ceiling` (or `<= ceiling - 1`), so `i <= isqrt(ceiling - 1)`.
      out.push(new Fact(FACT_MAX_INDEX, root, null, squareRootFloor(ceiling - 1) + 1))
    }
  }
  // `i < n` / `i <= n` where `n` is below a literal: `i` is below it too, one
  // further for a strict compare. It is what bounds a loop over a parameter
  // every caller passes a literal for (`src/ranges.ts`).
  if (loVar !== null && hiVar !== null) {
    const bound = maxIndexOf(state, hiVar)
    const below = strict ? bound - 1 : bound
    if (bound >= 0 && below >= 1) {
      out.push(new Fact(FACT_MAX_INDEX, loVar, null, below))
    }
  }
  // `i < n` where `n` is itself bounded by a length: the hoisted-length loop.
  // Transitivity is applied here, at the point the condition is evaluated,
  // rather than stored as a rule, so the resulting `below` is invalidated by
  // everything that invalidates a `below`.
  if (loVar !== null && hiVar !== null && strict) {
    for (const above of holdersAbove(state, hiVar)) {
      out.push(new Fact(FACT_BELOW, loVar, above, 0))
    }
  }
  // A `w.length` on the low side bounds the length from *above*, which proves
  // no access, so there is deliberately no further shape here.
  return out
}

/** What `a === b` proves: a literal pins an index's range and a length's floor. */
const equalityFacts = (walk: BoundsWalk, left: Node, right: Node): Fact[] => {
  const out: Fact[] = []
  addEqualityFacts(walk, out, left, right)
  addEqualityFacts(walk, out, right, left)
  return out
}

const addEqualityFacts = (walk: BoundsWalk, out: Fact[], value: Node, other: Node): void => {
  const n = literalValue(other)
  if (n < 0) {
    return
  }
  const v = indexLocal(walk.ctx, value)
  if (v !== null) {
    out.push(new Fact(FACT_MIN_VALUE, v, null, n))
    out.push(new Fact(FACT_MAX_INDEX, v, null, n + 1))
  }
  const holder = lengthOf(walk, value)
  if (holder !== null) {
    out.push(new Fact(FACT_MIN_LENGTH, holder, null, n))
  }
}

/**
 * What `a !== b` proves where it holds: nothing on its own, but a literal at
 * one end of a range already known moves that end in by one. `n !== 0` on a
 * non-negative `n` is `n >= 1`, which is what makes `n - 1` a valid index in
 * the recursion that counts `n` down, and `i !== n` on an `i <= n` is `i < n`.
 */
const disequalityFacts = (walk: BoundsWalk, state: State, left: Node, right: Node): Fact[] => {
  const out: Fact[] = []
  addDisequalityFacts(walk, state, out, left, right)
  addDisequalityFacts(walk, state, out, right, left)
  return out
}

const addDisequalityFacts = (walk: BoundsWalk, state: State, out: Fact[], value: Node, other: Node): void => {
  const n = literalValue(other)
  const v = indexLocal(walk.ctx, value)
  if (v === null) {
    return
  }
  // `d !== 0` and `d !== -1` are what a divisor needs (`provesDivisor`), and
  // neither is a bound, so they are kept apart from the families above.
  if (n === 0 || isMinusOne(other)) {
    out.push(new Fact(FACT_EXCLUDES, v, null, n === 0 ? 0 : -1))
  }
  if (n < 0) {
    return
  }
  if (minValueOf(state, v) === n) {
    out.push(new Fact(FACT_MIN_VALUE, v, null, n + 1))
  }
  if (n > 0 && maxIndexOf(state, v) === n + 1) {
    out.push(new Fact(FACT_MAX_INDEX, v, null, n))
  }
}

const factsFrom = (whenTrue: Fact[], whenFalse: Fact[]): ConditionFacts => {
  const out = new ConditionFacts()
  out.whenTrue = whenTrue
  out.whenFalse = whenFalse
  return out
}

/**
 * What a condition proves where it holds and where it does not. The boolean
 * algebra is the narrowing engine's: `a && b` proves both only when it is
 * true, `a || b` proves both negations only when it is false, and `!` swaps
 * the two halves.
 */
const conditionFacts = (walk: BoundsWalk, state: State, cond: Node): ConditionFacts => {
  const expr = unwrapBoundsParens(cond)
  if (expr.kind === N_UNARY && expr.text === "!") {
    const inner = conditionFacts(walk, state, expr.children[0])
    return factsFrom(inner.whenFalse, inner.whenTrue)
  }
  if (expr.kind !== N_BINARY) {
    return new ConditionFacts()
  }
  const op = expr.text
  const left = expr.children[0]
  const right = expr.children[1]
  if (op === "&&") {
    const l = conditionFacts(walk, state, left)
    const r = conditionFacts(walk, state, right)
    return factsFrom(concatFacts(survivingFacts(walk, l.whenTrue, right), r.whenTrue), [])
  }
  if (op === "||") {
    const l = conditionFacts(walk, state, left)
    const r = conditionFacts(walk, state, right)
    return factsFrom([], concatFacts(survivingFacts(walk, l.whenFalse, right), r.whenFalse))
  }
  if (op === "===") {
    return factsFrom(equalityFacts(walk, left, right), disequalityFacts(walk, state, left, right))
  }
  if (op === "!==") {
    return factsFrom(disequalityFacts(walk, state, left, right), equalityFacts(walk, left, right))
  }
  // `a < b` is false exactly when `b <= a`, and so on around the four
  // relations: each one proves something on both sides of the branch.
  if (op === "<") {
    return factsFrom(orderFacts(walk, state, left, right, true), orderFacts(walk, state, right, left, false))
  }
  if (op === "<=") {
    return factsFrom(orderFacts(walk, state, left, right, false), orderFacts(walk, state, right, left, true))
  }
  if (op === ">") {
    return factsFrom(orderFacts(walk, state, right, left, true), orderFacts(walk, state, left, right, false))
  }
  if (op === ">=") {
    return factsFrom(orderFacts(walk, state, right, left, false), orderFacts(walk, state, left, right, true))
  }
  return new ConditionFacts()
}

/**
 * What of `facts` still holds once `later` has run: the left operand's half of
 * `a && b` and `a || b`, which is evaluated *before* the right operand and
 * has to survive whatever the right operand does.
 *
 * The walk applies the right operand's effects as it goes, but every caller
 * then adds the whole condition's facts back from the syntax, after the walk,
 * so a fact the right operand killed came back to life:
 * `i < this.items.length && this.trim()` proved `this.items[i]` after `trim`
 * had popped, and `i < xs.length && xs.pop() > 0` did the same to a local.
 * This drops those facts by the same rules that prune a loop's entry state,
 * because "everything `later` can do" is exactly what `forgetAcross` models.
 */
const survivingFacts = (walk: BoundsWalk, facts: Fact[], later: Node): Fact[] => {
  if (facts.length === 0) {
    return facts
  }
  const scratch = new State(walk.ctx.table)
  addFacts(scratch, facts)
  forgetAcross(walk, scratch, later)
  return factsOf(scratch)
}

/** The facts `state` holds, as the facts that would rebuild it. */
const factsOf = (state: State): Fact[] => {
  const out: Fact[] = []
  for (const v of state.nonNegative) {
    out.push(new Fact(FACT_NON_NEGATIVE, v, null, 0))
  }
  let k = 0
  while (k < state.belowIndex.length) {
    out.push(new Fact(FACT_BELOW, state.belowIndex[k], state.belowHolder[k], state.belowOffset[k]))
    k = k + 1
  }
  k = 0
  while (k < state.atMostIndex.length) {
    out.push(new Fact(FACT_AT_MOST, state.atMostIndex[k], state.atMostHolder[k], 0))
    k = k + 1
  }
  k = 0
  while (k < state.maxIndexVar.length) {
    out.push(new Fact(FACT_MAX_INDEX, state.maxIndexVar[k], null, state.maxIndexValue[k]))
    k = k + 1
  }
  k = 0
  while (k < state.minLengthVar.length) {
    out.push(new Fact(FACT_MIN_LENGTH, state.minLengthVar[k], null, state.minLengthValue[k]))
    k = k + 1
  }
  k = 0
  while (k < state.minValueVar.length) {
    out.push(new Fact(FACT_MIN_VALUE, state.minValueVar[k], null, state.minValueValue[k]))
    k = k + 1
  }
  k = 0
  while (k < state.excludedVar.length) {
    out.push(new Fact(FACT_EXCLUDES, state.excludedVar[k], null, state.excludedValue[k]))
    k = k + 1
  }
  return out
}

const concatFacts = (a: Fact[], b: Fact[]): Fact[] => {
  const out: Fact[] = []
  for (const f of a) {
    out.push(f)
  }
  for (const f of b) {
    out.push(f)
  }
  return out
}

// ---- Assignments ------------------------------------------------------------------

/**
 * `v = v + <non-negative literal>` and its spellings. An increment can only
 * move `v` away from zero, so the lower bound survives it — but only with
 * `nsw` on, where passing `INT_MAX` is undefined behaviour the compiler may
 * assume away. `--wrapping` *defines* that step to land on `INT_MIN`, and a
 * lower bound a documented wrap can break is not a proof.
 */
const isIncrement = (program: CheckedProgram, v: Local, rhs: Node): boolean => {
  const e = unwrapBoundsParens(rhs)
  if (e.kind !== N_BINARY || e.text !== "+") {
    return false
  }
  const left = localOf(program, e.children[0])
  const right = localOf(program, e.children[1])
  if (left !== null && left === v) {
    return literalValue(e.children[1]) >= 0
  }
  if (right !== null && right === v) {
    return literalValue(e.children[0]) >= 0
  }
  return false
}

const keepsLowerBound = (ctx: CheckContext, v: Local): boolean => !ctx.wrapping || isUnsigned(v.type)

/**
 * `v = v - <non-negative literal>`, the mirror of `isIncrement`. Only the left
 * operand may be `v`: `c - v` moves the other way.
 */
const isDecrement = (program: CheckedProgram, v: Local, rhs: Node): boolean => {
  const e = unwrapBoundsParens(rhs)
  if (e.kind !== N_BINARY || e.text !== "-") {
    return false
  }
  const left = localOf(program, e.children[0])
  return left !== null && left === v && literalValue(e.children[1]) >= 0
}

/**
 * Whether a decrement of `v` keeps its upper bounds. `v - c <= v` unless the
 * subtraction wraps past `INT_MIN` to the top of the range, which `nsw` makes
 * undefined behaviour the compiler may assume away and `--wrapping` defines;
 * `known` is the caller's word that `v >= 0` there, which rules the wrap out
 * either way. An unsigned `v` wraps at zero by definition, so it never keeps
 * one.
 */
const keepsUpperBound = (ctx: CheckContext, v: Local, known: boolean): boolean =>
  !isUnsigned(v.type) && isIndexType(ctx.table, v.type) && (!ctx.wrapping || known)

/**
 * The facts `v = <local> - c` and `v = <local>` give `v`, read off what the
 * state knows about the local. Removing `c` lowers every floor by `c` — so a
 * floor of at least `c` leaves `v` non-negative — and every upper bound too,
 * which with `c >= 1` turns `w <= xs.length` into `v < xs.length`. The upper
 * half needs the subtraction not to wrap (`keepsUpperBound`).
 */
const differenceFacts = (walk: BoundsWalk, state: State, v: Local, w: Local, c: i32, out: Fact[]): void => {
  const floor = minValueOf(state, w)
  if (floor >= c) {
    out.push(new Fact(FACT_MIN_VALUE, v, null, floor - c))
  }
  if (c > 0 && !keepsUpperBound(walk.ctx, w, floor >= c)) {
    return
  }
  const max = maxIndexOf(state, w)
  if (max >= 0 && max - c >= 1) {
    out.push(new Fact(FACT_MAX_INDEX, v, null, max - c))
  }
  for (const above of holdersAbove(state, w)) {
    if (c >= 1 || knownBelow(state, w, above)) {
      out.push(new Fact(FACT_BELOW, v, above, 0))
    } else {
      out.push(new Fact(FACT_AT_MOST, v, above, 0))
    }
  }
}

/**
 * Whether the value of `expr` cannot be negative. A literal and a `.length`
 * say so outright, a variable says so when the state does, and a sum says so
 * when both ends do — under `nsw`, where a sum that would pass `INT_MAX` is
 * undefined behaviour rather than a wrap into the negatives. That last rule is
 * what gives `let j = i + 1` its lower bound, which is half of every proof
 * about a second cursor.
 */
const impliesNonNegative = (walk: BoundsWalk, state: State, expr: Node): boolean => {
  const ctx = walk.ctx
  const e = unwrapBoundsParens(expr)
  if (literalValue(e) >= 0) {
    return true
  }
  if (lengthOf(walk, e) !== null) {
    return true
  }
  const converted = convertedRange(walk, e)
  if (converted !== null) {
    return converted.lo >= 0
  }
  const v = localOf(ctx.program, e)
  if (v !== null) {
    return isIndexType(ctx.table, v.type) && knownNonNegative(state, v)
  }
  if (e.kind !== N_BINARY || e.text !== "+") {
    return false
  }
  const type = ctx.program.nodeTypes[e.id]
  if (ctx.wrapping && !(type >= 0 && isUnsigned(type))) {
    return false
  }
  return impliesNonNegative(walk, state, e.children[0]) && impliesNonNegative(walk, state, e.children[1])
}

/**
 * What a value gives the variable it is written into: a non-negative value
 * pins the lower end, a literal pins the upper one too, a `.length` bounds the
 * variable by that length, a copy or a difference carries the bounds of the
 * local it is taken from (`differenceFacts`), and an array of known size
 * starts with that many elements.
 */
const initialiserFacts = (walk: BoundsWalk, state: State, v: Local, init: Node): Fact[] => {
  const ctx = walk.ctx
  const out: Fact[] = []
  const e = unwrapBoundsParens(init)
  if (isIndexType(ctx.table, v.type) && impliesNonNegative(walk, state, e)) {
    out.push(new Fact(FACT_NON_NEGATIVE, v, null, 0))
  }
  const n = literalValue(e)
  if (n >= 0 && isIndexType(ctx.table, v.type)) {
    out.push(new Fact(FACT_MIN_VALUE, v, null, n))
    out.push(new Fact(FACT_MAX_INDEX, v, null, n + 1))
    return out
  }
  const holder = lengthOf(walk, e)
  if (holder !== null && isIndexType(ctx.table, v.type)) {
    // `const n = xs.length` is the hoist everybody is told to write, and this
    // is the fact that keeps it as fast as the loop that re-reads the length.
    out.push(new Fact(FACT_AT_MOST, v, holder, 0))
    return out
  }
  // `const k = toI32(b)` on a `u8` is below 256 for the reason `b` is: the
  // type cannot hold anything else (WP31 §8).
  const converted = convertedRange(walk, e)
  if (converted !== null && isIndexType(ctx.table, v.type)) {
    if (converted.hi >= toI64(-1) && converted.hi < I32_MAX) {
      out.push(new Fact(FACT_MAX_INDEX, v, null, toI32(converted.hi) + 1))
    }
    return out
  }
  if (!isIndexType(ctx.table, v.type)) {
    return initialiserArrayFacts(ctx, v, e, out)
  }
  // `let j = i`: the copy has every bound the original has.
  // A ranged local and an `i32` are one value with one base, so a copy between
  // them carries the bounds too.
  const copied = indexLocal(ctx, e)
  if (copied !== null && ctx.table.baseOf(copied.type) === ctx.table.baseOf(v.type)) {
    differenceFacts(walk, state, v, copied, 0, out)
    return out
  }
  rangeFacts(walk, state, v, e, out)
  if (e.kind === N_BINARY && e.text === "-") {
    const c = literalValue(e.children[1])
    const w = indexLocal(ctx, e.children[0])
    if (c >= 0 && w !== null && ctx.table.baseOf(w.type) === ctx.table.baseOf(v.type)) {
      differenceFacts(walk, state, v, w, c, out)
    }
    // `xs.length - 1` is the last index, when there is one: no floor, since
    // the array may be empty, but below the length whatever it holds. A
    // length is never negative, so the subtraction cannot wrap.
    const above = lengthOf(walk, e.children[0])
    if (c >= 1 && above !== null) {
      out.push(new Fact(FACT_BELOW, v, above, 0))
    }
  }
  return out
}

/**
 * What the range of a computed value gives the `i32` or `i64` variable it is
 * written into: `const ij = i + j` with both below 3000 is below 5999,
 * `acc = x & 0xffff` is in `[0, 65535]`, and `toI64(i & 1)` is 0 or 1. Only where the arithmetic is checked,
 * because a range drawn through a wrap is not one, and only where `e` writes
 * no local, so that the state describes the values it read.
 */
const rangeFacts = (walk: BoundsWalk, state: State, v: Local, e: Node, out: Fact[]): void => {
  const ctx = walk.ctx
  const base = ctx.table.baseOf(v.type)
  const computed = e.kind === N_BINARY || (e.kind === N_CALL && isBuiltinConversion(ctx.program, e, "toI64"))
  if (ctx.wrapping || (base !== T_I32 && base !== T_I64) || !computed) {
    return
  }
  if (writesAnyLocal(ctx.program, e)) {
    return
  }
  const range = valueRange(walk, state, e, base)
  if (range.lo >= toI64(0) && range.lo < I32_MAX) {
    out.push(new Fact(FACT_MIN_VALUE, v, null, toI32(range.lo)))
  }
  if (range.hi >= toI64(0) && range.hi < I32_MAX - toI64(1)) {
    out.push(new Fact(FACT_MAX_INDEX, v, null, toI32(range.hi) + 1))
  }
}

/** An array of known size starts with that many elements. */
const initialiserArrayFacts = (ctx: CheckContext, v: Local, e: Node, out: Fact[]): Fact[] => {
  if (ctx.table.isArray(v.type) && e.kind === N_ARRAY) {
    out.push(new Fact(FACT_MIN_LENGTH, v, null, e.children.length))
    return out
  }
  if (ctx.table.isArray(v.type) && e.kind === N_NEW && e.children[2].children.length === 1) {
    const size = literalValue(e.children[2].children[0])
    if (size >= 0) {
      out.push(new Fact(FACT_MIN_LENGTH, v, null, size))
    }
  }
  return out
}

// ---- The walk ---------------------------------------------------------------------

/**
 * The analysis in progress. `loops` is only a depth: the warning fires inside
 * a loop and nowhere else, because a check that runs once is not a check
 * anybody is paying for.
 */
export class BoundsWalk {
  ctx: CheckContext
  /** Access nodes whose surviving check is worth a warning, in source order. */
  unproven: Node[]
  /** Range entries whose surviving check is worth a warning (`judgeRange`), in evaluation order. */
  unprovenRanges: Node[]
  loops: i32
  uncheckedIndexing: boolean
  /**
   * The second walk of a body under `--unchecked-indexing` (`proveUnflagged`):
   * it records what an access passes, as the walk without the flag does, but
   * only where the migration leaves the access checked, and keeps nothing but
   * its element-access proofs.
   */
  shadow: boolean
  /**
   * Whether a proof is written to the side tables. `src/ranges.ts` walks a
   * body while its entry facts are still being settled, and a proof drawn from
   * an entry fact that has not settled may not be kept.
   */
  record: boolean
  /** The property paths this body's facts have been keyed by, in first-use order. */
  paths: PathHolder[]
  /**
   * The state at each `continue` of the innermost loop being walked. A
   * `continue` jumps to the `for` update or the `do/while` condition with its
   * branch's effects applied, so those are walked from the join of these and
   * the end of the body rather than from the end of the body alone (#181).
   */
  continues: State[]
  /**
   * The state at each `break` of the innermost loop or `switch` being walked.
   * A `break` leaves a `for` or `while` with the body's writes applied, past
   * the condition that re-established a fact about them, so the state after
   * the loop is the join of these and the condition's exit (#181's `break`
   * counterpart).
   */
  breaks: State[]
  /**
   * What the whole program knows about callees (`src/ranges.ts`), or `null`
   * in pass 2, which runs before every body is checked and so knows nothing:
   * there, any call drops every array length and every path.
   */
  tables: RangeTables | null
  /**
   * The accesses this walk proved that nothing had proved before it, in source
   * order: written to the side table already when `record` is set, and
   * waiting on the caller's word that they may be (`commitProofs`) when not.
   */
  proved: Node[]
  /** The `substring` bounds an unrecorded walk proved, waiting as `proved` does. */
  clamps: Node[]
  /** The arithmetic an unrecorded walk proved cannot overflow, waiting as `proved` does. */
  noOverflow: Node[]
  /**
   * The `slice` bounds this walk proved inside `[0, length]`, for
   * `proveSliceBounds` to record; `null` in every other walk, which judges no
   * `slice` at all.
   */
  sliceClamps: Node[] | null
  /**
   * The `const` string locals this body binds to an ASCII literal, beside the
   * literal's length (`literalStrings` / `literalLengths`, one entry each).
   * Filled only while `sliceClamps` is set, and read by nothing but
   * `judgeSliceBound`: a `const` is never rebound, so the length holds at
   * every use and nothing has to forget it, and keeping it out of `State`
   * keeps it away from the `substring` clamps the emitter folds.
   */
  literalStrings: Local[]
  literalLengths: i32[]
  /** Every call to a function taking entry facts, with what this site proves for it. */
  sites: RangeSite[]
  /** This body's program's callee table (`RangeTables.calleesOf`), or empty in pass 2. */
  callees: i32[]
  /**
   * How many sites the walk may stop after, or -1 to walk to the end. A walk
   * that only collects sites — its body has nothing left to prove — is over
   * once it has noted every call to a candidate there is (`done`).
   */
  /**
   * The summary of this body's returns being gathered (`noteReturn`), stated
   * at its declared return type, or `null` for a walk that gathers none — or
   * that met a return nothing can be said about, after which it gathers no
   * more. `returnParams` is the body's parameters' locals, by position.
   */
  returns: ReturnSummary | null
  returnParams: (Local | null)[]
  stopAfter: i32
  done: boolean
  /**
   * Whether `valueRange` may read a callee's return summary (`callRange`):
   * only while judging an operation (`judgeOverflow`) or gathering a summary
   * (`noteReturn`). No fact, and so no entry or index proof, ever rests on a
   * summary, which keeps the entries of `src/ranges.ts` weakening only.
   */
  callRanges: boolean

  constructor(ctx: CheckContext, uncheckedIndexing: boolean) {
    this.ctx = ctx
    this.unproven = []
    this.unprovenRanges = []
    this.paths = []
    this.continues = []
    this.breaks = []
    this.loops = 0
    this.uncheckedIndexing = uncheckedIndexing
    this.shadow = false
    this.tables = null
    this.record = true
    this.proved = []
    this.clamps = []
    this.noOverflow = []
    this.sliceClamps = null
    this.literalStrings = []
    this.literalLengths = []
    this.sites = []
    this.callees = []
    this.stopAfter = -1
    this.done = false
    this.callRanges = false
    this.returns = null
    this.returnParams = []
  }
}

/** `s.charCodeAt(i)` on a string receiver, which lowers to the same check `a[i]` does. */
const isCharCodeAt = (ctx: CheckContext, call: Node): boolean => {
  const callee = unwrapBoundsParens(call.children[0])
  if (callee.kind !== N_MEMBER || callee.text !== "charCodeAt") {
    return false
  }
  if (call.children[1].children.length !== 1) {
    return false
  }
  return ctx.program.nodeTypes[callee.children[0].id] === T_STRING
}

/**
 * `r.unwrapOr(d)` or `r.expect(m)` on a `Result`, whose one argument
 * `src/emit-result.ts` evaluates on the `Err` path only, or "" for any other
 * call. The names are the checker's (`checkResultMethod` in `src/result.ts`);
 * they are matched here rather than through the emitter's `resultMethodName`,
 * because a checker module does not reach into the emitter.
 */
const lazyResultMethod = (ctx: CheckContext, call: Node): string => {
  const callee = unwrapBoundsParens(call.children[0])
  if (callee.kind !== N_MEMBER || call.children[1].children.length !== 1) {
    return ""
  }
  if (callee.text !== "unwrapOr" && callee.text !== "expect") {
    return ""
  }
  return ctx.table.isResult(ctx.program.nodeTypes[callee.children[0].id]) ? callee.text : ""
}

/**
 * A call that is lowered inline and calls nothing, so it cannot reach an array
 * and move its `len`: the one exception to "any call drops every array length
 * fact". `charCodeAt` is a load. The builtin `toI32` is a cast or one
 * `llvm.fptosi.sat`, and without it `const m: i32 = toI32(ys.length)` would
 * drop the fact `const n: i32 = toI32(xs.length)` recorded one line above.
 * `uncheckedGet` and `uncheckedSet` are the load and the store `xs[i]` and
 * `xs[i] = v` are, less the check (`isUncheckedElementCall`), and without them
 * the rewrite of one access in `a[at[0]] + b[at[1]]` would un-prove the other.
 * The walk and the loop-effect scan both ask this, so they cannot disagree.
 */
export const callsNothing = (ctx: CheckContext, call: Node): boolean =>
  isCharCodeAt(ctx, call) || isBuiltinToI32(ctx.program, call) || isUncheckedElementCall(ctx.program, call)

/**
 * `uncheckedGet(xs, i)` or `uncheckedSet(xs, i, v)` from `nish:unsafe`, by the
 * name it was imported as: `isUncheckedAccess` in `src/emit-util.ts`, spelled
 * again here rather than imported, as `isBoundsAssignment` is. Neither moves a
 * length or a local, and `uncheckedSet` stores only a number (`src/builtins.ts`),
 * which no fact here describes, so neither changes the state. Neither has a
 * check to have passed, either, so neither records one (`recordPassedCheck`).
 */
const isUncheckedElementCall = (program: CheckedProgram, call: Node): boolean => {
  const callee = call.children[0]
  if (
    callee.kind !== N_IDENT ||
    program.nodeCallees[call.id] !== null ||
    call.children[1].children.length === 0
  ) {
    return false
  }
  const imported = program.nodeBuiltins[call.id]
  const name = imported.length > 0 ? imported : callee.text
  return name === "uncheckedGet" || name === "uncheckedSet"
}

/**
 * What an access leaves behind on the path that continues past it: its check
 * either passed or panicked, and `nish_panic_index` is `noreturn`, so from here
 * on `0 <= i < holder.length` — or `holder.length > n` for a literal index. The
 * facts go into the ordinary families, keyed on the ordinary holder, so every
 * invalidation in the header takes them away exactly as it takes away the ones
 * a guard wrote; nothing about them needs a rule of its own.
 *
 * A proven access has no check, and adds only what the state already entails.
 * Under `--unchecked-indexing` there is no check to have passed at all, so
 * nothing is recorded: an out-of-range access there proves nothing, and a
 * fact drawn from one would fold a later `substring` clamp, which that flag
 * leaves alone. The shadow walk records it anyway, for the accesses that keep
 * their check once the flag is gone, because that is what the build without
 * the flag will know there; its facts reach no side table but the one it is
 * asked about (`proveUnflagged`).
 *
 * `passes` is the caller's word that the check reads the array the holder
 * still names once the access is over. Only `a[i] = v` can break that, and the
 * caller says how.
 */
const recordPassedCheck = (walk: BoundsWalk, state: State, node: Node, holder: Local, index: Node): void => {
  if (
    walk.uncheckedIndexing ||
    (walk.shadow && node.kind === N_INDEX && hasUncheckedForm(walk.ctx.program, walk.ctx.table, node))
  ) {
    return
  }
  const constant = literalValue(index)
  if (constant >= 0) {
    addFact(state, new Fact(FACT_MIN_LENGTH, holder, null, constant + 1))
    return
  }
  // A passed `w[i + c]` leaves `i + c < w.length` behind, and nothing about
  // `i >= 0`: the sum can be in range while `i` is not.
  const offset = offsetIndex(walk.ctx, index)
  if (offset !== null) {
    addFact(state, new Fact(FACT_BELOW, offset.v, holder, offset.c))
    return
  }
  const i = indexLocal(walk.ctx, index)
  if (i === null) {
    return
  }
  addFact(state, new Fact(FACT_NON_NEGATIVE, i, null, 0))
  addFact(state, new Fact(FACT_BELOW, i, holder, 0))
}

/**
 * Record the verdict for one access. A proof goes into the side table the
 * emitter reads; the absence of one inside a loop goes on the list the WP15 §8
 * walk reports from, but only for the shape the analysis could have proved —
 * a field receiver or a computed index was never a candidate, and the §8 bar
 * is that a warning names a rewrite rather than a limitation.
 *
 * It is called where the emitter runs the check, so the state it leaves is
 * the one past the check, and `passes` says whether what the check passed on
 * may be recorded there (`recordPassedCheck`). The proof is taken first, from
 * the state before the check, because a check may not prove itself.
 */
const judge = (
  walk: BoundsWalk,
  state: State,
  node: Node,
  receiver: Node,
  index: Node,
  passes: boolean
): void => {
  const ctx = walk.ctx
  const holder = holderOf(walk, receiver)
  if (holder === null) {
    return
  }
  const proven = proves(ctx, state, holder, index)
  if (passes) {
    recordPassedCheck(walk, state, node, holder, index)
  }
  if (proven) {
    noteProof(walk, node)
    return
  }
  // A path receiver is proved when it can be and never warned about: the
  // warning's rewrite is a local, and a field receiver was not a candidate
  // before paths were.
  if (walk.loops === 0 || walk.uncheckedIndexing || lengthHolder(ctx, receiver) === null) {
    return
  }
  // A local and an offset from one are the indices a guard can prove, so they
  // are the ones the warning can name a rewrite for.
  if (indexLocal(ctx, index) === null && offsetIndex(ctx, index) === null) {
    return
  }
  walk.unproven.push(node)
}

/**
 * `s.substring(a)` / `s.substring(a, b)` on a string receiver: the shape whose
 * bounds are clamped rather than checked. Two arguments at most, because that
 * is the arity the checker accepts; a third is already an error and is never
 * judged here.
 */
const isSubstringCall = (ctx: CheckContext, call: Node): boolean => isStringRangeCall(ctx, call, "substring")

/** `s.slice(a)` / `s.slice(a, b)` on a string receiver: checked rather than clamped (`proveSliceBounds`). */
const isSliceCall = (ctx: CheckContext, call: Node): boolean => isStringRangeCall(ctx, call, "slice")

/** A call of the string method `name` with the one or two bounds the checker accepts. */
const isStringRangeCall = (ctx: CheckContext, call: Node, name: string): boolean => {
  const callee = unwrapBoundsParens(call.children[0])
  if (callee.kind !== N_MEMBER || callee.text !== name) {
    return false
  }
  const count = call.children[1].children.length
  if (count < 1 || count > 2) {
    return false
  }
  return ctx.program.nodeTypes[callee.children[0].id] === T_STRING
}

/**
 * `0 <= bound <= holder.length`, which is what makes the clamp a no-op.
 *
 * It is one fact weaker than `proves`, and deliberately so: an *index* has to
 * be below the length to name an element, while a substring bound may equal it
 * — `s.substring(i, s.length)` is an ordinary thing to write. That is exactly
 * what the `atMost` family records, and what `const n = s.length` gives a
 * program for free.
 *
 * A literal `0` is proven with no facts at all, because no string the runtime
 * builds has a negative length. That is not a special case for its own sake: it
 * is the lower bound of `s.substring(0, n)`, the commonest spelling of the call
 * there is, and it means the fold reaches code nobody rewrote.
 */
const provesClamp = (ctx: CheckContext, state: State, holder: Local | null, bound: Node): boolean => {
  const constant = literalValue(bound)
  if (constant >= 0) {
    return constant === 0 || (holder !== null && knownMinLength(state, holder, constant))
  }
  if (holder === null) {
    return false
  }
  const i = indexLocal(ctx, bound)
  if (i === null || !knownNonNegative(state, i)) {
    return false
  }
  // `knownAtMost` answers `knownBelow` too, and `i < len` implies `i <= len`.
  return knownAtMost(state, i, holder)
}

/**
 * Record whether the clamp on **one** `substring` bound can be dropped.
 *
 * The unit is the bound rather than the call, and that is the whole of the
 * soundness argument. `emitSubstring` clamps argument 0 and only then
 * evaluates argument 1, so the verdict on a bound has to be taken in the state
 * that reaches *that* bound: `walkExpression` calls this from inside the
 * argument loop. Judging both ends against the state the whole argument list
 * left behind proved `k` in range in `s.substring(k, (k = s.length))` — on a
 * negative `k`, whose clamp the emitter had already dropped — and read three
 * bytes before the string body.
 *
 * Judging after the bound's own walk rather than before it is not a third
 * order: the only shapes `provesClamp` can prove are a bare identifier and a
 * decimal literal, and walking either changes nothing.
 *
 * Nothing is pushed on to the unproven list here: the warning for the bounds
 * that stay clamped is reported by `checkPerformance`, which re-derives the
 * shape from the syntax and reads this table for the verdict, so that all of
 * WP15 §8's warnings still come out of one source-order walk.
 */
const judgeClampBound = (walk: BoundsWalk, state: State, holder: Local | null, bound: Node): void => {
  if (!provesClamp(walk.ctx, state, holder, bound)) {
    return
  }
  if (walk.record) {
    walk.ctx.program.nodeProvenClamp[bound.id] = true
  } else {
    walk.clamps.push(bound)
  }
}

/**
 * What a `slice` call's first bound left for its second one to be ordered
 * against: whether `provesClamp` proved it, and the largest value it can have
 * when it was proven at all (-1 otherwise).
 */
class SliceStart {
  ceiling: i32
  clamped: boolean

  constructor() {
    this.ceiling = -1
    this.clamped = false
  }
}

/**
 * `judgeClampBound` for a `slice` bound: the same proof in the same state,
 * since `emitSlice` also reads the receiver's length first and each bound in
 * order, with the literal receiver's length (`provesLiteralSlice`) added. The
 * verdict goes to `sliceClamps` and nowhere else, whatever the walk's
 * `record` says.
 *
 * The literal proof judges each bound alone, but `emitSlice` also panics on
 * `start > end`. Before it, a receiver whose length only its text gives never
 * had both ends proven, so `"abcdef".slice(5, 2)` warned, and it has to keep
 * warning (#326). So when the literal proof proved either bound, the second
 * one is recorded only when `start <= end` is known as well
 * (`boundsOrdered`). A pair `provesClamp` proved alone is recorded as it
 * always was: that proof does not relate a call's two bounds, which
 * `src/portability-strings.ts` states. The first bound is recorded whenever
 * it is proven, so the warning names the bound that fails.
 */
const judgeSliceBound = (
  walk: BoundsWalk,
  state: State,
  call: Node,
  holder: Local | null,
  bound: Node,
  start: SliceStart
): void => {
  const proved = walk.sliceClamps
  if (proved === null) {
    return
  }
  const receiver = unwrapBoundsParens(call.children[0]).children[0]
  const clamped = provesClamp(walk.ctx, state, holder, bound)
  if (!clamped && !provesLiteralSlice(walk, state, receiver, bound)) {
    return
  }
  if (bound === call.children[1].children[0]) {
    proved.push(bound)
    start.clamped = clamped
    start.ceiling = boundCeiling(walk, state, bound)
    return
  }
  const paired = clamped && start.clamped
  if (paired || (start.ceiling >= 0 && boundsOrdered(start.ceiling, boundFloor(walk, state, bound)))) {
    proved.push(bound)
  }
}

/** `start <= end`, from the largest `start` can be and the smallest `end` can be. */
const boundsOrdered = (startCeiling: i32, endFloor: i32): boolean =>
  startCeiling === 0 || (endFloor >= 0 && startCeiling <= endFloor)

/** The largest value a non-negative literal or a bounded local `bound` can have, or -1. */
const boundCeiling = (walk: BoundsWalk, state: State, bound: Node): i32 => {
  const constant = literalValue(bound)
  if (constant >= 0) {
    return constant
  }
  const i = indexLocal(walk.ctx, bound)
  if (i === null || !knownNonNegative(state, i)) {
    return -1
  }
  const above = maxIndexOf(state, i)
  return above > 0 ? above - 1 : -1
}

/** The smallest value a non-negative literal or a local with a known floor `bound` can have, or -1. */
const boundFloor = (walk: BoundsWalk, state: State, bound: Node): i32 => {
  const constant = literalValue(bound)
  if (constant >= 0) {
    return constant
  }
  const i = indexLocal(walk.ctx, bound)
  return i === null ? -1 : minValueOf(state, i)
}

/**
 * A `slice` bound placed inside `[0, length]` by the receiver's own text
 * (#326): `"abcdef".slice(1, 3)`, or the same on a `const` bound to that
 * literal or a module constant folded to one. The length is the literal's,
 * and the bound is a decimal literal or a local known to lie between 0 and
 * that length, so neither the native check nor TypeScript's clamp can move it.
 *
 * The receiver must be ASCII, so that its byte length and its UTF-16 length
 * are the one number. A non-ASCII literal is longer here than in TypeScript,
 * and a bound between the two lengths would be cut differently.
 *
 * This is deliberately not a `State` fact. `provesClamp` is shared with the
 * `substring` fold the emitter reads, and teaching it literal lengths would
 * drop clamps from emitted IR, which this change does not set out to do.
 */
const provesLiteralSlice = (walk: BoundsWalk, state: State, receiver: Node, bound: Node): boolean => {
  const length = asciiLiteralLength(walk, receiver)
  const ceiling = boundCeiling(walk, state, bound)
  return length >= 0 && ceiling >= 0 && ceiling <= length
}

/** The length of the ASCII string `expr` spells out, through a `const` or a module constant, or -1. */
const asciiLiteralLength = (walk: BoundsWalk, expr: Node): i32 => {
  const e = unwrapBoundsParens(expr)
  if (e.kind === N_STRING) {
    return isAsciiText(e.text) ? e.text.length : -1
  }
  if (e.kind !== N_IDENT) {
    return -1
  }
  const constant = walk.ctx.program.nodeConstants[e.id]
  if (constant !== null) {
    const folded = constant.type === T_STRING && constant.folded && isAsciiText(constant.textValue)
    return folded ? constant.textValue.length : -1
  }
  const v = walk.ctx.program.nodeLocals[e.id]
  if (v === null) {
    return -1
  }
  let k = 0
  while (k < walk.literalStrings.length) {
    if (walk.literalStrings[k] === v) {
      return walk.literalLengths[k]
    }
    k = k + 1
  }
  return -1
}

/**
 * Whether evaluating `node` can rebind the local `v`.
 *
 * An assignment or a step written inside it is the only thing that can. It is
 * asked of a `substring` receiver, because `emitSubstring` loads the length of
 * the receiver *value* before either bound runs — so once an argument has
 * rebound the variable, a fact stated against that variable is a fact about a
 * different string, and the length it bounds is not the length the clamp would
 * have used.
 *
 * "A callee cannot reach a caller's local" is the conclusion, not the
 * mechanism, and the mechanism is eight separate refusals. A syntactic scan of
 * the argument list is complete only while every one of these holds; any of
 * them relaxing makes a write reachable that this function does not see, and
 * nothing in the suite would fail:
 *
 *   - no arrow function and no nested `function` in a body
 *     (`Unsupported expression in Phase 1: ArrowFunction`,
 *     `Unsupported statement in Phase 1: FunctionDeclaration`) — so an
 *     argument cannot call something that assigns to a local of *this* frame.
 *     This is the one to watch. The moment an arrow *expression* is legal in
 *     a body, `s.substring(n, f())` rebinds the receiver with no assignment
 *     syntax anywhere in the argument list and this answers false.
 *   - no top-level `let` (``Top-level `let` is not supported; a module has no
 *     top-level code, so only `const` is available``) — a callee has no
 *     mutable module binding to write through either.
 *   - a parameter cannot be assigned (``Cannot assign to `p` because it is a
 *     parameter``) — a receiver bound to a parameter cannot be rebound at all,
 *     here or anywhere.
 *   - only a simple variable is an assignment target (`Only simple variables
 *     can be assigned`) — `[s, n] = ...` is refused, so `localOf` on the
 *     left-hand side sees every write there is.
 *   - `+=` is numeric (``Operator `+=` requires two operands of the same
 *     numeric type``) — so `=` is the only operator that writes a `string`,
 *     and `isBoundsAssignment` covers it.
 *   - no comma expression (`Comma expressions are forbidden in Nish`) — an
 *     argument is one expression, so a write cannot ride along beside a value.
 *   - no spread argument (`Unsupported expression in Phase 1: SpreadElement`)
 *     — the argument list is positionally the bound list, so argument 0 *is*
 *     bound 0 and the interleaved walk is the emitter's order.
 *   - no address of a local — `CPtr` is an address a C function owns and hands
 *     back, never one of ours, so nothing outside the frame has a pointer to
 *     write through.
 *
 * If one of those goes, the scan stops being a proof and the conservative
 * answer is to drop the holder at *any* call inside an argument instead. That
 * is sound without this list, and costs fold reach that today's language does
 * not make anyone pay for.
 */
const writesLocal = (program: CheckedProgram, node: Node, v: Local): boolean => {
  const steps = node.kind === N_UNARY && (node.text === "++" || node.text === "--")
  if ((node.kind === N_BINARY && isBoundsAssignment(node.text)) || steps) {
    const target = localOf(program, node.children[0])
    if (target !== null && target === v) {
      return true
    }
  }
  for (const child of node.children) {
    if (writesLocal(program, child, v)) {
      return true
    }
  }
  return false
}

/** The proof itself: `0 <= i` and `i < holder.length`, by whichever route the state has. */
const proves = (ctx: CheckContext, state: State, holder: Local, index: Node): boolean => {
  const constant = literalValue(index)
  if (constant >= 0) {
    return knownMinLength(state, holder, constant + 1)
  }
  // `w[i + k]`: `i >= 0` keeps the exact sum non-negative, and a reach of `k`
  // or more, or a literal bound on `i` that `k` more still fits under a known
  // length, keeps it below.
  const offset = offsetIndex(ctx, index)
  if (offset !== null) {
    if (!knownNonNegative(state, offset.v)) {
      return false
    }
    if (belowReach(state, offset.v, holder) >= offset.c) {
      return true
    }
    const top = maxIndexOf(state, offset.v)
    return top >= 0 && toI64(top) + toI64(offset.c) < I32_MAX && knownMinLength(state, holder, top + offset.c)
  }
  const i = indexLocal(ctx, index)
  if (i === null || !knownNonNegative(state, i)) {
    return false
  }
  if (knownBelow(state, i, holder)) {
    return true
  }
  const bound = maxIndexOf(state, i)
  return bound >= 0 && knownMinLength(state, holder, bound)
}

/**
 * Walk an expression in evaluation order, proving the accesses it contains and
 * applying what it does to the state. The order is the emitter's: an access is
 * judged at the point its check runs, which is after its own operands and
 * before anything that follows it. A range entry is the same: the emitter
 * checks a value once it has been computed (`emitExpression`), so it is judged
 * in the state the value's own evaluation left.
 */
const walkExpression = (walk: BoundsWalk, state: State, expr: Node): void => {
  walkOperands(walk, state, expr)
  let e = expr
  while (true) {
    judgeRange(walk, state, e)
    if (e.kind !== N_PAREN) {
      return
    }
    e = e.children[0]
  }
}

/**
 * Argument `index` of a call to `callee` (`null` when the checker recorded
 * none). When the callee checks that ranged parameter in its own prologue
 * (WP31 §9: it is outside the linkage condition `privateAbi` states, read here
 * from the context), the emitter writes no check at the call, so a warning
 * that one survives in this loop would name a guard that removes nothing.
 */
const walkArgument = (
  walk: BoundsWalk,
  state: State,
  arg: Node,
  callee: FunctionSig | null,
  index: i32
): void => {
  walkExpression(walk, state, arg)
  const count = walk.unprovenRanges.length
  if (callee === null || count === 0 || walk.unprovenRanges[count - 1] !== arg) {
    return
  }
  // Only the argument's own entry goes; one inside it (a nested call's) stands.
  // A method's or a constructor's `this` is parameter 0 and no argument.
  const param = callee.role === ROLE_FUNCTION ? index : index + 1
  const ctx = walk.ctx
  const inPrologue =
    param < callee.paramTypes.length &&
    ctx.table.isRanged(callee.paramTypes[param]) &&
    !(ctx.strictExports && !callee.visibleOutside())
  if (inPrologue) {
    walk.unprovenRanges.pop()
  }
}

/** `walkExpression` without the range judge: what an expression does, and the accesses inside it. */
const walkOperands = (walk: BoundsWalk, state: State, expr: Node): void => {
  // A leaf — a name, a literal, `this` — changes nothing and proves nothing.
  if (expr.children.length === 0 || walk.done) {
    return
  }
  const ctx = walk.ctx
  const e = unwrapBoundsParens(expr)

  // WP29: an arrow argument is a function of its own, proved when it was
  // lifted; it runs in the callee, not here, and reads nothing of this body's.
  if (e.kind === N_ARROW) {
    return
  }

  if (e.kind === N_INDEX) {
    walkExpression(walk, state, e.children[0])
    walkExpression(walk, state, e.children[1])
    judge(walk, state, e, e.children[0], e.children[1], true)
    return
  }

  if (e.kind === N_CALL) {
    const callee = unwrapBoundsParens(e.children[0])
    if (callee.kind === N_MEMBER) {
      walkExpression(walk, state, callee.children[0])
    } else if (callee.kind !== N_IDENT) {
      walkExpression(walk, state, callee)
    }
    const lazy = lazyResultMethod(ctx, e)
    if (lazy !== "") {
      // The argument runs on the `Err` path alone. `unwrapOr`'s fallback then
      // joins the `Ok` path, so only what holds either way survives; `expect`'s
      // message is followed by the exit, so nothing it did reaches past it.
      const errPath = cloneState(state)
      walkExpression(walk, errPath, e.children[1].children[0])
      if (lazy === "unwrapOr") {
        copyInto(state, intersect(state, errPath))
      }
      forgetCallEffects(walk, state)
      return
    }
    // A `substring`'s clamps are decided one bound at a time, interleaved with
    // the arguments, because that is the order `emitSubstring` writes them in:
    // bound 0 is clamped before bound 1 is evaluated, so nothing bound 1 does
    // may reach back. The receiver's length is read before either, so the
    // holder is dropped the moment an argument rebinds it — a literal `0`
    // still folds after that, because no string has a negative length.
    const slice = walk.sliceClamps !== null && isSliceCall(ctx, e)
    const clamped = slice || isSubstringCall(ctx, e)
    let holder: Local | null = null
    // What the first `slice` bound proved, for the second to be ordered against (`judgeSliceBound`).
    const start: SliceStart | null = slice ? new SliceStart() : null
    if (clamped) {
      holder = lengthHolder(ctx, callee.children[0])
    }
    const target = ctx.program.nodeCallees[e.id]
    let at = 0
    for (const arg of e.children[1].children) {
      walkArgument(walk, state, arg, target, at)
      at = at + 1
      if (clamped) {
        if (holder !== null && writesLocal(ctx.program, arg, holder)) {
          holder = null
        }
        if (start !== null) {
          judgeSliceBound(walk, state, e, holder, arg, start)
        } else {
          judgeClampBound(walk, state, holder, arg)
        }
      }
    }
    if (isCharCodeAt(ctx, e)) {
      judge(walk, state, e, callee.children[0], e.children[1].children[0], true)
    }
    if (isArrayPop(ctx, e)) {
      judgePop(walk, state, e)
    }
    if (callsNothing(ctx, e)) {
      return
    }
    // The state here is the one the callee starts in: every argument has run
    // and the call has not.
    if (walk.tables !== null) {
      noteCallSite(walk, state, e)
    }
    // `nish_str_new` is a callee like any other, so the array lengths go here
    // whether or not this call was a `substring` — and every path goes, string
    // or array, because a callee can store to any field it can reach.
    applyCallEffects(walk, state, e)
    return
  }

  if (e.kind === N_NEW) {
    const target = ctx.program.nodeCallees[e.id]
    let at = 0
    for (const arg of e.children[2].children) {
      walkArgument(walk, state, arg, target, at)
      at = at + 1
    }
    applyCallEffects(walk, state, e) // a constructor body is a callee like any other
    return
  }

  if (e.kind === N_BINARY) {
    walkBinary(walk, state, e)
    return
  }

  if (e.kind === N_CONDITIONAL) {
    walkExpression(walk, state, e.children[0])
    const facts = conditionFacts(walk, state, e.children[0])
    const whenTrue = cloneState(state)
    addFacts(whenTrue, facts.whenTrue)
    walkExpression(walk, whenTrue, e.children[1])
    const whenFalse = cloneState(state)
    addFacts(whenFalse, facts.whenFalse)
    walkExpression(walk, whenFalse, e.children[2])
    copyInto(state, intersect(whenTrue, whenFalse))
    return
  }

  if (e.kind === N_UNARY) {
    const operand = e.children[0]
    walkExpression(walk, state, operand)
    // `-x`, `x++` and `x--` are judged on the value read, before the step.
    judgeOverflow(walk, state, e, operand, null)
    if (e.text !== "++" && e.text !== "--") {
      return
    }
    const field = unwrapBoundsParens(operand)
    if (field.kind === N_MEMBER) {
      forgetPathsThrough(walk, state, field.text)
      return
    }
    const v = localOf(ctx.program, operand)
    if (v === null) {
      return
    }
    if (e.text === "++") {
      applyAssignment(walk, state, v, null, true)
    } else {
      applyDecrement(walk, state, v, 1)
    }
    return
  }

  // A template hole, an array or object literal, a member access, a bare
  // identifier: nothing here changes the state by itself, but a call nested
  // inside one still has to take the array lengths away, so every child is
  // walked rather than skipped.
  for (const child of e.children) {
    walkExpression(walk, state, child)
  }
}

// ---- Range entries (WP31 §6 and §8) -------------------------------------------------

/** The `Lo` of a range with no lower end to prove. */
const I32_MIN: i64 = -2147483648

/**
 * Whether `node` stores back into a ranged place: a compound assignment or an
 * increment, whose sum enters the target's range again. It is
 * `rangedStoreOf` in `src/emit-util.ts`, asked here without reaching into the
 * emitter (the reason `isBoundsAssignment` gives).
 */
const storesBackRange = (ctx: CheckContext, node: Node): boolean => {
  const steps = node.kind === N_UNARY && (node.text === "++" || node.text === "--")
  const compound = node.kind === N_BINARY && node.text !== "=" && isBoundsAssignment(node.text)
  return (steps || compound) && ctx.table.isRanged(ctx.program.nodeTypes[node.children[0].id])
}

/**
 * The range a value enters at `node` with a check, or -1: an entry the
 * checker recorded (a ranged `nodeTypes` beside the source in
 * `nodeCoercions`), or a store back into a ranged place. The two the emitter
 * checks (`emitRangeEntry` and `emitRangedStore`), less the entries that cost
 * nothing already (`entryIsFree`).
 */
const rangeEntryOf = (ctx: CheckContext, node: Node): i32 => {
  const program = ctx.program
  const table = ctx.table
  const from = program.nodeCoercions[node.id]
  const to = program.nodeTypes[node.id]
  if (from >= 0 && table.isRanged(to)) {
    return table.entryIsFree(from, to) ? -1 : to
  }
  if (storesBackRange(ctx, node)) {
    const target = program.nodeTypes[node.children[0].id]
    return table.entryIsFree(T_I32, target) ? -1 : target
  }
  return -1
}

/**
 * Whether the value `source` already lies in `to` where it enters (WP31 §8).
 * Two sources can be judged. `toI32(x)` lands in `x`'s declared range
 * (`convertedRange`), so `toI32(b)` on a `u8` enters `integer<0, 255>` for
 * nothing. A local is judged by its facts, one end at a time:
 *
 *   - the lower end holds when `Lo` is `-2147483648`, or `Lo <= 0` and the
 *     local is known non-negative. `Lo > 0` is never proven from flow, because
 *     `orderFacts` records no lower bound but zero (§11 leaves that open);
 *   - the upper end holds when `Hi` is `2147483647`, or `maxIndexOf` bounds
 *     the local by at most `Hi + 1`.
 *
 * A declared range on the source counts through the same two queries, so a
 * wider range is narrowed by a guard exactly as an `i32` is.
 */
const provesEntry = (walk: BoundsWalk, state: State, source: Node, to: i32): boolean => {
  const ctx = walk.ctx
  const lo = toI64(ctx.table.rangeLo(to))
  const hi = toI64(ctx.table.rangeHi(to))
  const converted = convertedRange(walk, source)
  if (converted !== null) {
    return converted.lo >= lo && converted.hi <= hi
  }
  const v = indexLocal(ctx, source)
  if (v === null) {
    return false
  }
  const low = lo === I32_MIN || (lo <= toI64(0) && knownNonNegative(state, v))
  if (!low) {
    return false
  }
  if (hi === I32_MAX) {
    return true
  }
  const bound = maxIndexOf(state, v)
  return bound >= 0 && toI64(bound) <= hi + toI64(1)
}

/**
 * Record the verdict for one range entry, the way `judge` does for an access:
 * a proof goes into `program.nodeProvenRange`, where the emitter and the
 * attribute pass read it, and a check left inside a loop goes on the list
 * `src/checker.ts` warns from (WP31 §8).
 *
 * Only pass 2 judges an entry. `src/ranges.ts` walks bodies again with what
 * the whole program knows, and could prove more, but a warning pass 2 gave
 * would then have to be taken back (`retractWarnings` does that for an
 * access); an entry it leaves checked is sound, and costs what it did.
 *
 * The warning names a guard, so it is only given where a guard can prove the
 * entry: a range starting at 0 or at `-2147483648`. A lower end above zero is
 * never proven from flow, and one below it only by `v >= 0`, which would
 * refuse values the range allows.
 */
const judgeRange = (walk: BoundsWalk, state: State, node: Node): void => {
  if (walk.tables !== null) {
    return
  }
  const ctx = walk.ctx
  const to = rangeEntryOf(ctx, node)
  if (to < 0) {
    return
  }
  // An entry with no recorded source is a store back, a sum no fact is stated about.
  if (ctx.program.nodeCoercions[node.id] >= 0 && provesEntry(walk, state, node, to)) {
    if (!walk.shadow) {
      ctx.program.nodeProvenRange[node.id] = true
    }
    return
  }
  const lo = toI64(ctx.table.rangeLo(to))
  if (walk.loops > 0 && (lo === toI64(0) || lo === I32_MIN)) {
    walk.unprovenRanges.push(node)
  }
}

/** Apply `v = <rhs>` to the state; `increment` covers `v += c`, `v++` and `++v` too. */
const applyAssignment = (
  walk: BoundsWalk,
  state: State,
  v: Local,
  rhs: Node | null,
  increment: boolean
): void => {
  const ctx = walk.ctx
  const steps = increment || (rhs !== null && isIncrement(ctx.program, v, rhs))
  if (steps && knownNonNegative(state, v) && keepsLowerBound(ctx, v)) {
    forgetUpperBounds(state, v)
    forgetWrappedFloor(state, v)
    addFact(state, new Fact(FACT_NON_NEGATIVE, v, null, 0))
    return
  }
  // The value is computed before the store, so what it proves is read from the
  // state the variable's own facts are still in.
  let facts: Fact[] = []
  if (rhs !== null) {
    facts = initialiserFacts(walk, state, v, rhs)
  }
  forgetLocal(walk, state, v)
  addFacts(state, facts)
}

/**
 * Apply `v = v - c` to the state: the floor drops by `c` and every upper bound
 * stays, when the subtraction cannot wrap (`keepsUpperBound`). A loop that
 * counts down from a last index, `for (let i = n - 1; i >= 0; i -= 1)`, is
 * proved by exactly this: the condition gives the floor back on each pass.
 */
const applyDecrement = (walk: BoundsWalk, state: State, v: Local, c: i32): void => {
  const floor = minValueOf(state, v)
  if (!keepsUpperBound(walk.ctx, v, floor >= 0)) {
    forgetLocal(walk, state, v)
    return
  }
  forgetLowerBounds(state, v)
  if (floor >= c) {
    addFact(state, new Fact(FACT_MIN_VALUE, v, null, floor - c))
  }
}

/**
 * Whether an operator writes its left operand: `=` and every `op=`. The same
 * rule `src/emit-util.ts` states, spelled again here rather than imported,
 * because a checker module that reaches into the emitter is a dependency
 * neither compiler has.
 */
export const isBoundsAssignment = (op: string): boolean => {
  if (op === "=") {
    return true
  }
  if (op.length < 2 || !op.endsWith("=")) {
    return false
  }
  // `===`, `!==`, `<=`, `>=` end in `=` and write nothing.
  return op !== "===" && op !== "!==" && op !== "==" && op !== "!=" && op !== "<=" && op !== ">="
}

/** `recordStoreType`: the element store writes a pointer or a value, and rewrites no record. */
export const NO_RECORD: i32 = -1
/** `recordStoreType`: the checker recorded no element type, so nothing says what the store reaches. */
const ANY_RECORD: i32 = -2

/**
 * Which record an element store writes in place. An array of records keeps
 * its elements inline (WP15 §2a) and `const r = rs[0]` is an interior pointer,
 * so `rs[0] = other` rewrites `r.xs` with no field name anywhere in the
 * statement. An array of classes holds pointers, so `nodes[i] = spare` stores a
 * pointer and rewrites no object; `inlineElementStruct` is the layout rule that
 * tells the two apart, and it is asked rather than restated. The answer is the
 * record's type, `NO_RECORD` for a pointer or a value, and `ANY_RECORD` for an
 * element whose type the checker did not record, because nothing says it is a
 * pointer.
 *
 * The header hoist in `src/emit-arrays.ts` (`storedFields`) asks the same
 * question about a field load it would lift out of a loop, and reads this
 * answer rather than a copy of it (#180).
 */
export const recordStoreType = (program: CheckedProgram, table: TypeTable, access: Node): i32 => {
  const type = program.nodeTypes[access.id]
  if (type < 0) {
    return ANY_RECORD
  }
  return inlineElementStruct(program, table, type) === null ? NO_RECORD : type
}

/**
 * Whether a whole-record store of `stored` can rewrite a field read off a
 * holder declared `holder`. The only memory the store writes is one slot of
 * inline storage, and the only thing that can point into that slot is a value
 * of the element's own type: a field of struct type is a pointer, never an
 * inline copy, and interfaces are nominal, so no other declared type is ever
 * bound to it. A path whose every link is read off something else — a class,
 * above all, which is never inline — keeps its facts, and its header hoist.
 * The proof here and the hoist in `src/emit-arrays.ts` ask this one question.
 */
export const recordReaches = (stored: i32, holder: i32): boolean =>
  stored === ANY_RECORD || holder < 0 || (stored !== NO_RECORD && stored === holder)

/**
 * Whether evaluating `value`, whose `effects` the caller collected, can change
 * what the access `target` reads before it: the index local, the array local, or a path's root or any field on it.
 * `a[i] = value` reads those two before `value` and checks after it, so a
 * proof stated in the state after `value` is a proof about them only while
 * `value` leaves them alone. A call needs no case here: it cannot reach a
 * local, and it already drops every path and array length it could.
 */
const rebindsAccess = (walk: BoundsWalk, effects: Effects, target: Node): boolean => {
  const ctx = walk.ctx
  const index = localOf(ctx.program, target.children[1])
  if (
    index !== null &&
    (contains(effects.stepped, index) ||
      contains(effects.decremented, index) ||
      contains(effects.clobbered, index))
  ) {
    return true
  }
  const receiver = unwrapBoundsParens(target.children[0])
  const local = localOf(ctx.program, receiver)
  if (local !== null) {
    return contains(effects.clobbered, local)
  }
  const holder = pathHolder(walk, receiver)
  if (holder === null) {
    return false
  }
  for (const path of walk.paths) {
    if (path.holder !== holder) {
      continue
    }
    if (contains(effects.clobbered, path.root)) {
      return true
    }
    for (const stored of effects.records) {
      if (recordRewritesPath(stored, path)) {
        return true
      }
    }
    for (const field of effects.fields) {
      if (path.fields.indexOf(field) >= 0) {
        return true
      }
    }
  }
  return false
}

/**
 * Whether the check of `a[i] = value` reads the array `a` still names once
 * the store is done, so that what the check passed on is a fact about `a`.
 * The array is read before `value` and its length after it. For a local that
 * is one array either way: `rebindsAccess` has already refused a `value` that
 * reassigns it, and a callee cannot reach a caller's local. A path is
 * different: a call in `value` can store `this.v = shorter` and leave the
 * check passing on the array the path no longer names, so a path holder
 * learns nothing from a store whose value calls anything.
 */
const storeReadsHolder = (walk: BoundsWalk, effects: Effects, target: Node): boolean =>
  lengthHolder(walk.ctx, target.children[0]) !== null || !effects.calls

/**
 * The length of the array `value` builds, when it is a fresh array whose
 * evaluation changes nothing the walk tracks: `new Array<T>(n)` with a literal
 * `n`, or an array literal whose elements write nothing and call nothing.
 * -1 for every other value.
 */
const freshLength = (walk: BoundsWalk, value: Node): i32 => {
  const ctx = walk.ctx
  const e = unwrapBoundsParens(value)
  if (!ctx.table.isArray(ctx.program.nodeTypes[e.id])) {
    return -1
  }
  if (e.kind === N_NEW && e.children[2].children.length === 1) {
    return literalValue(e.children[2].children[0])
  }
  if (e.kind !== N_ARRAY) {
    return -1
  }
  const effects = new Effects()
  collectEffects(walk, e, effects)
  const quiet =
    !effects.calls &&
    effects.stepped.length === 0 &&
    effects.decremented.length === 0 &&
    effects.clobbered.length === 0 &&
    effects.fields.length === 0 &&
    effects.records.length === 0
  return quiet ? e.children.length : -1
}

/** Assignments and the short-circuit operators; every other binary is left then right. */
const walkBinary = (walk: BoundsWalk, state: State, expr: Node): void => {
  const ctx = walk.ctx
  const op = expr.text
  const left = expr.children[0]
  const right = expr.children[1]

  // WP32: `a ?? d` runs `d` only where `a` is missing, the same join with no
  // condition for the right operand to assume.
  if (op === "&&" || op === "||" || op === "??") {
    walkExpression(walk, state, left)
    if (op === "??") {
      const maybeRan = cloneState(state)
      walkExpression(walk, maybeRan, right)
      copyInto(state, intersect(state, maybeRan))
      return
    }
    const facts = conditionFacts(walk, state, left)
    const guarded = cloneState(state)
    addFacts(guarded, op === "&&" ? facts.whenTrue : facts.whenFalse)
    walkExpression(walk, guarded, right)
    // The right operand may not have run at all, so only what holds either way
    // survives — which also puts back whatever the guard added and the right
    // operand did not take away.
    copyInto(state, intersect(state, guarded))
    return
  }

  if (!isBoundsAssignment(op)) {
    walkExpression(walk, state, left)
    walkExpression(walk, state, right)
    judgeOverflow(walk, state, expr, left, right)
    judgeDivision(walk, state, expr)
    return
  }

  const target = unwrapBoundsParens(left)
  if (target.kind === N_INDEX) {
    walkExpression(walk, state, target.children[0])
    walkExpression(walk, state, target.children[1])
    if (op !== "=") {
      // `a[i] op= v` checks, loads and only then evaluates `v`
      // (`emitElementAssignment`), so the check is judged before `v` runs.
      judge(walk, state, target, target.children[0], target.children[1], true)
      walkExpression(walk, state, right)
      judgeOverflow(walk, state, expr, target, right)
      judgeDivision(walk, state, expr)
    } else {
      // `a[i] = v` reads the array and the index, evaluates `v`, and only then
      // checks — with the index and the array it read *before* `v`. So a call
      // in the value is one the proof has to survive, which judging after it
      // gives; and a value that writes the index or rebinds the array makes
      // the state after it describe something the store does not use, so
      // there is no proof at all: `xs[i] = (i = 0)` checked the new `i` and
      // stored through the old one.
      walkExpression(walk, state, right)
      const effects = new Effects()
      collectEffects(walk, right, effects)
      if (!rebindsAccess(walk, effects, target)) {
        judge(
          walk,
          state,
          target,
          target.children[0],
          target.children[1],
          storeReadsHolder(walk, effects, target)
        )
      }
    }
    const stored = recordStoreType(ctx.program, ctx.table, target)
    if (stored !== NO_RECORD) {
      forgetPathsRecord(walk, state, stored)
    }
    return
  }

  if (target.kind === N_MEMBER) {
    // `recv.f = v` evaluates the receiver, and every check inside it, before
    // `v` (`emitFieldAssignment`), so the receiver is walked first: walking it
    // second judged `g.hs[i]` in `g.hs[i].n = (i = 0)` against the new `i`.
    walkExpression(walk, state, target.children[0])
    walkExpression(walk, state, right)
    if (op !== "=") {
      judgeOverflow(walk, state, expr, target, right)
    }
    judgeDivision(walk, state, expr)
    forgetPathsThrough(walk, state, target.text)
    // `this.v = new Array<i32>(6)` leaves the path naming an array of six,
    // which is what a later `this.v[5]` — or a callee handed `this` — needs.
    // The size is a literal and the value has no effects of its own, so
    // nothing between reading the receiver and the store can rebind the root.
    const size = op === "=" ? freshLength(walk, right) : -1
    if (size >= 0) {
      const holder = pathHolder(walk, target)
      if (holder !== null) {
        addFact(state, new Fact(FACT_MIN_LENGTH, holder, null, size))
      }
    }
    return
  }
  walkExpression(walk, state, right)
  if (op !== "=") {
    judgeOverflow(walk, state, expr, target, right)
  }
  judgeDivision(walk, state, expr)
  const v = localOf(ctx.program, target)
  if (v === null) {
    return
  }
  if (op === "=" && isDecrement(ctx.program, v, right)) {
    applyDecrement(walk, state, v, literalValue(unwrapBoundsParens(right).children[1]))
    return
  }
  if (op === "=") {
    applyAssignment(walk, state, v, right, false)
    return
  }
  if (op === "-=" && literalValue(right) >= 0) {
    applyDecrement(walk, state, v, literalValue(right))
    return
  }
  // `i += <non-negative literal>` steps the same way `i = i + n` does; every
  // other compound operator can move the value anywhere.
  applyAssignment(walk, state, v, null, op === "+=" && literalValue(right) >= 0)
}

// ---- Loops ------------------------------------------------------------------------

/**
 * What survives entering `root`, which is a loop at every call site but one:
 * the same pruning is what a statement the walk cannot model precisely gets.
 *
 * Every variable the node assigns loses its facts, because the second
 * iteration reaches the top of the body with the assignment behind it — except
 * a variable whose every assignment is an increment, which keeps its lower
 * bound and loses its upper ones, and one whose every assignment is a
 * decrement, which does the opposite. Every array length goes too as soon as
 * the node contains a call with no summary. A path goes with its root, with a
 * store to any field it names — its calls' summaries included — with a call or
 * a `new` with no summary anywhere in the node, and with a whole-record store
 * there that can reach one of its links (`recordReaches`).
 * That leaves the loop *condition* to re-establish the upper bound on each
 * pass, which is exactly what it does.
 */
const forgetAcross = (walk: BoundsWalk, state: State, root: Node): void => {
  const ctx = walk.ctx
  const effects = new Effects()
  collectEffects(walk, root, effects)
  // A variable every write masks to `[0, c]`, and that is in that range on the
  // way in, is in it at the top of every pass.
  const kept: Local[] = []
  const keptTops: i32[] = []
  let k = 0
  while (k < effects.masked.length && k < effects.maskTops.length) {
    const v = effects.masked[k]
    const top = effects.maskTops[k]
    const bound = maxIndexOf(state, v)
    const fresh = !contains(effects.unmasked, v) && !contains(effects.stepped, v)
    if (
      fresh &&
      !contains(effects.decremented, v) &&
      knownNonNegative(state, v) &&
      bound >= 0 &&
      bound <= top + 1
    ) {
      kept.push(v)
      keptTops.push(top)
    }
    k = k + 1
  }
  for (const v of effects.clobbered) {
    forgetLocal(walk, state, v)
  }
  k = 0
  while (k < kept.length && k < keptTops.length) {
    const v = kept[k]
    const top = keptTops[k]
    if (top < toI32(I32_MAX) - 1) {
      addFact(state, new Fact(FACT_NON_NEGATIVE, v, null, 0))
      addFact(state, new Fact(FACT_MAX_INDEX, v, null, top + 1))
    }
    k = k + 1
  }
  for (const v of effects.stepped) {
    if (contains(effects.clobbered, v)) {
      continue
    }
    if (keepsLowerBound(ctx, v) && !contains(effects.decremented, v)) {
      forgetUpperBounds(state, v)
      forgetWrappedFloor(state, v)
    } else {
      forgetLocal(walk, state, v)
    }
  }
  // A variable only ever counted down keeps its upper bounds, as one only
  // ever counted up keeps its lower one. The state reaching the loop says
  // nothing about the value at each decrement, so the wrap is ruled out by
  // `nsw` alone here.
  for (const v of effects.decremented) {
    if (contains(effects.clobbered, v) || contains(effects.stepped, v)) {
      continue
    }
    if (keepsUpperBound(ctx, v, false)) {
      forgetLowerBounds(state, v)
    } else {
      forgetLocal(walk, state, v)
    }
  }
  for (const field of effects.fields) {
    forgetPathsThrough(walk, state, field)
  }
  if (effects.calls) {
    forgetCallEffects(walk, state)
  } else {
    for (const stored of effects.records) {
      forgetPathsRecord(walk, state, stored)
    }
  }
}

/**
 * What a statement can do to the state on its way round: the locals it steps
 * and the ones it overwrites, the field names it stores to, whether it calls
 * anything, and which records it stores whole — the last two reach fields it
 * does not name.
 */
class Effects {
  stepped: Local[]
  /** Written only by `v -= c`, `v = v - c` and `v--`, with `c` a non-negative literal. */
  decremented: Local[]
  clobbered: Local[]
  /**
   * Of `clobbered`, the variables some write gives a value of any size, and
   * beside them the ones every write masks — `v = e & c`, `c` a non-negative
   * literal — with the largest mask. A masked variable is in `[0, c]` after
   * every pass whatever it was before, so a loop keeps that much of it.
   */
  unmasked: Local[]
  masked: Local[]
  maskTops: i32[]
  fields: string[]
  calls: boolean
  /** The record types a whole-record store writes (`recordStoreType`), each once. */
  records: i32[]

  constructor() {
    this.stepped = []
    this.decremented = []
    this.clobbered = []
    this.unmasked = []
    this.masked = []
    this.maskTops = []
    this.fields = []
    this.calls = false
    this.records = []
  }
}

/** Record whether the write `node` makes to `v` is a mask (`Effects.masked`). */
const noteMask = (node: Node, v: Local, effects: Effects): void => {
  const value = unwrapBoundsParens(node.children[1])
  const literal =
    node.text === "=" && value.kind === N_BINARY && value.text === "&"
      ? anyLiteral(value.children[1])
      : toI64(-1)
  const top = literal >= toI64(0) && literal < I32_MAX ? toI32(literal) : -1
  if (top < 0) {
    effects.unmasked.push(v)
    return
  }
  let k = 0
  while (k < effects.masked.length) {
    if (effects.masked[k] === v) {
      if (top > effects.maskTops[k]) {
        effects.maskTops[k] = top
      }
      return
    }
    k = k + 1
  }
  effects.masked.push(v)
  effects.maskTops.push(top)
}

const contains = (list: Local[], v: Local): boolean => {
  for (const x of list) {
    if (x === v) {
      return true
    }
  }
  return false
}

/** What a write to `target` does to paths: a field name it stores, or a whole record. */
const noteStoredField = (ctx: CheckContext, target: Node, effects: Effects): void => {
  const t = unwrapBoundsParens(target)
  if (t.kind === N_MEMBER && effects.fields.indexOf(t.text) < 0) {
    effects.fields.push(t.text)
  }
  if (t.kind === N_INDEX) {
    const stored = recordStoreType(ctx.program, ctx.table, t)
    if (stored !== NO_RECORD && effects.records.indexOf(stored) < 0) {
      effects.records.push(stored)
    }
  }
}

const collectEffects = (walk: BoundsWalk, node: Node, effects: Effects): void => {
  const ctx = walk.ctx
  const stepped = effects.stepped
  const clobbered = effects.clobbered
  if (node.kind === N_NEW || (node.kind === N_CALL && !callsNothing(ctx, node))) {
    noteCallEffects(walk, node, effects)
  }
  if (node.kind === N_BINARY && isBoundsAssignment(node.text)) {
    noteStoredField(ctx, node.children[0], effects)
    const v = localOf(ctx.program, node.children[0])
    if (v !== null) {
      const steps =
        (node.text === "=" && isIncrement(ctx.program, v, node.children[1])) ||
        (node.text === "+=" && literalValue(node.children[1]) >= 0)
      const falls =
        (node.text === "=" && isDecrement(ctx.program, v, node.children[1])) ||
        (node.text === "-=" && literalValue(node.children[1]) >= 0)
      if (steps) {
        stepped.push(v)
      } else if (falls) {
        effects.decremented.push(v)
      } else {
        clobbered.push(v)
        noteMask(node, v, effects)
      }
    }
  }
  if (node.kind === N_UNARY && (node.text === "++" || node.text === "--")) {
    noteStoredField(ctx, node.children[0], effects)
    const v = localOf(ctx.program, node.children[0])
    if (v !== null) {
      if (node.text === "++") {
        stepped.push(v)
      } else {
        effects.decremented.push(v)
      }
    }
  }
  for (const child of node.children) {
    // A leaf — a name, a literal, `this` — writes nothing and calls nothing.
    if (child.children.length > 0) {
      collectEffects(walk, child, effects)
    }
  }
}

/**
 * A call's share of `Effects`: what its summary says it stores, or `calls`
 * when nothing does (`callSummary`).
 */
const noteCallEffects = (walk: BoundsWalk, call: Node, effects: Effects): void => {
  const summary = callSummary(walk, call)
  if (summary === null) {
    effects.calls = true
    return
  }
  for (const field of summary.fields) {
    if (effects.fields.indexOf(field) < 0) {
      effects.fields.push(field)
    }
  }
  for (const stored of summary.records) {
    if (effects.records.indexOf(stored) < 0) {
      effects.records.push(stored)
    }
  }
}

// ---- Statements -------------------------------------------------------------------

/**
 * The state a `for` update or a `do/while` condition runs in: what holds at the
 * end of the body and at every `continue` in it. A body that always leaves
 * without a `continue` makes the update unreachable; it is still walked, from
 * the end of the body, so the accesses in it are judged at all.
 */
const continueJoin = (walk: BoundsWalk, end: State, exits: boolean): State => {
  let joined = end
  let k = 0
  if (exits && walk.continues.length > 0) {
    joined = walk.continues[0]
    k = 1
  }
  while (k < walk.continues.length) {
    joined = intersect(joined, walk.continues[k])
    k = k + 1
  }
  return joined
}

/**
 * The state after a `for` or `while`: what holds where the condition fails,
 * joined with every `break` out of the body. Written into `exit`, which is the
 * condition's state and so the one the enclosing block goes on in.
 */
const breakJoin = (walk: BoundsWalk, exit: State): void => {
  if (walk.breaks.length === 0) {
    return
  }
  let joined = exit
  for (const b of walk.breaks) {
    joined = intersect(joined, b)
  }
  copyInto(exit, joined)
}

/**
 * Walk one statement, returning whether control definitely leaves it. That
 * answer is what makes the early-exit guard work: after
 * `if (i >= s.length) { return 0; }` the negation of the test holds for the
 * rest of the block, which is the shape a scanner is written in.
 */
const walkBoundsStatement = (walk: BoundsWalk, state: State, stmt: Node): boolean => {
  if (walk.done) {
    return false
  }

  if (stmt.kind === N_BLOCK) {
    for (const inner of stmt.children) {
      if (walkBoundsStatement(walk, state, inner)) {
        return true
      }
    }
    return false
  }

  if (stmt.kind === N_VAR) {
    for (const decl of stmt.children[0].children) {
      walkDeclaration(walk, state, decl)
    }
    return false
  }

  if (stmt.kind === N_EXPR_STMT) {
    // `panic(…)` and `process.exit(…)` end the path as a `return` does, so a
    // guard ending in one proves the access after it. The answer is the
    // checker's own `terminatesControlFlow`, the test `checkStatement` uses
    // for unreachable code, so the two passes cannot disagree.
    walkExpression(walk, state, stmt.children[0])
    return terminatesControlFlow(walk.ctx, stmt.children[0])
  }

  if (stmt.kind === N_IF) {
    walkExpression(walk, state, stmt.children[0])
    const facts = conditionFacts(walk, state, stmt.children[0])
    const thenState = cloneState(state)
    addFacts(thenState, facts.whenTrue)
    const thenExits = walkBoundsStatement(walk, thenState, stmt.children[1])
    const elseState = cloneState(state)
    addFacts(elseState, facts.whenFalse)
    const hasElse = stmt.children[2].kind !== N_EMPTY
    const elseExits = hasElse ? walkBoundsStatement(walk, elseState, stmt.children[2]) : false
    if (thenExits && elseExits) {
      return true
    }
    if (thenExits) {
      copyInto(state, elseState)
    } else if (elseExits) {
      copyInto(state, thenState)
    } else {
      copyInto(state, intersect(thenState, elseState))
    }
    return false
  }

  if (stmt.kind === N_WHILE) {
    forgetAcross(walk, state, stmt)
    walk.loops = walk.loops + 1
    walkExpression(walk, state, stmt.children[0])
    const body = cloneState(state)
    addFacts(body, conditionFacts(walk, state, stmt.children[0]).whenTrue)
    // A `continue` here goes back to the condition, which was walked in the
    // state `forgetAcross` left, so its states are collected only to keep them
    // away from an enclosing loop's update.
    const outer = walk.continues
    const outerBreaks = walk.breaks
    walk.continues = []
    walk.breaks = []
    walkBoundsStatement(walk, body, stmt.children[1])
    breakJoin(walk, state)
    walk.continues = outer
    walk.breaks = outerBreaks
    walk.loops = walk.loops - 1
    return false
  }

  if (stmt.kind === N_DO) {
    forgetAcross(walk, state, stmt)
    walk.loops = walk.loops + 1
    const body = cloneState(state)
    // The state after a `do/while` is the one `forgetAcross` left, which never
    // saw the condition's facts, so a `break` has nothing to take back; its
    // states are collected only to keep them away from an enclosing loop.
    const outer = walk.continues
    const outerBreaks = walk.breaks
    walk.continues = []
    walk.breaks = []
    const exits = walkBoundsStatement(walk, body, stmt.children[0])
    const condition = continueJoin(walk, body, exits)
    walk.continues = outer
    walk.breaks = outerBreaks
    walkExpression(walk, condition, stmt.children[1])
    walk.loops = walk.loops - 1
    return false
  }

  if (stmt.kind === N_FOR) {
    // The initializer runs once, before the loop, so it is walked in the outer
    // state and its facts are what `forgetAcross` then prunes.
    const init = stmt.children[0]
    if (init.kind === N_VAR) {
      for (const decl of init.children[0].children) {
        walkDeclaration(walk, state, decl)
      }
    } else if (init.kind !== N_EMPTY) {
      walkExpression(walk, state, init)
    }
    const accumulated = accumulatorFacts(walk, state, stmt)
    forgetAcross(walk, state, stmt)
    addFacts(state, accumulated)
    walk.loops = walk.loops + 1
    const cond = stmt.children[1]
    if (cond.kind !== N_EMPTY) {
      walkExpression(walk, state, cond)
    }
    const body = cloneState(state)
    if (cond.kind !== N_EMPTY) {
      addFacts(body, conditionFacts(walk, state, cond).whenTrue)
    }
    const outer = walk.continues
    const outerBreaks = walk.breaks
    walk.continues = []
    walk.breaks = []
    const exits = walkBoundsStatement(walk, body, stmt.children[3])
    const update = continueJoin(walk, body, exits)
    breakJoin(walk, state)
    walk.continues = outer
    walk.breaks = outerBreaks
    if (stmt.children[2].kind !== N_EMPTY) {
      walkExpression(walk, update, stmt.children[2])
    }
    walk.loops = walk.loops - 1
    return false
  }

  if (stmt.kind === N_FOR_OF) {
    walkExpression(walk, state, stmt.children[1])
    forgetAcross(walk, state, stmt)
    walk.loops = walk.loops + 1
    const body = cloneState(state)
    // As with `do/while`, the state after the loop never saw a fact the loop
    // re-establishes, so a `break` is only kept away from an enclosing loop.
    const outer = walk.continues
    const outerBreaks = walk.breaks
    walk.continues = []
    walk.breaks = []
    walkBoundsStatement(walk, body, stmt.children[2])
    walk.continues = outer
    walk.breaks = outerBreaks
    walk.loops = walk.loops - 1
    return false
  }

  if (stmt.kind === N_RETURN) {
    if (stmt.children[0].kind !== N_EMPTY) {
      noteReturn(walk, state, stmt.children[0])
      walkExpression(walk, state, stmt.children[0])
    }
    return true
  }

  if (stmt.kind === N_CONTINUE) {
    walk.continues.push(cloneState(state))
    return true
  }

  if (stmt.kind === N_BREAK) {
    walk.breaks.push(cloneState(state))
    return true
  }

  if (stmt.kind === N_THROW) {
    walkExpression(walk, state, stmt.children[0])
    return true
  }

  if (stmt.kind === N_SWITCH) {
    walkExpression(walk, state, stmt.children[0])
    // A clause can be entered from the discriminant or fallen into from the
    // one above it, so each is walked from the state the whole `switch` is
    // sound under and nothing it decided survives past the closing brace.
    forgetAcross(walk, state, stmt)
    // A `break` in a clause leaves the `switch`, not a loop around it, and the
    // state after the `switch` is already the pruned one, so its states go no
    // further. A `continue` does reach the loop, and stays in its frame.
    const outerBreaks = walk.breaks
    walk.breaks = []
    for (const clause of stmt.children[1].children) {
      const clauseState = cloneState(state)
      const body = clause.kind === N_CASE ? clause.children[1] : clause.children[0]
      for (const inner of body.children) {
        if (walkBoundsStatement(walk, clauseState, inner)) {
          break
        }
      }
    }
    walk.breaks = outerBreaks
    return false
  }

  // Anything else: forget whatever it touches, then prove what it contains.
  forgetAcross(walk, state, stmt)
  for (const child of stmt.children) {
    walkExpression(walk, state, child)
  }
  return false
}

const walkDeclaration = (walk: BoundsWalk, state: State, decl: Node): void => {
  const init = decl.children[2]
  if (init.kind !== N_EMPTY) {
    walkExpression(walk, state, init)
  }
  const v = walk.ctx.program.nodeLocals[decl.id]
  if (v === null) {
    return
  }
  let facts: Fact[] = []
  if (init.kind !== N_EMPTY) {
    facts = initialiserFacts(walk, state, v, init)
  }
  forgetLocal(walk, state, v)
  addFacts(state, facts)
  // `const t = "abcdef"`: what `asciiLiteralLength` reads `t.slice(1, 3)` against.
  if (walk.sliceClamps === null || v.mutable || v.type !== T_STRING) {
    return
  }
  const length = asciiLiteralLength(walk, init)
  if (length >= 0) {
    walk.literalStrings.push(v)
    walk.literalLengths.push(length)
  }
}

/**
 * Prove the indices and the range entries of one checked function body.
 * Returns the walk, whose `unproven` and `unprovenRanges` are the accesses and
 * entries whose check survived inside a loop, so that the WP15 §8 walk reports
 * them from the same source-order traversal every other warning of the class
 * comes out of.
 *
 * The proofs themselves go into `program.nodeProvenIndex` and
 * `program.nodeProvenRange`, which are the only things the emitter ever reads
 * from here.
 */
export const analyzeBounds = (ctx: CheckContext, body: Node, uncheckedIndexing: boolean): BoundsWalk => {
  const walk = new BoundsWalk(ctx, uncheckedIndexing)
  // A body with nothing to judge has nothing to prove and nothing to warn
  // about, and the walk writes nothing else.
  if (!judgesAnything(ctx, body)) {
    return walk
  }
  const state = new State(ctx.table)
  if (body.kind === N_BLOCK) {
    walkBoundsStatement(walk, state, body)
  } else {
    walkExpression(walk, state, body)
  }
  if (uncheckedIndexing) {
    proveUnflagged(ctx, body)
  }
  return walk
}

/**
 * Under `--unchecked-indexing`, mark proven every element access of `body`
 * that the build without the flag would prove once the migration
 * (`src/unsafe-migrate.ts`) has run, so that it never rewrites one: the flag
 * build records no passed check, and its proofs alone are a subset of those.
 * A second walk records them as that build would, at every access the
 * migration leaves checked — one with no `nish:unsafe` form; one it rewrites
 * passes no check once rewritten. The emitter reads no access's proof under
 * the flag, which drops every check anyway, so the element accesses are the
 * only proofs kept: the walk is unrecorded, and its clamps, its overflow and
 * division proofs and its range entries rest on facts the flag build may not
 * use, so they are thrown away.
 *
 * Only pass 2's facts are taken. An access the whole-program pass
 * (`src/ranges.ts`) would prove from what a caller's passed check hands it is
 * still reported, and rewritten, which keeps its meaning.
 */
const proveUnflagged = (ctx: CheckContext, body: Node): void => {
  const shadow = new BoundsWalk(ctx, false)
  shadow.shadow = true
  shadow.record = false
  const state = new State(ctx.table)
  if (body.kind === N_BLOCK) {
    walkBoundsStatement(shadow, state, body)
  } else {
    walkExpression(shadow, state, body)
  }
  for (const node of shadow.proved) {
    if (node.kind === N_INDEX && ctx.table.isArray(ctx.program.nodeTypes[node.children[0].id])) {
      ctx.program.nodeProvenIndex[node.id] = true
    }
  }
}

/**
 * Whether `uncheckedGet` and `uncheckedSet` can say `access`: its element is
 * a number and its index an `i32` or a range over one, which is what
 * `checkUncheckedAccess` (src/builtins.ts) accepts. The migration rewrites
 * only such an access (`src/unsafe-migrate.ts`), and the shadow walk records
 * a passed check at every other (`recordPassedCheck`).
 */
export const hasUncheckedForm = (program: CheckedProgram, table: TypeTable, access: Node): boolean => {
  if (!isNumeric(table.refOf(program.nodeTypes[access.children[0].id]))) {
    return false
  }
  const index = program.nodeTypes[access.children[1].id]
  return index === T_I32 || (table.isRanged(index) && table.baseOf(index) === T_I32)
}

/**
 * Whether `node` holds anything `judge`, `judgeClampBound`, `judgeRange`,
 * `judgeDivision` or `judgePop` is ever called on: an element access, a call
 * spelled `.charCodeAt(...)`, `.substring(...)` or `.pop()` whatever its
 * receiver, a division, or a value entering a range. Read
 * off the syntax and the entries the checker recorded, so it answers `true`
 * for more than the walk judges, never less.
 */
const judgesAnything = (ctx: CheckContext, node: Node): boolean => {
  if (node.kind === N_INDEX || rangeEntryOf(ctx, node) >= 0) {
    return true
  }
  if (!ctx.wrapping && checksOverflow(ctx.program, ctx.table, node)) {
    return true
  }
  if (node.kind === N_CALL) {
    const callee = unwrapBoundsParens(node.children[0])
    const name = callee.kind === N_MEMBER ? callee.text : ""
    if (name === "charCodeAt" || name === "substring" || name === "pop") {
      return true
    }
  }
  // A division is judged for its divisor (`judgeDivision`), whatever its type.
  if (
    node.kind === N_BINARY &&
    (node.text === "/" || node.text === "%" || node.text === "/=" || node.text === "%=")
  ) {
    return true
  }
  for (const child of node.children) {
    // A leaf judges nothing unless a value enters a range there (WP31 §6).
    if (child.children.length > 0 ? judgesAnything(ctx, child) : rangeEntryOf(ctx, child) >= 0) {
      return true
    }
  }
  return false
}

// ---- Signed overflow --------------------------------------------------------------
//
// A signed `+ - *`, a negation, an increment or a decrement either fits its
// type or panics (docs/LANGUAGE.md, "Semantics decisions"). The emitter checks
// every one with `llvm.s*.with.overflow` unless this walk proved the result
// fits, which it records in `program.nodeProvenNoOverflow`; the emitter then
// writes the plain instruction with `nsw`, and that flag is the proof.
//
// The proof is interval arithmetic. Each operand is given the range of values
// it can hold at the point it is read: a literal or a folded constant is one
// value, `w.length` is `[0, MAX]`, a `toI32` of a `u8` or `u16` is its type's
// range, and a local is its type's range — a declared one for `integer<Lo,
// Hi>` — narrowed by what the state knows: its floor (`minValueOf`), its
// `maxIndex`, and `i < w.length`, which leaves it at most `MAX - 1`. A nested
// operation is the operation of its operands' ranges, cut to the type, which
// is sound *because* overflow panics: a value past either end never reaches
// the operator above it. The operation is proven when its range fits.
//
// The ranges are read off the state after both operands ran, so the walk
// proves nothing in an expression that writes a local (`writesAnyLocal`):
// there a variable could hold one value where it was read and another where
// the state describes it. A call writes no local of the caller — a local
// cannot be reached through an alias — so calls do not count.
//
// None of this runs under `--wrapping`, where nothing is checked; and every
// fact it reads is one the bounds walk already keeps sound under checked
// arithmetic, because a step past `MAX` that would have broken a floor now
// panics instead (`keepsLowerBound`).

/** `2^63 - 1`, built from `2^62` because a literal past `2^53` cannot be written exactly. */
const i64Max = (): i64 => {
  const half: i64 = toI64(1) << toI64(62)
  return half - toI64(1) + half
}

/** The closed range of values an operand may hold, `lo <= v <= hi`. */
class Interval {
  lo: i64
  hi: i64

  constructor(lo: i64, hi: i64) {
    this.lo = lo
    this.hi = hi
  }
}

/**
 * The base type a node's signed arithmetic is checked at, or -1 when it is
 * not checked: `+ - *` and `+= -= *=` on an `i32` or an `i64` (a ranged value
 * computes at its base), unary `-` on one — but not on a literal, which the
 * emitter writes as the negated constant — and `++` / `--`. `checksOverflow`
 * is the export, so that `src/attributes.ts` asks the same question the
 * emitter's path answers, and reads the same verdict.
 */
const checkedArithmeticType = (program: CheckedProgram, table: TypeTable, node: Node): i32 => {
  const op = node.text
  if (node.kind === N_BINARY) {
    if (op !== "+" && op !== "-" && op !== "*" && op !== "+=" && op !== "-=" && op !== "*=") {
      return -1
    }
  } else if (node.kind === N_UNARY) {
    if (op !== "-" && op !== "++" && op !== "--") {
      return -1
    }
    if (op === "-" && unwrapBoundsParens(node.children[0]).kind === N_NUMBER) {
      return -1
    }
  } else {
    return -1
  }
  const type = program.nodeTypes[node.children[0].id]
  if (type < 0) {
    return -1
  }
  const base = table.baseOf(type)
  return base === T_I32 || base === T_I64 ? base : -1
}

/** Whether `node` is signed arithmetic the emitter checks unless it is proven (`checkedArithmeticType`). */
export const checksOverflow = (program: CheckedProgram, table: TypeTable, node: Node): boolean =>
  checkedArithmeticType(program, table, node) >= 0

const typeMin = (type: i32): i64 => (type === T_I32 ? I32_MIN : -i64Max() - toI64(1))
const typeMax = (type: i32): i64 => (type === T_I32 ? I32_MAX : i64Max())

/** `x + y`, held at `[min, max]` rather than overflowing, for the ends of a range. */
const saturatingAdd = (x: i64, y: i64, min: i64, max: i64): i64 => {
  if (y > toI64(0) && x > max - y) {
    return max
  }
  if (y < toI64(0) && x < min - y) {
    return min
  }
  const sum = x + y
  if (sum > max) {
    return max
  }
  return sum < min ? min : sum
}

/** `x - y`, held at `[min, max]` the same way. */
const saturatingSub = (x: i64, y: i64, min: i64, max: i64): i64 => {
  if (y < toI64(0) && x > max + y) {
    return max
  }
  if (y > toI64(0) && x < min + y) {
    return min
  }
  const difference = x - y
  if (difference > max) {
    return max
  }
  return difference < min ? min : difference
}

/** `2^31`: products of ends inside `[-2^31, 2^31]` cannot overflow the `i64` they are computed in. */
const PRODUCT_LIMIT: i64 = 2147483648

const smallEnds = (a: Interval): boolean =>
  a.lo >= -PRODUCT_LIMIT && a.lo <= PRODUCT_LIMIT && a.hi >= -PRODUCT_LIMIT && a.hi <= PRODUCT_LIMIT

/**
 * The range of `a * b`, or `null` when an end is too large to multiply in an
 * `i64` without overflowing the compiler's own arithmetic. The four products
 * of the ends bound it, because a product is monotone in each factor.
 */
const productRange = (a: Interval, b: Interval): Interval | null => {
  if (!smallEnds(a) || !smallEnds(b)) {
    return null
  }
  const p1 = a.lo * b.lo
  const p2 = a.lo * b.hi
  const p3 = a.hi * b.lo
  const p4 = a.hi * b.hi
  const lo = p1 < p2 ? p1 : p2
  const hi = p1 > p2 ? p1 : p2
  const lo2 = p3 < p4 ? p3 : p4
  const hi2 = p3 > p4 ? p3 : p4
  return new Interval(lo < lo2 ? lo : lo2, hi > hi2 ? hi : hi2)
}

/** The arithmetic operator a node applies: `+`, `-` or `*`, with `++` / `--` as `+` / `-` and unary `-` as `neg`. */
const arithmeticOperator = (node: Node): string => {
  const op = node.text
  if (node.kind === N_UNARY) {
    if (op === "++") {
      return "+"
    }
    return op === "--" ? "-" : "neg"
  }
  return op.endsWith("=") ? op.substring(0, op.length - 1) : op
}

/**
 * The range of `a op b` at `type`, cut to the type's own range: a result past
 * either end panicked rather than reaching whatever reads it.
 */
const combinedRange = (op: string, a: Interval, b: Interval, type: i32): Interval => {
  const min = typeMin(type)
  const max = typeMax(type)
  if (op === "+") {
    return new Interval(saturatingAdd(a.lo, b.lo, min, max), saturatingAdd(a.hi, b.hi, min, max))
  }
  if (op === "-") {
    return new Interval(saturatingSub(a.lo, b.hi, min, max), saturatingSub(a.hi, b.lo, min, max))
  }
  if (op === "neg") {
    const zero = toI64(0)
    return new Interval(saturatingSub(zero, a.hi, min, max), saturatingSub(zero, a.lo, min, max))
  }
  const product = productRange(a, b)
  if (product === null) {
    return new Interval(min, max)
  }
  return new Interval(product.lo < min ? min : product.lo, product.hi > max ? max : product.hi)
}

/**
 * Whether `a op b` lands inside `type` for every pair of values the ranges
 * allow. Each comparison is arranged so that the compiler's own arithmetic
 * cannot overflow while it decides: `hi + b.hi <= max` is asked as
 * `hi <= max - b.hi` with `b.hi > 0`, and so on.
 */
const fitsType = (op: string, a: Interval, b: Interval, type: i32): boolean => {
  const min = typeMin(type)
  const max = typeMax(type)
  const zero = toI64(0)
  if (op === "+") {
    const highFits = b.hi <= zero || a.hi <= max - b.hi
    const lowFits = b.lo >= zero || a.lo >= min - b.lo
    return highFits && lowFits
  }
  if (op === "-") {
    const highFits = b.lo >= zero || a.hi <= max + b.lo
    const lowFits = b.hi <= zero || a.lo >= min + b.hi
    return highFits && lowFits
  }
  if (op === "neg") {
    // `-x` fits for every `x` but the minimum, whose negation is one past the top.
    return a.lo > min
  }
  const product = productRange(a, b)
  return product !== null && product.lo >= min && product.hi <= max
}

/**
 * The longest reach recorded for `i` against any holder, or -1 when `i` is
 * known below no length. `i + c < w.length` puts `i` at least `c + 1` below
 * the top, which is what lets the `i + 4` that steps a four-wide loop stay
 * unchecked.
 */
const longestReach = (state: State, i: Local): i32 => {
  let best = -1
  let k = 0
  while (k < state.belowIndex.length) {
    if (state.belowIndex[k] === i && state.belowOffset[k] > best) {
      best = state.belowOffset[k]
    }
    k = k + 1
  }
  return best
}

/** The range a local holds here: its type's, or its declared one, narrowed by the state. */
const localRange = (state: State, v: Local, type: i32): Interval =>
  new Interval(localLow(state, v, type), localHigh(state, v, type))

/** The low end of `localRange`: the type's, the declared range's, or the recorded floor. */
const localLow = (state: State, v: Local, type: i32): i64 => {
  let lo = typeMin(type)
  const declared = state.table.declaredRange(v.type)
  if (declared !== null && declared.lo > lo) {
    lo = declared.lo
  }
  const floor = minValueOf(state, v)
  return floor >= 0 && toI64(floor) > lo ? toI64(floor) : lo
}

/** The high end of `localRange`: the type's, the declared range's, or one below a recorded bound. */
const localHigh = (state: State, v: Local, type: i32): i64 => {
  let hi = typeMax(type)
  const declared = state.table.declaredRange(v.type)
  if (declared !== null && declared.hi < hi) {
    hi = declared.hi
  }
  const bound = maxIndexOf(state, v)
  if (bound >= 0 && toI64(bound) - toI64(1) < hi) {
    hi = toI64(bound) - toI64(1)
  }
  // A length is at most the type's top, so an index below one is below the
  // top, and one whose length reaches `c` further is `c` further below it.
  const reach = longestReach(state, v)
  if (reach >= 0 && hi > typeMax(type) - toI64(1) - toI64(reach)) {
    hi = typeMax(type) - toI64(1) - toI64(reach)
  }
  return hi
}

/**
 * The range `expr` can evaluate to at `type`, in `state`. Anything it does not
 * recognise is the whole type, which proves nothing and costs nothing.
 */
const valueRange = (walk: BoundsWalk, state: State, expr: Node, type: i32): Interval => {
  const ctx = walk.ctx
  const e = unwrapBoundsParens(expr)
  const literal = anyLiteral(e)
  if (literal >= toI64(0)) {
    return new Interval(literal, literal)
  }
  if (e.kind === N_UNARY && e.text === "-") {
    const negated = anyLiteral(e.children[0])
    if (negated >= toI64(0)) {
      return new Interval(-negated, -negated)
    }
  }
  if (e.kind === N_IDENT) {
    const constant = ctx.program.nodeConstants[e.id]
    if (constant !== null) {
      if (constant.folded && ctx.table.baseOf(constant.type) === type) {
        return new Interval(constant.intValue, constant.intValue)
      }
      return new Interval(typeMin(type), typeMax(type))
    }
  }
  if (lengthOf(walk, e) !== null) {
    return new Interval(toI64(0), typeMax(type))
  }
  const converted = convertedRange(walk, e)
  if (converted !== null) {
    return new Interval(converted.lo, converted.hi)
  }
  const widened = widenedRange(walk, state, e, type)
  if (widened !== null) {
    return widened
  }
  const v = localOf(ctx.program, e)
  if (v !== null && ctx.table.baseOf(v.type) === type) {
    return localRange(state, v, type)
  }
  const masked = maskedRange(walk, state, e, type)
  if (masked !== null) {
    return masked
  }
  if (
    checkedArithmeticType(ctx.program, ctx.table, e) === type &&
    e.kind === N_BINARY &&
    e.text.length === 1
  ) {
    const a = valueRange(walk, state, e.children[0], type)
    const b = valueRange(walk, state, e.children[1], type)
    return combinedRange(e.text, a, b, type)
  }
  if (e.kind === N_UNARY && e.text === "-" && checkedArithmeticType(ctx.program, ctx.table, e) === type) {
    const a = valueRange(walk, state, e.children[0], type)
    return combinedRange("neg", a, a, type)
  }
  const counted = bitCountRange(ctx.program, e, type)
  if (counted !== null) {
    return counted
  }
  if (e.kind === N_CALL) {
    const returned = callRange(walk, state, e, type)
    if (returned !== null) {
      return returned
    }
  }
  // A field or an element is its declared range, when its type has one.
  const declared = ctx.table.declaredRange(ctx.program.nodeTypes[e.id])
  if (declared !== null && ctx.table.baseOf(ctx.program.nodeTypes[e.id]) === type) {
    return new Interval(declared.lo, declared.hi)
  }
  return new Interval(typeMin(type), typeMax(type))
}

/**
 * `Math.clz32(x)` counts bits, so it lands in `[0, 32]`. The checker gives the
 * call `integer<0, 32>`, but an operand is recorded as the base it is read as
 * (`readAsBase` in src/expressions.ts), so the range reaches the prover here
 * rather than through the node's type: `31 - Math.clz32(b)`, the index of a
 * bit, then needs no overflow check. A user function called `clz32` on a value
 * named `Math` is not this, which `nodeCallees` and the receiver's type say.
 */
const bitCountRange = (program: CheckedProgram, e: Node, type: i32): Interval | null => {
  if (type !== T_I32 || e.kind !== N_CALL || program.nodeCallees[e.id] !== null) {
    return null
  }
  const callee = e.children[0]
  if (callee.kind !== N_MEMBER || callee.text !== "clz32") {
    return null
  }
  const receiver = callee.children[0]
  if (receiver.kind !== N_IDENT || receiver.text !== "Math" || program.nodeTypes[receiver.id] >= 0) {
    return null
  }
  return new Interval(toI64(0), toI64(32))
}

// ---- Return ranges ----------------------------------------------------------------

/**
 * `"Ok"` or `"Err"` for a call to the builtin `Result` constructor of that
 * name, and `""` for anything else, a user function called `Ok` included
 * (`isResultConstructorCall` in src/emit-result.ts asks the same).
 */
const resultConstructor = (program: CheckedProgram, table: TypeTable, call: Node): string => {
  if (call.kind !== N_CALL || program.nodeCallees[call.id] !== null) {
    return ""
  }
  const callee = call.children[0]
  if (callee.kind !== N_IDENT || (callee.text !== "Ok" && callee.text !== "Err")) {
    return ""
  }
  return table.isResult(program.nodeTypes[call.id]) ? callee.text : ""
}

/**
 * The position of the parameter `e` reads the `Ok` payload of — `r.value`,
 * with `r` a parameter of the body being walked — or -1. The checker allows
 * `r.value` only where `r.isOk()` is proved, and a parameter is never
 * assigned, so the value is the payload the caller passed.
 */
const payloadParameter = (walk: BoundsWalk, e: Node): i32 => {
  if (e.kind !== N_MEMBER || e.text !== "value") {
    return -1
  }
  const receiver = unwrapBoundsParens(e.children[0])
  const local: Local | null = receiver.kind === N_IDENT ? walk.ctx.program.nodeLocals[receiver.id] : null
  if (local === null || local.storage !== STORAGE_PARAM || !walk.ctx.table.isResult(local.type)) {
    return -1
  }
  let k = 0
  for (const p of walk.returnParams) {
    if (p !== null && p === local) {
      return k
    }
    k = k + 1
  }
  return -1
}

/**
 * Add what `expr`, returned from the body being walked, can be to its
 * summary (`ReturnSummary`), in the state the return starts in. A return
 * whose expression writes a local is read before it runs, so it says nothing,
 * and neither does any return of a `Result` but `Ok(x)`, `Err(...)` and a call
 * with a summary of its own.
 */
const noteReturn = (walk: BoundsWalk, state: State, expr: Node): void => {
  if (walk.returns === null) {
    return
  }
  walk.callRanges = true
  gatherReturn(walk, state, expr)
  walk.callRanges = false
}

const gatherReturn = (walk: BoundsWalk, state: State, expr: Node): void => {
  const summary = walk.returns
  if (summary === null) {
    return
  }
  const ctx = walk.ctx
  const table = ctx.table
  const e = unwrapBoundsParens(expr)
  if (writesAnyLocal(ctx.program, e)) {
    walk.returns = null
    return
  }
  if (table.isResult(summary.type)) {
    const payload = table.baseOf(table.okOf(summary.type))
    const made = resultConstructor(ctx.program, table, e)
    if (made === "Err") {
      return
    }
    let range: Interval | null = null
    if (made === "Ok" && e.children[1].children.length === 1) {
      range = valueRange(walk, state, e.children[1].children[0], payload)
    } else if (e.kind === N_CALL) {
      range = calledPayload(walk, e, payload)
    }
    keepGathering(walk, summary, range, payload)
    return
  }
  const type = table.baseOf(summary.type)
  const k = payloadParameter(walk, e)
  if (k < 0) {
    keepGathering(walk, summary, valueRange(walk, state, e, type), type)
    return
  }
  const declared = walk.returnParams[k]
  if (declared === null || table.baseOf(table.okOf(declared.type)) !== type) {
    walk.returns = null
  } else if (summary.flows.indexOf(k) < 0) {
    summary.flows.push(k)
  }
}

/**
 * Join `range` into the summary being gathered, or stop gathering: when
 * nothing is known about a return, or when the summary has become the whole
 * of `type`, which proves nothing and is not worth a caller's walk.
 */
const keepGathering = (walk: BoundsWalk, summary: ReturnSummary, range: Interval | null, type: i32): void => {
  if (range === null) {
    walk.returns = null
    return
  }
  joinReturn(summary, range)
  if (summary.lo <= typeMin(type) && summary.hi >= typeMax(type)) {
    walk.returns = null
  }
}

/**
 * The summary of the function `call` calls, when it is one a summary can be
 * trusted for: a plain function — a method may be dispatched to another body —
 * with a body in the tables, called under its own name.
 */
const summaryOfCall = (walk: BoundsWalk, call: Node): ReturnSummary | null => {
  const tables = walk.tables
  const callee = walk.ctx.program.nodeCallees[call.id]
  if (!walk.callRanges || tables === null || callee === null) {
    return null
  }
  if (callee.role !== ROLE_FUNCTION || callee.instance !== null) {
    return null
  }
  return tables.returnOf(tables.at(walk.callees, call, callee))
}

/**
 * The range a call to a function with a return summary evaluates to at
 * `type`, or `null`: the summary's own range, joined with the payload range
 * of each argument whose payload it hands back (`payloadRange`).
 */
const callRange = (walk: BoundsWalk, state: State, call: Node, type: i32): Interval | null => {
  const ctx = walk.ctx
  const table = ctx.table
  const callee = ctx.program.nodeCallees[call.id]
  if (callee === null || table.isResult(callee.returnType) || table.baseOf(callee.returnType) !== type) {
    return null
  }
  const summary = summaryOfCall(walk, call)
  if (summary === null) {
    return null
  }
  const out = new ReturnSummary(summary.type)
  if (summary.known) {
    joinReturn(out, new Interval(summary.lo, summary.hi))
  }
  const args = call.children[1].children
  for (const k of summary.flows) {
    if (k < 0 || k >= args.length) {
      return null
    }
    joinReturn(out, payloadRange(walk, state, args[k], type))
  }
  return out.known ? new Interval(out.lo, out.hi) : null
}

/**
 * The range of the `Ok` payload a call to a function returning a `Result`
 * hands back, from its summary, or `null`. Its summary says nothing about a
 * payload a parameter passes on, which a `Result` summary never records.
 */
const calledPayload = (walk: BoundsWalk, call: Node, type: i32): Interval | null => {
  const ctx = walk.ctx
  const table = ctx.table
  const callee = ctx.program.nodeCallees[call.id]
  if (callee === null || !table.isResult(callee.returnType)) {
    return null
  }
  if (table.baseOf(table.okOf(callee.returnType)) !== type) {
    return null
  }
  const summary = summaryOfCall(walk, call)
  if (summary === null || !summary.known || summary.flows.length > 0) {
    return null
  }
  return new Interval(summary.lo, summary.hi)
}

/** The range of the `Ok` payload `arg`, a `Result`, can carry: from `Ok(x)` or a summarised call, else the whole type. */
const payloadRange = (walk: BoundsWalk, state: State, arg: Node, type: i32): Interval => {
  const ctx = walk.ctx
  const e = unwrapBoundsParens(arg)
  if (resultConstructor(ctx.program, ctx.table, e) === "Ok" && e.children[1].children.length === 1) {
    return valueRange(walk, state, e.children[1].children[0], type)
  }
  const passed: Interval | null = e.kind === N_CALL ? calledPayload(walk, e, type) : null
  return passed !== null ? passed : new Interval(typeMin(type), typeMax(type))
}

/**
 * The range of an operator that cannot leave its operands' range by much and
 * cannot overflow at all: `x & c`, `x >> c`, `x >>> c`, `x % c` and `x / c`
 * for a non-negative literal `c`, or `null` for anything else. These are what
 * a hash folded into a table size or a byte pulled out of a word look like,
 * and the sum they feed is then proven.
 */
const maskedRange = (walk: BoundsWalk, state: State, e: Node, type: i32): Interval | null => {
  const ctx = walk.ctx
  if (e.kind !== N_BINARY || ctx.program.nodeTypes[e.id] < 0) {
    return null
  }
  if (ctx.table.baseOf(ctx.program.nodeTypes[e.id]) !== type) {
    return null
  }
  const op = e.text
  const literal = anyLiteral(e.children[1])
  const c = literal >= toI64(0) && literal < I32_MAX ? toI32(literal) : -1
  if (op === "&") {
    // Either side non-negative bounds the result by that side, whatever the other is.
    const a = valueRange(walk, state, e.children[0], type)
    const b = valueRange(walk, state, e.children[1], type)
    if (b.lo >= toI64(0) && (a.lo < toI64(0) || b.hi <= a.hi)) {
      return new Interval(toI64(0), b.hi)
    }
    if (a.lo >= toI64(0)) {
      return new Interval(toI64(0), a.hi)
    }
    return null
  }
  if (c < 0) {
    return null
  }
  const bits = type === T_I32 ? 32 : 64
  if (op === ">>" || op === ">>>") {
    const count = toI64(c & (bits - 1))
    const a = valueRange(walk, state, e.children[0], type)
    if (op === ">>" || a.lo >= toI64(0)) {
      // An arithmetic shift is monotone, and a logical one is the same shift on a non-negative value.
      return new Interval(a.lo >> count, a.hi >> count)
    }
    // A logical shift of anything by at least one is below `2^(bits - count)`.
    if (count >= toI64(1)) {
      return new Interval(toI64(0), typeMax(type) >> (count - toI64(1)))
    }
    return null
  }
  if ((op === "%" || op === "/") && c > 0) {
    const a = valueRange(walk, state, e.children[0], type)
    const divisor = toI64(c)
    if (op === "/") {
      // Truncation toward zero is monotone in the dividend.
      return new Interval(a.lo / divisor, a.hi / divisor)
    }
    const top = divisor - toI64(1)
    return new Interval(a.lo >= toI64(0) ? toI64(0) : -top, a.hi <= toI64(0) ? toI64(0) : top)
  }
  return null
}

// ---- Bounded accumulation -----------------------------------------------------------

/**
 * The bound a `for` loop's counter gives the number of passes, or -1 when it
 * gives none. The shape is `for (...; i < X; i++)` (or `<=`, or a step of
 * `i += c` with `c >= 1`) where the body writes `i` nowhere, `X` is a literal
 * or a local the loop does not write that the state bounds, and `i` has a
 * floor on the way in: each pass moves `i` up by at least one, and the pass
 * that would reach the bound is the condition's `false`.
 */
const passBound = (walk: BoundsWalk, state: State, loop: Node, effects: Effects): i64 => {
  const ctx = walk.ctx
  const cond = unwrapBoundsParens(loop.children[1])
  if (cond.kind !== N_BINARY || (cond.text !== "<" && cond.text !== "<=")) {
    return toI64(-1)
  }
  const i = indexLocal(ctx, cond.children[0])
  if (i === null || ctx.table.baseOf(i.type) !== T_I32 || !stepsByOne(ctx, loop.children[2], i)) {
    return toI64(-1)
  }
  if (contains(effects.clobbered, i) || contains(effects.decremented, i)) {
    return toI64(-1)
  }
  const strict = cond.text === "<"
  // `i < K` holds on every pass the body runs.
  let ceiling = toI64(-1)
  const literal = literalValue(cond.children[1])
  const bound = indexLocal(ctx, cond.children[1])
  if (literal >= 0) {
    ceiling = strict ? toI64(literal) : toI64(literal) + toI64(1)
  } else if (bound !== null && !writesVariable(effects, bound)) {
    const below = maxIndexOf(state, bound)
    if (below >= 0) {
      ceiling = strict ? toI64(below) - toI64(1) : toI64(below)
    }
  }
  const floor = minValueOf(state, i)
  if (ceiling < toI64(0) || floor < 0) {
    return toI64(-1)
  }
  return ceiling > toI64(floor) ? ceiling - toI64(floor) : toI64(0)
}

/** Whether `expr` names the local `v`. */
const isLocalNamed = (program: CheckedProgram, expr: Node, v: Local): boolean => {
  const named = localOf(program, expr)
  return named !== null && named === v
}

/** Whether `update` is `i++`, `++i`, `i += c` or `i = i + c` with `c >= 1`. */
const stepsByOne = (ctx: CheckContext, update: Node, i: Local): boolean => {
  const e = unwrapBoundsParens(update)
  if (e.kind === N_UNARY && e.text === "++") {
    return isLocalNamed(ctx.program, e.children[0], i)
  }
  if (e.kind !== N_BINARY || !isLocalNamed(ctx.program, e.children[0], i)) {
    return false
  }
  if (e.text === "+=") {
    return literalValue(e.children[1]) >= 1
  }
  return (
    e.text === "=" &&
    isIncrement(ctx.program, i, e.children[1]) &&
    literalValue(unwrapBoundsParens(e.children[1]).children[1]) >= 1
  )
}

/** One local's writes in a loop body, while they are all steps of a bounded size. */
class Accumulator {
  v: Local
  /** The sum of each site's largest step up, and of each site's largest step down (as a negative). */
  up: i64
  down: i64
  /** False once any write to `v` is not a bounded step, or sits in a nested loop. */
  bounded: boolean

  constructor(v: Local) {
    this.v = v
    this.up = toI64(0)
    this.down = toI64(0)
    this.bounded = true
  }
}

/** The accumulator for `v` in `list`, added when it is not there yet. */
const accumulatorOf = (list: Accumulator[], v: Local): Accumulator => {
  for (const a of list) {
    if (a.v === v) {
      return a
    }
  }
  const fresh = new Accumulator(v)
  list.push(fresh)
  return fresh
}

/** `2^31`: a step or a pass count past it is not one this proof multiplies. */
const STEP_LIMIT: i64 = 2147483648

/**
 * Note every write in `node` to a local: a step of a range no state can move —
 * a literal, `toI32` of a `u8`, a mask — counts once per pass when it is not
 * inside a nested loop, and anything else, or anything in a nested loop,
 * leaves the local unbounded.
 */
const collectSteps = (walk: BoundsWalk, node: Node, list: Accumulator[], nested: boolean): void => {
  const ctx = walk.ctx
  const steps = node.kind === N_UNARY && (node.text === "++" || node.text === "--")
  if ((node.kind === N_BINARY && isBoundsAssignment(node.text)) || steps) {
    const v = localOf(ctx.program, node.children[0])
    if (v !== null) {
      const a = accumulatorOf(list, v)
      const delta = stepRange(walk, node, v)
      if (nested || delta === null || ctx.table.baseOf(v.type) !== T_I32) {
        a.bounded = false
      } else {
        a.up = a.up + (delta.hi > toI64(0) ? delta.hi : toI64(0))
        a.down = a.down + (delta.lo < toI64(0) ? delta.lo : toI64(0))
      }
    }
  }
  const inner =
    nested || node.kind === N_FOR || node.kind === N_WHILE || node.kind === N_DO || node.kind === N_FOR_OF
  if (node.kind === N_ARROW) {
    return
  }
  for (const child of node.children) {
    if (child.children.length > 0) {
      collectSteps(walk, child, list, inner)
    }
  }
}

/** The range one write adds to `v`, or `null` when it is not a step of a state-free size. */
const stepRange = (walk: BoundsWalk, node: Node, v: Local): Interval | null => {
  const one = toI64(1)
  if (node.kind === N_UNARY) {
    return node.text === "++" ? new Interval(one, one) : new Interval(-one, -one)
  }
  let delta: Node | null = null
  let negate = false
  const rhs = unwrapBoundsParens(node.children[1])
  if (node.text === "+=" || node.text === "-=") {
    delta = node.children[1]
    negate = node.text === "-="
  } else if (node.text === "=" && rhs.kind === N_BINARY && (rhs.text === "+" || rhs.text === "-")) {
    if (isLocalNamed(walk.ctx.program, rhs.children[0], v)) {
      delta = rhs.children[1]
      negate = rhs.text === "-"
    } else if (rhs.text === "+" && isLocalNamed(walk.ctx.program, rhs.children[1], v)) {
      delta = rhs.children[0]
    }
  }
  if (delta === null || writesAnyLocal(walk.ctx.program, delta)) {
    return null
  }
  // An empty state: the range holds whatever the facts at the write are.
  const range = valueRange(walk, new State(walk.ctx.table), delta, T_I32)
  if (range.lo <= -STEP_LIMIT || range.hi >= STEP_LIMIT) {
    return null
  }
  return negate ? new Interval(-range.hi, -range.lo) : range
}

/**
 * The facts a bounded accumulation keeps at the top of a `for` loop, which
 * `forgetAcross` would otherwise drop: a local that every pass moves by at
 * most a bounded step, in a loop that makes at most `passBound` passes, stays
 * within its entry range widened by that many steps — on every pass, part way
 * through one, and after the loop. `sum = sum + toI32(buf[i])` over 256 bytes
 * is at most 65280, and `count++` once a pass under `i <= n` is at most `n`.
 * Checked arithmetic is what makes the steps steps: under `--wrapping` one can
 * land anywhere, so nothing is kept.
 */
const accumulatorFacts = (walk: BoundsWalk, state: State, loop: Node): Fact[] => {
  const ctx = walk.ctx
  const out: Fact[] = []
  if (ctx.wrapping || loop.children[1].kind === N_EMPTY) {
    return out
  }
  const effects = new Effects()
  collectEffects(walk, loop, effects)
  const passes = passBound(walk, state, loop, effects)
  if (passes < toI64(0) || passes >= STEP_LIMIT) {
    return out
  }
  const list: Accumulator[] = []
  collectSteps(walk, loop.children[3], list, false)
  // A write in the condition or the update runs on a schedule of its own,
  // which the per-pass count does not cover.
  const head = new Effects()
  collectEffects(walk, loop.children[1], head)
  collectEffects(walk, loop.children[2], head)
  for (const a of list) {
    if (!a.bounded || a.up >= STEP_LIMIT || a.down <= -STEP_LIMIT || writesVariable(head, a.v)) {
      continue
    }
    const up = a.up * passes
    const down = a.down * passes
    const lo = localLow(state, a.v, T_I32) + down
    const hi = localHigh(state, a.v, T_I32) + up
    if (lo >= toI64(0) && lo < I32_MAX) {
      out.push(new Fact(FACT_MIN_VALUE, a.v, null, toI32(lo)))
    }
    if (hi >= toI64(0) && hi < I32_MAX - toI64(1)) {
      out.push(new Fact(FACT_MAX_INDEX, a.v, null, toI32(hi) + 1))
    }
  }
  return out
}

/**
 * The range of the builtin `toI64(x)` for an `x` that is an `i32`, a `u8`, a
 * `u16` or a `u32`: `x`'s own, since the conversion widens without changing
 * the value. It is what proves `toI64(a) * toI64(b)` cannot overflow, and the
 * `i64` arithmetic on a value that is really a bit or a byte.
 */
const widenedRange = (walk: BoundsWalk, state: State, e: Node, type: i32): Interval | null => {
  const program = walk.ctx.program
  if (type !== T_I64 || e.kind !== N_CALL || !isBuiltinConversion(program, e, "toI64")) {
    return null
  }
  const x = e.children[1].children[0]
  const from = walk.ctx.table.baseOf(program.nodeTypes[x.id])
  if (from === T_I32) {
    return valueRange(walk, state, x, T_I32)
  }
  if (from === T_U8 || from === T_U16 || from === T_U32) {
    const declared = walk.ctx.table.declaredRange(from)
    return declared !== null ? new Interval(declared.lo, declared.hi) : null
  }
  return null
}

/** Whether evaluating `node` assigns, increments or decrements any local. */
const writesAnyLocal = (program: CheckedProgram, node: Node): boolean => {
  const steps = node.kind === N_UNARY && (node.text === "++" || node.text === "--")
  if ((node.kind === N_BINARY && isBoundsAssignment(node.text)) || steps) {
    if (localOf(program, node.children[0]) !== null) {
      return true
    }
  }
  for (const child of node.children) {
    if (writesAnyLocal(program, child)) {
      return true
    }
  }
  return false
}

/**
 * Record the verdict for one checked operation, in the state its operands
 * left. `left` is what the operator reads first — the target of a compound
 * assignment or a step — and `right` the other operand, or `null` for a
 * unary one. An increment or a decrement adds one. Pass 2 judges every
 * body, and `src/ranges.ts` judges again what is left with what the callers
 * prove about the parameters, as it does an access: a loop bounded by a
 * parameter every caller passes a literal for is where that pays.
 */
const judgeOverflow = (walk: BoundsWalk, state: State, node: Node, left: Node, right: Node | null): void => {
  const ctx = walk.ctx
  if (ctx.wrapping) {
    return
  }
  const type = checkedArithmeticType(ctx.program, ctx.table, node)
  if (type < 0 || ctx.program.nodeProvenNoOverflow[node.id]) {
    return
  }
  // The target of `x op= e` and of `x++` is written by the node itself, after
  // the operator; only what runs before it may not write.
  if (writesAnyLocal(ctx.program, left) || (right !== null && writesAnyLocal(ctx.program, right))) {
    return
  }
  walk.callRanges = true
  const a = valueRange(walk, state, left, type)
  const one = toI64(1)
  const b = right === null ? new Interval(one, one) : valueRange(walk, state, right, type)
  walk.callRanges = false
  if (!fitsType(arithmeticOperator(node), a, b, type)) {
    return
  }
  walk.noOverflow.push(node)
  if (walk.record) {
    ctx.program.nodeProvenNoOverflow[node.id] = true
  }
}

// ---- What crosses a call (src/ranges.ts) -----------------------------------------

/**
 * What a call can do to the facts, as far as the whole program can tell: the
 * field names the callee, or anything it calls, may store to, and the record
 * types it may store whole. A summary exists only for a callee that resizes no
 * array — it calls nothing that could (`src/ranges.ts` builds them) — so a
 * call with one keeps every array length the caller knows, and every path
 * whose fields and links it leaves alone. Everything else is `null` and drops
 * them all, which is what every call does in pass 2.
 */
export class CallSummary {
  fields: string[]
  records: i32[]

  constructor() {
    this.fields = []
    this.records = []
  }
}

/**
 * The whole-program facts a walk may read, keyed by `FunctionSig.name`:
 * each function's `CallSummary` (`null` for one that may do anything), and
 * whether it takes entry facts from its call sites. `none` is the summary of a
 * call that stores nothing at all.
 */
/** What `RangeTables.callees` records for a call whose callee has no body in the tables. */
export const NOT_HERE: i32 = 1073741824

export class RangeTables {
  index: StringMap
  summaries: (CallSummary | null)[]
  candidates: boolean[]
  none: CallSummary
  /**
   * Per program, and in step with `programs`, what `index` answers for the
   * callee of each call and `new` node, plus one: `NOT_HERE` for a callee with
   * no body in the tables, and `0` for a node nobody recorded. A walk meets a
   * call once per round and again inside a loop, and a name lookup there cost
   * more than the rest of the call's handling.
   */
  programs: CheckedProgram[]
  callees: i32[][]
  /**
   * Per candidate, an empty `EntryFacts` once the fixpoint has entered it with
   * nothing (`settleEmpty`), and `null` until then. An empty entry stays empty,
   * so what a site proves for such a callee cannot change its join, and
   * `noteCallSite` hands it this rather than working it out.
   */
  settledEmpty: (EntryFacts | null)[]
  /**
   * Per body, what its returns are known to be (`ReturnSummary`), or `null`
   * for nothing known. `src/ranges.ts` sets one only from a walk of the body
   * under the entry it settles on, and clears them all if the fixpoint does
   * not settle, so a summary a walk reads is one every call of the body keeps.
   */
  returns: (ReturnSummary | null)[]

  constructor() {
    this.index = new StringMap()
    this.summaries = []
    this.candidates = []
    this.none = new CallSummary()
    this.programs = []
    this.callees = []
    this.settledEmpty = []
    this.returns = []
  }

  /** Record that the candidate at `at` is entered with nothing, which is for good. */
  settleEmpty(at: i32, empty: EntryFacts): void {
    while (this.settledEmpty.length <= at) {
      const none: EntryFacts | null = null
      this.settledEmpty.push(none)
    }
    if (at >= 0 && at < this.settledEmpty.length) {
      this.settledEmpty[at] = empty
    }
  }

  /** The callee table of `program`, made the first time it is asked for. */
  calleesOf(program: CheckedProgram): i32[] {
    let k = 0
    while (k < this.programs.length) {
      if (this.programs[k] === program) {
        return this.callees[k]
      }
      k = k + 1
    }
    const made = new Array<i32>(program.nodeCallees.length)
    this.programs.push(program)
    this.callees.push(made)
    return made
  }

  /**
   * The index of `sig`, the callee of `call`, read from `known` when it was
   * recorded there. A callee with no body here is recorded as `NOT_HERE`,
   * whose index is past every table, so it answers what `-1` does.
   */
  at(known: i32[], call: Node, sig: FunctionSig): i32 {
    const cached = call.id < known.length ? known[call.id] : 0
    return cached > 0 ? cached - 1 : this.index.get(sig.name, -1)
  }

  add(sig: FunctionSig, candidate: boolean): void {
    this.index.set(sig.name, this.summaries.length)
    const unknown: CallSummary | null = null
    this.summaries.push(unknown)
    this.candidates.push(candidate)
    const nothing: ReturnSummary | null = null
    this.returns.push(nothing)
  }

  returnOf(at: i32): ReturnSummary | null {
    return at < 0 || at >= this.returns.length ? null : this.returns[at]
  }

  setReturn(at: i32, summary: ReturnSummary | null): void {
    if (at >= 0 && at < this.returns.length) {
      this.returns[at] = summary
    }
  }

  /** Forget every return summary: what an unsettled fixpoint leaves is not known to hold. */
  clearReturns(): void {
    let k = 0
    while (k < this.returns.length) {
      this.returns[k] = null
      k = k + 1
    }
  }

  dropCandidate(at: i32): void {
    if (at >= 0 && at < this.candidates.length) {
      this.candidates[at] = false
    }
  }

  setSummary(at: i32, summary: CallSummary): void {
    if (at >= 0 && at < this.summaries.length) {
      this.summaries[at] = summary
    }
  }

  summaryOf(at: i32): CallSummary | null {
    return at < 0 || at >= this.summaries.length ? null : this.summaries[at]
  }

  isCandidate(at: i32): boolean {
    return at >= 0 && at < this.candidates.length && this.candidates[at]
  }
}

/**
 * Whether `node`, an access pass 2 left checked or a `substring` call, is one
 * some walk could still prove, whatever the state it is judged in. `judge`
 * proves nothing without a holder, and `proves` nothing unless the index is a
 * literal or a bare local of an integer type; `provesClamp` needs a local
 * receiver for anything but a literal `0`, which pass 2 has already folded.
 * All of that is read off the syntax and the declared types, so an access
 * this answers `false` for keeps its check under every entry fact and every
 * summary there could be.
 */
export const isOpenAccess = (ctx: CheckContext, node: Node): boolean => {
  const program = ctx.program
  if (node.kind === N_INDEX) {
    return !program.nodeProvenIndex[node.id] && couldProve(ctx, node.children[0], node.children[1])
  }
  if (node.kind !== N_CALL) {
    return false
  }
  const callee = unwrapBoundsParens(node.children[0])
  if (isCharCodeAt(ctx, node)) {
    return (
      !program.nodeProvenIndex[node.id] && couldProve(ctx, callee.children[0], node.children[1].children[0])
    )
  }
  if (!isSubstringCall(ctx, node) || lengthHolder(ctx, callee.children[0]) === null) {
    return false
  }
  for (const bound of node.children[1].children) {
    if (!program.nodeProvenClamp[bound.id] && (literalValue(bound) >= 0 || indexLocal(ctx, bound) !== null)) {
      return true
    }
  }
  return false
}

/** Whether `holderOf` answers for `receiver` at all, and `proves` reads `index`. */
const couldProve = (ctx: CheckContext, receiver: Node, index: Node): boolean => {
  if (literalValue(index) < 0 && indexLocal(ctx, index) === null) {
    return false
  }
  if (lengthHolder(ctx, receiver) !== null) {
    return true
  }
  const fields: string[] = []
  const links: i32[] = []
  const type = declaredPathType(ctx, receiver, fields, links)
  return fields.length > 0 && type >= 0 && (ctx.table.isArray(type) || type === T_STRING)
}

/** A value no call can reach memory through: a number, a boolean or a string, which is immutable. */
const inertType = (type: i32): boolean =>
  type >= 0 && (isNumeric(type) || type === T_BOOL || type === T_STRING)

const inertOperands = (program: CheckedProgram, args: Node[]): boolean => {
  for (const arg of args) {
    if (!inertType(program.nodeTypes[arg.id])) {
      return false
    }
  }
  return true
}

/**
 * What `call` (an `N_CALL` or an `N_NEW`) may do, or `null` for "anything a
 * call can". A user function answers with its summary. A builtin, or a `new`
 * with no constructor, can reach memory only through what it is handed —
 * there is no mutable module state, and no function value to call back
 * through — so one handed nothing but numbers, booleans and strings stores
 * nothing and resizes nothing. `Arena` is the exception, and it is named: a
 * release takes no reference and still hands the memory behind every array
 * built since the mark to whatever allocates next.
 */
const callSummary = (walk: BoundsWalk, call: Node): CallSummary | null => {
  const tables = walk.tables
  if (tables === null) {
    return null
  }
  const callee = walk.ctx.program.nodeCallees[call.id]
  if (callee !== null) {
    return tables.summaryOf(tables.at(walk.callees, call, callee))
  }
  return isInertBuiltin(walk.ctx.program, call) ? tables.none : null
}

/** A call with no user function behind it, handed nothing a store could reach (`callSummary`). */
export const isInertBuiltin = (program: CheckedProgram, call: Node): boolean => {
  if (program.nodeCallees[call.id] !== null) {
    return false
  }
  if (call.kind === N_NEW) {
    return inertOperands(program, call.children[2].children)
  }
  const target = unwrapBoundsParens(call.children[0])
  if (target.kind === N_MEMBER) {
    const receiver = unwrapBoundsParens(target.children[0])
    const type = program.nodeTypes[receiver.id]
    const namespace =
      receiver.kind === N_IDENT && program.nodeLocals[receiver.id] === null && receiver.text !== "Arena"
    if (!inertType(type) && !(type < 0 && namespace)) {
      return false
    }
  } else if (target.kind !== N_IDENT) {
    return false
  }
  return inertOperands(program, call.children[1].children)
}

/** What a call leaves: its summary's stores, or every array length and every path. */
const applyCallEffects = (walk: BoundsWalk, state: State, call: Node): void => {
  const summary = callSummary(walk, call)
  if (summary === null) {
    forgetCallEffects(walk, state)
    return
  }
  for (const field of summary.fields) {
    forgetPathsThrough(walk, state, field)
  }
  for (const stored of summary.records) {
    forgetPathsRecord(walk, state, stored)
  }
}

/**
 * The facts that hold where a function is entered, stated against its
 * parameters by position — `params[0]` is `this` for a method — so that one
 * call site's facts and another's can be compared. Per parameter, a floor
 * (`p >= floor`, -1 for none) and a `maxIndex` (`p < n`, -1 for none); then
 * a list of length facts, each about a holder named by a parameter and the
 * fields read off it (`fields`, empty for the parameter itself):
 * `FACT_MIN_LENGTH` with its `values`, or
 * `FACT_BELOW` / `FACT_AT_MOST` with the parameter that is the index.
 */
/**
 * What a function's returns are known to be, for a call site to read
 * (`callRange`). For a function returning `i32` or `i64` it is the value's
 * range; for one returning a `Result` whose `Ok` arm is one of those it is the
 * `Ok` payload's, its `Err` returns adding nothing. `lo`/`hi` is the join of
 * every return the walk put a range on, once `known`, and `flows` the
 * parameters whose own `Ok` payload a `return r.value` hands back unchanged:
 * only a call site knows a range for that, from its argument
 * (`payloadRange`). A summary with neither says nothing.
 */
export class ReturnSummary {
  lo: i64
  hi: i64
  flows: i32[]
  /** The declared return type it describes. */
  type: i32
  known: boolean

  constructor(type: i32) {
    this.lo = toI64(0)
    this.hi = toI64(0)
    this.flows = []
    this.type = type
    this.known = false
  }
}

/** Whether two summaries say the same thing; `null` is nothing known. */
export const sameReturn = (a: ReturnSummary | null, b: ReturnSummary | null): boolean => {
  if (a === null || b === null) {
    return a === null && b === null
  }
  if (a.known !== b.known || a.flows.length !== b.flows.length) {
    return false
  }
  if (a.known && (a.lo !== b.lo || a.hi !== b.hi)) {
    return false
  }
  for (const k of a.flows) {
    if (b.flows.indexOf(k) < 0) {
      return false
    }
  }
  return true
}

/** The summary a finished walk gathered, or `null` when it cannot be used. */
export const gatheredReturn = (walk: BoundsWalk): ReturnSummary | null => {
  const gathered = walk.returns
  if (gathered === null || walk.done) {
    return null
  }
  if (!gathered.known && gathered.flows.length === 0) {
    return null
  }
  return gathered
}

const joinReturn = (summary: ReturnSummary, range: Interval): void => {
  if (summary.known && summary.lo <= range.lo && range.hi <= summary.hi) {
    return
  }
  if (!summary.known) {
    summary.lo = range.lo
    summary.hi = range.hi
    summary.known = true
    return
  }
  if (range.lo < summary.lo) {
    summary.lo = range.lo
  }
  if (range.hi > summary.hi) {
    summary.hi = range.hi
  }
}

export class EntryFacts {
  floor: i32[]
  maxIndex: i32[]
  kinds: i32[]
  index: i32[]
  roots: i32[]
  fields: string[][]
  values: i32[]

  constructor(count: i32) {
    this.floor = []
    this.maxIndex = []
    let k = 0
    while (k < count) {
      this.floor.push(-1)
      this.maxIndex.push(-1)
      k = k + 1
    }
    this.kinds = []
    this.index = []
    this.roots = []
    this.fields = []
    this.values = []
  }

  addLength(kind: i32, index: i32, root: i32, fields: string[], value: i32): void {
    if (this.find(kind, index, root, fields) >= 0) {
      return
    }
    this.kinds.push(kind)
    this.index.push(index)
    this.roots.push(root)
    this.fields.push(fields)
    this.values.push(value)
  }

  find(kind: i32, index: i32, root: i32, fields: string[]): i32 {
    let k = 0
    while (k < this.kinds.length) {
      if (
        this.kinds[k] === kind &&
        this.index[k] === index &&
        this.roots[k] === root &&
        sameFields(this.fields[k], fields)
      ) {
        return k
      }
      k = k + 1
    }
    return -1
  }

  isEmpty(): boolean {
    if (this.kinds.length > 0) {
      return false
    }
    let k = 0
    while (k < this.floor.length) {
      if (this.floor[k] >= 0 || this.maxIndex[k] >= 0) {
        return false
      }
      k = k + 1
    }
    return true
  }
}

/**
 * What holds at both of two call sites: the lower floor, the higher `maxIndex`,
 * the shorter minimum length, and a relation only where both state it.
 */
/** How many times a parameter's floor or bound may move before the entry fixpoint drops it. */
const WIDEN_AFTER: i32 = 16

/**
 * `next`, with the floor and the bound of every parameter that has now moved
 * more than `WIDEN_AFTER` times dropped. A bound an argument computes —
 * `walk(depth + 1)` — can climb by one per round for as long as the recursion
 * is unbounded, and the fixpoint would run out of rounds and keep no entry
 * fact anywhere; dropping that one parameter's bound is what lets it settle.
 * A recursion that does stop (AWFY Queens' `placeQueen(c + 1)` behind
 * `c === 7`) settles in fewer moves than that. `moves` is the count so far,
 * one per parameter, kept by the caller for each function.
 */
export const widenEntryFacts = (now: EntryFacts, next: EntryFacts, moves: i32[]): EntryFacts => {
  let widened: EntryFacts | null = null
  let k = 0
  while (k < next.floor.length && k < now.floor.length && k < moves.length) {
    if (next.floor[k] !== now.floor[k] || next.maxIndex[k] !== now.maxIndex[k]) {
      moves[k] = moves[k] + 1
      if (moves[k] > WIDEN_AFTER && (next.floor[k] >= 0 || next.maxIndex[k] >= 0)) {
        const copy: EntryFacts = widened !== null ? widened : copyEntryFacts(next)
        copy.floor[k] = -1
        copy.maxIndex[k] = -1
        widened = copy
      }
    }
    k = k + 1
  }
  return widened !== null ? widened : next
}

/** A copy of `facts` whose per-parameter floors and bounds can be changed alone. */
const copyEntryFacts = (facts: EntryFacts): EntryFacts => {
  const out = new EntryFacts(0)
  for (const f of facts.floor) {
    out.floor.push(f)
  }
  for (const m of facts.maxIndex) {
    out.maxIndex.push(m)
  }
  out.kinds = facts.kinds
  out.index = facts.index
  out.roots = facts.roots
  out.fields = facts.fields
  out.values = facts.values
  return out
}

export const joinEntryFacts = (a: EntryFacts, b: EntryFacts): EntryFacts => {
  const out = new EntryFacts(a.floor.length)
  let k = 0
  while (k < a.floor.length && k < b.floor.length) {
    if (a.floor[k] >= 0 && b.floor[k] >= 0) {
      out.floor[k] = a.floor[k] < b.floor[k] ? a.floor[k] : b.floor[k]
    }
    if (a.maxIndex[k] >= 0 && b.maxIndex[k] >= 0) {
      out.maxIndex[k] = a.maxIndex[k] > b.maxIndex[k] ? a.maxIndex[k] : b.maxIndex[k]
    }
    k = k + 1
  }
  k = 0
  while (k < a.kinds.length) {
    const other = b.find(a.kinds[k], a.index[k], a.roots[k], a.fields[k])
    if (other >= 0) {
      const value = a.values[k] < b.values[other] ? a.values[k] : b.values[other]
      out.addLength(a.kinds[k], a.index[k], a.roots[k], a.fields[k], value)
    }
    k = k + 1
  }
  return out
}

/** Whether two sets of entry facts say the same thing, which is when the fixpoint stops. */
export const sameEntryFacts = (a: EntryFacts, b: EntryFacts): boolean => {
  if (a.floor.length !== b.floor.length || a.kinds.length !== b.kinds.length) {
    return false
  }
  let k = 0
  while (k < a.floor.length) {
    if (a.floor[k] !== b.floor[k] || a.maxIndex[k] !== b.maxIndex[k]) {
      return false
    }
    k = k + 1
  }
  k = 0
  while (k < a.kinds.length) {
    const other = b.find(a.kinds[k], a.index[k], a.roots[k], a.fields[k])
    if (other < 0 || b.values[other] !== a.values[k]) {
      return false
    }
    k = k + 1
  }
  return true
}

/** One call to a function that takes entry facts, and what the call proves for it. */
export class RangeSite {
  call: Node
  callee: FunctionSig
  /** The callee's index in `RangeTables`. */
  at: i32
  facts: EntryFacts

  constructor(call: Node, callee: FunctionSig, at: i32, facts: EntryFacts) {
    this.call = call
    this.callee = callee
    this.at = at
    this.facts = facts
  }
}

const noteCallSite = (walk: BoundsWalk, state: State, call: Node): void => {
  const tables = walk.tables
  const callee = walk.ctx.program.nodeCallees[call.id]
  if (tables === null || callee === null) {
    return
  }
  const at = tables.at(walk.callees, call, callee)
  if (tables.isCandidate(at)) {
    let settled: EntryFacts | null = null
    if (at < tables.settledEmpty.length) {
      settled = tables.settledEmpty[at]
    }
    const facts = settled !== null ? settled : siteFacts(walk, state, call, callee)
    walk.sites.push(new RangeSite(call, callee, at, facts))
    if (walk.stopAfter >= 0 && walk.sites.length >= walk.stopAfter) {
      walk.done = true
    }
  }
}

/** Whether evaluating something with these `effects` can write `v`. */
const writesVariable = (effects: Effects, v: Local): boolean =>
  contains(effects.stepped, v) || contains(effects.decremented, v) || contains(effects.clobbered, v)

/**
 * What one call site proves for its callee's parameters, read off `state`,
 * which is the state once every argument has run. The receiver and the
 * arguments are evaluated in order before the call, so a fact about the local
 * an argument named is a fact about the value passed only while nothing
 * evaluated after it writes that local; and a fact about a path read off an
 * argument is one about the object passed only while nothing after it stores
 * to a link of the path, or calls something that might.
 */
const siteFacts = (walk: BoundsWalk, state: State, call: Node, callee: FunctionSig): EntryFacts => {
  const count = callee.paramNames.length
  const out = new EntryFacts(count)
  const args: Node[] = []
  const target = unwrapBoundsParens(call.children[0])
  if (callee.role === ROLE_METHOD) {
    if (target.kind !== N_MEMBER) {
      return out
    }
    args.push(target.children[0])
  }
  for (const arg of call.children[1].children) {
    args.push(arg)
  }
  if (args.length !== count) {
    return out
  }
  // Past the last argument that can write anything, the later arguments
  // have no effects to collect.
  let quiet = args.length
  while (quiet > 0 && !mayWrite(walk.ctx, args[quiet - 1])) {
    quiet = quiet - 1
  }
  // Per parameter: the caller's local an index was read from, and the root
  // and fields a holder was.
  const indexVars: (Local | null)[] = []
  const holderRoots: (Local | null)[] = []
  const holderFields: string[][] = []
  let k = 0
  for (const arg of args) {
    let indexVar: Local | null = null
    let holderRoot: Local | null = null
    let fields: string[] = []
    const type = callee.paramTypes[k]
    if (isIndexType(walk.ctx.table, type)) {
      const constant = literalValue(arg)
      const v = indexLocal(walk.ctx, arg)
      if (constant >= 0) {
        out.floor[k] = constant
        out.maxIndex[k] = constant + 1
      } else if (
        v !== null &&
        v.type === type &&
        (k + 1 >= quiet || !writesVariable(laterEffects(walk, args, k), v))
      ) {
        // The same type, or no fact at all: an `i32` with an upper bound and
        // no floor may be negative, and handed to a `u32` it is not below
        // anything.
        indexVar = v
        out.floor[k] = minValueOf(state, v)
        out.maxIndex[k] = maxIndexOf(state, v)
      } else if (v === null && k + 1 >= quiet) {
        arithmeticSiteFacts(walk, state, arg, type, out, k)
      }
    } else {
      const links: i32[] = []
      const root = argumentRoot(walk, arg, fields, links)
      if (root !== null && k + 1 >= quiet) {
        holderRoot = root
      } else if (root !== null) {
        const later = laterEffects(walk, args, k)
        const moved = later.calls || later.records.length > 0 || sharesField(later.fields, fields)
        if (!writesVariable(later, root) && (fields.length === 0 || !moved)) {
          holderRoot = root
        }
      }
      if (holderRoot === null) {
        fields = []
      }
    }
    indexVars.push(indexVar)
    holderRoots.push(holderRoot)
    holderFields.push(fields)
    k = k + 1
  }
  let r = 0
  for (const root of holderRoots) {
    if (root !== null && r < holderFields.length) {
      mapHolderFacts(walk, state, out, r, root, holderFields[r], indexVars)
    }
    r = r + 1
  }
  return out
}

/**
 * The floor and bound an `i32` argument computed by arithmetic gives its
 * parameter: `placeQueen(c + 1)` behind `if (c === 7) return` hands on
 * `c + 1 <= 7` once `c` is known below 8, which is what lets the recursion's
 * entry settle at `[0, 7]` (`valueRange`). Only for the last argument that can
 * write anything or later, so nothing evaluated after it rebinds what it read,
 * only for one that writes no local itself, and never under `--wrapping`,
 * where the range is not one.
 */
const arithmeticSiteFacts = (
  walk: BoundsWalk,
  state: State,
  arg: Node,
  type: i32,
  out: EntryFacts,
  k: i32
): void => {
  const ctx = walk.ctx
  const e = unwrapBoundsParens(arg)
  if (ctx.wrapping || e.kind !== N_BINARY || ctx.table.baseOf(type) !== T_I32) {
    return
  }
  if (ctx.program.nodeTypes[e.id] !== type || writesAnyLocal(ctx.program, e)) {
    return
  }
  const range = valueRange(walk, state, e, T_I32)
  if (range.lo >= toI64(0) && range.lo < I32_MAX) {
    out.floor[k] = toI32(range.lo)
  }
  if (range.hi >= toI64(0) && range.hi < I32_MAX - toI64(1)) {
    out.maxIndex[k] = toI32(range.hi) + 1
  }
}

/**
 * Whether evaluating `node` could put anything in an `Effects`: a call or a
 * `new`, an assignment, or a step. `collectEffects` finds nothing in a node
 * this answers `false` for.
 */
const mayWrite = (ctx: CheckContext, node: Node): boolean => {
  if (node.kind === N_NEW || (node.kind === N_CALL && !callsNothing(ctx, node))) {
    return true
  }
  if (node.kind === N_BINARY && isBoundsAssignment(node.text)) {
    return true
  }
  if (node.kind === N_UNARY && (node.text === "++" || node.text === "--")) {
    return true
  }
  for (const child of node.children) {
    if (mayWrite(ctx, child)) {
      return true
    }
  }
  return false
}

/** What evaluating every argument after the `k`th can do. */
const laterEffects = (walk: BoundsWalk, args: Node[], k: i32): Effects => {
  const later = new Effects()
  let j = 0
  for (const next of args) {
    if (j > k) {
      collectEffects(walk, next, later)
    }
    j = j + 1
  }
  return later
}

/**
 * The local an argument is rooted at, pushing the fields it reads off it on to
 * `fields`: a local or `this` alone, or a path of plain struct links from one.
 * `null` for anything else.
 */
const argumentRoot = (walk: BoundsWalk, arg: Node, fields: string[], links: i32[]): Local | null => {
  const program = walk.ctx.program
  let e = unwrapBoundsParens(arg)
  if (e.kind === N_MEMBER && declaredPathType(walk.ctx, e, fields, links) < 0) {
    return null
  }
  while (e.kind === N_MEMBER) {
    e = unwrapBoundsParens(e.children[0])
  }
  if (e.kind !== N_IDENT && e.kind !== N_THIS) {
    return null
  }
  return program.nodeLocals[e.id]
}

const sharesField = (stored: string[], fields: string[]): boolean => {
  for (const field of fields) {
    if (stored.indexOf(field) >= 0) {
      return true
    }
  }
  return false
}

/**
 * The length facts of every caller holder that parameter `r` reaches — the
 * argument itself, and every path the caller has facts about that extends it
 * — restated against `r` and the fields past the argument.
 */
const mapHolderFacts = (
  walk: BoundsWalk,
  state: State,
  out: EntryFacts,
  r: i32,
  root: Local,
  prefix: string[],
  indexVars: (Local | null)[]
): void => {
  if (prefix.length === 0 && (walk.ctx.table.isArray(root.type) || root.type === T_STRING)) {
    mapOneHolder(state, out, r, root, [], indexVars)
  }
  for (const path of walk.paths) {
    if (path.root !== root || path.fields.length < prefix.length) {
      continue
    }
    let k = 0
    let matches = true
    while (k < prefix.length) {
      if (path.fields[k] !== prefix[k]) {
        matches = false
      }
      k = k + 1
    }
    if (!matches) {
      continue
    }
    const rest: string[] = []
    while (k < path.fields.length) {
      rest.push(path.fields[k])
      k = k + 1
    }
    mapOneHolder(state, out, r, path.holder, rest, indexVars)
  }
}

const mapOneHolder = (
  state: State,
  out: EntryFacts,
  r: i32,
  holder: Local,
  rest: string[],
  indexVars: (Local | null)[]
): void => {
  const length = minLengthOf(state, holder)
  if (length > 0) {
    out.addLength(FACT_MIN_LENGTH, -1, r, rest, length)
  }
  let k = 0
  while (k < indexVars.length) {
    const v = indexVars[k]
    if (v !== null && knownBelow(state, v, holder)) {
      out.addLength(FACT_BELOW, k, r, rest, 0)
    } else if (v !== null && knownAtMost(state, v, holder)) {
      out.addLength(FACT_AT_MOST, k, r, rest, 0)
    }
    k = k + 1
  }
}

/**
 * The `Local` of each of `sig`'s parameters as `body` uses them, by position,
 * or `null` for one it never reads. The checker binds a parameter to a fresh
 * `Local` in a scope it does not keep, so the uses are where it is found; an
 * arrow's own parameters are not this function's, and its body is skipped.
 */
export const parameterLocals = (program: CheckedProgram, sig: FunctionSig, body: Node): (Local | null)[] => {
  const out: (Local | null)[] = []
  while (out.length < sig.paramNames.length) {
    out.push(null)
  }
  findParameters(program, body, sig.paramNames, out, out.length)
  return out
}

/**
 * Fill each still empty slot of `out` with the first use, in tree order, of
 * the parameter of that name, in one pass for all of them. `left` is how many
 * slots are empty, and the answer is how many still are, so that the search
 * stops when none is.
 */
const findParameters = (
  program: CheckedProgram,
  node: Node,
  names: string[],
  out: (Local | null)[],
  left: i32
): i32 => {
  if (node.kind === N_ARROW) {
    return left
  }
  let empty = left
  if (node.kind === N_IDENT || node.kind === N_THIS) {
    const local = program.nodeLocals[node.id]
    if (local !== null && local.storage === STORAGE_PARAM) {
      const k = names.indexOf(local.name)
      if (k >= 0 && k < out.length && out[k] === null) {
        out[k] = local
        empty = empty - 1
      }
    }
  }
  for (const child of node.children) {
    if (empty === 0) {
      return 0
    }
    empty = findParameters(program, child, names, out, empty)
  }
  return empty
}

/** Put `entering` into `state`, stated against the parameters' own locals (`parameterLocals`). */
const seedEntry = (walk: BoundsWalk, state: State, params: (Local | null)[], entering: EntryFacts): void => {
  let k = 0
  while (k < params.length && k < entering.floor.length) {
    const p = params[k]
    if (p !== null && isIndexType(walk.ctx.table, p.type)) {
      if (entering.floor[k] >= 0) {
        addFact(state, new Fact(FACT_MIN_VALUE, p, null, entering.floor[k]))
      }
      if (entering.maxIndex[k] >= 0) {
        addFact(state, new Fact(FACT_MAX_INDEX, p, null, entering.maxIndex[k]))
      }
    }
    k = k + 1
  }
  k = 0
  while (k < entering.kinds.length) {
    const root = params[entering.roots[k]]
    let holder: Local | null = null
    if (root !== null && entering.fields[k].length === 0) {
      holder = walk.ctx.table.isArray(root.type) || root.type === T_STRING ? root : null
    } else if (root !== null) {
      holder = internPath(walk, root, entering.fields[k])
    }
    if (holder !== null && entering.kinds[k] === FACT_MIN_LENGTH) {
      addFact(state, new Fact(FACT_MIN_LENGTH, holder, null, entering.values[k]))
    } else if (holder !== null && entering.index[k] >= 0) {
      const i = params[entering.index[k]]
      if (i !== null && isIndexType(walk.ctx.table, i.type)) {
        addFact(state, new Fact(entering.kinds[k], i, holder, 0))
      }
    }
    k = k + 1
  }
}

/**
 * Record what an unrecorded walk proved, once its caller knows the facts it
 * started from hold: `src/ranges.ts` knows that when the entry fixpoint has
 * settled, and the last walk of a body was the one under its settled entry.
 */
export const commitProofs = (program: CheckedProgram, walk: BoundsWalk): void => {
  for (const node of walk.proved) {
    program.nodeProvenIndex[node.id] = true
  }
  for (const bound of walk.clamps) {
    program.nodeProvenClamp[bound.id] = true
  }
  for (const node of walk.noOverflow) {
    program.nodeProvenNoOverflow[node.id] = true
  }
}

/**
 * WP33 NL8002: record in `nodeProvenClamp` each `slice` bound of `body` that
 * the `substring` proof, or the length of an ASCII literal receiver, places
 * inside `[0, s.length]`, and nothing else. The portability pass calls it once
 * per body it walks, before it reads a `slice` verdict, so a compile without
 * `--warn-portability` never does this work.
 *
 * It is the pass-2 walk — the facts the body proves by itself, with no entry
 * facts from its callers, which `src/ranges.ts` adds to `substring` verdicts —
 * run unrecorded, so every other verdict it reaches is thrown away and the
 * side tables the emitter reads are exactly what they were. The context is a
 * fresh one over the checked program: the walk reads only its program, table
 * and flags, and it reports nothing into the sink it is given.
 */
export const proveSliceBounds = (
  program: CheckedProgram,
  table: TypeTable,
  opts: Options,
  body: Node
): void => {
  const ctx = new CheckContext(
    table,
    program,
    new DiagnosticSink(),
    opts.numberMode,
    program.wrapping,
    program.uncheckedIndexing,
    opts.strictExports
  )
  const walk = new BoundsWalk(ctx, program.uncheckedIndexing)
  const proved: Node[] = []
  walk.record = false
  walk.sliceClamps = proved
  const state = new State(table)
  if (body.kind === N_BLOCK) {
    walkBoundsStatement(walk, state, body)
  } else {
    walkExpression(walk, state, body)
  }
  for (const bound of proved) {
    program.nodeProvenClamp[bound.id] = true
  }
}

/**
 * Walk one body the way `analyzeBounds` does, with what the whole program
 * knows: callee summaries in `tables`, and `entering` — or nothing — as the facts
 * that hold where it starts, stated against `params` (`parameterLocals`).
 * `callees` is the body's program's table from `RangeTables.calleesOf`. The
 * walk comes back with the call sites it saw and, when `record` is set, the
 * proofs it added. An unrecorded walk stops once it has noted `stopAfter`
 * sites, when that is not -1: its proofs are then only what it proved before.
 */
export const walkWithRanges = (
  ctx: CheckContext,
  params: (Local | null)[],
  body: Node,
  tables: RangeTables,
  callees: i32[],
  entering: EntryFacts | null,
  record: boolean,
  stopAfter: i32,
  returnType: i32,
  returnParams: (Local | null)[]
): BoundsWalk => {
  const walk = new BoundsWalk(ctx, ctx.uncheckedIndexing)
  walk.tables = tables
  walk.callees = callees
  walk.record = record
  walk.stopAfter = record ? -1 : stopAfter
  if (returnType >= 0) {
    walk.returns = new ReturnSummary(returnType)
    walk.returnParams = returnParams
    walk.stopAfter = -1
  }
  const state = new State(ctx.table)
  if (entering !== null && !entering.isEmpty()) {
    seedEntry(walk, state, params, entering)
  }
  if (body.kind === N_BLOCK) {
    walkBoundsStatement(walk, state, body)
  } else {
    // An arrow written as an expression returns it.
    noteReturn(walk, state, body)
    walkExpression(walk, state, body)
  }
  return walk
}
