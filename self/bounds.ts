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
// in `self/checker.ts` names the guard that would have proved it.
//
// The same facts answer a second question, and it is not about a check.
// `s.substring(a, b)` clamps each end into `[0, len]` the way JavaScript
// specifies — an `llvm.smin` / `llvm.smax` pair per bound, six intrinsic calls
// once the two are swapped into order — and that clamp is the semantics rather
// than a safety net, so `--unchecked-indexing` leaves it alone. A bound this
// analysis can place in `[0, s.length]` cannot be moved by the clamp, so the
// clamp is dead code: `program.nodeProvenClamp` says which bounds those are
// and `self/emit_strings.ts` writes them through.
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
// so knows no callee. `self/ranges.ts` walks each body again once the whole
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
//     `self/ranges.ts` knows the callee, a call whose summary has no stores
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

import { CheckContext } from "./context";
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
  N_DEFAULT,
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
  N_SWITCH,
  N_THIS,
  N_THROW,
  N_UNARY,
  N_VAR,
  N_VAR_DECL,
  N_WHILE,
  Node,
} from "./nodes";
import { StringMap } from "./map";
import { CheckedProgram, FunctionSig, ROLE_METHOD, inlineElementStruct } from "./program";
import { Local, STORAGE_LOCAL, STORAGE_PARAM } from "./symbols";
import { T_BOOL, T_I32, T_I64, T_STRING, TypeTable, isNumeric, isUnsigned } from "./types";

/** The largest bound the fold carries; a literal past it is answered "not a bound". */
const I32_MAX: i64 = 2147483647;

export const FACT_NON_NEGATIVE: i32 = 0;
export const FACT_BELOW: i32 = 1;
export const FACT_AT_MOST: i32 = 2;
export const FACT_MAX_INDEX: i32 = 3;
export const FACT_MIN_LENGTH: i32 = 4;
export const FACT_MIN_VALUE: i32 = 5;

/**
 * One fact. `v` is the index variable for every kind but `minLength`, whose `v`
 * is the length holder; `w` is the length holder of `below` and `atMost`; `n`
 * is the literal of the three constant families.
 */
export class Fact {
  kind: i32;
  v: Local;
  w: Local | null;
  n: i32;

  constructor(kind: i32, v: Local, w: Local | null, n: i32) {
    this.kind = kind;
    this.v = v;
    this.w = w;
    this.n = n;
  }
}

/** What a condition proves where it holds, and where it does not. */
export class ConditionFacts {
  whenTrue: Fact[];
  whenFalse: Fact[];

  constructor() {
    this.whenTrue = [];
    this.whenFalse = [];
  }
}

/**
 * The facts that hold at one program point, as parallel arrays per family,
 * because entry order is the order everything is compared in.
 */
export class State {
  nonNegative: Local[];
  belowIndex: Local[];
  belowHolder: Local[];
  atMostIndex: Local[];
  atMostHolder: Local[];
  maxIndexVar: Local[];
  maxIndexValue: i32[];
  minLengthVar: Local[];
  minLengthValue: i32[];
  minValueVar: Local[];
  minValueValue: i32[];

  constructor() {
    this.nonNegative = [];
    this.belowIndex = [];
    this.belowHolder = [];
    this.atMostIndex = [];
    this.atMostHolder = [];
    this.maxIndexVar = [];
    this.maxIndexValue = [];
    this.minLengthVar = [];
    this.minLengthValue = [];
    this.minValueVar = [];
    this.minValueValue = [];
  }
}

const cloneState = (s: State): State => {
  const out = new State();
  for (const v of s.nonNegative) {
    out.nonNegative.push(v);
  }
  let k = 0;
  while (k < s.belowIndex.length) {
    out.belowIndex.push(s.belowIndex[k]);
    out.belowHolder.push(s.belowHolder[k]);
    k = k + 1;
  }
  k = 0;
  while (k < s.atMostIndex.length) {
    out.atMostIndex.push(s.atMostIndex[k]);
    out.atMostHolder.push(s.atMostHolder[k]);
    k = k + 1;
  }
  k = 0;
  while (k < s.maxIndexVar.length) {
    out.maxIndexVar.push(s.maxIndexVar[k]);
    out.maxIndexValue.push(s.maxIndexValue[k]);
    k = k + 1;
  }
  k = 0;
  while (k < s.minLengthVar.length) {
    out.minLengthVar.push(s.minLengthVar[k]);
    out.minLengthValue.push(s.minLengthValue[k]);
    k = k + 1;
  }
  k = 0;
  while (k < s.minValueVar.length) {
    out.minValueVar.push(s.minValueVar[k]);
    out.minValueValue.push(s.minValueValue[k]);
    k = k + 1;
  }
  return out;
};

/** Overwrite `into` with `from`'s facts. The walk threads one mutable state through a body. */
const copyInto = (into: State, from: State): void => {
  const copy = cloneState(from);
  into.nonNegative = copy.nonNegative;
  into.belowIndex = copy.belowIndex;
  into.belowHolder = copy.belowHolder;
  into.atMostIndex = copy.atMostIndex;
  into.atMostHolder = copy.atMostHolder;
  into.maxIndexVar = copy.maxIndexVar;
  into.maxIndexValue = copy.maxIndexValue;
  into.minLengthVar = copy.minLengthVar;
  into.minLengthValue = copy.minLengthValue;
  into.minValueVar = copy.minValueVar;
  into.minValueValue = copy.minValueValue;
};

// ---- Reading the state ------------------------------------------------------------

/**
 * `v >= 0`. An unsigned type answers this without any flow at all, which is
 * the one ranged type the language already has: `u8`/`u16`/`u32`/`u64` cannot
 * hold a negative value, so their lower bound is read off the declaration.
 */
const knownNonNegative = (state: State, v: Local): boolean => {
  if (isUnsigned(v.type)) {
    return true;
  }
  for (const x of state.nonNegative) {
    if (x === v) {
      return true;
    }
  }
  return false;
};

/** `i < w.length` is recorded here. */
const knownBelow = (state: State, i: Local, w: Local): boolean => {
  let k = 0;
  while (k < state.belowIndex.length) {
    if (state.belowIndex[k] === i && state.belowHolder[k] === w) {
      return true;
    }
    k = k + 1;
  }
  return false;
};

/**
 * `i <= w.length`, which a strict `i < w.length` gives as well. The holders it
 * answers for are what turns `i < n` into `i < w.length` when `n` was bound to
 * a hoisted length.
 */
const knownAtMost = (state: State, i: Local, w: Local): boolean => {
  let k = 0;
  while (k < state.atMostIndex.length) {
    if (state.atMostIndex[k] === i && state.atMostHolder[k] === w) {
      return true;
    }
    k = k + 1;
  }
  return knownBelow(state, i, w);
};

/** Every holder whose length bounds `i` from above, in the order they were recorded. */
const holdersAbove = (state: State, i: Local): Local[] => {
  const out: Local[] = [];
  let k = 0;
  while (k < state.atMostIndex.length) {
    if (state.atMostIndex[k] === i && !contains(out, state.atMostHolder[k])) {
      out.push(state.atMostHolder[k]);
    }
    k = k + 1;
  }
  k = 0;
  while (k < state.belowIndex.length) {
    if (state.belowIndex[k] === i && !contains(out, state.belowHolder[k])) {
      out.push(state.belowHolder[k]);
    }
    k = k + 1;
  }
  return out;
};

/** The smallest recorded `n` with `i < n`, or -1 when there is none. */
const maxIndexOf = (state: State, i: Local): i32 => {
  let best = -1;
  let k = 0;
  while (k < state.maxIndexVar.length) {
    if (state.maxIndexVar[k] === i && (best < 0 || state.maxIndexValue[k] < best)) {
      best = state.maxIndexValue[k];
    }
    k = k + 1;
  }
  return best;
};

/** The largest recorded `n` with `w.length >= n`, or -1. */
const minLengthOf = (state: State, w: Local): i32 => {
  let best = -1;
  let k = 0;
  while (k < state.minLengthVar.length) {
    if (state.minLengthVar[k] === w && state.minLengthValue[k] > best) {
      best = state.minLengthValue[k];
    }
    k = k + 1;
  }
  return best;
};

/** Whether `w.length >= n` is recorded. */
const knownMinLength = (state: State, w: Local, n: i32): boolean => {
  const best = minLengthOf(state, w);
  return best >= 0 && best >= n;
};

/**
 * The largest `n` known to satisfy `v >= n`: a recorded floor, 0 for a
 * variable that is only known non-negative, or -1 when nothing bounds it from
 * below. The floor is what `n - 1` needs to stay non-negative, and it is how
 * `if (n !== 0)` on a non-negative `n` says `n >= 1`.
 */
const minValueOf = (state: State, v: Local): i32 => {
  let best = -1;
  let k = 0;
  while (k < state.minValueVar.length) {
    if (state.minValueVar[k] === v && state.minValueValue[k] > best) {
      best = state.minValueValue[k];
    }
    k = k + 1;
  }
  if (best < 0 && knownNonNegative(state, v)) {
    return 0;
  }
  return best;
};

// ---- Writing the state ------------------------------------------------------------

const addFact = (state: State, fact: Fact): void => {
  if (fact.kind === FACT_NON_NEGATIVE) {
    for (const x of state.nonNegative) {
      if (x === fact.v) {
        return;
      }
    }
    state.nonNegative.push(fact.v);
    return;
  }
  if (fact.kind === FACT_BELOW) {
    const w = fact.w;
    if (w !== null && !knownBelow(state, fact.v, w)) {
      state.belowIndex.push(fact.v);
      state.belowHolder.push(w);
    }
    return;
  }
  if (fact.kind === FACT_AT_MOST) {
    const above = fact.w;
    if (above !== null && !knownAtMost(state, fact.v, above)) {
      state.atMostIndex.push(fact.v);
      state.atMostHolder.push(above);
    }
    return;
  }
  if (fact.kind === FACT_MAX_INDEX) {
    state.maxIndexVar.push(fact.v);
    state.maxIndexValue.push(fact.n);
    return;
  }
  if (fact.kind === FACT_MIN_VALUE) {
    // A floor of 1 or more is a lower bound of 0 as well, and recording both
    // keeps every reader of `nonNegative` unaware of this family.
    addFact(state, new Fact(FACT_NON_NEGATIVE, fact.v, null, 0));
    if (fact.n > 0 && minValueOf(state, fact.v) < fact.n) {
      state.minValueVar.push(fact.v);
      state.minValueValue.push(fact.n);
    }
    return;
  }
  // A weaker floor than one already recorded changes no answer, and a checked
  // literal index offers the same one at every access it passes.
  if (knownMinLength(state, fact.v, fact.n)) {
    return;
  }
  state.minLengthVar.push(fact.v);
  state.minLengthValue.push(fact.n);
};

const addFacts = (state: State, facts: Fact[]): void => {
  for (const fact of facts) {
    addFact(state, fact);
  }
};

/**
 * Whether any fact in `state` names `v`, as an index or as a holder. The
 * `forget` family rebuilds every array it filters, and most of what it is
 * asked to forget is not there: a call forgets every path, an assignment
 * forgets its variable, whether or not either holds a fact.
 */
const mentions = (state: State, v: Local): boolean => {
  for (const x of state.nonNegative) {
    if (x === v) {
      return true;
    }
  }
  for (const x of state.belowIndex) {
    if (x === v) {
      return true;
    }
  }
  for (const x of state.belowHolder) {
    if (x === v) {
      return true;
    }
  }
  for (const x of state.atMostIndex) {
    if (x === v) {
      return true;
    }
  }
  for (const x of state.atMostHolder) {
    if (x === v) {
      return true;
    }
  }
  for (const x of state.maxIndexVar) {
    if (x === v) {
      return true;
    }
  }
  for (const x of state.minLengthVar) {
    if (x === v) {
      return true;
    }
  }
  for (const x of state.minValueVar) {
    if (x === v) {
      return true;
    }
  }
  return false;
};

/** Drop the upper bounds of `v` and keep its lower one: what an increment leaves behind. */
const forgetUpperBounds = (state: State, v: Local): void => {
  if (!mentions(state, v)) {
    return;
  }
  const index: Local[] = [];
  const holder: Local[] = [];
  let k = 0;
  while (k < state.belowIndex.length) {
    if (state.belowIndex[k] !== v) {
      index.push(state.belowIndex[k]);
      holder.push(state.belowHolder[k]);
    }
    k = k + 1;
  }
  state.belowIndex = index;
  state.belowHolder = holder;
  const atIndex: Local[] = [];
  const atHolder: Local[] = [];
  k = 0;
  while (k < state.atMostIndex.length) {
    if (state.atMostIndex[k] !== v) {
      atIndex.push(state.atMostIndex[k]);
      atHolder.push(state.atMostHolder[k]);
    }
    k = k + 1;
  }
  state.atMostIndex = atIndex;
  state.atMostHolder = atHolder;
  const maxVar: Local[] = [];
  const maxValue: i32[] = [];
  k = 0;
  while (k < state.maxIndexVar.length) {
    if (state.maxIndexVar[k] !== v) {
      maxVar.push(state.maxIndexVar[k]);
      maxValue.push(state.maxIndexValue[k]);
    }
    k = k + 1;
  }
  state.maxIndexVar = maxVar;
  state.maxIndexValue = maxValue;
};

