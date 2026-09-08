/**
 * Function/parameter attribute analysis ("Rust parity" hints for LLVM).
 *
 * Everything emitted here must be a *guarantee*, never a hope: a wrong
 * attribute is undefined behaviour, not a missed optimisation. The rules:
 *
 *   nounwind    The language has no exceptions; nothing can unwind.
 *   willreturn  The function cannot fail to return: every loop is a counted
 *               loop with a finite trip count (`isCountedLoop`), the body
 *               has no `throw` (which traps and never returns), it cannot
 *               reach a `noreturn` runtime call (`process.exit`, a checked
 *               `a[i]`), and every callee is itself willreturn (fixpoint over
 *               the call graph). Unbounded recursion is allowed: LangRef lets
 *               a willreturn function exhaust the stack. `mustprogress` is
 *               never added, because JS permits infinite loops.
 *   readnone    The function touches no memory except its own allocas and
 *               calls only functions that are themselves readnone. LLVM's
 *               FunctionAttrs pass infers exactly this, so it is safe to
 *               assert it up front. (Spelled `readnone`, which every LLVM
 *               version accepts; LLVM 16+ upgrades it to `memory(none)`.)
 *               `throw` lowers to `llvm.trap`, a side effect, so a throwing
 *               function (and anything that calls it) is neither readnone
 *               nor readonly.
 *   readonly    As above, but the body reads memory it does not own: a
 *               `.length` load through a string or array pointer, a field or
 *               element read, or a call to a reading callee (e.g.
 *               `amrit_str_eq`). Never with `readnone`.
 *   noundef     Every value is initialised, so no param or return
 *               value is ever undef/poison.
 *   zeroext     `boolean` is i1; the C ABI wants it zero-extended in a register.
 *   String params (`i8*`):
 *     nonnull   The language has no null.
 *     readonly  Strings are immutable.
 *     align 8   Literals and arena strings are 8-byte aligned.
 *     noalias   Valid because nothing writes through string pointers: the
 *               noalias guarantee only concerns *modified* memory.
 *     nocapture Only when the param never escapes (`classifyUse`): a use is
 *               harmless when the value is consumed on the spot (operand of
 *               an operator, a condition, the receiver of a `.length` read,
 *               a hole of a template that builds a new string, an argument
 *               of a runtime builtin, which are all `nocapture`); it escapes
 *               when returned, passed to a user function (conservatively,
 *               no fixpoint for strings), stored into a local, a field, an
 *               array or an object literal, or used in any way not listed.
 *               Parentheses, ternary arms and single-hole templates are
 *               transparent.
 *   Struct params (`%struct.X*`, WP2), including `this`:
 *     nonnull align 8 dereferenceable(sizeof X)
 *               Every struct value comes from the arena allocator: 8-aligned,
 *               at least `sizeof X` bytes, never null. `X` is the *declared*
 *               parameter type; a derived object passed in its place (WP2b)
 *               is at least as large, since the base fields are its prefix.
 *     noalias   Only on `this` of a constructor: `new` hands it a fresh
 *               allocation nothing else points at. Never elsewhere: two
 *               struct params may well be the same object.
 *     readonly  The function never stores through the pointer (`p.f = v`,
 *               `p.f op= v`), never lets it escape (see nocapture), and only
 *               passes it to callees whose corresponding parameter is itself
 *               readonly (fixpoint over the call graph, `pointerParams`).
 *               Writes through a *different* pointer to the same object are
 *               allowed by LangRef, but escaping disqualifies anyway so the
 *               function cannot even obtain such a pointer from this one.
 *     nocapture As for strings, with a fixpoint: passing the pointer to a
 *               callee that captures its parameter captures it here too.
 *   Array params (`%struct.amrit_array*`, WP4): the same `pointerParams` model
 *   as structs, with the array constructs classified as follows:
 *     nonnull   The language has no null.
 *     align 8   Headers come from the arena (8-byte rounded) only.
 *     dereferenceable(24)
 *               The header `{ i64 len, i64 cap, i8* data }` is always
 *               complete (WP9): a literal, `new Array`, or a runtime call
 *               produced it, so LLVM may hoist the `len` load ahead of the
 *               bounds branch and speculate it out of loops. Same on returns.
 *     readonly  The body never stores through the param: no `p[i] = v`,
 *               `p[i] op= v`, `p.push(v)`, nor through anything indexed from
 *               it (`p[i][j] = v`, `p[i].f = v`, `p[i].push(v)`: the element
 *               is a loaded pointer, so this is conservative), never aliases
 *               it (`let q = p`, `[p]`, `xs.push(p)`, `return p`, ...: an
 *               alias could be written and LLVM may fold it back into `p`),
 *               and only passes it to callees whose matching param is itself
 *               readonly (the fixpoint, optimistic on cycles: a param is
 *               written only if some actual store reaches it). Never
 *               `noalias`: two array params may be the same array, and
 *               arrays are mutable.
 *     nocapture As above with "captured" in place of "written": the param is
 *               used only as an indexing base, `.length` / `push` receiver,
 *               `for...of` source, `===` operand, or a direct argument to a
 *               callee that does not capture it.
 *
 *   Nullable params (`T | null`, WP6): as the pointer kind above minus
 *     `nonnull` and `dereferenceable`, which a null value would violate;
 *     `align 8` stays (null is aligned to every power of two).
 *
 * Memory strategy (WP6, `escape.ts`): the analysis also decides which
 * allocation sites become entry-block allocas (`stackSites`) and which
 * functions bracket their body with `amrit_arena_mark` / `amrit_arena_release`
 * (`arenaScope`). Both need the `pointerParams` fixpoint (does a callee
 * capture the object?), so `analyzeFunctions` runs the fixpoint, decides,
 * then re-collects the facts with the decisions applied (an allocation that
 * moved to the stack is no longer a write or an allocator call, and a field
 * access through a local that only ever holds a stack object is own memory)
 * and runs the fixpoint again.
 *
 * Cross-module facts (WP5): the analysis runs over *every* module of a
 * program at once, keyed by LLVM symbol, so a caller in `main.ts` sees the
 * same purity facts for an imported `square` as `math.ts` proved for its
 * definition. The importer's `declare` therefore carries exactly the
 * attributes of the exporter's `define`, which is what lets the optimiser
 * treat cross-module calls like local ones. Symbols are unique across the
 * program (the Compilation rejects clashes), so one map suffices.
 */
