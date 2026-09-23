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
// The five families of fact, keyed by *variable* — a local cannot be written
// through an alias, so no store and no call can invalidate a fact behind the
// checker's back:
//
//   nonNegative(i)   `i >= 0`
//   below(i, w)      `i < w.length`
//   atMost(i, w)     `i <= w.length`
//   maxIndex(i, n)   `i < n`, `n` a literal
//   minLength(w, n)  `w.length >= n`, `n` a literal
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
// `INT_MAX` to land on `INT_MIN`.
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
//   - a store of a whole element into an array of structs, which rewrites a
//     record in place and every field of it with no field name written;
//   - an assignment to the root, or its declaration running again;
//   - **any** call and any `new`, strings included. `FunctionFacts.resizesArray`
//     would answer "can this callee grow an array", but it is the attribute
//     fixpoint's, which runs after every body is checked, so here it is always
//     "not known yet" — and it would not be enough if it were known, because a
//     callee that stores `h.xs = shorter` resizes nothing and still rebinds the
//     path. `push` and `pop` are calls, so they are in this rule too;
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
import { CheckedProgram } from "./program";
import { Local, STORAGE_LOCAL } from "./symbols";
import { T_I32, T_I64, T_STRING, isUnsigned } from "./types";

/** The largest bound the fold carries; a literal past it is answered "not a bound". */
const I32_MAX: i64 = 2147483647;

export const FACT_NON_NEGATIVE: i32 = 0;
export const FACT_BELOW: i32 = 1;
export const FACT_AT_MOST: i32 = 2;
export const FACT_MAX_INDEX: i32 = 3;
export const FACT_MIN_LENGTH: i32 = 4;

/**
 * One fact. `v` is the index variable for the first three kinds and the length
 * holder for `minLength`; `w` is the length holder of `below`; `n` is the
 * literal of the two constant families.
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
 * The facts that hold at one program point. Four parallel-array families,
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
  state.minLengthVar.push(fact.v);
  state.minLengthValue.push(fact.n);
};

const addFacts = (state: State, facts: Fact[]): void => {
  for (const fact of facts) {
    addFact(state, fact);
  }
};

/** Drop the upper bounds of `v` and keep its lower one: what an increment leaves behind. */
const forgetUpperBounds = (state: State, v: Local): void => {
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
};

/**
 * Every length fact about an *array* goes; the string ones stay. A callee that
 * holds the same array may `push` and move `len`. A string has no such
 * operation at all, so only rebinding the variable can change `s.length`.
 */
const forgetArrayLengths = (ctx: CheckContext, state: State): void => {
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
  return out;
};

// ---- Reading the syntax -----------------------------------------------------------