/**
 * Forget everything that mentions `v`: its own bounds, the accesses it indexes
 * and the accesses indexed *into* it.
 */
const forget = (state: State, v: Local): void => {
  if (!mentions(state, v)) {
    return;
  }
  const kept: Local[] = [];
  for (const x of state.nonNegative) {
    if (x !== v) {
      kept.push(x);
    }
  }
  state.nonNegative = kept;
  const index: Local[] = [];
  const holder: Local[] = [];
  let k = 0;
  while (k < state.belowIndex.length) {
    if (state.belowIndex[k] !== v && state.belowHolder[k] !== v) {
      index.push(state.belowIndex[k]);
      holder.push(state.belowHolder[k]);
    }
    k = k + 1;
  }
  state.belowIndex = index;
  state.belowHolder = holder;
  const atIndex: Local[] = [];
  const atHolder: Local[] = [];
  k = 0;
  while (k < state.atMostIndex.length) {
    if (state.atMostIndex[k] !== v && state.atMostHolder[k] !== v) {
      atIndex.push(state.atMostIndex[k]);
      atHolder.push(state.atMostHolder[k]);
    }
    k = k + 1;
  }
  state.atMostIndex = atIndex;
  state.atMostHolder = atHolder;
  forgetUpperBounds(state, v);
  const lengthVar: Local[] = [];
  const lengthValue: i32[] = [];
  k = 0;
  while (k < state.minLengthVar.length) {
    if (state.minLengthVar[k] !== v) {
      lengthVar.push(state.minLengthVar[k]);
      lengthValue.push(state.minLengthValue[k]);
    }
    k = k + 1;
  }
  state.minLengthVar = lengthVar;
  state.minLengthValue = lengthValue;
  forgetLowerBounds(state, v);
};

/**
 * An unsigned increment wraps at the top of its range to zero, which keeps
 * `v >= 0` — its type says so anyway — and breaks any higher floor, so after
 * one only zero is left. A signed one keeps its floor under `nsw` or loses
 * everything under `--wrapping` (`keepsLowerBound`), and this leaves it alone.
 */
const forgetWrappedFloor = (state: State, v: Local): void => {
  if (isUnsigned(v.type)) {
    forgetLowerBounds(state, v);
  }
};

/**
 * Drop the lower bounds of `v` and keep its upper ones: what a decrement
 * leaves behind, where `forgetUpperBounds` is what an increment does.
 */
const forgetLowerBounds = (state: State, v: Local): void => {
  if (!mentions(state, v)) {
    return;
  }
  const kept: Local[] = [];
  for (const x of state.nonNegative) {
    if (x !== v) {
      kept.push(x);
    }
  }
  state.nonNegative = kept;
  const floorVar: Local[] = [];
  const floorValue: i32[] = [];
  let k = 0;
  while (k < state.minValueVar.length) {
    if (state.minValueVar[k] !== v) {
      floorVar.push(state.minValueVar[k]);
      floorValue.push(state.minValueValue[k]);
    }
    k = k + 1;
  }
  state.minValueVar = floorVar;
  state.minValueValue = floorValue;
};

/**
 * Every length fact about an *array* goes; the string ones stay. A callee that
 * holds the same array may `push` and move `len`. A string has no such
 * operation at all, so only rebinding the variable can change `s.length`.
 */
const forgetArrayLengths = (ctx: CheckContext, state: State): void => {
  if (state.belowHolder.length === 0 && state.atMostHolder.length === 0 && state.minLengthVar.length === 0) {
    return;
  }
  const index: Local[] = [];
  const holder: Local[] = [];
  let k = 0;
  while (k < state.belowIndex.length) {
    if (!ctx.table.isArray(state.belowHolder[k].type)) {
      index.push(state.belowIndex[k]);
      holder.push(state.belowHolder[k]);
    }
    k = k + 1;
  }
  state.belowIndex = index;
  state.belowHolder = holder;
  const atIndex: Local[] = [];
  const atHolder: Local[] = [];
  k = 0;
  while (k < state.atMostIndex.length) {
    if (!ctx.table.isArray(state.atMostHolder[k].type)) {
      atIndex.push(state.atMostIndex[k]);
      atHolder.push(state.atMostHolder[k]);
    }
    k = k + 1;
  }
  state.atMostIndex = atIndex;
  state.atMostHolder = atHolder;
  const lengthVar: Local[] = [];
  const lengthValue: i32[] = [];
  k = 0;
  while (k < state.minLengthVar.length) {
    if (!ctx.table.isArray(state.minLengthVar[k].type)) {
      lengthVar.push(state.minLengthVar[k]);
      lengthValue.push(state.minLengthValue[k]);
    }
    k = k + 1;
  }
  state.minLengthVar = lengthVar;
  state.minLengthValue = lengthValue;
};

/**
 * The facts that hold on both paths of a branch. Entries keep `a`'s order so
 * that the two compilers meet the same state in the same order.
 */
const intersect = (a: State, b: State): State => {
  const out = new State();
  for (const v of a.nonNegative) {
    if (knownNonNegative(b, v)) {
      out.nonNegative.push(v);
    }
  }
  let k = 0;
  while (k < a.belowIndex.length) {
    if (knownBelow(b, a.belowIndex[k], a.belowHolder[k])) {
      out.belowIndex.push(a.belowIndex[k]);
      out.belowHolder.push(a.belowHolder[k]);
    }
    k = k + 1;
  }
  k = 0;
  while (k < a.atMostIndex.length) {
    if (knownAtMost(b, a.atMostIndex[k], a.atMostHolder[k])) {
      out.atMostIndex.push(a.atMostIndex[k]);
      out.atMostHolder.push(a.atMostHolder[k]);
    }
    k = k + 1;
  }
  // The weaker of two bounds is the one that survives: `i < 3` on one path and
  // `i < 5` on the other means `i < 5` after the join.
  k = 0;
  while (k < a.maxIndexVar.length) {
    const other = maxIndexOf(b, a.maxIndexVar[k]);
    if (other >= 0) {
      out.maxIndexVar.push(a.maxIndexVar[k]);
      out.maxIndexValue.push(a.maxIndexValue[k] > other ? a.maxIndexValue[k] : other);
    }
    k = k + 1;
  }
  k = 0;
  while (k < a.minLengthVar.length) {
    const other = minLengthOf(b, a.minLengthVar[k]);
    if (other >= 0) {
      out.minLengthVar.push(a.minLengthVar[k]);
      out.minLengthValue.push(a.minLengthValue[k] < other ? a.minLengthValue[k] : other);
    }
    k = k + 1;
  }
  // The lower of two floors, as with a length's.
  k = 0;
  while (k < a.minValueVar.length) {
    const other = minValueOf(b, a.minValueVar[k]);
    if (other > 0) {
      out.minValueVar.push(a.minValueVar[k]);
      out.minValueValue.push(a.minValueValue[k] < other ? a.minValueValue[k] : other);
    }
    k = k + 1;
  }
  return out;
};

// ---- Reading the syntax -----------------------------------------------------------

export const unwrapBoundsParens = (expr: Node): Node => {
  let inner = expr;
  while (inner.kind === N_PAREN) {
    inner = inner.children[0];
  }
  return inner;
};

/** The local a bare identifier names, or `null` for every other expression. */
const localOf = (program: CheckedProgram, expr: Node): Local | null => {
  const e = unwrapBoundsParens(expr);
  if (e.kind !== N_IDENT) {
    return null;
  }
  return program.nodeLocals[e.id];
};

/** A local whose value is a thing with a `.length`: an array or a string. */
const lengthHolder = (ctx: CheckContext, expr: Node): Local | null => {
  const v = localOf(ctx.program, expr);
  if (v === null) {
    return null;
  }
  return ctx.table.isArray(v.type) || v.type === T_STRING ? v : null;
};

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
  root: Local;
  fields: string[];
  /** The declared type each of `fields` is read off: the root's, then each link's. */
  links: i32[];
  holder: Local;

  constructor(root: Local, fields: string[], links: i32[], holder: Local) {
    this.root = root;
    this.fields = fields;
    this.links = links;
    this.holder = holder;
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
  let e = unwrapBoundsParens(expr);
  while (e.kind === N_MEMBER) {
    e = unwrapBoundsParens(e.children[0]);
  }
  const fields: string[] = [];
  const links: i32[] = [];
  const type = declaredPathType(walk, expr, fields, links);
  if (fields.length === 0 || type < 0 || (!walk.ctx.table.isArray(type) && type !== T_STRING)) {
    return null;
  }
  // `declaredPathType` answered, so `e` is an identifier or `this` with a local.
  const root = walk.ctx.program.nodeLocals[e.id];
  if (root === null) {
    return null;
  }
  return internHolder(walk, root, fields, links, type);
};

/** The one stand-in for the path `root.fields`, made the first time it is asked for. */
const internHolder = (walk: BoundsWalk, root: Local, fields: string[], links: i32[], type: i32): Local => {
  const name = `${root.name}.${fields.join(".")}`;
  for (const path of walk.paths) {
    if (path.root === root && path.holder.name === name) {
      return path.holder;
    }
  }
  const holder = new Local(name, type, false, STORAGE_LOCAL);
  walk.paths.push(new PathHolder(root, fields, links, holder));
  return holder;
};

/**
 * `pathHolder` for a path given as a root and its field names rather than as
 * an expression: the entry facts of `self/ranges.ts` name one that way. Every
 * link is resolved on its declared type, by the rule `declaredPathType` holds
 * an expression to, and `null` is the answer wherever that one would refuse.
 */
const internPath = (walk: BoundsWalk, root: Local, fields: string[]): Local | null => {
  const program = walk.ctx.program;
  const table = walk.ctx.table;
  const links: i32[] = [];
  let type = root.type;
  for (const name of fields) {
    if (!table.isStruct(type)) {
      return null;
    }
    const info = program.struct(table.nameOf(type));
    if (info === null) {
      return null;
    }
    const field = info.field(name);
    if (field === null) {
      return null;
    }
    links.push(type);
    type = field.type;
  }
  if (fields.length === 0 || (!table.isArray(type) && type !== T_STRING)) {
    return null;
  }
  return internHolder(walk, root, fields, links, type);
};

/**
 * The declared type of the location `expr` names, pushing its field names on
 * to `fields` from the root outward and the declared type each is read off on
 * to `links`, or -1 where a link is not a plain struct
 * with that field. Recursive rather than a loop over the links, so that it
 * indexes nothing and has no bounds check of its own to prove.
 */
const declaredPathType = (walk: BoundsWalk, expr: Node, fields: string[], links: i32[]): i32 => {
  const program = walk.ctx.program;
  const table = walk.ctx.table;
  const e = unwrapBoundsParens(expr);
  if (e.kind === N_IDENT || e.kind === N_THIS) {
    const root = program.nodeLocals[e.id];
    return root === null ? -1 : root.type;
  }
  if (e.kind !== N_MEMBER) {
    return -1;
  }
  const below = declaredPathType(walk, e.children[0], fields, links);
  if (below < 0 || !table.isStruct(below)) {
    return -1;
  }
  const info = program.struct(table.nameOf(below));
  if (info === null) {
    return -1;
  }
  const field = info.field(e.text);
  if (field === null) {
    return -1;
  }
  fields.push(e.text);
  links.push(below);
  return field.type;
};

/** A local holder or a path holder: what a `.length` or an element access is stated against. */
const holderOf = (walk: BoundsWalk, expr: Node): Local | null => {
  const local = lengthHolder(walk.ctx, expr);
  if (local !== null) {
    return local;
  }
  return pathHolder(walk, expr);
};

/** Every path fact goes: what a call or a `new` leaves. */
const forgetPaths = (walk: BoundsWalk, state: State): void => {
  for (const path of walk.paths) {
    forget(state, path.holder);
  }
};

/** Whether a whole-record store of `stored` (`recordStoreType`) can rewrite a field `path` reads. */
const recordRewritesPath = (stored: i32, path: PathHolder): boolean => {
  for (const link of path.links) {
    if (recordReaches(stored, link)) {
      return true;
    }
  }
  return false;
};