import ts from "typescript";
import { CheckedProgram, FunctionSig, LocalVar, Param } from "../checker";
import {
  baseConstruction,
  effectiveConstructor,
  intrinsicType,
  isAssignmentOperator,
} from "../checker/classes";
import { unwrapParens } from "../checker/control-flow";
import { CompilerOptions, DEFAULT_OPTIONS, StaticType, resultByValue, stripNull } from "../types";
import { arrayMethodName, isPushCall } from "./emit/arrays";
import { CallSite, EscapeResult, analyzeEscapes } from "./escape";
import { collectBuiltinFacts } from "./emit/expressions";
import { factCollectors } from "./emit/members";
import { resultLayout } from "../checker/result";
import { isSpawnCall } from "./emit/io";
import { isResultConstructorCall, resultMethodName } from "./emit/result";
import { collectStringFacts, isStringMethodCall, unwrapStringPassthrough } from "./emit/strings";
import { INLINE_ALLOCATOR_ATTRS, MemoryEffect, RUNTIME_BY_NAME } from "./runtime";

/** What a function does with one pointer-typed parameter: a struct (WP2, `this` included) or an array (WP4). */
export interface PointerParamFacts {
  /** `sizeof` of the pointee, for `dereferenceable`; 0 when it is not emitted (arrays). */
  size: number;
  /** Stores through the pointer (`p.f = v`, `p[i] = v`, `p.push(v)`), directly or via a callee (fixpoint). */
  writesThrough: boolean;
  /** The pointer may outlive the call: returned, stored, aliased, or captured by a callee (fixpoint). */
  captured: boolean;
  /** Calls the pointer is passed to, by callee symbol and parameter index (0 is `this` for methods). */
  passedTo: { callee: string; index: number }[];
}

export interface FunctionFacts {
  hasLoops: boolean;
  /** The body itself loads from memory it does not own (a string/array header read, a field or element read). */
  readsMemory: boolean;
  /** Every loop in the body is a counted loop (`isCountedLoop`); vacuously true without loops. */
  loopsBounded: boolean;
  /** Contains `throw`, which lowers to `llvm.trap`: a side effect that never returns. */
  hasTrap: boolean;
  effect: MemoryEffect;
  /** Returns on every input (modulo stack exhaustion); refined by the call-graph fixpoint. */
  willReturn: boolean;
  /**
   * Can reach a `noreturn` runtime call (`process.exit`, WP7; `amrit_panic_index`,
   * WP4), directly or through a callee; such a function must not carry `willreturn`.
   */
  callsNoReturn: boolean;
  /** Parameter names that escape (see `classifyUse`); decides `nocapture` for strings. */
  escaping: Set<string>;
  /** User functions and runtime symbols called directly (by LLVM symbol). */
  callees: Set<string>;
  /** Parameter names in signature order (`this` first for methods), to resolve `passedTo` indices. */
  paramNames: string[];
  /** Per pointer-typed parameter (struct or array) facts, keyed by parameter name. */
  pointerParams: Map<string, PointerParamFacts>;
  /** A constructor: `this` is a fresh allocation, so it is `noalias`. */
  freshThis: boolean;
  /** `sizeof` the returned struct, when the return type is a struct. */
  returnDeref?: number;
  // ---- WP6 memory strategy (see escape.ts) ----
  /** Allocation expressions lowered to entry-block allocas. */
  stackSites: Set<ts.Node>;
  /** Locals that only ever hold a stack object: accesses through them are own memory. */
  stackLocals: Set<LocalVar>;
  /** WP17: by-value `Result` parameters whose unpacked object is an entry-block alloca. */
  stackParams: Set<string>;
  /** Bracket the body with `amrit_arena_mark` / `amrit_arena_release`. Decided after the fixpoint. */
  arenaScope: boolean;
  /** Performs an arena allocation, directly or through a callee (fixpoint). */
  allocates: boolean;
  /** The body has an arena allocation of its own that flows `local` (something to release). */
  directArena: boolean;
  /** An allocation may survive the call other than through the return value (fixpoint over callees). */
  allocLeaks: boolean;
  /** An allocation of this function is returned: the caller owns it, so no scope here. */
  returnsAllocation: boolean;
  /** Calls `Arena.reset` / `Arena.release`, directly or through a callee (fixpoint). */
  usesArenaControl: boolean;
  /** Calls to pointer-returning user functions and where each result flows. */
  callSites: CallSite[];
}

