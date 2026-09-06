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
 *     nocapture Only when the param never escapes (`classifyUse`): a use is
 *               harmless when the value is consumed on the spot (operand of
 *               an operator, a condition, the receiver of a `.length` read,
 *               a hole of a template that builds a new string, an argument
 *               of a runtime builtin, which are all `nocapture`); it escapes
 *               when returned, passed to a user function (conservatively,
 *               no fixpoint for strings), stored into a local, a field or an
 *               object literal, or used in any way not listed. Parentheses,
 *               ternary arms and single-hole templates are transparent.
 *   Struct params (`%struct.X*`, WP2), including `this`:
 *     nonnull align 8 dereferenceable(sizeof X)
 *               Every struct value comes from the arena allocator: 8-aligned,
 *               at least `sizeof X` bytes, never null.
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
import { isAssignmentOperator } from "../checker/classes";
import { unwrapParens } from "../checker/control-flow";
import { StaticType } from "../types";
import { factCollectors } from "./emit/members";
import { collectStringFacts, unwrapStringPassthrough } from "./emit/strings";
import { INLINE_ALLOCATOR_ATTRS, MemoryEffect, RUNTIME_BY_NAME } from "./runtime";

/** What a function does with one struct-typed parameter (WP2). */
export interface PointerParamFacts {
  /** `sizeof` of the pointee, for `dereferenceable`. */
  size: number;
  /** Stores through the pointer (`p.f = v`), directly or via a callee (fixpoint). */
  writesThrough: boolean;
  /** The pointer may outlive the call: returned, stored, aliased, or captured by a callee (fixpoint). */
  captured: boolean;
  /** Calls the pointer is passed to, by callee symbol and parameter index (0 is `this`). */
  passedTo: { callee: string; index: number }[];
}

export interface FunctionFacts {
  hasLoops: boolean;
  /** The body itself loads from memory it does not own (a string header read, a field read). */
  readsMemory: boolean;
  /** Every loop in the body is a counted loop (`isCountedLoop`); vacuously true without loops. */
  loopsBounded: boolean;
  /** Contains `throw`, which lowers to `llvm.trap`: a side effect that never returns. */
  hasTrap: boolean;
  effect: MemoryEffect;
  /** Returns on every input (modulo stack exhaustion); refined by the call-graph fixpoint. */
  willReturn: boolean;
  /** Parameter names that escape (see `classifyUse`). */
  escaping: Set<string>;
  /** User functions called directly (by LLVM symbol). */
  callees: Set<string>;
  /** Parameter names in signature order (`this` first for methods), to resolve `passedTo` indices. */
  paramNames: string[];
  /** Per struct-typed parameter facts, keyed by parameter name. */
  pointerParams: Map<string, PointerParamFacts>;
  /** A constructor: `this` is a fresh allocation, so it is `noalias`. */
  freshThis: boolean;
  /** `sizeof` the returned struct, when the return type is a struct. */
  returnDeref?: number;
}

const EFFECT_RANK: Record<MemoryEffect, number> = { none: 0, read: 1, write: 2 };
function maxEffect(a: MemoryEffect, b: MemoryEffect): MemoryEffect {
  return EFFECT_RANK[a] >= EFFECT_RANK[b] ? a : b;
}

/**
 * The inline arena allocator is not in `RUNTIME_FUNCTIONS` (it is emitted as
 * an IR definition, see `runtime.ts`), but callers must still see it as a
 * writing, `willreturn` callee.
 */
const INLINE_ALLOCATOR = { effect: "write" as MemoryEffect, attrs: INLINE_ALLOCATOR_ATTRS };

function runtimeFacts(callee: string): { effect: MemoryEffect; attrs: string[] } | undefined {
  return callee === "sts_alloc_struct" ? INLINE_ALLOCATOR : RUNTIME_BY_NAME.get(callee);
}

/**
 * Gather per-function facts for one module or a whole program, then
 * propagate over the (cross-module) call graph to a fixpoint: a function is
 * as impure as the most impure thing it calls, and it is willreturn only if
 * everything it calls is. The result is keyed by LLVM symbol (`FunctionSig.name`).
 */