/** The facts of every path a whole-record store of `stored` can rewrite a link of. */
const forgetPathsRecord = (walk: BoundsWalk, state: State, stored: i32): void => {
  for (const path of walk.paths) {
    if (recordRewritesPath(stored, path)) {
      forget(state, path.holder);
    }
  }
};

/**
 * What a call leaves: every array length, a callee holding the same array may
 * move `len`; and every path, string or array, because a callee can store to
 * any field it can reach. Array-typed paths go in the first half as well,
 * which is harmless; the second is what takes the string ones.
 */
const forgetCallEffects = (walk: BoundsWalk, state: State): void => {
  forgetArrayLengths(walk.ctx, state);
  forgetPaths(walk, state);
};

/**
 * The facts of every path that names `field` on any link. By name and not by
 * struct type, so a store through a second holder of the same object is
 * caught without the walk knowing the two alias.
 */
const forgetPathsThrough = (walk: BoundsWalk, state: State, field: string): void => {
  for (const path of walk.paths) {
    if (path.fields.indexOf(field) >= 0) {
      forget(state, path.holder);
    }
  }
};

/** `v` is rebound: its own facts go, and so does every path rooted at it. */
const forgetLocal = (walk: BoundsWalk, state: State, v: Local): void => {
  forget(state, v);
  for (const path of walk.paths) {
    if (path.root === v) {
      forget(state, path.holder);
    }
  }
};

/**
 * Integer types only. An `f64` index is truncated toward zero by `fptosi`, and
 * a proof about the double is not a proof about the truncation once `NaN` and
 * the values past `2^63` are in the picture, so `--number-mode f64` gets the
 * constant-index proofs and nothing else.
 */
const isIndexType = (type: i32): boolean => type === T_I32 || type === T_I64 || isUnsigned(type);

/** A local that can be an index: an integer, signed or unsigned. */
const indexLocal = (program: CheckedProgram, expr: Node): Local | null => {
  const v = localOf(program, expr);
  if (v === null || !isIndexType(v.type)) {
    return null;
  }
  return v;
};

/**
 * Whether `call` is the builtin `toI32` itself, resolved the way the checker
 * resolved it: a plain identifier with no user function behind it
 * (`nodeCallees` is `null` only for a builtin) and no `nish:` import
 * renaming another builtin to that spelling (`nodeBuiltins` is `""`). A user
 * function called `toI32` wins over the builtin, and it may answer anything,
 * so the spelling alone is never trusted.
 */
const isBuiltinToI32 = (program: CheckedProgram, call: Node): boolean => {
  const callee = call.children[0];
  return (
    callee.kind === N_IDENT &&
    callee.text === "toI32" &&
    program.nodeCallees[call.id] === null &&
    program.nodeBuiltins[call.id] === "" &&
    call.children[1].children.length === 1
  );
};

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
  let e = unwrapBoundsParens(expr);
  if (e.kind === N_CALL && isBuiltinToI32(walk.ctx.program, e)) {
    e = unwrapBoundsParens(e.children[1].children[0]);
  }
  if (e.kind !== N_MEMBER || e.text !== "length") {
    return null;
  }
  return holderOf(walk, e.children[0]);
};

/**
 * The non-negative integer a literal denotes, or -1. Written as decimal digits
 * only: `0x10` and `1_0` are normalised differently by the two front ends, and
 * a bound that only one compiler folds is a bound that makes the two disagree
 * about a bounds check.
 */
const literalValue = (expr: Node): i32 => {
  const e = unwrapBoundsParens(expr);
  if (e.kind !== N_NUMBER) {
    return -1;
  }
  const written = e.text;
  if (written.length === 0) {
    return -1;
  }
  let value: i64 = 0;
  let k = 0;
  while (k < written.length) {
    const c = written.charCodeAt(k);
    if (c < 48 || c > 57) {
      return -1;
    }
    value = value * toI64(10) + toI64(c - 48);
    // Bounds live in `i32` at the source level; a literal past that is not a
    // bound anybody wrote on purpose. Bailing out here rather than after the
    // last digit is also what keeps the `i64` fold from overflowing on a long
    // run of digits, which would be undefined behaviour inside the very check
    // that is deciding whether a program is safe.
    if (value > I32_MAX) {
      return -1;
    }
    k = k + 1;
  }
  return toI32(value);
};

// ---- Conditions -------------------------------------------------------------------

/**
 * What `lo < hi` (or `lo <= hi`) proves. Four shapes carry a bound worth
 * recording; everything else says nothing this domain can hold.
 */
const orderFacts = (walk: BoundsWalk, state: State, lo: Node, hi: Node, strict: boolean): Fact[] => {
  const ctx = walk.ctx;
  const out: Fact[] = [];
  const loVar = indexLocal(ctx.program, lo);
  const hiVar = indexLocal(ctx.program, hi);
  const loConst = literalValue(lo);
  const hiConst = literalValue(hi);
  const hiLength = lengthOf(walk, hi);

  // `i < w.length`: the fact the whole analysis is built around.
  if (loVar !== null && hiLength !== null && strict) {
    out.push(new Fact(FACT_BELOW, loVar, hiLength, 0));
  }
  // `i < n` / `i <= n`.
  if (loVar !== null && hiConst >= 0) {
    out.push(new Fact(FACT_MAX_INDEX, loVar, null, strict ? hiConst : hiConst + 1));
  }
  // `n < i` / `n <= i`: a lower bound. Zero is the one an access needs, and a
  // floor above it is what lets `i - 1` keep one.
  if (hiVar !== null && loConst >= 0) {
    out.push(new Fact(FACT_NON_NEGATIVE, hiVar, null, 0));
    out.push(new Fact(FACT_MIN_VALUE, hiVar, null, strict ? loConst + 1 : loConst));
  }
  // `n < w.length` / `n <= w.length`: §2.2's length guard.
  if (loConst >= 0 && hiLength !== null) {
    out.push(new Fact(FACT_MIN_LENGTH, hiLength, null, strict ? loConst + 1 : loConst));
  }
  // `i <= w.length`, which is not a proof on its own but is what a later
  // `k < i` needs to become `k < w.length`.
  if (loVar !== null && hiLength !== null && !strict) {
    out.push(new Fact(FACT_AT_MOST, loVar, hiLength, 0));
  }
  // `i < n` where `n` is itself bounded by a length: the hoisted-length loop.
  // Transitivity is applied here, at the point the condition is evaluated,
  // rather than stored as a rule, so the resulting `below` is invalidated by
  // everything that invalidates a `below`.
  if (loVar !== null && hiVar !== null && strict) {
    for (const above of holdersAbove(state, hiVar)) {
      out.push(new Fact(FACT_BELOW, loVar, above, 0));
    }
  }
  // A `w.length` on the low side bounds the length from *above*, which proves
  // no access, so there is deliberately no further shape here.
  return out;
};

/** What `a === b` proves: a literal pins an index's range and a length's floor. */
const equalityFacts = (walk: BoundsWalk, left: Node, right: Node): Fact[] => {
  const out: Fact[] = [];
  addEqualityFacts(walk, out, left, right);
  addEqualityFacts(walk, out, right, left);
  return out;
};

const addEqualityFacts = (walk: BoundsWalk, out: Fact[], value: Node, other: Node): void => {
  const n = literalValue(other);
  if (n < 0) {
    return;
  }
  const v = indexLocal(walk.ctx.program, value);
  if (v !== null) {
    out.push(new Fact(FACT_MIN_VALUE, v, null, n));
    out.push(new Fact(FACT_MAX_INDEX, v, null, n + 1));
  }
  const holder = lengthOf(walk, value);
  if (holder !== null) {
    out.push(new Fact(FACT_MIN_LENGTH, holder, null, n));
  }
};

/**
 * What `a !== b` proves where it holds: nothing on its own, but a literal at
 * one end of a range already known moves that end in by one. `n !== 0` on a
 * non-negative `n` is `n >= 1`, which is what makes `n - 1` a valid index in
 * the recursion that counts `n` down, and `i !== n` on an `i <= n` is `i < n`.
 */
const disequalityFacts = (walk: BoundsWalk, state: State, left: Node, right: Node): Fact[] => {
  const out: Fact[] = [];
  addDisequalityFacts(walk, state, out, left, right);
  addDisequalityFacts(walk, state, out, right, left);
  return out;
};

const addDisequalityFacts = (walk: BoundsWalk, state: State, out: Fact[], value: Node, other: Node): void => {
  const n = literalValue(other);
  const v = indexLocal(walk.ctx.program, value);
  if (n < 0 || v === null) {
    return;
  }
  if (minValueOf(state, v) === n) {
    out.push(new Fact(FACT_MIN_VALUE, v, null, n + 1));
  }
  if (n > 0 && maxIndexOf(state, v) === n + 1) {
    out.push(new Fact(FACT_MAX_INDEX, v, null, n));
  }
};

const factsFrom = (whenTrue: Fact[], whenFalse: Fact[]): ConditionFacts => {
  const out = new ConditionFacts();
  out.whenTrue = whenTrue;
  out.whenFalse = whenFalse;
  return out;
};

/**
 * What a condition proves where it holds and where it does not. The boolean
 * algebra is the narrowing engine's: `a && b` proves both only when it is
 * true, `a || b` proves both negations only when it is false, and `!` swaps
 * the two halves.
 */
const conditionFacts = (walk: BoundsWalk, state: State, cond: Node): ConditionFacts => {
  const expr = unwrapBoundsParens(cond);
  if (expr.kind === N_UNARY && expr.text === "!") {
    const inner = conditionFacts(walk, state, expr.children[0]);
    return factsFrom(inner.whenFalse, inner.whenTrue);
  }
  if (expr.kind !== N_BINARY) {
    return new ConditionFacts();
  }
  const op = expr.text;
  const left = expr.children[0];
  const right = expr.children[1];
  if (op === "&&") {
    const l = conditionFacts(walk, state, left);
    const r = conditionFacts(walk, state, right);
    return factsFrom(concatFacts(survivingFacts(walk, l.whenTrue, right), r.whenTrue), []);
  }
  if (op === "||") {
    const l = conditionFacts(walk, state, left);
    const r = conditionFacts(walk, state, right);
    return factsFrom([], concatFacts(survivingFacts(walk, l.whenFalse, right), r.whenFalse));
  }
  if (op === "===") {
    return factsFrom(equalityFacts(walk, left, right), disequalityFacts(walk, state, left, right));
  }
  if (op === "!==") {
    return factsFrom(disequalityFacts(walk, state, left, right), equalityFacts(walk, left, right));
  }
  // `a < b` is false exactly when `b <= a`, and so on around the four
  // relations: each one proves something on both sides of the branch.
  if (op === "<") {
    return factsFrom(orderFacts(walk, state, left, right, true), orderFacts(walk, state, right, left, false));
  }
  if (op === "<=") {
    return factsFrom(orderFacts(walk, state, left, right, false), orderFacts(walk, state, right, left, true));
  }
  if (op === ">") {
    return factsFrom(orderFacts(walk, state, right, left, true), orderFacts(walk, state, left, right, false));
  }
  if (op === ">=") {
    return factsFrom(orderFacts(walk, state, right, left, false), orderFacts(walk, state, left, right, true));
  }
  return new ConditionFacts();
};

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
  const scratch = new State();
  addFacts(scratch, facts);
  forgetAcross(walk, scratch, later);
  return factsOf(scratch);
};

/** The facts `state` holds, as the facts that would rebuild it. */
const factsOf = (state: State): Fact[] => {
  const out: Fact[] = [];
  for (const v of state.nonNegative) {
    out.push(new Fact(FACT_NON_NEGATIVE, v, null, 0));
  }
  let k = 0;
  while (k < state.belowIndex.length) {
    out.push(new Fact(FACT_BELOW, state.belowIndex[k], state.belowHolder[k], 0));
    k = k + 1;
  }
  k = 0;
  while (k < state.atMostIndex.length) {
    out.push(new Fact(FACT_AT_MOST, state.atMostIndex[k], state.atMostHolder[k], 0));
    k = k + 1;
  }
  k = 0;
  while (k < state.maxIndexVar.length) {
    out.push(new Fact(FACT_MAX_INDEX, state.maxIndexVar[k], null, state.maxIndexValue[k]));
    k = k + 1;
  }
  k = 0;
  while (k < state.minLengthVar.length) {
    out.push(new Fact(FACT_MIN_LENGTH, state.minLengthVar[k], null, state.minLengthValue[k]));
    k = k + 1;
  }
  k = 0;
  while (k < state.minValueVar.length) {
    out.push(new Fact(FACT_MIN_VALUE, state.minValueVar[k], null, state.minValueValue[k]));
    k = k + 1;
  }
  return out;
};

