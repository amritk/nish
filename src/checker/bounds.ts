/**
 * The bounds-check proof (WP15 §2.1 and §2.2): a flow-sensitive analysis that
 * decides, for every `a[i]` and every `s.charCodeAt(i)`, whether the index is
 * already known to be in range. Where it is, the emitter writes the
 * `getelementptr` and nothing else; where it is not, the runtime check stays
 * and the `performance` warning of §8's table names the guard that would have
 * proved it.
 *
 * **What "ranged" means here.** §2.1 proposes a declared range —
 * `i: integer<0, 255>` — and §2.2 a length guard that narrows an array for the
 * region it dominates. The declared form needs a generic type parameter, which
 * Phase 0 refuses and which §9 item 8 owns, so what ships is the *analysis*
 * both surfaces would feed: ranges are inferred from the guards, loop
 * conditions and initialisers already in the program, and from the one ranged
 * type the language does have — `u8`/`u16`/`u32`/`u64`, whose lower bound is
 * the type rather than a proof. A declared range is then one more source of
 * facts for this domain rather than a second mechanism.
 *
 * **The domain.** Five families of fact, all keyed by *variable* and never by
 * a property path, for the same reason `narrowing.ts` gives: a local cannot be
 * written through an alias, so no store and no call can invalidate a fact
 * behind the checker's back. `this.pos < this.source.length` therefore proves
 * nothing, and the warning names the rewrite (bind the two to locals), exactly
 * as the nullable hint does.
 *
 *   nonNegative(i)   `i >= 0`
 *   below(i, w)      `i < w.length`
 *   atMost(i, w)     `i <= w.length`
 *   maxIndex(i, n)   `i < n`, `n` a literal
 *   minLength(w, n)  `w.length >= n`, `n` a literal
 *
 * An access `w[i]` is proven when `i >= 0` and either `i < w.length` directly,
 * or `i < n <= w.length` through the two constant families. A constant index
 * `w[3]` needs only `minLength(w, 4)`.
 *
 * `atMost` is what makes the *hoisted* length work, and it is there because
 * the advice everybody gives about bounds checks is to hoist one:
 * `const n = xs.length` records `n <= xs.length`, and a later `i < n` then
 * proves `i < xs.length` without the loop ever mentioning `xs.length` again.
 * Without it the compiler would be eliminating the check from the naive loop
 * and keeping it in the loop somebody had already optimised by hand.
 *
 * **What invalidates a fact** is the whole soundness argument:
 *
 *   - an assignment to `i` drops every fact about `i`, unless the assignment
 *     is `i = i + <non-negative literal>` (or `i++`, `i += c`), which can only
 *     move `i` away from zero and so keeps `nonNegative` while dropping the
 *     upper bounds. That exception is gated on `nsw`: under `--wrapping` the
 *     increment is *defined* to wrap past `INT_MAX` into the negatives, and a
 *     lower bound that a documented wrap can break is not a proof.
 *   - an assignment to `w` drops every fact that mentions `w`'s length.
 *   - **any call drops every array length fact**, because a callee holding the
 *     same array may `push` and move `len`. String lengths survive: a string
 *     is immutable, so the only thing that can change `s.length` is rebinding
 *     `s`, which is an assignment. That asymmetry is what makes a lexer's
 *     `while (i < s.length && isAlpha(s.charCodeAt(i)))` provable with a user
 *     call sitting in the same condition.
 *   - entering a loop drops every fact about a variable the loop assigns
 *     (except the monotone case above) and every array length fact when the
 *     loop body contains a call. The loop *condition* is then walked in that
 *     state, so `for (let i = 0; i < a.length; i++)` re-establishes
 *     `below(i, a)` on every pass, which is precisely what makes the counted
 *     loop check-free.
 *
 * The walk is in evaluation order, which is load-bearing rather than tidy:
 * `a[i] = f()` must be proven against the facts that survive `f`, because the
 * check the emitter writes runs after the call, and `f(a[i])` must be proven
 * against the facts *before* it, because the check runs before.
 *
 * The result is one side table, `CheckedProgram.provenIndices`, holding the
 * access nodes whose check may be dropped. `emit/arrays.ts` and
 * `emit/strings.ts` read it and `collectArrayFacts` reads it too — a proven
 * access no longer calls `nish_panic_index`, so a function whose every index
 * is proven keeps `willreturn`.
 *
 * **The same facts answer a second question, and it is not about a check.**
 * `s.substring(a, b)` clamps each end into `[0, len]` the way JavaScript
 * specifies — an `llvm.smin` / `llvm.smax` pair per bound, six intrinsic calls
 * once the two are swapped into order — and that clamp is the semantics rather
 * than a safety net, so `--unchecked-indexing` leaves it alone. A bound this
 * analysis can place in `[0, s.length]` cannot be moved by the clamp, so the
 * clamp is dead code: `CheckedProgram.provenClamps` says which bounds those
 * are and `emit/strings.ts` writes them through. LLVM does not find this on
 * its own — the guard a program writes is on the `i32` and the clamp is on its
 * `sext`, and `opt -O3` keeps all six calls either way.
 */
import ts from "typescript";
import { CheckContext } from "./context.js";
import { CheckedProgram, FunctionSig, LocalVar } from "./program.js";
import { CompilerOptions, StaticType, isUnsigned } from "../types.js";

/**
 * One fact, as a tagged record rather than a discriminated union: stage1's
 * subset has no unions beyond `T | null`, and the two analyses are compared
 * byte for byte by the IR oracle, so the shape that mirrors is the shape both
 * get. `v` is the index variable for the first three kinds and the length
 * holder for `minLength`; `w` is the length holder of `below`; `n` is the
 * literal of the two constant families.
 */
type Fact = {
  kind: "nonNegative" | "below" | "atMost" | "maxIndex" | "minLength";
  v: LocalVar;
  w?: LocalVar;
  n: number;
};

/** What a condition proves where it holds, and where it does not. */
type ConditionFacts = {
  whenTrue: Fact[];
  whenFalse: Fact[];
};

const NO_FACTS: ConditionFacts = { whenTrue: [], whenFalse: [] };

/**
 * The facts that hold at one program point. Four parallel-array families
 * rather than four `Map`s, because entry order is the order everything is
 * compared in and stage1 has neither `Map` nor `Set`.
 */
type State = {
  nonNegative: LocalVar[];
  belowIndex: LocalVar[];
  belowHolder: LocalVar[];
  atMostIndex: LocalVar[];
  atMostHolder: LocalVar[];
  maxIndexVar: LocalVar[];
  maxIndexValue: number[];
  minLengthVar: LocalVar[];
  minLengthValue: number[];
};

