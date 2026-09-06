/**
 * Function/parameter attribute analysis ("Rust parity" hints for LLVM).
 *
 * Everything emitted here must be a *guarantee*, never a hope: a wrong
 * attribute is undefined behaviour, not a missed optimisation. The rules:
 *
 *   nounwind    StaticTS has no exceptions; nothing can unwind.
 *   willreturn  The function cannot fail to return: every loop is a counted
 *               loop with a finite trip count (`isCountedLoop`), the body
 *               has no `throw` (which traps and never returns), and every
 *               callee is itself willreturn (fixpoint over the call graph).
 *               Unbounded recursion is allowed: LangRef lets a willreturn
 *               function exhaust the stack. `mustprogress` is never added,
 *               because JS permits infinite loops.
 *   readnone    The function touches no memory except its own allocas and
 *               calls only functions that are themselves readnone. LLVM's
 *               FunctionAttrs pass infers exactly this, so it is safe to
 *               assert it up front. (Spelled `readnone`, which every LLVM
 *               version accepts; LLVM 16+ upgrades it to `memory(none)`.)

 *               `throw` lowers to `llvm.trap`, a side effect, so a throwing
 *               function (and anything that calls it) is neither readnone
 *               nor readonly.
 *   readonly    As above, but the body reads memory it does not own: a
 *               `.length` load through a string pointer, or a call to a
 *               reading callee (e.g. `sts_str_eq`). Never with `readnone`.
 *   noundef     Every StaticTS value is initialised, so no param or return
 *               value is ever undef/poison.
 *   zeroext     `boolean` is i1; the C ABI wants it zero-extended in a register.
 *   String params (`i8*`):
 *     nonnull   StaticTS has no null.
 *     readonly  Strings are immutable.
 *     align 8   Literals and arena strings are 8-byte aligned.
 *     noalias   Valid because nothing writes through string pointers: the
 *               noalias guarantee only concerns *modified* memory.
 *     nocapture Only when the param never escapes: it is not returned and
 *               not passed to any call (there are no stores of pointers yet).
 *   Array params (`%struct.sts_array*`, WP4):
 *     nonnull   StaticTS has no null.
 *     align 8   Headers come from the arena (8-byte rounded) only.
 *     readonly  The body never stores through the param (no `p[i] = v`,
 *               `p[i] op= v`, `p.push(v)`, nor through anything indexed from
 *               it), never aliases it (`let q = p`, `[p]`, `xs.push(p)`,
 *               `return p`, ...: an alias could be written and LLVM may fold
 *               it back into `p`), and only passes it to callees whose
 *               matching param is itself readonly (fixpoint over the call
 *               graph, optimistic on cycles: a param is written only if some
 *               actual store reaches it). Never `noalias`: two array params
 *               may be the same array, and arrays are mutable.
 *     nocapture As above with "captured" in place of "written": the param is
 *               used only as an indexing base, `.length` / `push` receiver,
 *               `for...of` source, `===` operand, or a direct argument to a
 *               callee that does not capture it.
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
import { CheckedProgram, FunctionSig, Param } from "../checker";
import { unwrapParens } from "../checker/control-flow";
import { CompilerOptions, DEFAULT_OPTIONS, StaticType } from "../types";
import { ParamPass, collectArrayParamFacts, isPushCall } from "./emit/arrays";
import { factCollectors } from "./emit/members";
import { collectBuiltinFacts } from "./emit/expressions";
import { collectStringFacts, unwrapStringPassthrough } from "./emit/strings";
import { MemoryEffect, RUNTIME_BY_NAME } from "./runtime";

export interface FunctionFacts {
  hasLoops: boolean;
  /** The body itself loads from memory it does not own (a string header read). */
  readsMemory: boolean;
  /** Every loop in the body is a counted loop (`isCountedLoop`); vacuously true without loops. */
  loopsBounded: boolean;
  /** Contains `throw`, which lowers to `llvm.trap`: a side effect that never returns. */
  hasTrap: boolean;
  effect: MemoryEffect;
  /** Returns on every input (modulo stack exhaustion); refined by the call-graph fixpoint. */
  willReturn: boolean;
  /**
   * Can reach a `noreturn` runtime call (`process.exit`, WP7), directly or
   * through a callee; such a function must not carry `willreturn`.
   */
  callsNoReturn: boolean;
  /** Parameter names that escape (returned or passed to a call). */
  escaping: Set<string>;
  /** User functions called directly (by LLVM symbol). */
  callees: Set<string>;
  /** Parameter names in order, so a callee's param facts can be looked up by argument index. */
  paramNames: string[];
  /** Array params stored through (directly, or via a callee after the fixpoint). */
  writtenParams: Set<string>;
  /** Array params that escape (directly, or via a callee after the fixpoint). */
  capturedParams: Set<string>;
  /** Params handed straight to a user callee, for the two fixpoints above. */
  paramPasses: ParamPass[];
}

const EFFECT_RANK: Record<MemoryEffect, number> = { none: 0, read: 1, write: 2 };
function maxEffect(a: MemoryEffect, b: MemoryEffect): MemoryEffect {
  return EFFECT_RANK[a] >= EFFECT_RANK[b] ? a : b;
}

/**
 * Gather per-function facts for one module or a whole program, then
 * propagate over the (cross-module) call graph to a fixpoint: a function is
 * as impure as the most impure thing it calls, and it is willreturn only if
 * everything it calls is. The result is keyed by LLVM symbol (`FunctionSig.name`).
 */