const unwrapBoundsParens = (expr: Node): Node => {
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
  holder: Local;

  constructor(root: Local, fields: string[], holder: Local) {
    this.root = root;
    this.fields = fields;
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
  const type = declaredPathType(walk, expr, fields);
  if (fields.length === 0 || type < 0 || (!walk.ctx.table.isArray(type) && type !== T_STRING)) {
    return null;
  }
  // `declaredPathType` answered, so `e` is an identifier or `this` with a local.
  const root = walk.ctx.program.nodeLocals[e.id];
  if (root === null) {
    return null;
  }
  const name = `${root.name}.${fields.join(".")}`;
  for (const path of walk.paths) {
    if (path.root === root && path.holder.name === name) {
      return path.holder;
    }
  }
  const holder = new Local(name, type, false, STORAGE_LOCAL);
  walk.paths.push(new PathHolder(root, fields, holder));
  return holder;
};

/**
 * The declared type of the location `expr` names, pushing its field names on
 * to `fields` from the root outward, or -1 where a link is not a plain struct
 * with that field. Recursive rather than a loop over the links, so that it
 * indexes nothing and has no bounds check of its own to prove.
 */
const declaredPathType = (walk: BoundsWalk, expr: Node, fields: string[]): i32 => {
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
  const below = declaredPathType(walk, e.children[0], fields);
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

/** Every path fact goes: what a call, a `new` or a whole-record store leaves. */
const forgetPaths = (walk: BoundsWalk, state: State): void => {
  for (const path of walk.paths) {
    forget(state, path.holder);
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
  // `n < i` / `n <= i`: a lower bound, and zero is the only one that matters.
  if (hiVar !== null && loConst >= 0) {
    out.push(new Fact(FACT_NON_NEGATIVE, hiVar, null, 0));
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
    out.push(new Fact(FACT_NON_NEGATIVE, v, null, 0));
    out.push(new Fact(FACT_MAX_INDEX, v, null, n + 1));
  }
  const holder = lengthOf(walk, value);
  if (holder !== null) {
    out.push(new Fact(FACT_MIN_LENGTH, holder, null, n));
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
    return factsFrom(equalityFacts(walk, left, right), []);
  }
  if (op === "!==") {
    return factsFrom([], equalityFacts(walk, left, right));
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
 * variable by that length, and an array of known size starts with that many
 * elements.
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
  /** The property paths this body's facts have been keyed by, in first-use order. */
  paths: PathHolder[];

  constructor(ctx: CheckContext, uncheckedIndexing: boolean) {
    this.ctx = ctx;
    this.unproven = [];
    this.paths = [];
    this.loops = 0;
    this.uncheckedIndexing = uncheckedIndexing;
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
 * A call that is lowered inline and calls nothing, so it cannot reach an array
 * and move its `len`: the one exception to "any call drops every array length
 * fact". `charCodeAt` is a load. The builtin `toI32` is a cast or one
 * `llvm.fptosi.sat`, and without it `const m: i32 = toI32(ys.length)` would
 * drop the fact `const n: i32 = toI32(xs.length)` recorded one line above.
 * The walk and the loop-effect scan both ask this, so they cannot disagree.
 */
const callsNothing = (ctx: CheckContext, call: Node): boolean => isCharCodeAt(ctx, call) || isBuiltinToI32(ctx.program, call);

/**
 * Record the verdict for one access. A proof goes into the side table the
 * emitter reads; the absence of one inside a loop goes on the list the WP15 §8
 * walk reports from, but only for the shape the analysis could have proved —
 * a field receiver or a computed index was never a candidate, and the §8 bar
 * is that a warning names a rewrite rather than a limitation.
 */
const judge = (walk: BoundsWalk, state: State, node: Node, receiver: Node, index: Node): void => {
  const ctx = walk.ctx;
  const holder = holderOf(walk, receiver);
  if (holder === null) {
    return;
  }
  if (proves(ctx, state, holder, index)) {
    ctx.program.nodeProvenIndex[node.id] = true;
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
const judgeClampBound = (ctx: CheckContext, state: State, holder: Local | null, bound: Node): void => {
  if (provesClamp(ctx, state, holder, bound)) {
    ctx.program.nodeProvenClamp[bound.id] = true;
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

  if (e.kind === N_INDEX) {
    walkExpression(walk, state, e.children[0]);
    walkExpression(walk, state, e.children[1]);
    judge(walk, state, e, e.children[0], e.children[1]);
    return;
  }

  if (e.kind === N_CALL) {
    const callee = unwrapBoundsParens(e.children[0]);
    if (callee.kind === N_MEMBER) {
      walkExpression(walk, state, callee.children[0]);
    } else if (callee.kind !== N_IDENT) {
      walkExpression(walk, state, callee);
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
        judgeClampBound(ctx, state, holder, arg);
      }
    }
    if (isCharCodeAt(ctx, e)) {
      judge(walk, state, e, callee.children[0], e.children[1].children[0]);
    }
    if (callsNothing(ctx, e)) {
      return;
    }
    // `nish_str_new` is a callee like any other, so the array lengths go here
    // whether or not this call was a `substring` — and every path goes, string
    // or array, because a callee can store to any field it can reach.
    forgetCallEffects(walk, state);
    return;
  }

  if (e.kind === N_NEW) {
    for (const arg of e.children[2].children) {
      walkExpression(walk, state, arg);
    }
    forgetCallEffects(walk, state); // a constructor body is a callee like any other
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
      forgetLocal(walk, state, v);
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
 * Whether an operator writes its left operand: `=` and every `op=`. The same
 * rule `self/emit_util.ts` states, spelled again here rather than imported,
 * because a checker module that reaches into the emitter is a dependency
 * neither compiler has.
 */
const isBoundsAssignment = (op: string): boolean => {
  if (op === "=") {
    return true;
  }
  if (op.length < 2 || !op.endsWith("=")) {
    return false;
  }
  // `===`, `!==`, `<=`, `>=` end in `=` and write nothing.
  return op !== "===" && op !== "!==" && op !== "==" && op !== "!=" && op !== "<=" && op !== ">=";
};

/**
 * Whether an element store writes a struct in place. An array of records keeps
 * its elements inline (WP15 §2a) and `const r = rs[0]` is an interior pointer,
 * so `rs[0] = other` rewrites `r.xs` with no field name anywhere in the
 * statement. An array of classes holds pointers and a store there changes no
 * object, but the two are told apart by a layout rule this walk has no reason
 * to restate, so any struct element counts.
 */
const storesRecord = (ctx: CheckContext, access: Node): boolean => {
  const type = ctx.program.nodeTypes[access.id];
  return type < 0 || ctx.table.isStruct(type);
};

/**
 * Whether evaluating `value` can change what the access `target` reads before
 * it: the index local, the array local, or a path's root or any field on it.
 * `a[i] = value` reads those two before `value` and checks after it, so a
 * proof stated in the state after `value` is a proof about them only while
 * `value` leaves them alone. A call needs no case here: it cannot reach a
 * local, and it already drops every path and array length it could.
 */
const rebindsAccess = (walk: BoundsWalk, value: Node, target: Node): boolean => {
  const ctx = walk.ctx;
  const effects = new Effects();
  collectEffects(ctx, value, effects);
  const index = localOf(ctx.program, target.children[1]);
  if (index !== null && (contains(effects.stepped, index) || contains(effects.clobbered, index))) {
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
    if (effects.records || contains(effects.clobbered, path.root)) {
      return true;
    }
    for (const field of effects.fields) {
      if (path.fields.indexOf(field) >= 0) {
        return true;
      }
    }
  }
  return false;
};

/** Assignments and the short-circuit operators; every other binary is left then right. */
const walkBinary = (walk: BoundsWalk, state: State, expr: Node): void => {
  const ctx = walk.ctx;
  const op = expr.text;
  const left = expr.children[0];
  const right = expr.children[1];

  if (op === "&&" || op === "||") {
    walkExpression(walk, state, left);
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
      judge(walk, state, target, target.children[0], target.children[1]);
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
      if (!rebindsAccess(walk, right, target)) {
        judge(walk, state, target, target.children[0], target.children[1]);
      }
    }
    if (storesRecord(ctx, target)) {
      forgetPaths(walk, state);
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
    return;
  }
  walkExpression(walk, state, right);
  const v = localOf(ctx.program, target);
  if (v === null) {
    return;
  }
  if (op === "=") {
    applyAssignment(walk, state, v, right, false);
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
 * bound and loses its upper ones. Every array length goes too as soon as the
 * node contains a call. A path goes with its root, with a store to any field it
 * names, and with a call, a `new` or a whole-record store anywhere in the node.
 * That leaves the loop *condition* to re-establish the upper bound on each
 * pass, which is exactly what it does.
 */
const forgetAcross = (walk: BoundsWalk, state: State, root: Node): void => {
  const ctx = walk.ctx;
  const effects = new Effects();
  collectEffects(ctx, root, effects);
  for (const v of effects.clobbered) {
    forgetLocal(walk, state, v);
  }
  for (const v of effects.stepped) {
    if (contains(effects.clobbered, v)) {
      continue;
    }
    if (keepsLowerBound(ctx, v)) {
      forgetUpperBounds(state, v);
    } else {
      forgetLocal(walk, state, v);
    }
  }
  for (const field of effects.fields) {
    forgetPathsThrough(walk, state, field);
  }
  if (effects.calls) {
    forgetCallEffects(walk, state);
  } else if (effects.records) {
    forgetPaths(walk, state);
  }
};

/**
 * What a statement can do to the state on its way round: the locals it steps
 * and the ones it overwrites, the field names it stores to, and whether it
 * calls anything or stores a whole record, either of which reaches fields it
 * does not name.
 */
class Effects {
  stepped: Local[];
  clobbered: Local[];
  fields: string[];
  calls: boolean;
  records: boolean;

  constructor() {
    this.stepped = [];
    this.clobbered = [];
    this.fields = [];
    this.calls = false;
    this.records = false;
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
  if (t.kind === N_INDEX && storesRecord(ctx, t)) {
    effects.records = true;
  }
};

const collectEffects = (ctx: CheckContext, node: Node, effects: Effects): void => {
  const stepped = effects.stepped;
  const clobbered = effects.clobbered;
  if (node.kind === N_NEW) {
    effects.calls = true;
  }
  if (node.kind === N_CALL && !callsNothing(ctx, node)) {
    effects.calls = true;
  }
  if (node.kind === N_BINARY && isBoundsAssignment(node.text)) {
    noteStoredField(ctx, node.children[0], effects);
    const v = localOf(ctx.program, node.children[0]);
    if (v !== null) {
      const steps =
        (node.text === "=" && isIncrement(ctx.program, v, node.children[1])) ||
        (node.text === "+=" && literalValue(node.children[1]) >= 0);
      if (steps) {
        stepped.push(v);
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
        clobbered.push(v);
      }
    }
  }
  for (const child of node.children) {
    collectEffects(ctx, child, effects);
  }
};

// ---- Statements -------------------------------------------------------------------

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
    walkBoundsStatement(walk, body, stmt.children[1]);
    walk.loops = walk.loops - 1;
    return false;
  }

  if (stmt.kind === N_DO) {
    forgetAcross(walk, state, stmt);
    walk.loops = walk.loops + 1;
    const body = cloneState(state);
    walkBoundsStatement(walk, body, stmt.children[0]);
    walkExpression(walk, body, stmt.children[1]);
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
    walkBoundsStatement(walk, body, stmt.children[3]);
    if (stmt.children[2].kind !== N_EMPTY) {
      walkExpression(walk, body, stmt.children[2]);
    }
    walk.loops = walk.loops - 1;
    return false;
  }

  if (stmt.kind === N_FOR_OF) {
    walkExpression(walk, state, stmt.children[1]);
    forgetAcross(walk, state, stmt);
    walk.loops = walk.loops + 1;
    const body = cloneState(state);
    walkBoundsStatement(walk, body, stmt.children[2]);
    walk.loops = walk.loops - 1;
    return false;
  }

  if (stmt.kind === N_RETURN) {
    if (stmt.children[0].kind !== N_EMPTY) {
      walkExpression(walk, state, stmt.children[0]);
    }
    return true;
  }

  if (stmt.kind === N_BREAK || stmt.kind === N_CONTINUE) {
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
    for (const clause of stmt.children[1].children) {
      const clauseState = cloneState(state);
      const body = clause.kind === N_CASE ? clause.children[1] : clause.children[0];
      for (const inner of body.children) {
        if (walkBoundsStatement(walk, clauseState, inner)) {
          break;
        }
      }
    }
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