const emptyState = (): State => ({
  nonNegative: [],
  belowIndex: [],
  belowHolder: [],
  atMostIndex: [],
  atMostHolder: [],
  maxIndexVar: [],
  maxIndexValue: [],
  minLengthVar: [],
  minLengthValue: [],
});

const cloneState = (s: State): State => ({
  nonNegative: [...s.nonNegative],
  belowIndex: [...s.belowIndex],
  belowHolder: [...s.belowHolder],
  atMostIndex: [...s.atMostIndex],
  atMostHolder: [...s.atMostHolder],
  maxIndexVar: [...s.maxIndexVar],
  maxIndexValue: [...s.maxIndexValue],
  minLengthVar: [...s.minLengthVar],
  minLengthValue: [...s.minLengthValue],
});

/** Overwrite `into` with `from`'s facts. The walk threads one mutable state through a body. */
const copyInto = (into: State, from: State): void => {
  into.nonNegative = [...from.nonNegative];
  into.belowIndex = [...from.belowIndex];
  into.belowHolder = [...from.belowHolder];
  into.atMostIndex = [...from.atMostIndex];
  into.atMostHolder = [...from.atMostHolder];
  into.maxIndexVar = [...from.maxIndexVar];
  into.maxIndexValue = [...from.maxIndexValue];
  into.minLengthVar = [...from.minLengthVar];
  into.minLengthValue = [...from.minLengthValue];
};

// ---- Reading the state -----------------------------------------------------------------

/**
 * `v >= 0`. An unsigned type answers this without any flow at all, which is
 * the one ranged type the language already has: `u8`/`u16`/`u32`/`u64` cannot
 * hold a negative value, so their lower bound is read off the declaration
 * exactly as §2.1's `integer<0, n>` would be.
 */
const knownNonNegative = (state: State, v: LocalVar): boolean =>
  isUnsigned(v.type) || state.nonNegative.includes(v);

/** `i < w.length` is recorded here. */
const knownBelow = (state: State, i: LocalVar, w: LocalVar): boolean => {
  for (let k = 0; k < state.belowIndex.length; k++) {
    if (state.belowIndex[k] === i && state.belowHolder[k] === w) return true;
  }
  return false;
};

/**
 * `i <= w.length`, which a strict `i < w.length` gives as well. The holders it
 * answers for are what turns `i < n` into `i < w.length` when `n` was bound to
 * a hoisted length.
 */
const knownAtMost = (state: State, i: LocalVar, w: LocalVar): boolean => {
  for (let k = 0; k < state.atMostIndex.length; k++) {
    if (state.atMostIndex[k] === i && state.atMostHolder[k] === w) return true;
  }
  return knownBelow(state, i, w);
};

/** Every holder whose length bounds `i` from above, in the order they were recorded. */
const holdersAbove = (state: State, i: LocalVar): LocalVar[] => {
  const out: LocalVar[] = [];
  for (let k = 0; k < state.atMostIndex.length; k++) {
    if (state.atMostIndex[k] === i && !out.includes(state.atMostHolder[k])) out.push(state.atMostHolder[k]);
  }
  for (let k = 0; k < state.belowIndex.length; k++) {
    if (state.belowIndex[k] === i && !out.includes(state.belowHolder[k])) out.push(state.belowHolder[k]);
  }
  return out;
};

/** The smallest recorded `n` with `i < n`, or `undefined` when there is none. */
const maxIndexOf = (state: State, i: LocalVar): number | undefined => {
  let best: number | undefined;
  for (let k = 0; k < state.maxIndexVar.length; k++) {
    if (state.maxIndexVar[k] === i && (best === undefined || state.maxIndexValue[k] < best)) {
      best = state.maxIndexValue[k];
    }
  }
  return best;
};

/** Whether `w.length >= n` is recorded. */
const knownMinLength = (state: State, w: LocalVar, n: number): boolean => {
  for (let k = 0; k < state.minLengthVar.length; k++) {
    if (state.minLengthVar[k] === w && state.minLengthValue[k] >= n) return true;
  }
  return false;
};

// ---- Writing the state -----------------------------------------------------------------

const addFact = (state: State, fact: Fact): void => {
  if (fact.kind === "nonNegative") {
    if (!state.nonNegative.includes(fact.v)) state.nonNegative.push(fact.v);
  } else if (fact.kind === "below") {
    const w = fact.w;
    if (w !== undefined && !knownBelow(state, fact.v, w)) {
      state.belowIndex.push(fact.v);
      state.belowHolder.push(w);
    }
  } else if (fact.kind === "atMost") {
    const w = fact.w;
    if (w !== undefined && !knownAtMost(state, fact.v, w)) {
      state.atMostIndex.push(fact.v);
      state.atMostHolder.push(w);
    }
  } else if (fact.kind === "maxIndex") {
    state.maxIndexVar.push(fact.v);
    state.maxIndexValue.push(fact.n);
  } else {
    state.minLengthVar.push(fact.v);
    state.minLengthValue.push(fact.n);
  }
};

const addFacts = (state: State, facts: Fact[]): void => {
  for (const fact of facts) addFact(state, fact);
};

/**
 * Forget everything that mentions `v`: its own bounds, the accesses it indexes
 * and the accesses indexed *into* it. Called for every assignment the monotone
 * rule below does not rescue.
 */
const forget = (state: State, v: LocalVar): void => {
  state.nonNegative = state.nonNegative.filter((x) => x !== v);
  const index: LocalVar[] = [];
  const holder: LocalVar[] = [];
  for (let k = 0; k < state.belowIndex.length; k++) {
    if (state.belowIndex[k] !== v && state.belowHolder[k] !== v) {
      index.push(state.belowIndex[k]);
      holder.push(state.belowHolder[k]);
    }
  }
  state.belowIndex = index;
  state.belowHolder = holder;
  const atIndex: LocalVar[] = [];
  const atHolder: LocalVar[] = [];
  for (let k = 0; k < state.atMostIndex.length; k++) {
    if (state.atMostIndex[k] !== v && state.atMostHolder[k] !== v) {
      atIndex.push(state.atMostIndex[k]);
      atHolder.push(state.atMostHolder[k]);
    }
  }
  state.atMostIndex = atIndex;
  state.atMostHolder = atHolder;
  forgetUpperBounds(state, v);
  const lengthVar: LocalVar[] = [];
  const lengthValue: number[] = [];
  for (let k = 0; k < state.minLengthVar.length; k++) {
    if (state.minLengthVar[k] !== v) {
      lengthVar.push(state.minLengthVar[k]);
      lengthValue.push(state.minLengthValue[k]);
    }
  }
  state.minLengthVar = lengthVar;
  state.minLengthValue = lengthValue;
};