const EFFECT_RANK: Record<MemoryEffect, number> = { none: 0, read: 1, write: 2 };
function maxEffect(a: MemoryEffect, b: MemoryEffect): MemoryEffect {
  return EFFECT_RANK[a] >= EFFECT_RANK[b] ? a : b;
}

interface CalleeFacts {
  effect: MemoryEffect;
  attrs: readonly string[];
  noreturn?: boolean;
}

/**
 * The inline arena allocator is not in `RUNTIME_FUNCTIONS` (it is emitted as
 * an IR definition, see `runtime.ts`), but callers must still see it as a
 * writing, `willreturn` callee.
 */
const INLINE_ALLOCATOR: CalleeFacts = { effect: "write", attrs: INLINE_ALLOCATOR_ATTRS };

function runtimeFacts(callee: string): CalleeFacts | undefined {
  return callee === "amrit_alloc_struct" ? INLINE_ALLOCATOR : RUNTIME_BY_NAME.get(callee);
}

/**
 * Gather per-function facts for one module or a whole program, then
 * propagate over the (cross-module) call graph to a fixpoint: a function is
 * as impure as the most impure thing it calls, it is willreturn only if
 * everything it calls is, and a pointer parameter is written/captured if any
 * callee it is passed to writes/captures the matching parameter. The result
 * is keyed by LLVM symbol (`FunctionSig.name`).
 */
export function analyzeFunctions(
  programs: CheckedProgram | readonly CheckedProgram[],
  opts: CompilerOptions = DEFAULT_OPTIONS
): Map<string, FunctionFacts> {
  const list = Array.isArray(programs)
    ? (programs as readonly CheckedProgram[])
    : [programs as CheckedProgram];
  const collect = (escapes?: Map<string, EscapeResult>) => {
    const facts = new Map<string, FunctionFacts>();
    for (const program of list) {
      for (const sig of program.functions)
        facts.set(sig.name, collectFacts(program, sig, opts, escapes?.get(sig.name)));
    }
    return facts;
  };
  // Round 1: plain facts and the capture fixpoint, which the escape analysis needs.
  const first = collect();
  propagate(first);
  const escapes = new Map<string, EscapeResult>();
  for (const program of list) {
    for (const sig of program.functions) escapes.set(sig.name, analyzeEscapes(program, sig, first, opts));
  }
  // Round 2: the same facts with stack allocations applied, then the scope decision.
  const facts = collect(escapes);
  propagate(facts);
  for (const f of facts.values()) {
    f.arenaScope = f.directArena && !f.allocLeaks && !f.returnsAllocation && !f.usesArenaControl;
    if (f.arenaScope) {
      // Both are `willreturn` and the function already writes (it allocates), so nothing else moves.
      f.callees.add("amrit_arena_mark");
      f.callees.add("amrit_arena_release");
    }
  }
  return facts;
}

/** Propagate effects, termination, pointer facts and allocation facts over the call graph to a fixpoint. */
function propagate(facts: Map<string, FunctionFacts>): void {
  let changed = true;
  while (changed) {
    changed = false;
    for (const [, f] of facts) {
      for (const callee of f.callees) {
        const calleeFacts = facts.get(callee);
        const runtime = runtimeFacts(callee);
        const calleeEffect: MemoryEffect = calleeFacts ? calleeFacts.effect : (runtime?.effect ?? "write");
        const calleeReturns = calleeFacts
          ? calleeFacts.willReturn
          : (runtime?.attrs.includes("willreturn") ?? false);
        const merged = maxEffect(f.effect, calleeEffect);
        if (merged !== f.effect) {
          f.effect = merged;
          changed = true;
        }
        if (f.willReturn && !calleeReturns) {
          f.willReturn = false;
          changed = true;
        }
        const noReturn = calleeFacts ? calleeFacts.callsNoReturn : (runtime?.noreturn ?? false);
        if (noReturn && !f.callsNoReturn) {
          f.callsNoReturn = true;
          f.willReturn = false;
          changed = true;
        }
        // WP6: allocation facts flow up the call graph (see escape.ts).
        if (calleeFacts?.allocates && !f.allocates) {
          f.allocates = true;
          changed = true;
        }
        if (calleeFacts?.allocLeaks && !f.allocLeaks) {
          f.allocLeaks = true;
          changed = true;
        }
        if (calleeFacts?.usesArenaControl && !f.usesArenaControl) {
          f.usesArenaControl = true;
          changed = true;
        }
      }
      // A pointer-returning callee that allocates makes its result an allocation of this function.
      for (const site of f.callSites) {
        if (!facts.get(site.callee)?.allocates) continue;
        if (site.flow === "local" && !f.directArena) {
          f.directArena = true;
          changed = true;
        } else if (site.flow === "returned" && !f.returnsAllocation) {
          f.returnsAllocation = true;
          changed = true;
        } else if (site.flow === "leaks" && !f.allocLeaks) {
          f.allocLeaks = true;
          changed = true;
        }
      }
      // A pointer inherits what every callee it is passed to does with the
      // corresponding parameter (only user functions take struct or array
      // pointers by parameter). An unknown callee is assumed to do both.
      for (const pp of f.pointerParams.values()) {
        for (const { callee, index } of pp.passedTo) {
          const g = facts.get(callee);
          const target = g?.pointerParams.get(g.paramNames[index] ?? "");
          const writes = target ? target.writesThrough : true;
          const captures = target ? target.captured : true;
          if (writes && !pp.writesThrough) {
            pp.writesThrough = true;
            changed = true;
          }
          if (captures && !pp.captured) {
            pp.captured = true;
            changed = true;
          }
        }
      }
    }
  }
}