const concatFacts = (a: Fact[], b: Fact[]): Fact[] => {
  const out: Fact[] = [];
  for (const f of a) {
    out.push(f);
  }
  for (const f of b) {
    out.push(f);
  }
  return out;
};

// ---- Assignments ------------------------------------------------------------------

/**
 * `v = v + <non-negative literal>` and its spellings. An increment can only
 * move `v` away from zero, so the lower bound survives it — but only with
 * `nsw` on, where passing `INT_MAX` is undefined behaviour the compiler may
 * assume away. `--wrapping` *defines* that step to land on `INT_MIN`, and a
 * lower bound a documented wrap can break is not a proof.
 */
const isIncrement = (program: CheckedProgram, v: Local, rhs: Node): boolean => {
  const e = unwrapBoundsParens(rhs);
  if (e.kind !== N_BINARY || e.text !== "+") {
    return false;
  }
  const left = localOf(program, e.children[0]);
  const right = localOf(program, e.children[1]);
  if (left !== null && left === v) {
    return literalValue(e.children[1]) >= 0;
  }
  if (right !== null && right === v) {
    return literalValue(e.children[0]) >= 0;
  }
  return false;
};

const keepsLowerBound = (ctx: CheckContext, v: Local): boolean => !ctx.wrapping || isUnsigned(v.type);

/**
 * `v = v - <non-negative literal>`, the mirror of `isIncrement`. Only the left
 * operand may be `v`: `c - v` moves the other way.
 */
const isDecrement = (program: CheckedProgram, v: Local, rhs: Node): boolean => {
  const e = unwrapBoundsParens(rhs);
  if (e.kind !== N_BINARY || e.text !== "-") {
    return false;
  }
  const left = localOf(program, e.children[0]);
  return left !== null && left === v && literalValue(e.children[1]) >= 0;
};

/**
 * Whether a decrement of `v` keeps its upper bounds. `v - c <= v` unless the
 * subtraction wraps past `INT_MIN` to the top of the range, which `nsw` makes
 * undefined behaviour the compiler may assume away and `--wrapping` defines;
 * `known` is the caller's word that `v >= 0` there, which rules the wrap out
 * either way. An unsigned `v` wraps at zero by definition, so it never keeps
 * one.
 */
const keepsUpperBound = (ctx: CheckContext, v: Local, known: boolean): boolean =>
  !isUnsigned(v.type) && isIndexType(v.type) && (!ctx.wrapping || known);

/**
 * The facts `v = <local> - c` and `v = <local>` give `v`, read off what the
 * state knows about the local. Removing `c` lowers every floor by `c` — so a
 * floor of at least `c` leaves `v` non-negative — and every upper bound too,
 * which with `c >= 1` turns `w <= xs.length` into `v < xs.length`. The upper
 * half needs the subtraction not to wrap (`keepsUpperBound`).
 */
const differenceFacts = (walk: BoundsWalk, state: State, v: Local, w: Local, c: i32, out: Fact[]): void => {
  const floor = minValueOf(state, w);
  if (floor >= c) {
    out.push(new Fact(FACT_MIN_VALUE, v, null, floor - c));
  }
  if (c > 0 && !keepsUpperBound(walk.ctx, w, floor >= c)) {
    return;
  }
  const max = maxIndexOf(state, w);
  if (max >= 0 && max - c >= 1) {
    out.push(new Fact(FACT_MAX_INDEX, v, null, max - c));
  }
  for (const above of holdersAbove(state, w)) {
    if (c >= 1 || knownBelow(state, w, above)) {
      out.push(new Fact(FACT_BELOW, v, above, 0));
    } else {
      out.push(new Fact(FACT_AT_MOST, v, above, 0));
    }
  }
};

/**
 * Whether the value of `expr` cannot be negative. A literal and a `.length`
 * say so outright, a variable says so when the state does, and a sum says so
 * when both ends do — under `nsw`, where a sum that would pass `INT_MAX` is
 * undefined behaviour rather than a wrap into the negatives. That last rule is
 * what gives `let j = i + 1` its lower bound, which is half of every proof
 * about a second cursor.
 */
const impliesNonNegative = (walk: BoundsWalk, state: State, expr: Node): boolean => {
  const ctx = walk.ctx;
  const e = unwrapBoundsParens(expr);
  if (literalValue(e) >= 0) {
    return true;
  }
  if (lengthOf(walk, e) !== null) {
    return true;
  }
  const v = localOf(ctx.program, e);
  if (v !== null) {
    return isIndexType(v.type) && knownNonNegative(state, v);
  }
  if (e.kind !== N_BINARY || e.text !== "+") {
    return false;
  }
  const type = ctx.program.nodeTypes[e.id];
  if (ctx.wrapping && !(type >= 0 && isUnsigned(type))) {
    return false;
  }
  return impliesNonNegative(walk, state, e.children[0]) && impliesNonNegative(walk, state, e.children[1]);
};

/**
 * What a value gives the variable it is written into: a non-negative value
 * pins the lower end, a literal pins the upper one too, a `.length` bounds the
 * variable by that length, a copy or a difference carries the bounds of the
 * local it is taken from (`differenceFacts`), and an array of known size
 * starts with that many elements.
 */
const initialiserFacts = (walk: BoundsWalk, state: State, v: Local, init: Node): Fact[] => {
  const ctx = walk.ctx;
  const out: Fact[] = [];
  const e = unwrapBoundsParens(init);
  if (isIndexType(v.type) && impliesNonNegative(walk, state, e)) {
    out.push(new Fact(FACT_NON_NEGATIVE, v, null, 0));
  }
  const n = literalValue(e);
  if (n >= 0 && isIndexType(v.type)) {
    out.push(new Fact(FACT_MIN_VALUE, v, null, n));
    out.push(new Fact(FACT_MAX_INDEX, v, null, n + 1));
    return out;
  }
  const holder = lengthOf(walk, e);
  if (holder !== null && isIndexType(v.type)) {
    // `const n = xs.length` is the hoist everybody is told to write, and this
    // is the fact that keeps it as fast as the loop that re-reads the length.
    out.push(new Fact(FACT_AT_MOST, v, holder, 0));
    return out;
  }
  if (!isIndexType(v.type)) {
    return initialiserArrayFacts(ctx, v, e, out);
  }
  // `let j = i`: the copy has every bound the original has.
  const copied = indexLocal(ctx.program, e);
  if (copied !== null && copied.type === v.type) {
    differenceFacts(walk, state, v, copied, 0, out);
    return out;
  }
  if (e.kind === N_BINARY && e.text === "-") {
    const c = literalValue(e.children[1]);
    const w = indexLocal(ctx.program, e.children[0]);
    if (c >= 0 && w !== null && w.type === v.type) {
      differenceFacts(walk, state, v, w, c, out);
    }
    // `xs.length - 1` is the last index, when there is one: no floor, since
    // the array may be empty, but below the length whatever it holds. A
    // length is never negative, so the subtraction cannot wrap.
    const above = lengthOf(walk, e.children[0]);
    if (c >= 1 && above !== null) {
      out.push(new Fact(FACT_BELOW, v, above, 0));
    }
  }
  return out;
};

/** An array of known size starts with that many elements. */
const initialiserArrayFacts = (ctx: CheckContext, v: Local, e: Node, out: Fact[]): Fact[] => {
  if (ctx.table.isArray(v.type) && e.kind === N_ARRAY) {
    out.push(new Fact(FACT_MIN_LENGTH, v, null, e.children.length));
    return out;
  }
  if (ctx.table.isArray(v.type) && e.kind === N_NEW && e.children[2].children.length === 1) {
    const size = literalValue(e.children[2].children[0]);
    if (size >= 0) {
      out.push(new Fact(FACT_MIN_LENGTH, v, null, size));
    }
  }
  return out;
};

// ---- The walk ---------------------------------------------------------------------

/**
 * The analysis in progress. `loops` is only a depth: the warning fires inside
 * a loop and nowhere else, because a check that runs once is not a check
 * anybody is paying for.
 */
export class BoundsWalk {
  ctx: CheckContext;
  /** Access nodes whose surviving check is worth a warning, in source order. */
  unproven: Node[];
  loops: i32;
  uncheckedIndexing: boolean;
  /**
   * Whether a proof is written to the side tables. `self/ranges.ts` walks a
   * body while its entry facts are still being settled, and a proof drawn from
   * an entry fact that has not settled may not be kept.
   */
  record: boolean;
  /** The property paths this body's facts have been keyed by, in first-use order. */
  paths: PathHolder[];
  /**
   * The state at each `continue` of the innermost loop being walked. A
   * `continue` jumps to the `for` update or the `do/while` condition with its
   * branch's effects applied, so those are walked from the join of these and
   * the end of the body rather than from the end of the body alone (#181).
   */
  continues: State[];
  /**
   * The state at each `break` of the innermost loop or `switch` being walked.
   * A `break` leaves a `for` or `while` with the body's writes applied, past
   * the condition that re-established a fact about them, so the state after
   * the loop is the join of these and the condition's exit (#181's `break`
   * counterpart).
   */
  breaks: State[];
  /**
   * What the whole program knows about callees (`self/ranges.ts`), or `null`
   * in pass 2, which runs before every body is checked and so knows nothing:
   * there, any call drops every array length and every path.
   */
  tables: RangeTables | null;
  /**
   * The accesses this walk proved that nothing had proved before it, in source
   * order: written to the side table already when `record` is set, and
   * waiting on the caller's word that they may be (`commitProofs`) when not.
   */
  proved: Node[];
  /** The `substring` bounds an unrecorded walk proved, waiting as `proved` does. */
  clamps: Node[];
  /** Every call to a function taking entry facts, with what this site proves for it. */
  sites: RangeSite[];

  constructor(ctx: CheckContext, uncheckedIndexing: boolean) {
    this.ctx = ctx;
    this.unproven = [];
    this.paths = [];
    this.continues = [];
    this.breaks = [];
    this.loops = 0;
    this.uncheckedIndexing = uncheckedIndexing;
    this.tables = null;
    this.record = true;
    this.proved = [];
    this.clamps = [];
    this.sites = [];
  }
}

/** `s.charCodeAt(i)` on a string receiver, which lowers to the same check `a[i]` does. */
const isCharCodeAt = (ctx: CheckContext, call: Node): boolean => {
  const callee = unwrapBoundsParens(call.children[0]);
  if (callee.kind !== N_MEMBER || callee.text !== "charCodeAt") {
    return false;
  }
  if (call.children[1].children.length !== 1) {
    return false;
  }
  return ctx.program.nodeTypes[callee.children[0].id] === T_STRING;
};

/**
 * `r.unwrapOr(d)` or `r.expect(m)` on a `Result`, whose one argument
 * `self/emit_result.ts` evaluates on the `Err` path only, or "" for any other
 * call. The names are the checker's (`checkResultMethod` in `self/result.ts`);
 * they are matched here rather than through the emitter's `resultMethodName`,
 * because a checker module does not reach into the emitter.
 */
const lazyResultMethod = (ctx: CheckContext, call: Node): string => {
  const callee = unwrapBoundsParens(call.children[0]);
  if (callee.kind !== N_MEMBER || call.children[1].children.length !== 1) {
    return "";
  }
  if (callee.text !== "unwrapOr" && callee.text !== "expect") {
    return "";
  }
  return ctx.table.isResult(ctx.program.nodeTypes[callee.children[0].id]) ? callee.text : "";
};

/**
 * A call that is lowered inline and calls nothing, so it cannot reach an array
 * and move its `len`: the one exception to "any call drops every array length
 * fact". `charCodeAt` is a load. The builtin `toI32` is a cast or one
 * `llvm.fptosi.sat`, and without it `const m: i32 = toI32(ys.length)` would
 * drop the fact `const n: i32 = toI32(xs.length)` recorded one line above.
 * The walk and the loop-effect scan both ask this, so they cannot disagree.
 */
export const callsNothing = (ctx: CheckContext, call: Node): boolean => isCharCodeAt(ctx, call) || isBuiltinToI32(ctx.program, call);

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
 * leaves alone.
 *
 * `passes` is the caller's word that the check reads the array the holder
 * still names once the access is over. Only `a[i] = v` can break that, and the
 * caller says how.
 */