export function analyzeFunctions(programs: CheckedProgram | readonly CheckedProgram[]): Map<string, FunctionFacts> {
  const list = Array.isArray(programs) ? (programs as readonly CheckedProgram[]) : [programs as CheckedProgram];
  const facts = new Map<string, FunctionFacts>();
  for (const program of list) {
    for (const sig of program.functions) facts.set(sig.name, collectFacts(program, sig));
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const [, f] of facts) {
      for (const callee of f.callees) {
        const calleeFacts = facts.get(callee);
        const runtime = runtimeFacts(callee);
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
      }
      // A struct pointer inherits what every callee it is passed to does with
      // the corresponding parameter (only user functions take struct pointers).
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
  return facts;
}

// ---- Escape classification --------------------------------------------------------------

/** How the enclosing construct consumes a parameter reference. */
type ParamUse =
  | { kind: "none" } // consumed on the spot; the pointer does not outlive the expression
  | { kind: "escape" } // retained: returned, stored, aliased, or something not modelled
  | { kind: "argument"; callee: FunctionSig; index: number } // passed to a user function (index counts `this`)
  | { kind: "read" } // receiver of a field or `.length` read
  | { kind: "write" }; // receiver of a field store

const USE_NONE: ParamUse = { kind: "none" };
const USE_ESCAPE: ParamUse = { kind: "escape" };

/** `` `${s}` ``: a template that lowers to its single string hole unchanged. */
function isStringPassthrough(program: CheckedProgram, template: ts.TemplateExpression): boolean {
  return unwrapStringPassthrough(program, template) !== template;
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
    if (ts.isPropertyAccessExpression(parent) && parent.expression === node) {
      const use = parent.parent;
      if (ts.isCallExpression(use) && use.expression === parent) {
        const callee = program.callees.get(use);
        return callee ? { kind: "argument", callee, index: 0 } : USE_NONE;
      }
      if (ts.isBinaryExpression(use) && use.left === parent && isAssignmentOperator(use.operatorToken.kind)) {
        return { kind: "write" };
      }
      return { kind: "read" };
    }
    if (ts.isCallExpression(parent)) {
      const index = parent.arguments.indexOf(node);
      if (index < 0) return USE_ESCAPE;
      const callee = program.callees.get(parent);
      if (!callee) return USE_NONE; // a builtin: every runtime function is declared nocapture
      return { kind: "argument", callee, index: index + (callee.struct ? 1 : 0) };
    }
    if (ts.isNewExpression(parent)) {
      const index = parent.arguments?.indexOf(node) ?? -1;
      const target = program.types.get(parent);
      const ctor = target?.kind === "struct" ? program.structs.get(target.name)?.ctor : undefined;
      if (index < 0 || !ctor) return USE_ESCAPE;
      return { kind: "argument", callee: ctor, index: index + 1 };
    }
    if (ts.isBinaryExpression(parent)) {
      // Assignment retains the right-hand side; every other operator consumes both operands.
      if (isAssignmentOperator(parent.operatorToken.kind)) return parent.right === node ? USE_ESCAPE : USE_NONE;
      return USE_NONE;
    }
    if (ts.isPrefixUnaryExpression(parent) || ts.isPostfixUnaryExpression(parent)) return USE_NONE;
    if (ts.isExpressionStatement(parent) || ts.isThrowStatement(parent)) return USE_NONE;
    if (ts.isIfStatement(parent) || ts.isWhileStatement(parent) || ts.isDoStatement(parent)) return USE_NONE;
    if (ts.isForStatement(parent)) return USE_NONE;
    return USE_ESCAPE; // return, variable initializer, object literal property, ...
  }
}

function structSize(program: CheckedProgram, t: StaticType): number | undefined {
  return t.kind === "struct" ? program.structs.get(t.name)?.size : undefined;
}

function collectFacts(program: CheckedProgram, sig: FunctionSig): FunctionFacts {
  const facts: FunctionFacts = {
    hasLoops: false,
    readsMemory: false,
    loopsBounded: true,
    hasTrap: false,
    effect: "none",
    willReturn: true,
    escaping: new Set(),
    callees: new Set(),
    paramNames: sig.params.map((p) => p.name),
    pointerParams: new Map(),
    freshThis: sig.role === "constructor",
    returnDeref: structSize(program, sig.returnType),
  };
  const paramNames = new Set(facts.paramNames);
  for (const p of sig.params) {
    if (p.type.kind === "struct") {
      facts.pointerParams.set(p.name, {
        size: structSize(program, p.type) ?? 0,
        writesThrough: false,
        captured: false,
        passedTo: [],
      });
    }
  }

  /** A reference to one of this function's parameters (`this` included), by name. */
  const paramRef = (node: ts.Node): string | undefined => {
    if (!ts.isIdentifier(node) && node.kind !== ts.SyntaxKind.ThisKeyword) return undefined;
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
        // Structs: resolved by the fixpoint against the callee's own facts.
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
    for (const collect of factCollectors) collect(program, node, facts);
    ts.forEachChild(node, visit);
  };
  visit(sig.decl.body!);

  if (facts.readsMemory) facts.effect = maxEffect(facts.effect, "read");
  if (facts.hasTrap) facts.effect = "write";
  facts.willReturn = facts.loopsBounded && !facts.hasTrap;
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
    case "struct": {
      // See the header comment: every fact here is proved by `collectFacts`
      // plus the `pointerParams` fixpoint in `analyzeFunctions`.
      const pointer = f.pointerParams.get(p.name);
      attrs.push("nonnull");
      if (p.name === "this" && f.freshThis) attrs.push("noalias");
      if (pointer && !pointer.writesThrough && !pointer.captured) attrs.push("readonly");
      attrs.push("align 8");
      if (pointer && pointer.size > 0) attrs.push(`dereferenceable(${pointer.size})`);
      if (pointer && !pointer.captured) attrs.push("nocapture");
      break;
    }
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
    case "struct":
      return ["noundef", "nonnull", "align 8", ...(deref ? [`dereferenceable(${deref})`] : [])];
    default:
      return ["noundef"];
  }
}