// ---- Escape classification --------------------------------------------------------------

/** How the enclosing construct consumes a parameter reference. */
type ParamUse =
  | { kind: "none" } // consumed on the spot; the pointer does not outlive the expression
  | { kind: "escape" } // retained: returned, stored, aliased, or something not modelled
  | { kind: "argument"; callee: FunctionSig; index: number } // passed to a user function (index counts `this`)
  | { kind: "read" } // receiver of a field, element, `.length` or `for...of` read
  | { kind: "write" }; // receiver of a field store, element store or `push`

const USE_NONE: ParamUse = { kind: "none" };
const USE_ESCAPE: ParamUse = { kind: "escape" };
const USE_READ: ParamUse = { kind: "read" };
const USE_WRITE: ParamUse = { kind: "write" };

/** `` `${s}` ``: a template that lowers to its single string hole unchanged. */
function isStringPassthrough(program: CheckedProgram, template: ts.TemplateExpression): boolean {
  return unwrapStringPassthrough(program, template) !== template;
}

function isAssignmentTarget(node: ts.Node): boolean {
  const parent = node.parent;
  return (
    ts.isBinaryExpression(parent) && parent.left === node && isAssignmentOperator(parent.operatorToken.kind)
  );
}

/**
 * Classify a reference to a parameter by walking up through the transparent
 * wrappers (parentheses, ternary arms, single-hole templates) to the construct
 * that consumes the value. Anything not explicitly harmless escapes.
 */
export function classifyUse(program: CheckedProgram, ref: ts.Expression): ParamUse {
  let node: ts.Expression = ref;
  for (;;) {
    const parent = node.parent;
    if (ts.isParenthesizedExpression(parent)) {
      node = parent;
      continue;
    }
    if (ts.isConditionalExpression(parent)) {
      if (parent.condition === node) return USE_NONE;
      node = parent;
      continue;
    }
    if (ts.isTemplateSpan(parent)) {
      const template = parent.parent as ts.TemplateExpression;
      if (!isStringPassthrough(program, template)) return USE_NONE; // concatenation copies; runtime is nocapture
      node = template;
      continue;
    }
    if (ts.isElementAccessExpression(parent) && parent.expression === node) {
      return classifyElementUse(program, parent); // `p[i]`: the element is loaded, the pointer itself is not retained
    }
    if (ts.isPropertyAccessExpression(parent) && parent.expression === node) {
      const use = parent.parent;
      if (ts.isCallExpression(use) && use.expression === parent) {
        const callee = program.callees.get(use);
        if (callee) return { kind: "argument", callee, index: 0 };
        // `p.push(v)` and `p.pop()` store into the array header; `indexOf`
        // and `join` only read it, and so do the string byte methods (WP14),
        // whose runtime parameters are all `nocapture readonly` and whose
        // `substring` copies what it keeps. Anything else is treated as
        // retaining the receiver.
        const method = arrayMethodName(program, use);
        if (method === "push" || method === "pop") return USE_WRITE;
        if (method !== undefined) return USE_READ;
        // WP16: `r.orReturn()`, `r.unwrapOr(d)` and `r.expect(m)` load out of
        // the receiver and never store the pointer itself anywhere.
        if (resultMethodName(program, use) !== undefined) return USE_READ;
        return isStringMethodCall(program, use) ? USE_READ : USE_ESCAPE;
      }
      return isAssignmentTarget(parent) ? USE_WRITE : USE_READ; // `p.f = v` / `p.f`, `p.length`
    }
    if (ts.isCallExpression(parent)) {
      // `super(...)` (WP2b): the flow of `this` into the base construction is
      // recorded per constructor by `collectFacts`, explicit call or not.
      if (parent.expression === node) return USE_NONE;
      const index = parent.arguments.indexOf(node);
      if (index < 0) return USE_ESCAPE;
      const callee = program.callees.get(parent);
      if (callee) return { kind: "argument", callee, index: index + (callee.struct ? 1 : 0) };
      // `xs.push(p)` stores `p` into the array, `ok(p)` / `err(p)` store it
      // into the `Result` they build (WP16), `r.unwrapOr(p)` hands it back as
      // the expression's value, and `spawnSync(p)` leaves the runtime holding
      // an arena vector of pointers into `p`'s strings (WP14 D4); every other
      // builtin lowers to runtime functions whose pointer params are all
      // declared `nocapture`.
      if (
        isPushCall(program, parent) ||
        isResultConstructorCall(program, parent) ||
        isSpawnCall(program, parent)
      ) {
        return USE_ESCAPE;
      }
      return resultMethodName(program, parent) === "unwrapOr" ? USE_ESCAPE : USE_NONE;
    }
    if (ts.isNewExpression(parent)) {
      const index = parent.arguments?.indexOf(node) ?? -1;
      const target = intrinsicType(program, parent); // the class constructed, whatever it converts to
      const info = target?.kind === "struct" ? program.structs.get(target.name) : undefined;
      const ctor = info && effectiveConstructor(info); // own or inherited (WP2b)
      if (index < 0 || !ctor) return USE_ESCAPE;
      return { kind: "argument", callee: ctor, index: index + 1 };
    }
    if (ts.isBinaryExpression(parent)) {
      // Assignment retains the right-hand side; every other operator (`===`, `+`, ...) consumes both operands.
      if (isAssignmentOperator(parent.operatorToken.kind))
        return parent.right === node ? USE_ESCAPE : USE_NONE;
      return USE_NONE;
    }
    if (ts.isForOfStatement(parent)) return parent.expression === node ? USE_READ : USE_ESCAPE;
    if (ts.isPrefixUnaryExpression(parent) || ts.isPostfixUnaryExpression(parent)) return USE_NONE;
    if (ts.isExpressionStatement(parent)) return USE_NONE;
    if (ts.isIfStatement(parent) || ts.isWhileStatement(parent) || ts.isDoStatement(parent)) return USE_NONE;
    if (ts.isForStatement(parent)) return USE_NONE;
    return USE_ESCAPE; // return, variable initializer, array/object literal element, ...
  }
}