/** Drop the upper bounds of `v` and keep its lower one: what an increment leaves behind. */
const forgetUpperBounds = (state: State, v: LocalVar): void => {
  const index: LocalVar[] = [];
  const holder: LocalVar[] = [];
  for (let k = 0; k < state.belowIndex.length; k++) {
    if (state.belowIndex[k] !== v) {
      index.push(state.belowIndex[k]);
      holder.push(state.belowHolder[k]);
    }
  }
  state.belowIndex = index;
  state.belowHolder = holder;
  const atIndex: LocalVar[] = [];
  const atHolder: LocalVar[] = [];
  for (let k = 0; k < state.atMostIndex.length; k++) {
    if (state.atMostIndex[k] !== v) {
      atIndex.push(state.atMostIndex[k]);
      atHolder.push(state.atMostHolder[k]);
    }
  }
  state.atMostIndex = atIndex;
  state.atMostHolder = atHolder;
  const maxVar: LocalVar[] = [];
  const maxValue: number[] = [];
  for (let k = 0; k < state.maxIndexVar.length; k++) {
    if (state.maxIndexVar[k] !== v) {
      maxVar.push(state.maxIndexVar[k]);
      maxValue.push(state.maxIndexValue[k]);
    }
  }
  state.maxIndexVar = maxVar;
  state.maxIndexValue = maxValue;
};

/**
 * Every length fact about an *array* goes; the string ones stay. A callee that
 * holds the same array may `push` and move `len`, and the checker has no
 * whole-program answer to that at this point in the pipeline. A string has no
 * such operation at all: its bytes and its length are fixed at construction,
 * so only rebinding the variable can change what `s.length` reads.
 */
const forgetArrayLengths = (state: State): void => {
  const index: LocalVar[] = [];
  const holder: LocalVar[] = [];
  for (let k = 0; k < state.belowIndex.length; k++) {
    if (state.belowHolder[k].type.kind !== "array") {
      index.push(state.belowIndex[k]);
      holder.push(state.belowHolder[k]);
    }
  }
  state.belowIndex = index;
  state.belowHolder = holder;
  const atIndex: LocalVar[] = [];
  const atHolder: LocalVar[] = [];
  for (let k = 0; k < state.atMostIndex.length; k++) {
    if (state.atMostHolder[k].type.kind !== "array") {
      atIndex.push(state.atMostIndex[k]);
      atHolder.push(state.atMostHolder[k]);
    }
  }
  state.atMostIndex = atIndex;
  state.atMostHolder = atHolder;
  const lengthVar: LocalVar[] = [];
  const lengthValue: number[] = [];
  for (let k = 0; k < state.minLengthVar.length; k++) {
    if (state.minLengthVar[k].type.kind !== "array") {
      lengthVar.push(state.minLengthVar[k]);
      lengthValue.push(state.minLengthValue[k]);
    }
  }
  state.minLengthVar = lengthVar;
  state.minLengthValue = lengthValue;
};

/**
 * The facts that hold on both paths of a branch. Entries keep `a`'s order so
 * that two runs of the analysis over the same program meet the same state in
 * the same order, which is what lets the two compilers agree byte for byte.
 */
const intersect = (a: State, b: State): State => {
  const out = emptyState();
  out.nonNegative = a.nonNegative.filter((v) => knownNonNegative(b, v));
  for (let k = 0; k < a.belowIndex.length; k++) {
    if (knownBelow(b, a.belowIndex[k], a.belowHolder[k])) {
      out.belowIndex.push(a.belowIndex[k]);
      out.belowHolder.push(a.belowHolder[k]);
    }
  }
  for (let k = 0; k < a.atMostIndex.length; k++) {
    if (knownAtMost(b, a.atMostIndex[k], a.atMostHolder[k])) {
      out.atMostIndex.push(a.atMostIndex[k]);
      out.atMostHolder.push(a.atMostHolder[k]);
    }
  }
  // The weaker of two bounds is the one that survives: `i < 3` on one path and
  // `i < 5` on the other means `i < 5` after the join.
  for (let k = 0; k < a.maxIndexVar.length; k++) {
    const other = maxIndexOf(b, a.maxIndexVar[k]);
    if (other !== undefined) {
      out.maxIndexVar.push(a.maxIndexVar[k]);
      out.maxIndexValue.push(Math.max(a.maxIndexValue[k], other));
    }
  }
  for (let k = 0; k < a.minLengthVar.length; k++) {
    const other = minLengthOf(b, a.minLengthVar[k]);
    if (other !== undefined) {
      out.minLengthVar.push(a.minLengthVar[k]);
      out.minLengthValue.push(Math.min(a.minLengthValue[k], other));
    }
  }
  return out;
};

/** The largest recorded `n` with `w.length >= n`, or `undefined`. */
const minLengthOf = (state: State, w: LocalVar): number | undefined => {
  let best: number | undefined;
  for (let k = 0; k < state.minLengthVar.length; k++) {
    if (state.minLengthVar[k] === w && (best === undefined || state.minLengthValue[k] > best)) {
      best = state.minLengthValue[k];
    }
  }
  return best;
};

// ---- Reading the syntax ----------------------------------------------------------------

const unwrapParens = (expr: ts.Expression): ts.Expression => {
  let inner = expr;
  while (ts.isParenthesizedExpression(inner)) inner = inner.expression;
  return inner;
};

/** The local a bare identifier names, or `undefined` for every other expression. */
const localOf = (program: CheckedProgram, expr: ts.Expression): LocalVar | undefined => {
  const e = unwrapParens(expr);
  return ts.isIdentifier(e) ? program.bindings.get(e) : undefined;
};

/** A local whose value is a thing with a `.length`: an array or a string. */
const lengthHolder = (program: CheckedProgram, expr: ts.Expression): LocalVar | undefined => {
  const v = localOf(program, expr);
  if (!v) return undefined;
  return v.type.kind === "array" || v.type.kind === "string" ? v : undefined;
};

/** A local that can be an index: an integer, signed or unsigned. `f64` is never one (see `isIndexType`). */
const indexLocal = (program: CheckedProgram, expr: ts.Expression): LocalVar | undefined => {
  const v = localOf(program, expr);
  return v !== undefined && isIndexType(v.type) ? v : undefined;
};