const recordPassedCheck = (walk: BoundsWalk, state: State, holder: Local, index: Node): void => {
  if (walk.uncheckedIndexing) {
    return;
  }
  const constant = literalValue(index);
  if (constant >= 0) {
    addFact(state, new Fact(FACT_MIN_LENGTH, holder, null, constant + 1));
    return;
  }
  const i = indexLocal(walk.ctx.program, index);
  if (i === null) {
    return;
  }
  addFact(state, new Fact(FACT_NON_NEGATIVE, i, null, 0));
  addFact(state, new Fact(FACT_BELOW, i, holder, 0));
};

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
const judge = (walk: BoundsWalk, state: State, node: Node, receiver: Node, index: Node, passes: boolean): void => {
  const ctx = walk.ctx;
  const holder = holderOf(walk, receiver);
  if (holder === null) {
    return;
  }
  const proven = proves(ctx, state, holder, index);
  if (passes) {
    recordPassedCheck(walk, state, holder, index);
  }
  if (proven) {
    if (!ctx.program.nodeProvenIndex[node.id]) {
      walk.proved.push(node);
      if (walk.record) {
        ctx.program.nodeProvenIndex[node.id] = true;
      }
    }
    return;
  }
  // A path receiver is proved when it can be and never warned about: the
  // warning's rewrite is a local, and a field receiver was not a candidate
  // before paths were.
  if (walk.loops === 0 || walk.uncheckedIndexing || lengthHolder(ctx, receiver) === null) {
    return;
  }
  if (indexLocal(ctx.program, index) === null) {
    return;
  }
  walk.unproven.push(node);
};

/**
 * `s.substring(a)` / `s.substring(a, b)` on a string receiver: the shape whose
 * bounds are clamped rather than checked. Two arguments at most, because that
 * is the arity the checker accepts; a third is already an error and is never
 * judged here.
 */
const isSubstringCall = (ctx: CheckContext, call: Node): boolean => {
  const callee = unwrapBoundsParens(call.children[0]);
  if (callee.kind !== N_MEMBER || callee.text !== "substring") {
    return false;
  }
  const count = call.children[1].children.length;
  if (count < 1 || count > 2) {
    return false;
  }
  return ctx.program.nodeTypes[callee.children[0].id] === T_STRING;
};

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
  const constant = literalValue(bound);
  if (constant >= 0) {
    return constant === 0 || (holder !== null && knownMinLength(state, holder, constant));
  }
  if (holder === null) {
    return false;
  }
  const i = indexLocal(ctx.program, bound);
  if (i === null || !knownNonNegative(state, i)) {
    return false;
  }
  // `knownAtMost` answers `knownBelow` too, and `i < len` implies `i <= len`.
  return knownAtMost(state, i, holder);
};

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
    return;
  }
  if (walk.record) {
    walk.ctx.program.nodeProvenClamp[bound.id] = true;
  } else {
    walk.clamps.push(bound);
  }
};

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
  const steps = node.kind === N_UNARY && (node.text === "++" || node.text === "--");
  if ((node.kind === N_BINARY && isBoundsAssignment(node.text)) || steps) {
    const target = localOf(program, node.children[0]);
    if (target !== null && target === v) {
      return true;
    }
  }
  for (const child of node.children) {
    if (writesLocal(program, child, v)) {
      return true;
    }
  }
  return false;
};

/** The proof itself: `0 <= i` and `i < holder.length`, by whichever route the state has. */
const proves = (ctx: CheckContext, state: State, holder: Local, index: Node): boolean => {
  const constant = literalValue(index);
  if (constant >= 0) {
    return knownMinLength(state, holder, constant + 1);
  }
  const i = indexLocal(ctx.program, index);
  if (i === null || !knownNonNegative(state, i)) {
    return false;
  }
  if (knownBelow(state, i, holder)) {
    return true;
  }
  const bound = maxIndexOf(state, i);
  return bound >= 0 && knownMinLength(state, holder, bound);
};

/**
 * Walk an expression in evaluation order, proving the accesses it contains and
 * applying what it does to the state. The order is the emitter's: an access is
 * judged at the point its check runs, which is after its own operands and
 * before anything that follows it.
 */
const walkExpression = (walk: BoundsWalk, state: State, expr: Node): void => {
  const ctx = walk.ctx;
  const e = unwrapBoundsParens(expr);

  // WP29: an arrow argument is a function of its own, proved when it was
  // lifted; it runs in the callee, not here, and reads nothing of this body's.
  if (e.kind === N_ARROW) {
    return;
  }

  if (e.kind === N_INDEX) {
    walkExpression(walk, state, e.children[0]);
    walkExpression(walk, state, e.children[1]);
    judge(walk, state, e, e.children[0], e.children[1], true);
    return;
  }

  if (e.kind === N_CALL) {
    const callee = unwrapBoundsParens(e.children[0]);
    if (callee.kind === N_MEMBER) {
      walkExpression(walk, state, callee.children[0]);
    } else if (callee.kind !== N_IDENT) {
      walkExpression(walk, state, callee);
    }
    const lazy = lazyResultMethod(ctx, e);
    if (lazy !== "") {
      // The argument runs on the `Err` path alone. `unwrapOr`'s fallback then
      // joins the `Ok` path, so only what holds either way survives; `expect`'s
      // message is followed by the exit, so nothing it did reaches past it.
      const errPath = cloneState(state);
      walkExpression(walk, errPath, e.children[1].children[0]);
      if (lazy === "unwrapOr") {
        copyInto(state, intersect(state, errPath));
      }
      forgetCallEffects(walk, state);
      return;
    }
    // A `substring`'s clamps are decided one bound at a time, interleaved with
    // the arguments, because that is the order `emitSubstring` writes them in:
    // bound 0 is clamped before bound 1 is evaluated, so nothing bound 1 does
    // may reach back. The receiver's length is read before either, so the
    // holder is dropped the moment an argument rebinds it — a literal `0`
    // still folds after that, because no string has a negative length.
    const clamped = isSubstringCall(ctx, e);
    let holder: Local | null = null;
    if (clamped) {
      holder = lengthHolder(ctx, callee.children[0]);
    }
    for (const arg of e.children[1].children) {
      walkExpression(walk, state, arg);
      if (clamped) {
        if (holder !== null && writesLocal(ctx.program, arg, holder)) {
          holder = null;
        }
        judgeClampBound(walk, state, holder, arg);
      }
    }
    if (isCharCodeAt(ctx, e)) {
      judge(walk, state, e, callee.children[0], e.children[1].children[0], true);
    }
    if (callsNothing(ctx, e)) {
      return;
    }
    // The state here is the one the callee starts in: every argument has run
    // and the call has not.
    if (walk.tables !== null) {
      noteCallSite(walk, state, e);
    }
    // `nish_str_new` is a callee like any other, so the array lengths go here
    // whether or not this call was a `substring` — and every path goes, string
    // or array, because a callee can store to any field it can reach.
    applyCallEffects(walk, state, e);
    return;
  }

  if (e.kind === N_NEW) {
    for (const arg of e.children[2].children) {
      walkExpression(walk, state, arg);
    }
    applyCallEffects(walk, state, e); // a constructor body is a callee like any other
    return;
  }

  if (e.kind === N_BINARY) {
    walkBinary(walk, state, e);
    return;
  }

  if (e.kind === N_CONDITIONAL) {
    walkExpression(walk, state, e.children[0]);
    const facts = conditionFacts(walk, state, e.children[0]);
    const whenTrue = cloneState(state);
    addFacts(whenTrue, facts.whenTrue);
    walkExpression(walk, whenTrue, e.children[1]);
    const whenFalse = cloneState(state);
    addFacts(whenFalse, facts.whenFalse);
    walkExpression(walk, whenFalse, e.children[2]);
    copyInto(state, intersect(whenTrue, whenFalse));
    return;
  }

  if (e.kind === N_UNARY) {
    const operand = e.children[0];
    walkExpression(walk, state, operand);
    if (e.text !== "++" && e.text !== "--") {
      return;
    }
    const field = unwrapBoundsParens(operand);
    if (field.kind === N_MEMBER) {
      forgetPathsThrough(walk, state, field.text);
      return;
    }
    const v = localOf(ctx.program, operand);
    if (v === null) {
      return;
    }
    if (e.text === "++") {
      applyAssignment(walk, state, v, null, true);
    } else {
      applyDecrement(walk, state, v, 1);
    }
    return;
  }

  // A template hole, an array or object literal, a member access, a bare
  // identifier: nothing here changes the state by itself, but a call nested
  // inside one still has to take the array lengths away, so every child is
  // walked rather than skipped.
  for (const child of e.children) {
    walkExpression(walk, state, child);
  }
};

/** Apply `v = <rhs>` to the state; `increment` covers `v += c`, `v++` and `++v` too. */
const applyAssignment = (walk: BoundsWalk, state: State, v: Local, rhs: Node | null, increment: boolean): void => {
  const ctx = walk.ctx;
  const steps = increment || (rhs !== null && isIncrement(ctx.program, v, rhs));
  if (steps && knownNonNegative(state, v) && keepsLowerBound(ctx, v)) {
    forgetUpperBounds(state, v);
    forgetWrappedFloor(state, v);
    addFact(state, new Fact(FACT_NON_NEGATIVE, v, null, 0));
    return;
  }
  // The value is computed before the store, so what it proves is read from the
  // state the variable's own facts are still in.
  let facts: Fact[] = [];
  if (rhs !== null) {
    facts = initialiserFacts(walk, state, v, rhs);
  }
  forgetLocal(walk, state, v);
  addFacts(state, facts);
};

/**
 * Apply `v = v - c` to the state: the floor drops by `c` and every upper bound
 * stays, when the subtraction cannot wrap (`keepsUpperBound`). A loop that
 * counts down from a last index, `for (let i = n - 1; i >= 0; i -= 1)`, is
 * proved by exactly this: the condition gives the floor back on each pass.
 */
const applyDecrement = (walk: BoundsWalk, state: State, v: Local, c: i32): void => {
  const floor = minValueOf(state, v);
  if (!keepsUpperBound(walk.ctx, v, floor >= 0)) {
    forgetLocal(walk, state, v);
    return;
  }
  forgetLowerBounds(state, v);
  if (floor >= c) {
    addFact(state, new Fact(FACT_MIN_VALUE, v, null, floor - c));
  }
};

/**
 * Whether an operator writes its left operand: `=` and every `op=`. The same
 * rule `self/emit_util.ts` states, spelled again here rather than imported,
 * because a checker module that reaches into the emitter is a dependency
 * neither compiler has.
 */
export const isBoundsAssignment = (op: string): boolean => {
  if (op === "=") {
    return true;
  }
  if (op.length < 2 || !op.endsWith("=")) {
    return false;
  }
  // `===`, `!==`, `<=`, `>=` end in `=` and write nothing.
  return op !== "===" && op !== "!==" && op !== "==" && op !== "!=" && op !== "<=" && op !== ">=";
};