/**
 * The parameter is the indexing base of `access` (`p[i]`, `p[i][j]`, ...).
 * The value obtained is a loaded element, not the pointer, so the pointer
 * can never be captured this way; but a store through the element
 * (`p[i] = v`, `p[i][j] op= v`, `p[i].f = v`, `p[i].push(v)`, a method call
 * on it, or handing it to a user function or constructor that might store)
 * counts as a write through `p`, conservatively, as docs/wp4-arrays.md
 * specifies. Everything else (`x = p[i]`, `p[i] + 1`, `p[i].length`,
 * `console.log(p[i])`, `return p[i]`) is a read.
 */
function classifyElementUse(program: CheckedProgram, access: ts.ElementAccessExpression): ParamUse {
  let node: ts.Expression = access;
  for (;;) {
    const parent = node.parent;
    if (
      ts.isParenthesizedExpression(parent) ||
      (ts.isElementAccessExpression(parent) && parent.expression === node)
    ) {
      node = parent;
      continue;
    }
    if (ts.isConditionalExpression(parent)) {
      if (parent.condition === node) return USE_READ;
      node = parent;
      continue;
    }
    if (isAssignmentTarget(node)) return USE_WRITE;
    if (ts.isPropertyAccessExpression(parent) && parent.expression === node) {
      const use = parent.parent;
      const called = ts.isCallExpression(use) && use.expression === parent;
      return called || isAssignmentTarget(parent) ? USE_WRITE : USE_READ;
    }
    if (ts.isCallExpression(parent)) return program.callees.has(parent) ? USE_WRITE : USE_READ; // builtins are nocapture
    if (ts.isNewExpression(parent)) return USE_WRITE; // the constructor may store through the element
    return USE_READ;
  }
}

/** `sizeof` the pointee, for `dereferenceable`; undefined where there is nothing fixed to claim. */
function structSize(program: CheckedProgram, t: StaticType): number | undefined {
  if (t.kind === "result") return resultLayout(t).size; // WP16: derived from the type, not declared
  return t.kind === "struct" ? program.structs.get(t.name)?.size : undefined;
}

/**
 * Struct, array and `Result` params, plain or `T | null` (WP6), get pointer
 * facts — except a `Result` the ABI packs into a register (WP17), which is
 * not a pointer at all, so there is nothing for the fixpoint to say about it.
 */
function isPointerParam(t: StaticType): boolean {
  const inner = stripNull(t);
  return (
    inner.kind === "struct" ||
    inner.kind === "array" ||
    (inner.kind === "result" && !resultByValue(inner))
  );
}

/**
 * Per-function facts from one walk of the body. `memory` (round 2, see
 * `analyzeFunctions`) tells the collectors which allocations are allocas and
 * which locals hold them, and carries the allocation facts into the result.
 */