/**
 * Integer types only. An `f64` index is truncated toward zero by `fptosi`, and
 * a proof about the double is not a proof about the truncation once `NaN` and
 * the values past `2^63` are in the picture — so `--number-mode f64` gets the
 * constant-index proofs (which need no range at all) and nothing else.
 */
const isIndexType = (t: StaticType): boolean => t.kind === "i32" || t.kind === "i64" || isUnsigned(t);

/** `w.length` on a local holder: the expression a bound is stated against. */
const lengthOfLocal = (program: CheckedProgram, expr: ts.Expression): LocalVar | undefined => {
  const e = unwrapParens(expr);
  if (!ts.isPropertyAccessExpression(e) || e.name.text !== "length") return undefined;
  return lengthHolder(program, e.expression);
};

/**
 * The non-negative integer a literal denotes. Written as decimal digits only:
 * `0x10` and `1_0` are normalised differently by the two front ends, and a
 * bound that only one compiler folds is a bound that makes the two disagree
 * about a bounds check — which the IR oracle would report as a miscompile.
 */
const literalValue = (expr: ts.Expression): number | undefined => {
  const e = unwrapParens(expr);
  if (!ts.isNumericLiteral(e)) return undefined;
  const written = e.getText(e.getSourceFile());
  if (written.length === 0) return undefined;
  for (let k = 0; k < written.length; k++) {
    const c = written.charCodeAt(k);
    if (c < 48 || c > 57) return undefined;
  }
  const value = Number(written);
  // Bounds live in `i32` at the source level; a literal past that is not a
  // bound anybody wrote on purpose and folding it would need `bigint`.
  return Number.isSafeInteger(value) && value <= 2147483647 ? value : undefined;
};

// ---- Conditions ------------------------------------------------------------------------

/**
 * What `lo < hi` (or `lo <= hi`) proves. Four shapes carry a bound worth
 * recording; everything else says nothing this domain can hold.
 */
const orderFacts = (
  program: CheckedProgram,
  state: State,
  lo: ts.Expression,
  hi: ts.Expression,
  strict: boolean
): Fact[] => {
  const out: Fact[] = [];
  const loVar = indexLocal(program, lo);
  const hiVar = indexLocal(program, hi);
  const loConst = literalValue(lo);
  const hiConst = literalValue(hi);
  const hiLength = lengthOfLocal(program, hi);

  // `i < w.length`: the fact the whole analysis is built around.
  if (loVar !== undefined && hiLength !== undefined && strict) {
    out.push({ kind: "below", v: loVar, w: hiLength, n: 0 });
  }
  // `i < n` / `i <= n`.
  if (loVar !== undefined && hiConst !== undefined) {
    out.push({ kind: "maxIndex", v: loVar, n: strict ? hiConst : hiConst + 1 });
  }
  // `n < i` / `n <= i`: a lower bound, and zero is the only one that matters.
  if (hiVar !== undefined && loConst !== undefined) {
    out.push({ kind: "nonNegative", v: hiVar, n: 0 });
  }
  // `n < w.length` / `n <= w.length`: §2.2's length guard.
  if (loConst !== undefined && hiLength !== undefined) {
    out.push({ kind: "minLength", v: hiLength, n: strict ? loConst + 1 : loConst });
  }
  // `i <= w.length`, which is not a proof on its own but is what a later
  // `k < i` needs to become `k < w.length`.
  if (loVar !== undefined && hiLength !== undefined && !strict) {
    out.push({ kind: "atMost", v: loVar, w: hiLength, n: 0 });
  }
  // `i < n` where `n` is itself bounded by a length: the hoisted-length loop.
  // Transitivity is applied here, at the point the condition is evaluated,
  // rather than stored as a rule, so the resulting `below` is invalidated by
  // everything that invalidates a `below`.
  if (loVar !== undefined && hiVar !== undefined && strict) {
    for (const w of holdersAbove(state, hiVar)) out.push({ kind: "below", v: loVar, w, n: 0 });
  }
  // A `w.length` on the low side bounds the length from *above*, which proves
  // no access, so there is deliberately no further shape here.
  return out;
};

/** What `a === b` proves: a literal pins an index's range and a length's floor. */
const equalityFacts = (program: CheckedProgram, left: ts.Expression, right: ts.Expression): Fact[] => {
  const out: Fact[] = [];
  const pairs: [ts.Expression, ts.Expression][] = [
    [left, right],
    [right, left],
  ];
  for (const [value, other] of pairs) {
    const n = literalValue(other);
    if (n === undefined) continue;
    const v = indexLocal(program, value);
    if (v !== undefined) {
      out.push({ kind: "nonNegative", v, n: 0 });
      out.push({ kind: "maxIndex", v, n: n + 1 });
    }
    const holder = lengthOfLocal(program, value);
    if (holder !== undefined) out.push({ kind: "minLength", v: holder, n });
  }
  return out;
};

/**
 * What a condition proves where it holds and where it does not. The boolean
 * algebra is `narrowing.ts`'s, for the same reasons: `a && b` proves both only
 * when it is true, `a || b` proves both negations only when it is false, and
 * `!` swaps the two halves.
 */
const conditionFacts = (program: CheckedProgram, state: State, cond: ts.Expression): ConditionFacts => {
  const expr = unwrapParens(cond);
  if (ts.isPrefixUnaryExpression(expr) && expr.operator === ts.SyntaxKind.ExclamationToken) {
    const inner = conditionFacts(program, state, expr.operand);
    return { whenTrue: inner.whenFalse, whenFalse: inner.whenTrue };
  }
  if (!ts.isBinaryExpression(expr)) return NO_FACTS;
  const op = expr.operatorToken.kind;
  if (op === ts.SyntaxKind.AmpersandAmpersandToken) {
    const l = conditionFacts(program, state, expr.left);
    const r = conditionFacts(program, state, expr.right);
    return { whenTrue: [...l.whenTrue, ...r.whenTrue], whenFalse: [] };
  }
  if (op === ts.SyntaxKind.BarBarToken) {
    const l = conditionFacts(program, state, expr.left);
    const r = conditionFacts(program, state, expr.right);
    return { whenTrue: [], whenFalse: [...l.whenFalse, ...r.whenFalse] };
  }
  if (op === ts.SyntaxKind.EqualsEqualsEqualsToken) {
    return { whenTrue: equalityFacts(program, expr.left, expr.right), whenFalse: [] };
  }
  if (op === ts.SyntaxKind.ExclamationEqualsEqualsToken) {
    return { whenTrue: [], whenFalse: equalityFacts(program, expr.left, expr.right) };
  }
  // `a < b` is false exactly when `b <= a`, and so on around the four
  // relations: each one proves something on both sides of the branch.
  if (op === ts.SyntaxKind.LessThanToken) {
    return {
      whenTrue: orderFacts(program, state, expr.left, expr.right, true),
      whenFalse: orderFacts(program, state, expr.right, expr.left, false),
    };
  }
  if (op === ts.SyntaxKind.LessThanEqualsToken) {
    return {
      whenTrue: orderFacts(program, state, expr.left, expr.right, false),
      whenFalse: orderFacts(program, state, expr.right, expr.left, true),
    };
  }
  if (op === ts.SyntaxKind.GreaterThanToken) {
    return {
      whenTrue: orderFacts(program, state, expr.right, expr.left, true),
      whenFalse: orderFacts(program, state, expr.left, expr.right, false),
    };
  }
  if (op === ts.SyntaxKind.GreaterThanEqualsToken) {
    return {
      whenTrue: orderFacts(program, state, expr.right, expr.left, false),
      whenFalse: orderFacts(program, state, expr.left, expr.right, true),
    };
  }
  return NO_FACTS;
};