export function analyzeFunctions(
  programs: CheckedProgram | readonly CheckedProgram[],
  opts: CompilerOptions = DEFAULT_OPTIONS
): Map<string, FunctionFacts> {
  const list = Array.isArray(programs) ? (programs as readonly CheckedProgram[]) : [programs as CheckedProgram];
  const facts = new Map<string, FunctionFacts>();
  for (const program of list) {
    for (const sig of program.functions) facts.set(sig.name, collectFacts(program, sig, opts));
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const [, f] of facts) {
      for (const callee of f.callees) {
        const calleeFacts = facts.get(callee);
        const runtime = RUNTIME_BY_NAME.get(callee);
        const calleeEffect: MemoryEffect = calleeFacts ? calleeFacts.effect : runtime?.effect ?? "write";
        const calleeReturns = calleeFacts ? calleeFacts.willReturn : runtime?.attrs.includes("willreturn") ?? false;
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
      }
      // An array param passed to a callee is written/captured if the callee's param is.
      // An unknown callee (no facts) is assumed to do both.
      for (const pass of f.paramPasses) {
        const callee = facts.get(pass.callee);
        const name = callee?.paramNames[pass.index];
        const written = !callee || name === undefined || callee.writtenParams.has(name);
        const captured = !callee || name === undefined || callee.capturedParams.has(name);
        if (written && !f.writtenParams.has(pass.param)) {
          f.writtenParams.add(pass.param);
          changed = true;
        }
        if (captured && !f.capturedParams.has(pass.param)) {
          f.capturedParams.add(pass.param);
          changed = true;
        }
      }
    }
  }
  return facts;
}

function collectFacts(program: CheckedProgram, sig: FunctionSig, opts: CompilerOptions): FunctionFacts {
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
    writtenParams: new Set(),
    capturedParams: new Set(),
    paramPasses: [],
  };
  const paramNames = new Set(sig.params.map((p) => p.name));

  const noteEscape = (expr: ts.Expression) => {
    expr = unwrapStringPassthrough(program, expr); // parentheses and single-hole templates
    if (ts.isIdentifier(expr)) {
      const v = program.bindings.get(expr);
      if (v?.storage === "param" && paramNames.has(v.name)) facts.escaping.add(v.name);
    }
  };

  const visit = (node: ts.Node): void => {
    if (ts.isIterationStatement(node, false)) {
      facts.hasLoops = true;
      if (!isCountedLoop(program, node)) facts.loopsBounded = false;
    }
    if (ts.isThrowStatement(node)) facts.hasTrap = true;
    if (ts.isReturnStatement(node) && node.expression) noteEscape(node.expression);
    if (ts.isCallExpression(node)) {
      const callee = program.callees.get(node);
      if (callee) {
        facts.callees.add(callee.name);
        // Only user functions can capture an argument; every runtime symbol a
        // builtin lowers to is declared `nocapture` in runtime.ts.
        node.arguments.forEach(noteEscape);
      }
    }
    collectStringFacts(program, node, facts);
    for (const collect of factCollectors) collect(program, node, facts, opts);
    collectBuiltinFacts(program, node, facts); // WP7: toI32/toF64/..., readFileSync/...
    ts.forEachChild(node, visit);
  };
  visit(sig.decl.body!);
  collectArrayParamFacts(program, sig, facts);

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
 * Every other loop (`while`, `do`, other `for` shapes) is unbounded.
 */
export function isCountedLoop(program: CheckedProgram, loop: ts.IterationStatement): boolean {
  if (ts.isForOfStatement(loop)) return !bodyMayExtend(program, loop.statement);
  if (!ts.isForStatement(loop) || !loop.initializer || !loop.condition || !loop.incrementor) return false;
  if (!ts.isVariableDeclarationList(loop.initializer) || loop.initializer.declarations.length !== 1) return false;
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

function isAssignmentToken(kind: ts.SyntaxKind): boolean {
  return kind >= ts.SyntaxKind.FirstAssignment && kind <= ts.SyntaxKind.LastAssignment;
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
    if (ts.isThrowStatement(node) || isPushCall(program, node) || (ts.isCallExpression(node) && program.callees.has(node))) {
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
      isAssignmentToken(node.operatorToken.kind) &&
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

export function functionAttributes(f: FunctionFacts): string[] {
  const attrs = ["nounwind"];
  if (f.willReturn) attrs.push("willreturn");
  if (f.effect === "none") attrs.push("readnone");
  else if (f.effect === "read") attrs.push("readonly");
  return attrs;
}

export function paramAttributes(p: Param, f: FunctionFacts): string[] {
  const attrs = ["noundef"];
  switch (p.type.kind) {
    case "bool":
      attrs.push("zeroext");
      break;
    case "string":
      attrs.push("nonnull", "noalias", "readonly", "align 8");
      if (!f.escaping.has(p.name)) attrs.push("nocapture");
      break;
    case "array":
      attrs.push("nonnull", "align 8");
      if (!f.writtenParams.has(p.name)) attrs.push("readonly");
      if (!f.capturedParams.has(p.name)) attrs.push("nocapture");
      break;
  }
  return attrs;
}

export function returnAttributes(t: StaticType): string[] {
  switch (t.kind) {
    case "void":
      return [];
    case "bool":
      return ["noundef", "zeroext"];
    case "string":
    case "array":
      return ["noundef", "nonnull", "align 8"];
    default:
      return ["noundef"];
  }
}