function collectFacts(
  program: CheckedProgram,
  sig: FunctionSig,
  opts: CompilerOptions,
  memory?: EscapeResult
): FunctionFacts {
  const facts: FunctionFacts = {
    hasLoops: false,
    readsMemory: false,
    loopsBounded: true,
    hasTrap: false,
    effect: "none",
    willReturn: true,
    callsNoReturn: false,
    escaping: new Set(),
    callees: new Set(),
    paramNames: sig.params.map((p) => p.name),
    pointerParams: new Map(),
    freshThis: sig.role === "constructor",
    returnDeref: structSize(program, sig.returnType),
    stackSites: memory?.stackSites ?? new Set(),
    stackLocals: memory?.stackLocals ?? new Set(),
    stackParams: memory?.stackParams ?? new Set(),
    arenaScope: false,
    allocates: memory?.directArena ?? false,
    directArena: memory?.directArena ?? false,
    allocLeaks: memory?.allocLeaks ?? false,
    returnsAllocation: memory?.returnsAllocation ?? false,
    usesArenaControl: memory?.usesArenaControl ?? false,
    callSites: memory?.callSites ?? [],
  };
  // A `returned` or `leaked` allocation is still an allocation.
  if (facts.returnsAllocation || facts.allocLeaks) facts.allocates = true;
  const paramNames = new Set(facts.paramNames);
  for (const p of sig.params) {
    if (isPointerParam(p.type)) {
      facts.pointerParams.set(p.name, {
        size: structSize(program, stripNull(p.type)) ?? 0,
        writesThrough: false,
        captured: false,
        passedTo: [],
      });
    }
  }

  /** A reference to one of this function's parameters (`this` included, also as `super`, WP2b), by name. */
  const paramRef = (node: ts.Node): string | undefined => {
    if (
      !ts.isIdentifier(node) &&
      node.kind !== ts.SyntaxKind.ThisKeyword &&
      node.kind !== ts.SyntaxKind.SuperKeyword
    ) {
      return undefined;
    }
    const v = program.bindings.get(node as ts.Identifier);
    return v?.storage === "param" && paramNames.has(v.name) ? v.name : undefined;
  };

  const noteUse = (name: string, ref: ts.Expression) => {
    const use = classifyUse(program, ref);
    const pointer = facts.pointerParams.get(name);
    switch (use.kind) {
      case "escape":
        facts.escaping.add(name);
        if (pointer) {
          pointer.captured = true;
          pointer.writesThrough = true; // an alias may be written through later
        }
        break;
      case "argument":
        // Strings: conservatively escape when handed to any user function.
        // Structs and arrays: resolved by the fixpoint against the callee's own facts.
        if (pointer) pointer.passedTo.push({ callee: use.callee.name, index: use.index });
        else facts.escaping.add(name);
        break;
      case "write":
        if (pointer) pointer.writesThrough = true;
        break;
      default:
        break;
    }
  };

  const visit = (node: ts.Node): void => {
    if (ts.isIterationStatement(node, false)) {
      facts.hasLoops = true;
      if (!isCountedLoop(program, node)) facts.loopsBounded = false;
    }
    if (ts.isThrowStatement(node)) facts.hasTrap = true;
    if (ts.isCallExpression(node)) {
      const callee = program.callees.get(node);
      if (callee) facts.callees.add(callee.name);
    }
    const param = paramRef(node);
    if (param !== undefined) noteUse(param, node as ts.Expression);
    collectStringFacts(program, node, facts);
    for (const collect of factCollectors) collect(program, node, facts, opts);
    collectBuiltinFacts(program, node, facts); // WP7: toI32/toF64/..., readFileSync/...
    ts.forEachChild(node, visit);
  };
  visit(sig.decl.body!);

  // WP2b: a derived constructor builds its base part (`super(...)`, written or
  // implicit): `this` is handed to the nearest ancestor constructor, and the
  // initializers of constructor-less ancestors are stored through it. Recorded
  // from the class, not from the statement, so an implicit call is not missed.
  if (sig.role === "constructor" && sig.struct?.base) {
    const base = baseConstruction(sig.struct);
    const self = facts.pointerParams.get("this")!;
    if (base.ctor) {
      facts.callees.add(base.ctor.name);
      self.passedTo.push({ callee: base.ctor.name, index: 0 });
    }
    if (base.stores) {
      self.writesThrough = true;
      facts.effect = "write";
    }
  }

  if (facts.readsMemory) facts.effect = maxEffect(facts.effect, "read");
  if (facts.hasTrap) facts.effect = "write";
  facts.willReturn = facts.loopsBounded && !facts.hasTrap && !facts.callsNoReturn;
  return facts;
}

// ---- Counted loops ------------------------------------------------------------

const INT32_MAX = 0x7fffffff;