// ---- Assignments -----------------------------------------------------------------------

/**
 * `v = v + <non-negative literal>` and its spellings. An increment can only
 * move `v` away from zero, so the lower bound survives it — but only with
 * `nsw` on, where passing `INT_MAX` is undefined behaviour the compiler may
 * assume away. `--wrapping` *defines* that step to land on `INT_MIN`, and a
 * lower bound a documented wrap can break is not a proof (the unsigned widths
 * are exempt: they wrap by definition and are never negative either way).
 */
const isIncrement = (program: CheckedProgram, v: LocalVar, rhs: ts.Expression): boolean => {
  const e = unwrapParens(rhs);
  if (!ts.isBinaryExpression(e) || e.operatorToken.kind !== ts.SyntaxKind.PlusToken) return false;
  const left = localOf(program, e.left);
  const right = localOf(program, e.right);
  if (left === v) return literalValue(e.right) !== undefined;
  if (right === v) return literalValue(e.left) !== undefined;
  return false;
};

const keepsLowerBound = (opts: CompilerOptions, v: LocalVar): boolean => opts.nsw || isUnsigned(v.type);

/** Apply `v = <rhs>` to the state; `increment` covers `v += c`, `v++` and `++v` too. */
const applyAssignment = (
  walk: Walk,
  state: State,
  v: LocalVar,
  rhs: ts.Expression | undefined,
  increment: boolean
): void => {
  const program = walk.ctx.program;
  const monotone =
    (increment || (rhs !== undefined && isIncrement(program, v, rhs))) &&
    knownNonNegative(state, v) &&
    keepsLowerBound(walk.ctx.opts, v);
  if (monotone) {
    forgetUpperBounds(state, v);
    addFact(state, { kind: "nonNegative", v, n: 0 });
    return;
  }
  // The value is computed before the store, so what it proves is read from the
  // state the variable's own facts are still in.
  const facts = rhs === undefined ? [] : initialiserFacts(program, walk.ctx.opts, state, v, rhs);
  forget(state, v);
  addFacts(state, facts);
};

/**
 * Whether the value of `expr` cannot be negative. A literal and a `.length`
 * say so outright, a variable says so when the state does, and a sum says so
 * when both ends do — under `nsw`, where a sum that would pass `INT_MAX` is
 * undefined behaviour rather than a wrap into the negatives. That last rule is
 * what gives `let j = i + 1` its lower bound, which is half of every proof
 * about a second cursor.
 */
const impliesNonNegative = (
  program: CheckedProgram,
  opts: CompilerOptions,
  state: State,
  expr: ts.Expression
): boolean => {
  const e = unwrapParens(expr);
  if (literalValue(e) !== undefined) return true;
  if (lengthOfLocal(program, e) !== undefined) return true;
  const v = localOf(program, e);
  if (v !== undefined) return isIndexType(v.type) && knownNonNegative(state, v);
  if (!ts.isBinaryExpression(e) || e.operatorToken.kind !== ts.SyntaxKind.PlusToken) return false;
  const type = program.types.get(e);
  if (!opts.nsw && !(type !== undefined && isUnsigned(type))) return false;
  return (
    impliesNonNegative(program, opts, state, e.left) && impliesNonNegative(program, opts, state, e.right)
  );
};

/**
 * What a value gives the variable it is written into: a non-negative value
 * pins the lower end, a literal pins the upper one too, a `.length` bounds the
 * variable by that length, and an array of known size starts with that many
 * elements.
 */
const initialiserFacts = (
  program: CheckedProgram,
  opts: CompilerOptions,
  state: State,
  v: LocalVar,
  init: ts.Expression
): Fact[] => {
  const e = unwrapParens(init);
  const out: Fact[] = [];
  if (isIndexType(v.type) && impliesNonNegative(program, opts, state, e)) {
    out.push({ kind: "nonNegative", v, n: 0 });
  }
  const n = literalValue(e);
  if (n !== undefined && isIndexType(v.type)) {
    out.push({ kind: "maxIndex", v, n: n + 1 });
    return out;
  }
  const holder = lengthOfLocal(program, e);
  if (holder !== undefined && isIndexType(v.type)) {
    // `const n = xs.length` is the hoist everybody is told to write, and this
    // is the fact that keeps it as fast as the loop that re-reads the length.
    out.push({ kind: "atMost", v, w: holder, n: 0 });
    return out;
  }
  if (v.type.kind === "array" && ts.isArrayLiteralExpression(e)) {
    out.push({ kind: "minLength", v, n: e.elements.length });
    return out;
  }
  if (v.type.kind === "array" && ts.isNewExpression(e) && e.arguments?.length === 1) {
    const size = literalValue(e.arguments[0]);
    if (size !== undefined) out.push({ kind: "minLength", v, n: size });
  }
  return out;
};

// ---- The walk --------------------------------------------------------------------------

/**
 * The analysis in progress. `loops` is only a depth: the warning fires inside
 * a loop and nowhere else, because a check that runs once is not a check
 * anybody is paying for.
 */
type Walk = {
  ctx: CheckContext;
  proven: WeakSet<ts.Node>;
  /** Access nodes whose surviving check is worth a warning, in source order. */
  unproven: ts.Node[];
  /** `substring` bound expressions the clamp cannot move; see `provenClamps`. */
  provenClamps: WeakSet<ts.Node>;
  loops: number;
};