/** `recordStoreType`: the element store writes a pointer or a value, and rewrites no record. */
export const NO_RECORD: i32 = -1;
/** `recordStoreType`: the checker recorded no element type, so nothing says what the store reaches. */
export const ANY_RECORD: i32 = -2;

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
 * The header hoist in `self/emit_arrays.ts` (`storedFields`) asks the same
 * question about a field load it would lift out of a loop, and reads this
 * answer rather than a copy of it (#180).
 */
export const recordStoreType = (program: CheckedProgram, table: TypeTable, access: Node): i32 => {
  const type = program.nodeTypes[access.id];
  if (type < 0) {
    return ANY_RECORD;
  }
  return inlineElementStruct(program, table, type) === null ? NO_RECORD : type;
};

/**
 * Whether a whole-record store of `stored` can rewrite a field read off a
 * holder declared `holder`. The only memory the store writes is one slot of
 * inline storage, and the only thing that can point into that slot is a value
 * of the element's own type: a field of struct type is a pointer, never an
 * inline copy, and interfaces are nominal, so no other declared type is ever
 * bound to it. A path whose every link is read off something else — a class,
 * above all, which is never inline — keeps its facts, and its header hoist.
 * The proof here and the hoist in `self/emit_arrays.ts` ask this one question.
 */
export const recordReaches = (stored: i32, holder: i32): boolean =>
  stored === ANY_RECORD || holder < 0 || (stored !== NO_RECORD && stored === holder);

/**
 * Whether evaluating `value`, whose `effects` the caller collected, can change
 * what the access `target` reads before it: the index local, the array local, or a path's root or any field on it.
 * `a[i] = value` reads those two before `value` and checks after it, so a
 * proof stated in the state after `value` is a proof about them only while
 * `value` leaves them alone. A call needs no case here: it cannot reach a
 * local, and it already drops every path and array length it could.
 */
const rebindsAccess = (walk: BoundsWalk, effects: Effects, target: Node): boolean => {
  const ctx = walk.ctx;
  const index = localOf(ctx.program, target.children[1]);
  if (index !== null && (contains(effects.stepped, index) || contains(effects.decremented, index) || contains(effects.clobbered, index))) {
    return true;
  }
  const receiver = unwrapBoundsParens(target.children[0]);
  const local = localOf(ctx.program, receiver);
  if (local !== null) {
    return contains(effects.clobbered, local);
  }
  const holder = pathHolder(walk, receiver);
  if (holder === null) {
    return false;
  }
  for (const path of walk.paths) {
    if (path.holder !== holder) {
      continue;
    }
    if (contains(effects.clobbered, path.root)) {
      return true;
    }
    for (const stored of effects.records) {
      if (recordRewritesPath(stored, path)) {
        return true;
      }
    }
    for (const field of effects.fields) {
      if (path.fields.indexOf(field) >= 0) {
        return true;
      }
    }
  }
  return false;
};

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
  lengthHolder(walk.ctx, target.children[0]) !== null || !effects.calls;

/**
 * The length of the array `value` builds, when it is a fresh array whose
 * evaluation changes nothing the walk tracks: `new Array<T>(n)` with a literal
 * `n`, or an array literal whose elements write nothing and call nothing.
 * -1 for every other value.
 */
const freshLength = (walk: BoundsWalk, value: Node): i32 => {
  const ctx = walk.ctx;
  const e = unwrapBoundsParens(value);
  if (!ctx.table.isArray(ctx.program.nodeTypes[e.id])) {
    return -1;
  }
  if (e.kind === N_NEW && e.children[2].children.length === 1) {
    return literalValue(e.children[2].children[0]);
  }
  if (e.kind !== N_ARRAY) {
    return -1;
  }
  const effects = new Effects();
  collectEffects(walk, e, effects);
  const quiet =
    !effects.calls &&
    effects.stepped.length === 0 &&
    effects.decremented.length === 0 &&
    effects.clobbered.length === 0 &&
    effects.fields.length === 0 &&
    effects.records.length === 0;
  return quiet ? e.children.length : -1;
};

/** Assignments and the short-circuit operators; every other binary is left then right. */
const walkBinary = (walk: BoundsWalk, state: State, expr: Node): void => {
  const ctx = walk.ctx;
  const op = expr.text;
  const left = expr.children[0];
  const right = expr.children[1];

  // WP32: `a ?? d` runs `d` only where `a` is missing, the same join with no
  // condition for the right operand to assume.
  if (op === "&&" || op === "||" || op === "??") {
    walkExpression(walk, state, left);
    if (op === "??") {
      const maybeRan = cloneState(state);
      walkExpression(walk, maybeRan, right);
      copyInto(state, intersect(state, maybeRan));
      return;
    }
    const facts = conditionFacts(walk, state, left);
    const guarded = cloneState(state);
    addFacts(guarded, op === "&&" ? facts.whenTrue : facts.whenFalse);
    walkExpression(walk, guarded, right);
    // The right operand may not have run at all, so only what holds either way
    // survives — which also puts back whatever the guard added and the right
    // operand did not take away.
    copyInto(state, intersect(state, guarded));
    return;
  }

  if (!isBoundsAssignment(op)) {
    walkExpression(walk, state, left);
    walkExpression(walk, state, right);
    return;
  }

  const target = unwrapBoundsParens(left);
  if (target.kind === N_INDEX) {
    walkExpression(walk, state, target.children[0]);
    walkExpression(walk, state, target.children[1]);
    if (op !== "=") {
      // `a[i] op= v` checks, loads and only then evaluates `v`
      // (`emitElementAssignment`), so the check is judged before `v` runs.
      judge(walk, state, target, target.children[0], target.children[1], true);
      walkExpression(walk, state, right);
    } else {
      // `a[i] = v` reads the array and the index, evaluates `v`, and only then
      // checks — with the index and the array it read *before* `v`. So a call
      // in the value is one the proof has to survive, which judging after it
      // gives; and a value that writes the index or rebinds the array makes
      // the state after it describe something the store does not use, so
      // there is no proof at all: `xs[i] = (i = 0)` checked the new `i` and
      // stored through the old one.
      walkExpression(walk, state, right);
      const effects = new Effects();
      collectEffects(walk, right, effects);
      if (!rebindsAccess(walk, effects, target)) {
        judge(walk, state, target, target.children[0], target.children[1], storeReadsHolder(walk, effects, target));
      }
    }
    const stored = recordStoreType(ctx.program, ctx.table, target);
    if (stored !== NO_RECORD) {
      forgetPathsRecord(walk, state, stored);
    }
    return;
  }

  if (target.kind === N_MEMBER) {
    // `recv.f = v` evaluates the receiver, and every check inside it, before
    // `v` (`emitFieldAssignment`), so the receiver is walked first: walking it
    // second judged `g.hs[i]` in `g.hs[i].n = (i = 0)` against the new `i`.
    walkExpression(walk, state, target.children[0]);
    walkExpression(walk, state, right);
    forgetPathsThrough(walk, state, target.text);
    // `this.v = new Array<i32>(6)` leaves the path naming an array of six,
    // which is what a later `this.v[5]` — or a callee handed `this` — needs.
    // The size is a literal and the value has no effects of its own, so
    // nothing between reading the receiver and the store can rebind the root.
    const size = op === "=" ? freshLength(walk, right) : -1;
    if (size >= 0) {
      const holder = pathHolder(walk, target);
      if (holder !== null) {
        addFact(state, new Fact(FACT_MIN_LENGTH, holder, null, size));
      }
    }
    return;
  }
  walkExpression(walk, state, right);
  const v = localOf(ctx.program, target);
  if (v === null) {
    return;
  }
  if (op === "=" && isDecrement(ctx.program, v, right)) {
    applyDecrement(walk, state, v, literalValue(unwrapBoundsParens(right).children[1]));
    return;
  }
  if (op === "=") {
    applyAssignment(walk, state, v, right, false);
    return;
  }
  if (op === "-=" && literalValue(right) >= 0) {
    applyDecrement(walk, state, v, literalValue(right));
    return;
  }
  // `i += <non-negative literal>` steps the same way `i = i + n` does; every
  // other compound operator can move the value anywhere.
  applyAssignment(walk, state, v, null, op === "+=" && literalValue(right) >= 0);
};

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
  const ctx = walk.ctx;
  const effects = new Effects();
  collectEffects(walk, root, effects);
  for (const v of effects.clobbered) {
    forgetLocal(walk, state, v);
  }
  for (const v of effects.stepped) {
    if (contains(effects.clobbered, v)) {
      continue;
    }
    if (keepsLowerBound(ctx, v) && !contains(effects.decremented, v)) {
      forgetUpperBounds(state, v);
      forgetWrappedFloor(state, v);
    } else {
      forgetLocal(walk, state, v);
    }
  }
  // A variable only ever counted down keeps its upper bounds, as one only
  // ever counted up keeps its lower one. The state reaching the loop says
  // nothing about the value at each decrement, so the wrap is ruled out by
  // `nsw` alone here.
  for (const v of effects.decremented) {
    if (contains(effects.clobbered, v) || contains(effects.stepped, v)) {
      continue;
    }
    if (keepsUpperBound(ctx, v, false)) {
      forgetLowerBounds(state, v);
    } else {
      forgetLocal(walk, state, v);
    }
  }
  for (const field of effects.fields) {
    forgetPathsThrough(walk, state, field);
  }
  if (effects.calls) {
    forgetCallEffects(walk, state);
  } else {
    for (const stored of effects.records) {
      forgetPathsRecord(walk, state, stored);
    }
  }
};

/**
 * What a statement can do to the state on its way round: the locals it steps
 * and the ones it overwrites, the field names it stores to, whether it calls
 * anything, and which records it stores whole — the last two reach fields it
 * does not name.
 */
class Effects {
  stepped: Local[];
  /** Written only by `v -= c`, `v = v - c` and `v--`, with `c` a non-negative literal. */
  decremented: Local[];
  clobbered: Local[];
  fields: string[];
  calls: boolean;
  /** The record types a whole-record store writes (`recordStoreType`), each once. */
  records: i32[];

  constructor() {
    this.stepped = [];
    this.decremented = [];
    this.clobbered = [];
    this.fields = [];
    this.calls = false;
    this.records = [];
  }
}

const contains = (list: Local[], v: Local): boolean => {
  for (const x of list) {
    if (x === v) {
      return true;
    }
  }
  return false;
};

/** What a write to `target` does to paths: a field name it stores, or a whole record. */
const noteStoredField = (ctx: CheckContext, target: Node, effects: Effects): void => {
  const t = unwrapBoundsParens(target);
  if (t.kind === N_MEMBER && effects.fields.indexOf(t.text) < 0) {
    effects.fields.push(t.text);
  }
  if (t.kind === N_INDEX) {
    const stored = recordStoreType(ctx.program, ctx.table, t);
    if (stored !== NO_RECORD && effects.records.indexOf(stored) < 0) {
      effects.records.push(stored);
    }
  }
};

const collectEffects = (walk: BoundsWalk, node: Node, effects: Effects): void => {
  const ctx = walk.ctx;
  const stepped = effects.stepped;
  const clobbered = effects.clobbered;
  if (node.kind === N_NEW || (node.kind === N_CALL && !callsNothing(ctx, node))) {
    noteCallEffects(walk, node, effects);
  }
  if (node.kind === N_BINARY && isBoundsAssignment(node.text)) {
    noteStoredField(ctx, node.children[0], effects);
    const v = localOf(ctx.program, node.children[0]);
    if (v !== null) {
      const steps =
        (node.text === "=" && isIncrement(ctx.program, v, node.children[1])) ||
        (node.text === "+=" && literalValue(node.children[1]) >= 0);
      const falls =
        (node.text === "=" && isDecrement(ctx.program, v, node.children[1])) ||
        (node.text === "-=" && literalValue(node.children[1]) >= 0);
      if (steps) {
        stepped.push(v);
      } else if (falls) {
        effects.decremented.push(v);
      } else {
        clobbered.push(v);
      }
    }
  }
  if (node.kind === N_UNARY && (node.text === "++" || node.text === "--")) {
    noteStoredField(ctx, node.children[0], effects);
    const v = localOf(ctx.program, node.children[0]);
    if (v !== null) {
      if (node.text === "++") {
        stepped.push(v);
      } else {
        effects.decremented.push(v);
      }
    }
  }
  for (const child of node.children) {
    collectEffects(walk, child, effects);
  }
};

/**
 * A call's share of `Effects`: what its summary says it stores, or `calls`
 * when nothing does (`callSummary`).
 */
const noteCallEffects = (walk: BoundsWalk, call: Node, effects: Effects): void => {
  const summary = callSummary(walk, call);
  if (summary === null) {
    effects.calls = true;
    return;
  }
  for (const field of summary.fields) {
    if (effects.fields.indexOf(field) < 0) {
      effects.fields.push(field);
    }
  }
  for (const stored of summary.records) {
    if (effects.records.indexOf(stored) < 0) {
      effects.records.push(stored);
    }
  }
};

// ---- Statements -------------------------------------------------------------------

/**
 * The state a `for` update or a `do/while` condition runs in: what holds at the
 * end of the body and at every `continue` in it. A body that always leaves
 * without a `continue` makes the update unreachable; it is still walked, from
 * the end of the body, so the accesses in it are judged at all.
 */
const continueJoin = (walk: BoundsWalk, end: State, exits: boolean): State => {
  let joined = end;
  let k = 0;
  if (exits && walk.continues.length > 0) {
    joined = walk.continues[0];
    k = 1;
  }
  while (k < walk.continues.length) {
    joined = intersect(joined, walk.continues[k]);
    k = k + 1;
  }
  return joined;
};

/**
 * The state after a `for` or `while`: what holds where the condition fails,
 * joined with every `break` out of the body. Written into `exit`, which is the
 * condition's state and so the one the enclosing block goes on in.
 */
const breakJoin = (walk: BoundsWalk, exit: State): void => {
  if (walk.breaks.length === 0) {
    return;
  }
  let joined = exit;
  for (const b of walk.breaks) {
    joined = intersect(joined, b);
  }
  copyInto(exit, joined);
};

/**
 * Walk one statement, returning whether control definitely leaves it. That
 * answer is what makes the early-exit guard work: after
 * `if (i >= s.length) { return 0; }` the negation of the test holds for the
 * rest of the block, which is the shape a scanner is written in.
 */