/**
 * True for `for (let i = <init>; i CMP bound; STEP) body` over i32 when the
 * trip count is finite by construction, which is what lets the enclosing
 * function keep `willreturn`:
 *
 *   - `i` is a single `let` of type i32 declared in the initializer;
 *   - `bound` is an identifier or a non-negative integer literal;
 *   - STEP moves `i` towards the bound: `i++`, `++i`, `i += c` with `<`/`<=`,
 *     or `i--`, `--i`, `i -= c` with `>`/`>=` (`c` a positive literal);
 *   - the body assigns neither `i` nor `bound` (matched by name, so an
 *     assignment to a shadowing inner variable of the same name also
 *     disqualifies, which is conservative) and contains no `throw`;
 *   - the step can never wrap. i32 arithmetic wraps, so `i <= n; i++` spins
 *     forever when `n === INT32_MAX`. With an identifier bound (any value)
 *     only `<` with step +1 and `>` with step -1 are wrap-free; with a
 *     literal bound the last in-range value plus the step must still fit.
 *
 * `f64` induction variables never qualify: `i++` is a no-op once
 * `|i| >= 2^53`, so `for (let i = 0; i < n; i++)` in f64 mode can spin.
 * A `for...of` over an array is counted unless its body may extend the
 * array (`bodyMayExtend`, WP4). Every other loop (`while`, `do`, other
 * `for` shapes) is unbounded.
 */
export function isCountedLoop(program: CheckedProgram, loop: ts.IterationStatement): boolean {
  if (ts.isForOfStatement(loop)) return !bodyMayExtend(program, loop.statement);
  if (!ts.isForStatement(loop) || !loop.initializer || !loop.condition || !loop.incrementor) return false;
  if (!ts.isVariableDeclarationList(loop.initializer) || loop.initializer.declarations.length !== 1)
    return false;
  const iv = program.locals.get(loop.initializer.declarations[0]);
  if (iv?.type.kind !== "i32") return false;

  const cond = unwrapParens(loop.condition);
  if (!ts.isBinaryExpression(cond) || !isName(cond.left, iv.name)) return false;
  const cmp = cond.operatorToken.kind;
  const upward = cmp === ts.SyntaxKind.LessThanToken || cmp === ts.SyntaxKind.LessThanEqualsToken;
  const downward = cmp === ts.SyntaxKind.GreaterThanToken || cmp === ts.SyntaxKind.GreaterThanEqualsToken;
  const inclusive = cmp === ts.SyntaxKind.LessThanEqualsToken || cmp === ts.SyntaxKind.GreaterThanEqualsToken;
  const bound = unwrapParens(cond.right);
  if (!ts.isIdentifier(bound) && !ts.isNumericLiteral(bound)) return false;

  const step = stepOf(unwrapParens(loop.incrementor), iv.name);
  if (step === undefined || step === 0) return false;
  if (!((upward && step > 0) || (downward && step < 0))) return false;

  if (ts.isIdentifier(bound)) {
    if (Math.abs(step) !== 1 || inclusive) return false;
  } else if (upward) {
    const last = inclusive ? Number(bound.text) : Number(bound.text) - 1;
    if (last + step > INT32_MAX) return false;
  }
  // Downward from a non-negative literal bound: `bound - |step| >= -INT32_MAX`, so no wrap.

  const guarded = new Set([iv.name, ...(ts.isIdentifier(bound) ? [bound.text] : [])]);
  return !bodyDisturbs(loop.statement, guarded);
}

function isName(expr: ts.Expression, name: string): boolean {
  const e = unwrapParens(expr);
  return ts.isIdentifier(e) && e.text === name;
}

/** Signed step of `i++`, `++i`, `i--`, `--i`, `i += c`, `i -= c`; undefined for anything else. */
function stepOf(expr: ts.Expression, name: string): number | undefined {
  if ((ts.isPrefixUnaryExpression(expr) || ts.isPostfixUnaryExpression(expr)) && isName(expr.operand, name)) {
    if (expr.operator === ts.SyntaxKind.PlusPlusToken) return 1;
    if (expr.operator === ts.SyntaxKind.MinusMinusToken) return -1;
    return undefined;
  }
  if (ts.isBinaryExpression(expr) && isName(expr.left, name)) {
    const rhs = unwrapParens(expr.right);
    if (!ts.isNumericLiteral(rhs)) return undefined;
    if (expr.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken) return Number(rhs.text);
    if (expr.operatorToken.kind === ts.SyntaxKind.MinusEqualsToken) return -Number(rhs.text);
  }
  return undefined;
}

function isIncDec(kind: ts.SyntaxKind): boolean {
  return kind === ts.SyntaxKind.PlusPlusToken || kind === ts.SyntaxKind.MinusMinusToken;
}

/**
 * `for (const x of a)` re-reads `a.length` every iteration, so it is bounded
 * unless the body can grow an array: any `push` (on any array, since `a` may
 * be aliased), any call to a user function (which could push through an
 * alias it receives), or a `throw`.
 */
function bodyMayExtend(program: CheckedProgram, body: ts.Node): boolean {
  let extends_ = false;
  const visit = (node: ts.Node): void => {
    if (extends_) return;
    if (
      ts.isThrowStatement(node) ||
      isPushCall(program, node) ||
      (ts.isCallExpression(node) && program.callees.has(node))
    ) {
      extends_ = true;
    } else {
      ts.forEachChild(node, visit);
    }
  };
  visit(body);
  return extends_;
}