/** `w[i]` or `s.charCodeAt(i)`: the receiver and the index, or `undefined`. */
type Access = {
  node: ts.Node;
  receiver: ts.Expression;
  index: ts.Expression;
};

const elementAccess = (expr: ts.ElementAccessExpression): Access => ({
  node: expr,
  receiver: expr.expression,
  index: expr.argumentExpression,
});

/** `s.charCodeAt(i)` on a string receiver, which lowers to the same check `a[i]` does. */
const charCodeAccess = (program: CheckedProgram, call: ts.CallExpression): Access | undefined => {
  const callee = unwrapParens(call.expression);
  if (!ts.isPropertyAccessExpression(callee) || callee.name.text !== "charCodeAt") return undefined;
  if (call.arguments.length !== 1) return undefined;
  if (program.types.get(callee.expression)?.kind !== "string") return undefined;
  return { node: call, receiver: callee.expression, index: call.arguments[0] };
};

/**
 * Record the verdict for one access. A proof goes into the side table the
 * emitter reads; the absence of one inside a loop goes on the list the
 * `performance` walk reports from, but only for the shape the analysis could
 * have proved — a field receiver or a computed index was never a candidate,
 * and §8's bar is that a warning names a rewrite rather than a limitation.
 */
const judge = (walk: Walk, state: State, access: Access): void => {
  const program = walk.ctx.program;
  const holder = lengthHolder(program, access.receiver);
  if (holder === undefined) return;
  if (proves(walk, state, holder, access.index)) {
    walk.proven.add(access.node);
    return;
  }
  if (walk.loops === 0 || walk.ctx.opts.uncheckedIndexing) return;
  if (indexLocal(program, access.index) === undefined) return;
  walk.unproven.push(access.node);
};

/**
 * `s.substring(a)` / `s.substring(a, b)` on a string receiver: the receiver and
 * the bounds. Two arguments at most, because that is the arity the checker
 * accepts; a third is already an error and is never judged here.
 */