const walkBoundsStatement = (walk: BoundsWalk, state: State, stmt: Node): boolean => {
  const ctx = walk.ctx;

  if (stmt.kind === N_BLOCK) {
    for (const inner of stmt.children) {
      if (walkBoundsStatement(walk, state, inner)) {
        return true;
      }
    }
    return false;
  }

  if (stmt.kind === N_VAR) {
    for (const decl of stmt.children[0].children) {
      walkDeclaration(walk, state, decl);
    }
    return false;
  }

  if (stmt.kind === N_EXPR_STMT) {
    walkExpression(walk, state, stmt.children[0]);
    return false;
  }

  if (stmt.kind === N_IF) {
    walkExpression(walk, state, stmt.children[0]);
    const facts = conditionFacts(walk, state, stmt.children[0]);
    const thenState = cloneState(state);
    addFacts(thenState, facts.whenTrue);
    const thenExits = walkBoundsStatement(walk, thenState, stmt.children[1]);
    const elseState = cloneState(state);
    addFacts(elseState, facts.whenFalse);
    const hasElse = stmt.children[2].kind !== N_EMPTY;
    const elseExits = hasElse ? walkBoundsStatement(walk, elseState, stmt.children[2]) : false;
    if (thenExits && elseExits) {
      return true;
    }
    if (thenExits) {
      copyInto(state, elseState);
    } else if (elseExits) {
      copyInto(state, thenState);
    } else {
      copyInto(state, intersect(thenState, elseState));
    }
    return false;
  }

  if (stmt.kind === N_WHILE) {
    forgetAcross(walk, state, stmt);
    walk.loops = walk.loops + 1;
    walkExpression(walk, state, stmt.children[0]);
    const body = cloneState(state);
    addFacts(body, conditionFacts(walk, state, stmt.children[0]).whenTrue);
    // A `continue` here goes back to the condition, which was walked in the
    // state `forgetAcross` left, so its states are collected only to keep them
    // away from an enclosing loop's update.
    const outer = walk.continues;
    const outerBreaks = walk.breaks;
    walk.continues = [];
    walk.breaks = [];
    walkBoundsStatement(walk, body, stmt.children[1]);
    breakJoin(walk, state);
    walk.continues = outer;
    walk.breaks = outerBreaks;
    walk.loops = walk.loops - 1;
    return false;
  }

  if (stmt.kind === N_DO) {
    forgetAcross(walk, state, stmt);
    walk.loops = walk.loops + 1;
    const body = cloneState(state);
    // The state after a `do/while` is the one `forgetAcross` left, which never
    // saw the condition's facts, so a `break` has nothing to take back; its
    // states are collected only to keep them away from an enclosing loop.
    const outer = walk.continues;
    const outerBreaks = walk.breaks;
    walk.continues = [];
    walk.breaks = [];
    const exits = walkBoundsStatement(walk, body, stmt.children[0]);
    const condition = continueJoin(walk, body, exits);
    walk.continues = outer;
    walk.breaks = outerBreaks;
    walkExpression(walk, condition, stmt.children[1]);
    walk.loops = walk.loops - 1;
    return false;
  }

  if (stmt.kind === N_FOR) {
    // The initializer runs once, before the loop, so it is walked in the outer
    // state and its facts are what `forgetAcross` then prunes.
    const init = stmt.children[0];
    if (init.kind === N_VAR) {
      for (const decl of init.children[0].children) {
        walkDeclaration(walk, state, decl);
      }
    } else if (init.kind !== N_EMPTY) {
      walkExpression(walk, state, init);
    }
    forgetAcross(walk, state, stmt);
    walk.loops = walk.loops + 1;
    const cond = stmt.children[1];
    if (cond.kind !== N_EMPTY) {
      walkExpression(walk, state, cond);
    }
    const body = cloneState(state);
    if (cond.kind !== N_EMPTY) {
      addFacts(body, conditionFacts(walk, state, cond).whenTrue);
    }
    const outer = walk.continues;
    const outerBreaks = walk.breaks;
    walk.continues = [];
    walk.breaks = [];
    const exits = walkBoundsStatement(walk, body, stmt.children[3]);
    const update = continueJoin(walk, body, exits);
    breakJoin(walk, state);
    walk.continues = outer;
    walk.breaks = outerBreaks;
    if (stmt.children[2].kind !== N_EMPTY) {
      walkExpression(walk, update, stmt.children[2]);
    }
    walk.loops = walk.loops - 1;
    return false;
  }

  if (stmt.kind === N_FOR_OF) {
    walkExpression(walk, state, stmt.children[1]);
    forgetAcross(walk, state, stmt);
    walk.loops = walk.loops + 1;
    const body = cloneState(state);
    // As with `do/while`, the state after the loop never saw a fact the loop
    // re-establishes, so a `break` is only kept away from an enclosing loop.
    const outer = walk.continues;
    const outerBreaks = walk.breaks;
    walk.continues = [];
    walk.breaks = [];
    walkBoundsStatement(walk, body, stmt.children[2]);
    walk.continues = outer;
    walk.breaks = outerBreaks;
    walk.loops = walk.loops - 1;
    return false;
  }

  if (stmt.kind === N_RETURN) {
    if (stmt.children[0].kind !== N_EMPTY) {
      walkExpression(walk, state, stmt.children[0]);
    }
    return true;
  }

  if (stmt.kind === N_CONTINUE) {
    walk.continues.push(cloneState(state));
    return true;
  }

  if (stmt.kind === N_BREAK) {
    walk.breaks.push(cloneState(state));
    return true;
  }

  if (stmt.kind === N_THROW) {
    walkExpression(walk, state, stmt.children[0]);
    return true;
  }

  if (stmt.kind === N_SWITCH) {
    walkExpression(walk, state, stmt.children[0]);
    // A clause can be entered from the discriminant or fallen into from the
    // one above it, so each is walked from the state the whole `switch` is
    // sound under and nothing it decided survives past the closing brace.
    forgetAcross(walk, state, stmt);
    // A `break` in a clause leaves the `switch`, not a loop around it, and the
    // state after the `switch` is already the pruned one, so its states go no
    // further. A `continue` does reach the loop, and stays in its frame.
    const outerBreaks = walk.breaks;
    walk.breaks = [];
    for (const clause of stmt.children[1].children) {
      const clauseState = cloneState(state);
      const body = clause.kind === N_CASE ? clause.children[1] : clause.children[0];
      for (const inner of body.children) {
        if (walkBoundsStatement(walk, clauseState, inner)) {
          break;
        }
      }
    }
    walk.breaks = outerBreaks;
    return false;
  }

  // Anything else: forget whatever it touches, then prove what it contains.
  forgetAcross(walk, state, stmt);
  for (const child of stmt.children) {
    walkExpression(walk, state, child);
  }
  return false;
};

const walkDeclaration = (walk: BoundsWalk, state: State, decl: Node): void => {
  const init = decl.children[2];
  if (init.kind !== N_EMPTY) {
    walkExpression(walk, state, init);
  }
  const v = walk.ctx.program.nodeLocals[decl.id];
  if (v === null) {
    return;
  }
  let facts: Fact[] = [];
  if (init.kind !== N_EMPTY) {
    facts = initialiserFacts(walk, state, v, init);
  }
  forgetLocal(walk, state, v);
  addFacts(state, facts);
};

/**
 * Prove the indices of one checked function body. Returns the access nodes
 * whose check survived inside a loop, in source order, so that the WP15 §8
 * walk reports them from the same source-order traversal every other warning
 * of the class comes out of.
 *
 * The proofs themselves go into `program.nodeProvenIndex`, which is the only
 * thing the emitter ever reads from here.
 */
export const analyzeBounds = (ctx: CheckContext, body: Node, uncheckedIndexing: boolean): Node[] => {
  const walk = new BoundsWalk(ctx, uncheckedIndexing);
  const state = new State();
  if (body.kind === N_BLOCK) {
    walkBoundsStatement(walk, state, body);
  } else {
    walkExpression(walk, state, body);
  }
  return walk.unproven;
};

// ---- What crosses a call (self/ranges.ts) -----------------------------------------

/**
 * What a call can do to the facts, as far as the whole program can tell: the
 * field names the callee, or anything it calls, may store to, and the record
 * types it may store whole. A summary exists only for a callee that resizes no
 * array — it calls nothing that could (`self/ranges.ts` builds them) — so a
 * call with one keeps every array length the caller knows, and every path
 * whose fields and links it leaves alone. Everything else is `null` and drops
 * them all, which is what every call does in pass 2.
 */
export class CallSummary {
  fields: string[];
  records: i32[];

  constructor() {
    this.fields = [];
    this.records = [];
  }
}

/**
 * The whole-program facts a walk may read, keyed by `FunctionSig.name`:
 * each function's `CallSummary` (`null` for one that may do anything), and
 * whether it takes entry facts from its call sites. `none` is the summary of a
 * call that stores nothing at all.
 */
export class RangeTables {
  index: StringMap;
  summaries: (CallSummary | null)[];
  candidates: boolean[];
  none: CallSummary;

  constructor() {
    this.index = new StringMap();
    this.summaries = [];
    this.candidates = [];
    this.none = new CallSummary();
  }

  add(sig: FunctionSig, candidate: boolean): void {
    this.index.set(sig.name, this.summaries.length);
    const unknown: CallSummary | null = null;
    this.summaries.push(unknown);
    this.candidates.push(candidate);
  }

  dropCandidate(at: i32): void {
    if (at >= 0 && at < this.candidates.length) {
      this.candidates[at] = false;
    }
  }

  setSummary(at: i32, summary: CallSummary): void {
    if (at >= 0 && at < this.summaries.length) {
      this.summaries[at] = summary;
    }
  }

  summaryOf(sig: FunctionSig): CallSummary | null {
    const at = this.index.get(sig.name, -1);
    return at < 0 ? null : this.summaries[at];
  }

  isCandidate(sig: FunctionSig): boolean {
    const at = this.index.get(sig.name, -1);
    return at >= 0 && this.candidates[at];
  }
}

/** A value no call can reach memory through: a number, a boolean or a string, which is immutable. */
const inertType = (type: i32): boolean => type >= 0 && (isNumeric(type) || type === T_BOOL || type === T_STRING);

const inertOperands = (program: CheckedProgram, args: Node[]): boolean => {
  for (const arg of args) {
    if (!inertType(program.nodeTypes[arg.id])) {
      return false;
    }
  }
  return true;
};

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
export const callSummary = (walk: BoundsWalk, call: Node): CallSummary | null => {
  const tables = walk.tables;
  if (tables === null) {
    return null;
  }
  const callee = walk.ctx.program.nodeCallees[call.id];
  if (callee !== null) {
    return tables.summaryOf(callee);
  }
  return isInertBuiltin(walk.ctx.program, call) ? tables.none : null;
};

/** A call with no user function behind it, handed nothing a store could reach (`callSummary`). */
export const isInertBuiltin = (program: CheckedProgram, call: Node): boolean => {
  if (program.nodeCallees[call.id] !== null) {
    return false;
  }
  if (call.kind === N_NEW) {
    return inertOperands(program, call.children[2].children);
  }
  const target = unwrapBoundsParens(call.children[0]);
  if (target.kind === N_MEMBER) {
    const receiver = unwrapBoundsParens(target.children[0]);
    const type = program.nodeTypes[receiver.id];
    const namespace = receiver.kind === N_IDENT && program.nodeLocals[receiver.id] === null && receiver.text !== "Arena";
    if (!inertType(type) && !(type < 0 && namespace)) {
      return false;
    }
  } else if (target.kind !== N_IDENT) {
    return false;
  }
  return inertOperands(program, call.children[1].children);
};

/** What a call leaves: its summary's stores, or every array length and every path. */
const applyCallEffects = (walk: BoundsWalk, state: State, call: Node): void => {
  const summary = callSummary(walk, call);
  if (summary === null) {
    forgetCallEffects(walk, state);
    return;
  }
  for (const field of summary.fields) {
    forgetPathsThrough(walk, state, field);
  }
  for (const stored of summary.records) {
    forgetPathsRecord(walk, state, stored);
  }
};

/**
 * The facts that hold where a function is entered, stated against its
 * parameters by position — `params[0]` is `this` for a method — so that one
 * call site's facts and another's can be compared. Per parameter, a floor
 * (`p >= floor`, -1 for none) and a `maxIndex` (`p < n`, -1 for none); then
 * a list of length facts, each about a holder named by a parameter and the
 * fields read off it (`fields`, empty for the parameter itself, and `keys`,
 * the same joined with dots): `FACT_MIN_LENGTH` with its `values`, or
 * `FACT_BELOW` / `FACT_AT_MOST` with the parameter that is the index.
 */
export class EntryFacts {
  floor: i32[];
  maxIndex: i32[];
  kinds: i32[];
  index: i32[];
  roots: i32[];
  keys: string[];
  fields: string[][];
  values: i32[];

  constructor(count: i32) {
    this.floor = [];
    this.maxIndex = [];
    let k = 0;
    while (k < count) {
      this.floor.push(-1);
      this.maxIndex.push(-1);
      k = k + 1;
    }
    this.kinds = [];
    this.index = [];
    this.roots = [];
    this.keys = [];
    this.fields = [];
    this.values = [];
  }