/** True when `body` may assign one of `names` (by any assignment form) or may throw. */
function bodyDisturbs(body: ts.Node, names: Set<string>): boolean {
  let disturbed = false;
  const visit = (node: ts.Node): void => {
    if (disturbed) return;
    if (ts.isThrowStatement(node)) {
      disturbed = true;
    } else if (
      ts.isBinaryExpression(node) &&
      isAssignmentOperator(node.operatorToken.kind) &&
      ts.isIdentifier(node.left) &&
      names.has(node.left.text)
    ) {
      disturbed = true;
    } else if (
      (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
      isIncDec(node.operator) &&
      ts.isIdentifier(node.operand) &&
      names.has(node.operand.text)
    ) {
      disturbed = true;
    } else {
      ts.forEachChild(node, visit);
    }
  };
  visit(body);
  return disturbed;
}

// ---- Attribute rendering ----------------------------------------------------

/** `sizeof(%struct.amrit_array)`: `{ i64 len, i64 cap, i8* data }` (WP4 layout, `ARRAY_TYPE` in runtime.ts). */
const ARRAY_HEADER_BYTES = 24;

export function functionAttributes(f: FunctionFacts): string[] {
  const attrs = ["nounwind"];
  if (f.willReturn) attrs.push("willreturn");
  if (f.effect === "none") attrs.push("readnone");
  else if (f.effect === "read") attrs.push("readonly");
  return attrs;
}

export function paramAttributes(p: Param, f: FunctionFacts): string[] {
  const attrs = ["noundef"];
  // See the header comment: every pointer fact here is proved by `collectFacts`
  // plus the `pointerParams` fixpoint in `analyzeFunctions`.
  const pointer = f.pointerParams.get(p.name);
  switch (p.type.kind) {
    case "bool":
      attrs.push("zeroext");
      break;
    case "string":
      attrs.push("nonnull", "noalias", "readonly", "align 8");
      if (!f.escaping.has(p.name)) attrs.push("nocapture");
      break;
    case "array":
      // dereferenceable(24) (WP9): every array value points at a full
      // `%struct.amrit_array` header (len, cap, data: 24 bytes) allocated by
      // the arena or built by a literal; there is no null and no partial header.
      attrs.push("nonnull", "align 8", `dereferenceable(${ARRAY_HEADER_BYTES})`);
      if (pointer && !pointer.writesThrough && !pointer.captured) attrs.push("readonly");
      if (pointer && !pointer.captured) attrs.push("nocapture");
      break;
    case "struct":
      attrs.push("nonnull");
      if (p.name === "this" && f.freshThis) attrs.push("noalias");
      if (pointer && !pointer.writesThrough && !pointer.captured) attrs.push("readonly");
      attrs.push("align 8");
      if (pointer && pointer.size > 0) attrs.push(`dereferenceable(${pointer.size})`);
      if (pointer && !pointer.captured) attrs.push("nocapture");
      break;
    case "result":
      // WP17: a small `Result` arrives packed in an `i64`, so none of the
      // pointer facts are about it; `noundef` alone, as for any scalar.
      if (resultByValue(p.type)) break;
      // WP16: every `Result` comes from `ok(...)` / `err(...)`, so the object
      // is whole and never null, and nothing in the language can store through
      // one — `readonly` here needs no more than the absence of a write, which
      // the fixpoint checks anyway.
      attrs.push("nonnull", "align 8");
      if (pointer && pointer.size > 0) attrs.push(`dereferenceable(${pointer.size})`);
      if (pointer && !pointer.writesThrough && !pointer.captured) attrs.push("readonly");
      if (pointer && !pointer.captured) attrs.push("nocapture");
      break;
    case "nullable": // WP6: no `nonnull` / `dereferenceable`; the rest as for the pointee kind
      if (p.type.inner.kind === "string") attrs.push("noalias", "readonly");
      else if (pointer && !pointer.writesThrough && !pointer.captured) attrs.push("readonly");
      attrs.push("align 8");
      if (pointer ? !pointer.captured : !f.escaping.has(p.name)) attrs.push("nocapture");
      break;
  }
  return attrs;
}

/** `deref` is the struct size for struct-returning functions (`FunctionFacts.returnDeref`). */
export function returnAttributes(t: StaticType, deref?: number): string[] {
  switch (t.kind) {
    case "void":
      return [];
    case "bool":
      return ["noundef", "zeroext"];
    case "string":
      return ["noundef", "nonnull", "align 8"];
    case "array":
      return ["noundef", "nonnull", "align 8", `dereferenceable(${ARRAY_HEADER_BYTES})`]; // full header, see paramAttributes
    case "result":
      // WP17: a small `Result` comes back packed in an `i64`, so none of the
      // pointer facts are about it; the word is always fully defined, because
      // the dead arm is discarded by a `select` before it is shifted in. A
      // pointer `Result` is exactly a struct here, as it was in WP16.
      if (resultByValue(t)) return ["noundef"];
      return ["noundef", "nonnull", "align 8", ...(deref ? [`dereferenceable(${deref})`] : [])];
    case "struct": // WP16: a whole, never-null object
      return ["noundef", "nonnull", "align 8", ...(deref ? [`dereferenceable(${deref})`] : [])];
    case "nullable":
      return ["noundef", "align 8"]; // WP6: may be null
    default:
      return ["noundef"];
  }
}