const substringBounds = (
  program: CheckedProgram,
  call: ts.CallExpression
): { receiver: ts.Expression; bounds: readonly ts.Expression[] } | undefined => {
  const callee = unwrapParens(call.expression);
  if (!ts.isPropertyAccessExpression(callee) || callee.name.text !== "substring") return undefined;
  if (call.arguments.length === 0 || call.arguments.length > 2) return undefined;
  if (program.types.get(callee.expression)?.kind !== "string") return undefined;
  return { receiver: callee.expression, bounds: call.arguments };
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
 * is the lower bound of `s.substring(0, n)`, which is the commonest spelling of
 * the call there is, and it means the fold reaches code nobody rewrote.
 */
const provesClamp = (
  walk: Walk,
  state: State,
  holder: LocalVar | undefined,
  bound: ts.Expression
): boolean => {
  const constant = literalValue(bound);
  if (constant !== undefined) {
    if (constant === 0) return true;
    return constant > 0 && holder !== undefined && knownMinLength(state, holder, constant);
  }
  if (holder === undefined) return false;
  const i = indexLocal(walk.ctx.program, bound);
  if (i === undefined || !knownNonNegative(state, i)) return false;
  // `knownAtMost` answers `knownBelow` too, and `i < len` implies `i <= len`.
  return knownAtMost(state, i, holder);
};

/**
 * Record which of a `substring`'s bounds the clamp cannot move. Nothing is
 * pushed on to the unproven list here: the warning for the bounds that stay
 * clamped is reported by `checkPerformance`, which re-derives the shape from
 * the syntax and reads this table for the verdict, so that all of WP15 §8's
 * warnings still come out of one source-order walk.
 */
const judgeClamp = (walk: Walk, state: State, call: ts.CallExpression): void => {
  const parts = substringBounds(walk.ctx.program, call);
  if (parts === undefined) return;
  const holder = lengthHolder(walk.ctx.program, parts.receiver);
  for (const bound of parts.bounds) {
    if (provesClamp(walk, state, holder, bound)) walk.provenClamps.add(bound);
  }
};

/** The proof itself: `0 <= i` and `i < holder.length`, by whichever route the state has. */
const proves = (walk: Walk, state: State, holder: LocalVar, index: ts.Expression): boolean => {
  const program = walk.ctx.program;
  const constant = literalValue(index);
  if (constant !== undefined) return knownMinLength(state, holder, constant + 1);
  const i = indexLocal(program, index);
  if (i === undefined || !knownNonNegative(state, i)) return false;
  if (knownBelow(state, i, holder)) return true;
  const bound = maxIndexOf(state, i);
  return bound !== undefined && knownMinLength(state, holder, bound);
};

/**
 * Walk an expression in evaluation order, proving the accesses it contains and
 * applying what it does to the state. The order is the emitter's: an access
 * is judged at the point its check runs, which is after its own operands and
 * before anything that follows it.
 */
const walkExpression = (walk: Walk, state: State, expr: ts.Expression): void => {
  const program = walk.ctx.program;
  const e = unwrapParens(expr);

  if (ts.isElementAccessExpression(e)) {
    walkExpression(walk, state, e.expression);
    walkExpression(walk, state, e.argumentExpression);
    judge(walk, state, elementAccess(e));
    return;
  }

  if (ts.isCallExpression(e)) {
    const callee = unwrapParens(e.expression);
    if (ts.isPropertyAccessExpression(callee)) walkExpression(walk, state, callee.expression);
    else if (!ts.isIdentifier(callee)) walkExpression(walk, state, callee);
    for (const arg of e.arguments) walkExpression(walk, state, arg);
    const chars = charCodeAccess(program, e);
    if (chars !== undefined) {
      // `charCodeAt` is inlined to a load; it calls nothing and mutates nothing.
      judge(walk, state, chars);
      return;
    }
    // The clamp runs before the copy, so the bounds are judged against the
    // facts that reach the call rather than the ones that survive it. The call
    // still forgets array lengths below: `nish_str_new` is a callee like any
    // other, and nothing about this verdict changes what it may do.
    judgeClamp(walk, state, e);
    forgetArrayLengths(state);
    return;
  }

  if (ts.isNewExpression(e)) {
    if (e.arguments) for (const arg of e.arguments) walkExpression(walk, state, arg);
    forgetArrayLengths(state); // a constructor body is a callee like any other
    return;
  }

  if (ts.isBinaryExpression(e)) {
    walkBinary(walk, state, e);
    return;
  }

  if (ts.isConditionalExpression(e)) {
    walkExpression(walk, state, e.condition);
    const facts = conditionFacts(program, state, e.condition);
    const whenTrue = cloneState(state);
    addFacts(whenTrue, facts.whenTrue);
    walkExpression(walk, whenTrue, e.whenTrue);
    const whenFalse = cloneState(state);
    addFacts(whenFalse, facts.whenFalse);
    walkExpression(walk, whenFalse, e.whenFalse);
    copyInto(state, intersect(whenTrue, whenFalse));
    return;
  }

  if (ts.isPostfixUnaryExpression(e) || ts.isPrefixUnaryExpression(e)) {
    const operand = e.operand;
    const stepping =
      e.operator === ts.SyntaxKind.PlusPlusToken || e.operator === ts.SyntaxKind.MinusMinusToken;
    walkExpression(walk, state, operand);
    if (!stepping) return;
    const v = localOf(program, operand);
    if (v === undefined) return;
    if (e.operator === ts.SyntaxKind.PlusPlusToken) applyAssignment(walk, state, v, undefined, true);
    else forget(state, v);
    return;
  }

  // A template hole, an array or object literal, a property access, a bare
  // identifier: nothing here changes the state by itself, but a call nested
  // inside one still has to take the array lengths away, so every child is
  // walked rather than skipped.
  ts.forEachChild(e, (child) => walkAny(walk, state, child));
};

/**
 * Reach the expressions inside a node whose own kind the walk does not name.
 * The tree between a statement and the call buried in a template hole is made
 * of nodes that are neither, and missing one would mean missing the call.
 */
const walkAny = (walk: Walk, state: State, node: ts.Node): void => {
  if (
    ts.isElementAccessExpression(node) ||
    ts.isCallExpression(node) ||
    ts.isNewExpression(node) ||
    ts.isBinaryExpression(node) ||
    ts.isConditionalExpression(node) ||
    ts.isPrefixUnaryExpression(node) ||
    ts.isPostfixUnaryExpression(node) ||
    ts.isParenthesizedExpression(node)
  ) {
    walkExpression(walk, state, node as ts.Expression);
    return;
  }
  ts.forEachChild(node, (child) => walkAny(walk, state, child));
};

/** Assignments and the short-circuit operators; every other binary is left then right. */
const walkBinary = (walk: Walk, state: State, expr: ts.BinaryExpression): void => {
  const program = walk.ctx.program;
  const op = expr.operatorToken.kind;

  if (op === ts.SyntaxKind.AmpersandAmpersandToken || op === ts.SyntaxKind.BarBarToken) {
    walkExpression(walk, state, expr.left);
    const facts = conditionFacts(program, state, expr.left);
    const guarded = cloneState(state);
    addFacts(guarded, op === ts.SyntaxKind.AmpersandAmpersandToken ? facts.whenTrue : facts.whenFalse);
    walkExpression(walk, guarded, expr.right);
    // The right operand may not have run at all, so only what holds either way
    // survives — which also puts back whatever the guard added and the right
    // operand did not take away.
    copyInto(state, intersect(state, guarded));
    return;
  }

  const assignment = op >= ts.SyntaxKind.FirstAssignment && op <= ts.SyntaxKind.LastAssignment;
  if (!assignment) {
    walkExpression(walk, state, expr.left);
    walkExpression(walk, state, expr.right);
    return;
  }

  const target = unwrapParens(expr.left);
  if (ts.isElementAccessExpression(target)) {
    // The emitter evaluates the array, the index and the value, and only then
    // writes the check — so a call in the value is a call the check comes
    // after, and the proof has to survive it.
    walkExpression(walk, state, target.expression);
    walkExpression(walk, state, target.argumentExpression);
    walkExpression(walk, state, expr.right);
    judge(walk, state, elementAccess(target));
    return;
  }

  walkExpression(walk, state, expr.right);
  if (ts.isPropertyAccessExpression(target)) {
    walkExpression(walk, state, target.expression);
    return;
  }
  const v = localOf(program, target);
  if (v === undefined) return;
  if (op === ts.SyntaxKind.EqualsToken) {
    applyAssignment(walk, state, v, expr.right, false);
    return;
  }
  // `i += <non-negative literal>` steps the same way `i = i + n` does; every
  // other compound operator can move the value anywhere.
  const stepping = op === ts.SyntaxKind.PlusEqualsToken && literalValue(expr.right) !== undefined;
  applyAssignment(walk, state, v, undefined, stepping);
};

// ---- Loops -----------------------------------------------------------------------------

/**
 * What survives entering `node`, which is a loop at every call site but one:
 * the same pruning is what a statement the walk cannot model precisely gets. Every variable the loop assigns loses its
 * facts, because the second iteration reaches the top of the body with the
 * assignment behind it — except a variable whose every assignment in the loop
 * is an increment, which keeps its lower bound and loses its upper ones. Every
 * array length goes too as soon as the loop contains a call, for the reason
 * `forgetArrayLengths` gives.
 *
 * That leaves the loop *condition* to re-establish the upper bound on each
 * pass, which is exactly what it does: `for (let i = 0; i < a.length; i++)`
 * walks its condition in this state and proves `a[i]` from it.
 */
const forgetAcross = (walk: Walk, state: State, root: ts.Node): void => {
  const program = walk.ctx.program;
  const stepped: LocalVar[] = [];
  const clobbered: LocalVar[] = [];
  let calls = false;
  const visit = (node: ts.Node): void => {
    if (ts.isNewExpression(node)) calls = true;
    if (ts.isCallExpression(node) && charCodeAccess(program, node) === undefined) calls = true;
    if (ts.isBinaryExpression(node) && isAssignmentOperator(node.operatorToken.kind)) {
      const v = localOf(program, node.left);
      if (v !== undefined) {
        const op = node.operatorToken.kind;
        const steps =
          (op === ts.SyntaxKind.EqualsToken && isIncrement(program, v, node.right)) ||
          (op === ts.SyntaxKind.PlusEqualsToken && literalValue(node.right) !== undefined);
        (steps ? stepped : clobbered).push(v);
      }
    }
    if (ts.isPostfixUnaryExpression(node) || ts.isPrefixUnaryExpression(node)) {
      const v = localOf(program, node.operand);
      if (v !== undefined) {
        if (node.operator === ts.SyntaxKind.PlusPlusToken) stepped.push(v);
        else if (node.operator === ts.SyntaxKind.MinusMinusToken) clobbered.push(v);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(root);
  for (const v of clobbered) forget(state, v);
  for (const v of stepped) {
    if (clobbered.includes(v)) continue;
    if (keepsLowerBound(walk.ctx.opts, v)) forgetUpperBounds(state, v);
    else forget(state, v);
  }
  if (calls) forgetArrayLengths(state);
};

const isAssignmentOperator = (kind: ts.SyntaxKind): boolean =>
  kind >= ts.SyntaxKind.FirstAssignment && kind <= ts.SyntaxKind.LastAssignment;

// ---- Statements ------------------------------------------------------------------------

/**
 * Walk one statement, returning whether control definitely leaves it. That
 * answer is what makes the early-exit guard work: after
 * `if (i >= s.length) { return 0; }` the negation of the test holds for the
 * rest of the block, which is the shape a scanner is written in.
 */
const walkStatement = (walk: Walk, state: State, stmt: ts.Statement): boolean => {
  const program = walk.ctx.program;

  if (ts.isBlock(stmt)) {
    for (const inner of stmt.statements) {
      if (walkStatement(walk, state, inner)) return true;
    }
    return false;
  }

  if (ts.isVariableStatement(stmt)) {
    for (const decl of stmt.declarationList.declarations) walkDeclaration(walk, state, decl);
    return false;
  }

  if (ts.isExpressionStatement(stmt)) {
    walkExpression(walk, state, stmt.expression);
    return false;
  }

  if (ts.isIfStatement(stmt)) {
    walkExpression(walk, state, stmt.expression);
    const facts = conditionFacts(program, state, stmt.expression);
    const thenState = cloneState(state);
    addFacts(thenState, facts.whenTrue);
    const thenExits = walkStatement(walk, thenState, stmt.thenStatement);
    const elseState = cloneState(state);
    addFacts(elseState, facts.whenFalse);
    const elseExits = stmt.elseStatement ? walkStatement(walk, elseState, stmt.elseStatement) : false;
    if (thenExits && elseExits) return true;
    copyInto(state, thenExits ? elseState : elseExits ? thenState : intersect(thenState, elseState));
    return false;
  }

  if (ts.isWhileStatement(stmt)) {
    forgetAcross(walk, state, stmt);
    walk.loops++;
    walkExpression(walk, state, stmt.expression);
    const body = cloneState(state);
    addFacts(body, conditionFacts(program, state, stmt.expression).whenTrue);
    walkStatement(walk, body, stmt.statement);
    walk.loops--;
    return false;
  }

  if (ts.isDoStatement(stmt)) {
    forgetAcross(walk, state, stmt);
    walk.loops++;
    const body = cloneState(state);
    walkStatement(walk, body, stmt.statement);
    walkExpression(walk, body, stmt.expression);
    walk.loops--;
    return false;
  }

  if (ts.isForStatement(stmt)) {
    // The initializer runs once, before the loop, so it is walked in the outer
    // state and its facts are what `enterLoop` then prunes.
    if (stmt.initializer) {
      if (ts.isVariableDeclarationList(stmt.initializer)) {
        for (const decl of stmt.initializer.declarations) walkDeclaration(walk, state, decl);
      } else {
        walkExpression(walk, state, stmt.initializer);
      }
    }
    forgetAcross(walk, state, stmt);
    walk.loops++;
    if (stmt.condition) walkExpression(walk, state, stmt.condition);
    const body = cloneState(state);
    if (stmt.condition) addFacts(body, conditionFacts(program, state, stmt.condition).whenTrue);
    walkStatement(walk, body, stmt.statement);
    if (stmt.incrementor) walkExpression(walk, body, stmt.incrementor);
    walk.loops--;
    return false;
  }

  if (ts.isForOfStatement(stmt)) {
    walkExpression(walk, state, stmt.expression);
    forgetAcross(walk, state, stmt);
    walk.loops++;
    const body = cloneState(state);
    walkStatement(walk, body, stmt.statement);
    walk.loops--;
    return false;
  }

  if (ts.isReturnStatement(stmt)) {
    if (stmt.expression) walkExpression(walk, state, stmt.expression);
    return true;
  }

  if (ts.isBreakStatement(stmt) || ts.isContinueStatement(stmt)) return true;

  if (ts.isThrowStatement(stmt)) {
    walkExpression(walk, state, stmt.expression);
    return true;
  }

  if (ts.isSwitchStatement(stmt)) {
    walkExpression(walk, state, stmt.expression);
    // A clause can be entered from the discriminant or fallen into from the
    // one above it, so each is walked from the state the whole `switch` is
    // sound under and nothing it decided survives past the closing brace.
    forgetAcross(walk, state, stmt);
    for (const clause of stmt.caseBlock.clauses) {
      const clauseState = cloneState(state);
      for (const inner of clause.statements) {
        if (walkStatement(walk, clauseState, inner)) break;
      }
    }
    return false;
  }

  // Anything else: forget whatever it touches, then prove what it contains.
  forgetAcross(walk, state, stmt);
  ts.forEachChild(stmt, (child) => {
    if (ts.isStatement(child)) walkStatement(walk, state, child);
    else walkAny(walk, state, child);
  });
  return false;
};

const walkDeclaration = (walk: Walk, state: State, decl: ts.VariableDeclaration): void => {
  if (decl.initializer) walkExpression(walk, state, decl.initializer);
  const v = walk.ctx.program.locals.get(decl);
  if (v === undefined) return;
  const facts = decl.initializer
    ? initialiserFacts(walk.ctx.program, walk.ctx.opts, state, v, decl.initializer)
    : [];
  forget(state, v);
  addFacts(state, facts);
};

/**
 * Prove the indices of one checked function body. Returns the access nodes
 * whose check survived inside a loop, in source order, so that
 * `checkPerformance` reports them from the same walk every other WP15 §8
 * warning comes out of and the diagnostics stay in source order.
 *
 * The proofs themselves go into `ctx.program.provenIndices`, which is the only
 * thing the emitter ever reads from here.
 */
export const analyzeBounds = (ctx: CheckContext, sig: FunctionSig): ts.Node[] => {
  // WP27 S1: a foreign declaration has no body, so there are no indices to
  // prove. Guarded here as well as at the call, the way `checkResultLocalsHandled`
  // and `checkElementReferences` are: this is the fifth of the body walkers
  // `FunctionSig.body`'s comment names, and each of them is safe on its own
  // rather than on its caller's account.
  const body = sig.body;
  if (body === undefined) return [];
  const walk: Walk = {
    ctx,
    proven: ctx.program.provenIndices,
    unproven: [],
    provenClamps: ctx.program.provenClamps,
    loops: 0,
  };
  const state = emptyState();
  if (ts.isBlock(body)) walkStatement(walk, state, body);
  else walkExpression(walk, state, body);
  return walk.unproven;
};
