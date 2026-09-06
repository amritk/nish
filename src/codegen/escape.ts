/**
 * Allocation escape analysis (WP6): which allocations can live on the stack,
 * and which functions can reclaim their arena temporaries on exit.
 *
 * An *allocation site* is an expression that produces fresh memory:
 *
 *   new C(...), { ... }        a struct            (stackable)
 *   [a, b], new Array<T>(<literal>)  an array      (stackable up to STACK_ARRAY_BYTES)
 *   new Array<T>(n)            an array, dynamic   (arena)
 *   a + b, `...${x}...`, readFileSync(p)   a string (arena)
 *   f(...) returning a pointer type         whatever `f` allocated and
 *                              returned; counted only if `f` allocates
 *                              (decided by the fixpoint in attributes.ts)
 *
 * Each site's value *flows* somewhere. Following it through the transparent
 * wrappers (parentheses, ternary arms) and through the `const` / `let`
 * locals it is stored in (and their aliases, `const y = x`), every use is
 * classified with `classifyUse` from attributes.ts, the same classification
 * that decides `nocapture` on parameters:
 *
 *   local     consumed on the spot: an operand, a field or element read or
 *             write through it, a `.length`, a `for...of` source, an `===`,
 *             an argument to a callee whose matching parameter is not
 *             captured (`pointerParams` fixpoint; `escaping` for strings),
 *             the receiver of a method whose `this` is not captured
 *   returned  the value (or an alias) is returned: it outlives the function
 *             but only through the return value, which the caller sees as
 *             an allocation site of its own
 *   leaks     anything else: stored into a field, element, array or object
 *             literal, pushed, assigned to another variable (`y = x`),
 *             passed to a capturing callee, ...
 *
 * Stack allocation: a stackable site whose flow is `local` and whose holding
 * locals are never reassigned becomes an `alloca` in the entry block. This
 * is sound because every reference to the object lives in a local declared
 * at or below the site's block (or is consumed within the site's own
 * statement), so when control leaves that block, or the function returns,
 * nothing can name the object any more. A site inside a loop is hoisted once
 * and its slot is reused every iteration: the previous iteration's object
 * is unreachable by the same argument (its locals are out of scope), and the
 * initializer or constructor runs again on every pass, so the slot never
 * holds a stale object that is still observable.
 *
 * Arena scopes: a function whose direct arena allocations all flow `local`
 * (and whose callees do not leak allocations, see the fixpoint) reclaims them
 * with `sts_arena_mark` at entry and `sts_arena_release` before every `ret`.
 * A `returned` site disables the scope (the caller owns that memory); a
 * `leaks` site marks the function `allocLeaks`, which disables the scope of
 * every caller too, since the leaked memory may be reachable from an object
 * the caller still holds. `push` on an array that is not a local allocation
 * site leaks (the growth belongs to an array someone else owns), and so does
 * any call to `Arena.reset` / `Arena.release` (`usesArenaControl`).
 */
import ts from "typescript";
import { CheckedProgram, FunctionSig, LocalVar } from "../checker";
import { dottedName } from "../checker/builtins";
import { isAssignmentOperator } from "../checker/classes";
import { CompilerOptions, StaticType, alignOf, isNumeric, stripNull } from "../types";
import { FunctionFacts, classifyUse } from "./attributes";
import { isPushCall } from "./emit/arrays";
import { unwrapStringPassthrough } from "./emit/strings";

/** Largest array data block (`[n x T]`) placed on the stack, in bytes. */
export const STACK_ARRAY_BYTES = 4096;

export type Flow = "local" | "returned" | "leaks";

/** What happens to the allocations a user callee returns, from the caller's side. */
export interface CallSite {
  callee: string;
  flow: Flow;
}

export interface EscapeResult {
  /** Allocation expressions lowered to entry-block allocas. */
  stackSites: Set<ts.Node>;
  /** Locals that only ever hold a stack object (for the effect analysis: their fields are own memory). */
  stackLocals: Set<LocalVar>;
  /** The body performs an arena allocation whose flow is `local` (there is something to release). */
  directArena: boolean;
  /** Some direct allocation `leaks`. */
  allocLeaks: boolean;
  /** Some direct allocation is `returned`. */
  returnsAllocation: boolean;
  /** Calls `Arena.reset` / `Arena.release` directly. */
  usesArenaControl: boolean;
  /** Calls to pointer-returning user functions, with the flow of each result. */
  callSites: CallSite[];
}

interface Site {
  node: ts.Expression;
  /** Struct or array of a known size within budget: may become an alloca. */
  stackable: boolean;
  /** A user call: the site counts only if the callee allocates (fixpoint). */
  callee?: string;
}

/** Bytes per element: every StaticTS value is a scalar or a pointer, so its size is its alignment. */
function elementSize(elem: StaticType): number {
  return alignOf(elem);
}