  addLength(kind: i32, index: i32, root: i32, fields: string[], value: i32): void {
    const key = fields.join(".");
    if (this.find(kind, index, root, key) >= 0) {
      return;
    }
    this.kinds.push(kind);
    this.index.push(index);
    this.roots.push(root);
    this.keys.push(key);
    this.fields.push(fields);
    this.values.push(value);
  }

  find(kind: i32, index: i32, root: i32, key: string): i32 {
    let k = 0;
    while (k < this.kinds.length) {
      if (this.kinds[k] === kind && this.index[k] === index && this.roots[k] === root && this.keys[k] === key) {
        return k;
      }
      k = k + 1;
    }
    return -1;
  }

  isEmpty(): boolean {
    if (this.kinds.length > 0) {
      return false;
    }
    let k = 0;
    while (k < this.floor.length) {
      if (this.floor[k] >= 0 || this.maxIndex[k] >= 0) {
        return false;
      }
      k = k + 1;
    }
    return true;
  }
}

/**
 * What holds at both of two call sites: the lower floor, the higher `maxIndex`,
 * the shorter minimum length, and a relation only where both state it.
 */
export const joinEntryFacts = (a: EntryFacts, b: EntryFacts): EntryFacts => {
  const out = new EntryFacts(a.floor.length);
  let k = 0;
  while (k < a.floor.length && k < b.floor.length) {
    if (a.floor[k] >= 0 && b.floor[k] >= 0) {
      out.floor[k] = a.floor[k] < b.floor[k] ? a.floor[k] : b.floor[k];
    }
    if (a.maxIndex[k] >= 0 && b.maxIndex[k] >= 0) {
      out.maxIndex[k] = a.maxIndex[k] > b.maxIndex[k] ? a.maxIndex[k] : b.maxIndex[k];
    }
    k = k + 1;
  }
  k = 0;
  while (k < a.kinds.length) {
    const other = b.find(a.kinds[k], a.index[k], a.roots[k], a.keys[k]);
    if (other >= 0) {
      const value = a.values[k] < b.values[other] ? a.values[k] : b.values[other];
      out.addLength(a.kinds[k], a.index[k], a.roots[k], a.fields[k], value);
    }
    k = k + 1;
  }
  return out;
};

/** Whether two sets of entry facts say the same thing, which is when the fixpoint stops. */
export const sameEntryFacts = (a: EntryFacts, b: EntryFacts): boolean => {
  if (a.floor.length !== b.floor.length || a.kinds.length !== b.kinds.length) {
    return false;
  }
  let k = 0;
  while (k < a.floor.length) {
    if (a.floor[k] !== b.floor[k] || a.maxIndex[k] !== b.maxIndex[k]) {
      return false;
    }
    k = k + 1;
  }
  k = 0;
  while (k < a.kinds.length) {
    const other = b.find(a.kinds[k], a.index[k], a.roots[k], a.keys[k]);
    if (other < 0 || b.values[other] !== a.values[k]) {
      return false;
    }
    k = k + 1;
  }
  return true;
};

/** One call to a function that takes entry facts, and what the call proves for it. */
export class RangeSite {
  call: Node;
  callee: FunctionSig;
  facts: EntryFacts;

  constructor(call: Node, callee: FunctionSig, facts: EntryFacts) {
    this.call = call;
    this.callee = callee;
    this.facts = facts;
  }
}

const noteCallSite = (walk: BoundsWalk, state: State, call: Node): void => {
  const tables = walk.tables;
  const callee = walk.ctx.program.nodeCallees[call.id];
  if (tables === null || callee === null || !tables.isCandidate(callee)) {
    return;
  }
  walk.sites.push(new RangeSite(call, callee, siteFacts(walk, state, call, callee)));
};

/** Whether evaluating something with these `effects` can write `v`. */
const writesVariable = (effects: Effects, v: Local): boolean =>
  contains(effects.stepped, v) || contains(effects.decremented, v) || contains(effects.clobbered, v);

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
  const program = walk.ctx.program;
  const count = callee.paramNames.length;
  const out = new EntryFacts(count);
  const args: Node[] = [];
  const target = unwrapBoundsParens(call.children[0]);
  if (callee.role === ROLE_METHOD) {
    if (target.kind !== N_MEMBER) {
      return out;
    }
    args.push(target.children[0]);
  }
  for (const arg of call.children[1].children) {
    args.push(arg);
  }
  if (args.length !== count) {
    return out;
  }
  // Per parameter: the caller's local an index was read from, and the root
  // and fields a holder was.
  const indexVars: (Local | null)[] = [];
  const holderRoots: (Local | null)[] = [];
  const holderFields: string[][] = [];
  let k = 0;
  for (const arg of args) {
    let indexVar: Local | null = null;
    let holderRoot: Local | null = null;
    let fields: string[] = [];
    const type = callee.paramTypes[k];
    if (isIndexType(type)) {
      const constant = literalValue(arg);
      const v = indexLocal(program, arg);
      if (constant >= 0) {
        out.floor[k] = constant;
        out.maxIndex[k] = constant + 1;
      } else if (v !== null && v.type === type && !writesVariable(laterEffects(walk, args, k), v)) {
        // The same type, or no fact at all: an `i32` with an upper bound and
        // no floor may be negative, and handed to a `u32` it is not below
        // anything.
        indexVar = v;
        out.floor[k] = minValueOf(state, v);
        out.maxIndex[k] = maxIndexOf(state, v);
      }
    } else {
      const links: i32[] = [];
      const root = argumentRoot(walk, arg, fields, links);
      if (root !== null) {
        const later = laterEffects(walk, args, k);
        const moved = later.calls || later.records.length > 0 || sharesField(later.fields, fields);
        if (!writesVariable(later, root) && (fields.length === 0 || !moved)) {
          holderRoot = root;
        }
      }
      if (holderRoot === null) {
        fields = [];
      }
    }
    indexVars.push(indexVar);
    holderRoots.push(holderRoot);
    holderFields.push(fields);
    k = k + 1;
  }
  let r = 0;
  for (const root of holderRoots) {
    if (root !== null && r < holderFields.length) {
      mapHolderFacts(walk, state, out, r, root, holderFields[r], indexVars);
    }
    r = r + 1;
  }
  return out;
};

/** What evaluating every argument after the `k`th can do. */
const laterEffects = (walk: BoundsWalk, args: Node[], k: i32): Effects => {
  const later = new Effects();
  let j = 0;
  for (const next of args) {
    if (j > k) {
      collectEffects(walk, next, later);
    }
    j = j + 1;
  }
  return later;
};

/**
 * The local an argument is rooted at, pushing the fields it reads off it on to
 * `fields`: a local or `this` alone, or a path of plain struct links from one.
 * `null` for anything else.
 */
const argumentRoot = (walk: BoundsWalk, arg: Node, fields: string[], links: i32[]): Local | null => {
  const program = walk.ctx.program;
  let e = unwrapBoundsParens(arg);
  if (e.kind === N_MEMBER && declaredPathType(walk, e, fields, links) < 0) {
    return null;
  }
  while (e.kind === N_MEMBER) {
    e = unwrapBoundsParens(e.children[0]);
  }
  if (e.kind !== N_IDENT && e.kind !== N_THIS) {
    return null;
  }
  return program.nodeLocals[e.id];
};

const sharesField = (stored: string[], fields: string[]): boolean => {
  for (const field of fields) {
    if (stored.indexOf(field) >= 0) {
      return true;
    }
  }
  return false;
};

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
    mapOneHolder(state, out, r, root, [], indexVars);
  }
  for (const path of walk.paths) {
    if (path.root !== root || path.fields.length < prefix.length) {
      continue;
    }
    let k = 0;
    let matches = true;
    while (k < prefix.length) {
      if (path.fields[k] !== prefix[k]) {
        matches = false;
      }
      k = k + 1;
    }
    if (!matches) {
      continue;
    }
    const rest: string[] = [];
    while (k < path.fields.length) {
      rest.push(path.fields[k]);
      k = k + 1;
    }
    mapOneHolder(state, out, r, path.holder, rest, indexVars);
  }
};

const mapOneHolder = (state: State, out: EntryFacts, r: i32, holder: Local, rest: string[], indexVars: (Local | null)[]): void => {
  const length = minLengthOf(state, holder);
  if (length > 0) {
    out.addLength(FACT_MIN_LENGTH, -1, r, rest, length);
  }
  let k = 0;
  while (k < indexVars.length) {
    const v = indexVars[k];
    if (v !== null && knownBelow(state, v, holder)) {
      out.addLength(FACT_BELOW, k, r, rest, 0);
    } else if (v !== null && knownAtMost(state, v, holder)) {
      out.addLength(FACT_AT_MOST, k, r, rest, 0);
    }
    k = k + 1;
  }
};

/**
 * The `Local` of each of `sig`'s parameters as `body` uses them, by position,
 * or `null` for one it never reads. The checker binds a parameter to a fresh
 * `Local` in a scope it does not keep, so the uses are where it is found; an
 * arrow's own parameters are not this function's, and its body is skipped.
 */
const parameterLocals = (program: CheckedProgram, sig: FunctionSig, body: Node): (Local | null)[] => {
  const out: (Local | null)[] = [];
  for (const name of sig.paramNames) {
    out.push(findParameter(program, body, name));
  }
  return out;
};

const findParameter = (program: CheckedProgram, node: Node, name: string): Local | null => {
  if (node.kind === N_ARROW) {
    return null;
  }
  if (node.kind === N_IDENT || node.kind === N_THIS) {
    const local = program.nodeLocals[node.id];
    if (local !== null && local.storage === STORAGE_PARAM && local.name === name) {
      return local;
    }
  }
  for (const child of node.children) {
    const found = findParameter(program, child, name);
    if (found !== null) {
      return found;
    }
  }
  return null;
};

/** Put `entering` into `state`, stated against the parameters' own locals. */
const seedEntry = (walk: BoundsWalk, state: State, sig: FunctionSig, body: Node, entering: EntryFacts): void => {
  const params = parameterLocals(walk.ctx.program, sig, body);
  let k = 0;
  while (k < params.length && k < entering.floor.length) {
    const p = params[k];
    if (p !== null && isIndexType(p.type)) {
      if (entering.floor[k] >= 0) {
        addFact(state, new Fact(FACT_MIN_VALUE, p, null, entering.floor[k]));
      }
      if (entering.maxIndex[k] >= 0) {
        addFact(state, new Fact(FACT_MAX_INDEX, p, null, entering.maxIndex[k]));
      }
    }
    k = k + 1;
  }
  k = 0;
  while (k < entering.kinds.length) {
    const root = params[entering.roots[k]];
    let holder: Local | null = null;
    if (root !== null && entering.fields[k].length === 0) {
      holder = walk.ctx.table.isArray(root.type) || root.type === T_STRING ? root : null;
    } else if (root !== null) {
      holder = internPath(walk, root, entering.fields[k]);
    }
    if (holder !== null && entering.kinds[k] === FACT_MIN_LENGTH) {
      addFact(state, new Fact(FACT_MIN_LENGTH, holder, null, entering.values[k]));
    } else if (holder !== null && entering.index[k] >= 0) {
      const i = params[entering.index[k]];
      if (i !== null && isIndexType(i.type)) {
        addFact(state, new Fact(entering.kinds[k], i, holder, 0));
      }
    }
    k = k + 1;
  }
};

/**
 * Record what an unrecorded walk proved, once its caller knows the facts it
 * started from hold: `self/ranges.ts` knows that when the entry fixpoint has
 * settled, and the last walk of a body was the one under its settled entry.
 */
export const commitProofs = (program: CheckedProgram, walk: BoundsWalk): void => {
  for (const node of walk.proved) {
    program.nodeProvenIndex[node.id] = true;
  }
  for (const bound of walk.clamps) {
    program.nodeProvenClamp[bound.id] = true;
  }
};

/**
 * Walk one body the way `analyzeBounds` does, with what the whole program
 * knows: callee summaries in `tables`, and `entering` — or nothing — as the facts
 * that hold where it starts. The walk comes back with the call sites it saw
 * and, when `record` is set, the proofs it added.
 */
export const walkWithRanges = (
  ctx: CheckContext,
  sig: FunctionSig,
  body: Node,
  tables: RangeTables,
  entering: EntryFacts | null,
  record: boolean
): BoundsWalk => {
  const walk = new BoundsWalk(ctx, ctx.uncheckedIndexing);
  walk.tables = tables;
  walk.record = record;
  const state = new State();
  if (entering !== null && !entering.isEmpty()) {
    seedEntry(walk, state, sig, body, entering);
  }
  if (body.kind === N_BLOCK) {
    walkBoundsStatement(walk, state, body);
  } else {
    walkExpression(walk, state, body);
  }
  return walk;
};