function unwrapParens(expr: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(expr)) expr = expr.expression;
  return expr;
}

/** The non-negative integer a literal length denotes, or undefined for anything else. */
function literalLength(expr: ts.Expression): number | undefined {
  const e = unwrapParens(expr);
  if (!ts.isNumericLiteral(e)) return undefined;
  const n = Number(e.text);
  return Number.isInteger(n) && n >= 0 ? n : undefined;
}

function isAssignmentTarget(node: ts.Node): boolean {
  const parent = node.parent;
  return ts.isBinaryExpression(parent) && parent.left === node && isAssignmentOperator(parent.operatorToken.kind);
}

function isPointerResult(t: StaticType): boolean {
  const inner = stripNull(t);
  return inner.kind === "struct" || inner.kind === "array" || inner.kind === "string";
}

const worse = (a: Flow, b: Flow): Flow => (a === "leaks" || b === "leaks" ? "leaks" : a === "returned" || b === "returned" ? "returned" : "local");

export function analyzeEscapes(
  program: CheckedProgram,
  sig: FunctionSig,
  facts: Map<string, FunctionFacts>,
  opts: CompilerOptions
): EscapeResult {
  const result: EscapeResult = {
    stackSites: new Set(),
    stackLocals: new Set(),
    directArena: false,
    allocLeaks: false,
    returnsAllocation: false,
    usesArenaControl: false,
    callSites: [],
  };
  const sites: Site[] = [];
  /** Every identifier reference to each local of this function, in source order. */
  const refs = new Map<LocalVar, ts.Identifier[]>();
  const declarations: ts.VariableDeclaration[] = [];
  /** Arrays that grow: `push` receivers that are locals (checked against the site locals below). */
  const pushes: ts.CallExpression[] = [];
  let logsNumbers = false;

  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node)) {
      const v = program.bindings.get(node);
      if (v?.storage === "local") {
        const list = refs.get(v) ?? [];
        list.push(node);
        refs.set(v, list);
      }
    } else if (ts.isVariableDeclaration(node)) {
      declarations.push(node);
    } else if (ts.isNewExpression(node)) {
      const t = program.types.get(node);
      if (t?.kind === "struct") sites.push({ node, stackable: true });
      else if (t?.kind === "array") {
        const n = literalLength(node.arguments![0]);
        sites.push({ node, stackable: n !== undefined && n * elementSize(t.elem) <= STACK_ARRAY_BYTES });
      }
    } else if (ts.isObjectLiteralExpression(node)) {
      sites.push({ node, stackable: true });
    } else if (ts.isArrayLiteralExpression(node)) {
      const t = program.types.get(node);
      const bytes = t?.kind === "array" ? node.elements.length * elementSize(t.elem) : Number.POSITIVE_INFINITY;
      sites.push({ node, stackable: bytes <= STACK_ARRAY_BYTES });
    } else if (ts.isBinaryExpression(node)) {
      if (node.operatorToken.kind === ts.SyntaxKind.PlusToken && program.types.get(node.left)?.kind === "string") {
        sites.push({ node, stackable: false });
      }
    } else if (ts.isTemplateExpression(node)) {
      if (unwrapStringPassthrough(program, node) === node) sites.push({ node, stackable: false });
    } else if (ts.isCallExpression(node)) {
      visitCall(node);
    }
    ts.forEachChild(node, visit);
  };
  const visitCall = (call: ts.CallExpression): void => {
    const callee = program.callees.get(call);
    if (callee) {
      if (isPointerResult(callee.returnType)) sites.push({ node: call, stackable: false, callee: callee.name });
      return;
    }
    const push: boolean = isPushCall(program, call); // a plain boolean: the guard would narrow `call` to never
    if (push) {
      pushes.push(call);
      return;
    }
    if (ts.isIdentifier(call.expression)) {
      if (call.expression.text === "readFileSync") sites.push({ node: call, stackable: false });
      return;
    }
    const name = dottedName(call.expression);
    if (name === "Arena.reset" || name === "Arena.release") result.usesArenaControl = true;
    else if (name === "console.log" && isNumeric(program.types.get(call.arguments[0]) ?? { kind: "void" })) {
      logsNumbers = true; // `sts_str_from_*` allocates the text; `sts_print` does not retain it
    }
  };
  visit(sig.decl.body!);

  // ---- Flow of one value ---------------------------------------------------------

  /** The local the value is stored in, or `return`, or undefined when `classifyUse` must decide. */
  const flowTarget = (expr: ts.Expression): LocalVar | "return" | undefined => {
    let node: ts.Expression = expr;
    for (;;) {
      const parent = node.parent;
      if (ts.isParenthesizedExpression(parent) || (ts.isConditionalExpression(parent) && parent.condition !== node)) {
        node = parent;
        continue;
      }
      if (ts.isVariableDeclaration(parent) && parent.initializer === node) return program.locals.get(parent);
      if (ts.isReturnStatement(parent)) return "return";
      return undefined;
    }
  };

  /** Whether the callee retains the pointer passed as parameter `index` (`this` is 0 for methods). */
  const calleeCaptures = (callee: FunctionSig, index: number): boolean => {
    const g = facts.get(callee.name);
    const name = g?.paramNames[index];
    if (!g || name === undefined) return true;
    const pointer = g.pointerParams.get(name);
    return pointer ? pointer.captured : g.escaping.has(name);
  };

  interface Outcome {
    flow: Flow;
    /** No local on the path is ever reassigned (required for the stack). */
    stable: boolean;
  }

  const useOutcome = (expr: ts.Expression): Outcome => {
    const use = classifyUse(program, expr);
    switch (use.kind) {
      case "none":
      case "read":
      case "write":
        return { flow: "local", stable: true };
      case "argument":
        return { flow: calleeCaptures(use.callee, use.index) ? "leaks" : "local", stable: true };
      default:
        return { flow: "leaks", stable: true };
    }
  };

  const localOutcomes = new Map<LocalVar, Outcome>();
  const localOutcome = (v: LocalVar, visiting: Set<LocalVar>): Outcome => {
    const known = localOutcomes.get(v);
    if (known) return known;
    if (visiting.has(v)) return { flow: "local", stable: true }; // `const y = x; const x2 = y` chains are acyclic; guard anyway
    visiting.add(v);
    let out: Outcome = { flow: "local", stable: true };
    for (const ref of refs.get(v) ?? []) {
      if (isAssignmentTarget(ref)) {
        out = { ...out, stable: false }; // `x = other`: the object is no longer named by `x` (the stack rule wants a fixed binding)
        continue;
      }
      const step = valueOutcome(ref, visiting);
      out = { flow: worse(out.flow, step.flow), stable: out.stable && step.stable };
    }
    localOutcomes.set(v, out);
    return out;
  };

  const valueOutcome = (expr: ts.Expression, visiting: Set<LocalVar>): Outcome => {
    const target = flowTarget(expr);
    if (target === "return") return { flow: "returned", stable: true };
    if (target) return localOutcome(target, visiting);
    return useOutcome(expr);
  };

  // ---- Decisions -----------------------------------------------------------------

  for (const site of sites) {
    const { flow, stable } = valueOutcome(site.node, new Set());
    if (site.callee !== undefined) {
      result.callSites.push({ callee: site.callee, flow });
      continue;
    }
    if (site.stackable && opts.stackAlloc && flow === "local" && stable) {
      result.stackSites.add(site.node);
      continue;
    }
    if (flow === "local") result.directArena = true;
    else if (flow === "returned") result.returnsAllocation = true;
    else result.allocLeaks = true;
  }

  // Locals that hold nothing but a stack object: their initializer is a stack
  // site or such a local, and they are never reassigned. Source order is
  // declaration order, so an alias sees its source decided first.
  for (const decl of declarations) {
    const v = program.locals.get(decl);
    if (!v || !decl.initializer) continue;
    const init = unwrapParens(decl.initializer);
    const fromSite = result.stackSites.has(init);
    const fromLocal = ts.isIdentifier(init) && result.stackLocals.has(program.bindings.get(init)!);
    if ((fromSite || fromLocal) && localOutcome(v, new Set()).stable) result.stackLocals.add(v);
  }

  // `xs.push(v)`: growth memory belongs to `xs`. Fine when `xs` is a local
  // allocation of this function that flows `local` (the growth dies with it);
  // a leak otherwise (a parameter, a field, an element, a returned array).
  for (const push of pushes) {
    const receiver = unwrapParens((push.expression as ts.PropertyAccessExpression).expression);
    const v = ts.isIdentifier(receiver) ? program.bindings.get(receiver) : undefined;
    const owned = v?.storage === "local" && ownsSite(v) && localOutcome(v, new Set()).flow === "local";
    if (owned) result.directArena = true;
    else result.allocLeaks = true;
  }
  if (logsNumbers) result.directArena = true;
  return result;

  /** `v` was initialised by an allocation site of this function (directly or through an alias). */
  function ownsSite(v: LocalVar): boolean {
    const decl = declarations.find((d) => program.locals.get(d) === v);
    if (!decl?.initializer) return false;
    const init = unwrapParens(decl.initializer);
    if (sites.some((s) => s.node === init)) return true;
    const alias = ts.isIdentifier(init) ? program.bindings.get(init) : undefined;
    return alias?.storage === "local" && alias !== v && ownsSite(alias);
  }
}
