/**
 * Allocation escape analysis (WP6): which allocations can live on the stack,
 * and which functions can reclaim their arena temporaries on exit.
 *
 * An *allocation site* is an expression that produces fresh memory:
 *
 *   new C(...), { ... }        a struct            (stackable)
 *   [a, b], new Array<T>(<literal>)  an array      (stackable up to STACK_ARRAY_BYTES)
 *   new Array<T>(n)            an array, dynamic   (arena)
 *   a + b, `...${x}...`, readFileSync(p),
 *   readFileSyncOrNull(p)      a string            (arena)
 *   Ok(v), Err(e)              a Result (WP16)     (stackable)
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
 * with `nish_arena_mark` at entry and `nish_arena_release` before every `ret`.
 * A `returned` site disables the scope (the caller owns that memory); a
 * `leaks` site marks the function `allocLeaks`, which disables the scope of
 * every caller too, since the leaked memory may be reachable from an object
 * the caller still holds. `push` on an array that is not a local allocation
 * site leaks (the growth belongs to an array someone else owns), and so does
 * any call to `Arena.reset` / `Arena.release` (`usesArenaControl`).
 *
 * Call-site reclaim (WP9): `leaks` is two different facts in one bucket. A
 * value stored into a field, an element or a callee that keeps it is reachable
 * from the *caller* after the call; a value merely assigned to a local
 * (`s = s + piece(i)`) is not — that local dies with the frame, and the only
 * reason such a site is not `local` is that the stack rule needs a fixed
 * binding. So every outcome also carries `escapes`, which is true only in the
 * first case and follows the value into the local in the second, exactly as
 * `flow` already follows `const y = x`. `EscapeResult.allocEscapes` is the
 * per-function union, and `reclaimsReturnedString` is what it buys: at a call
 * whose callee never lets an allocation out other than through its return
 * value, the caller may mark the arena before the call and hand the returned
 * string to `nish_arena_keep`, which moves it down to the mark and reclaims
 * every temporary the callee left behind it. `allocEscapes` implies
 * `allocLeaks` but not the reverse, and only the new fact is refined: the
 * automatic scopes still read `allocLeaks` and decide exactly what they did.
 */
import ts from "typescript";
import { CheckedProgram, FunctionSig, LocalVar } from "../checker/index.js";
import { dottedName } from "../checker/builtins.js";
import { isFunctionResult } from "../checker/declarations.js";
import { intrinsicType, isAssignmentOperator } from "../checker/classes.js";
import { CompilerOptions, StaticType, alignOf, isNumeric, resultByValue, stripNull } from "../types.js";
import { FunctionFacts, classifyUse } from "./attributes.js";
import { isJoinCall, isPushCall, literalLength } from "./emit/arrays.js";
import { isResultConstructorCall, resultMethodName } from "./emit/result.js";
import { isStringAllocCall, unwrapStringPassthrough } from "./emit/strings.js";

/** Largest array data block (`[n x T]`) placed on the stack, in bytes. */
export const STACK_ARRAY_BYTES = 4096;

export type Flow = "local" | "returned" | "leaks";

/** What happens to the allocations a user callee returns, from the caller's side. */
export interface CallSite {
  callee: string;
  flow: Flow;
  /** WP9: the result is reachable after this function returns, other than through its return value. */
  escapes: boolean;
}

export interface EscapeResult {
  /** Allocation expressions lowered to entry-block allocas. */
  stackSites: Set<ts.Node>;
  /** Locals that only ever hold a stack object (for the effect analysis: their fields are own memory). */
  stackLocals: Set<LocalVar>;
  /**
   * WP17: names of the by-value `Result` parameters whose unpacked object may
   * be an entry-block alloca. The word arrives in a register, so the object
   * the body reads is built here; it is this function's own memory unless a
   * use of the parameter stores the pointer somewhere that outlives the frame
   * (an object literal, `push`), which is exactly what `localOutcome` decides
   * for a local holding an allocation.
   */
  stackParams: Set<string>;
  /** The body performs an arena allocation whose flow is `local` (there is something to release). */
  directArena: boolean;
  /** Some direct allocation `leaks`. */
  allocLeaks: boolean;
  /**
   * WP9: some direct allocation is reachable after this function returns other
   * than through its return value. Refines `allocLeaks`, which also counts a
   * value assigned to a local of this frame; see the header.
   */
  allocEscapes: boolean;
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

/** Bytes per element: every value is a scalar or a pointer, so its size is its alignment. */
function elementSize(elem: StaticType): number {
  return alignOf(elem);
}

function unwrapParens(expr: ts.Expression): ts.Expression {
  let inner = expr;
  while (ts.isParenthesizedExpression(inner)) inner = inner.expression;
  return inner;
}

function isAssignmentTarget(node: ts.Node): boolean {
  const parent = node.parent;
  return (
    ts.isBinaryExpression(parent) && parent.left === node && isAssignmentOperator(parent.operatorToken.kind)
  );
}

function isPointerResult(t: StaticType): boolean {
  const inner = stripNull(t);
  // A `Result` (WP16) is a pointer into the arena like the others, so a call
  // that answers one is an allocation site of its caller — unless WP17 packs
  // it into a register, in which case the callee allocated nothing and the
  // caller's copy is its own (see the `resultByValue` arm of `visitCall`).
  return (
    inner.kind === "struct" ||
    inner.kind === "array" ||
    inner.kind === "string" ||
    (inner.kind === "result" && !resultByValue(inner))
  );
}

const worse = (a: Flow, b: Flow): Flow =>
  a === "leaks" || b === "leaks" ? "leaks" : a === "returned" || b === "returned" ? "returned" : "local";

/**
 * WP9: may the caller reclaim the arena around a call to `callee`?
 *
 * The proof has three parts, and all three are needed:
 *
 *  - **The callee's garbage is garbage.** `allocEscapes` is false, so nothing
 *    the callee allocated is reachable from anywhere the caller can see except
 *    through the value it returned. The caller holds no other pointer into the
 *    call, because a return value is the only thing a call hands back.
 *  - **The arena did not move under the mark.** `usesArenaControl` is false, so
 *    neither the callee nor anything it calls reset or released the arena
 *    between the mark and the reclaim.
 *  - **The kept value can be moved.** Only a plain `string` qualifies: it is one
 *    flat block with no interior pointers, so relocating its bytes relocates the
 *    whole value. An array header points at a separate data block, a struct or a
 *    `Result` may hold pointers into other blocks, and `string | null` may be
 *    null, so none of them is moved.
 *
 * `allocates` is not part of the proof, only of the profit: a callee that never
 * bumps the arena has nothing to reclaim, so the pair of calls is skipped.
 */
export function reclaimsReturnedString(callee: FunctionSig, facts: Map<string, FunctionFacts>): boolean {
  if (callee.returnType.kind !== "string") return false;
  const g = facts.get(callee.name);
  return g !== undefined && g.allocates && !g.allocEscapes && !g.usesArenaControl;
}

export function analyzeEscapes(
  program: CheckedProgram,
  sig: FunctionSig,
  facts: Map<string, FunctionFacts>,
  opts: CompilerOptions
): EscapeResult {
  const result: EscapeResult = {
    stackSites: new Set(),
    stackLocals: new Set(),
    stackParams: new Set(),
    directArena: false,
    allocLeaks: false,
    allocEscapes: false,
    returnsAllocation: false,
    usesArenaControl: false,
    callSites: [],
  };
  /** WP17: this function hands its `Result` back in a register, not as a pointer. */
  const returnsByValueResult = resultByValue(sig.returnType);
  const sites: Site[] = [];
  /** Every identifier reference to each local of this function, in source order. */
  const refs = new Map<LocalVar, ts.Identifier[]>();
  const declarations: ts.VariableDeclaration[] = [];
  /** Arrays that grow: `push` receivers that are locals (checked against the site locals below). */
  const pushes: ts.CallExpression[] = [];
  let logsNumbers = false;

  /** WP17: the `LocalVar` of each by-value `Result` parameter, by name. */
  const byValueParams = new Map<string, LocalVar>();
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node)) {
      const v = program.bindings.get(node);
      // A by-value `Result` parameter owns its object, so its uses are walked
      // like a local's: the same alias chain decides alloca or arena.
      if (v?.storage === "param" && resultByValue(v.type)) byValueParams.set(v.name, v);
      if (v?.storage === "local" || (v?.storage === "param" && resultByValue(v.type))) {
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
      const bytes =
        t?.kind === "array" ? node.elements.length * elementSize(t.elem) : Number.POSITIVE_INFINITY;
      sites.push({ node, stackable: bytes <= STACK_ARRAY_BYTES });
    } else if (ts.isBinaryExpression(node)) {
      if (
        node.operatorToken.kind === ts.SyntaxKind.PlusToken &&
        program.types.get(node.left)?.kind === "string"
      ) {
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
      if (isPointerResult(callee.returnType))
        sites.push({ node: call, stackable: false, callee: callee.name });
      // WP17: a `Result` returned in a register is materialised by the *caller*,
      // so the call is an allocation site of this function like `new C(...)` is:
      // an entry-block alloca unless the pointer is handed to something that
      // keeps it, and never memory the callee owns.
      else if (resultByValue(callee.returnType)) sites.push({ node: call, stackable: true });
      return;
    }
    const push: boolean = isPushCall(program, call); // a plain boolean: the guard would narrow `call` to never
    if (push) {
      pushes.push(call);
      return;
    }
    // WP14: `s.substring(...)`, `String.fromCharCode(c)` and `parts.join(s)`
    // each bump one string out of the arena, so they are allocation sites
    // like `a + b` is.
    if (isStringAllocCall(program, call) || isJoinCall(program, call)) {
      sites.push({ node: call, stackable: false });
      return;
    }
    // WP16: `r.orReturn()` builds the `Result` this function returns early, so
    // the body hands out arena memory whatever else it does — which is exactly
    // what disqualifies it from an automatic arena scope. WP17: not when the
    // `Result` is packed into the return register, because then nothing is
    // built at all.
    if (resultMethodName(program, call) === "orReturn") {
      if (!resultByValue(sig.returnType)) result.returnsAllocation = true;
      return;
    }
    if (ts.isIdentifier(call.expression)) {
      // `Ok(v)` / `Err(e)` bump one fixed-size struct, so they are stackable
      // exactly as `new C(...)` is.
      if (isResultConstructorCall(program, call)) {
        sites.push({ node: call, stackable: true });
        return;
      }
      // Both file readers bump their result out of the arena, so both are
      // allocation sites. Missing the `OrNull` half gave a function that
      // returns it an automatic arena scope, which released the bytes before
      // the caller could read them (`tests/cases/mem_read_or_null_scope`).
      const name = call.expression.text;
      if (name === "readFileSync" || name === "readFileSyncOrNull") {
        sites.push({ node: call, stackable: false });
      }
      return;
    }
    const name = dottedName(call.expression);
    if (name === "Arena.reset" || name === "Arena.release") result.usesArenaControl = true;
    else if (name === "console.log" && isNumeric(program.types.get(call.arguments[0]) ?? { kind: "void" })) {
      logsNumbers = true; // `nish_str_from_*` allocates the text; `nish_print` does not retain it
    }
  };
  visit(sig.decl.body!);

  // ---- Flow of one value ---------------------------------------------------------

  /** The local the value is stored in, or `return`, or undefined when `classifyUse` must decide. */
  const flowTarget = (expr: ts.Expression): LocalVar | "return" | undefined => {
    let node: ts.Expression = expr;
    for (;;) {
      const parent = node.parent;
      if (
        ts.isParenthesizedExpression(parent) ||
        (ts.isConditionalExpression(parent) && parent.condition !== node)
      ) {
        node = parent;
        continue;
      }
      if (ts.isVariableDeclaration(parent) && parent.initializer === node) return program.locals.get(parent);
      // A concise arrow body is the one `return` it means, so the value it
      // builds is returned rather than local (WP22 §4).
      if (isFunctionResult(node)) return "return";
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
    /**
     * WP9: the value is reachable after this function returns, other than
     * through its return value. Always false for a `local` or `returned` flow;
     * false for a `leaks` flow whose only cause is an assignment to a local of
     * this frame, whose own outcome it takes instead.
     */
    escapes: boolean;
  }

  /**
   * `x = <expr>`: the local of this function the value is assigned to. It is
   * still `leaks` for the stack rule — the binding is not fixed, so the slot
   * may not be reused — but the value has not left the frame, so `escapes`
   * follows it into `x` the way `flow` already follows `const x = <expr>`.
   * A store through anything else (`o.f = v`, `a[i] = v`) or into a parameter
   * is not a local of this frame and keeps the conservative answer.
   */
  const assignedLocal = (expr: ts.Expression): LocalVar | undefined => {
    let node: ts.Expression = expr;
    for (;;) {
      const parent = node.parent;
      if (
        ts.isParenthesizedExpression(parent) ||
        (ts.isConditionalExpression(parent) && parent.condition !== node)
      ) {
        node = parent;
        continue;
      }
      if (
        !ts.isBinaryExpression(parent) ||
        parent.right !== node ||
        !isAssignmentOperator(parent.operatorToken.kind) ||
        !ts.isIdentifier(parent.left)
      ) {
        return undefined;
      }
      const target = program.bindings.get(parent.left);
      return target?.storage === "local" ? target : undefined;
    }
  };

  const useOutcome = (expr: ts.Expression, visiting: Set<LocalVar>): Outcome => {
    const use = classifyUse(program, expr);
    switch (use.kind) {
      case "none":
      case "read":
      case "write":
        return { flow: "local", stable: true, escapes: false };
      case "argument": {
        // WP17: a by-value `Result` argument is packed into a register, so the
        // callee gets a copy and never sees this object at all.
        if (resultByValue(use.callee.params[use.index]?.type ?? { kind: "void" }))
          return { flow: "local", stable: true, escapes: false };
        const captured = calleeCaptures(use.callee, use.index);
        return { flow: captured ? "leaks" : "local", stable: true, escapes: captured };
      }
      default: {
        const target = assignedLocal(expr);
        const escapes = target ? localOutcome(target, visiting).escapes : true;
        return { flow: "leaks", stable: true, escapes };
      }
    }
  };

  const localOutcomes = new Map<LocalVar, Outcome>();
  const localOutcome = (v: LocalVar, visiting: Set<LocalVar>): Outcome => {
    const known = localOutcomes.get(v);
    if (known) return known;
    // `const y = x; const x2 = y` chains are acyclic, but `escapes` also
    // follows `y = x`, and two locals assigned to each other do cycle. The
    // re-entry is therefore pessimistic about escaping and optimistic about
    // the flow, which is what the existing decisions were computed with.
    if (visiting.has(v)) return { flow: "local", stable: true, escapes: true };
    visiting.add(v);
    let out: Outcome = { flow: "local", stable: true, escapes: false };
    for (const ref of refs.get(v) ?? []) {
      if (isAssignmentTarget(ref)) {
        out = { ...out, stable: false }; // `x = other`: the object is no longer named by `x` (the stack rule wants a fixed binding)
        continue;
      }
      const step = valueOutcome(ref, visiting);
      out = {
        flow: worse(out.flow, step.flow),
        stable: out.stable && step.stable,
        escapes: out.escapes || step.escapes,
      };
    }
    localOutcomes.set(v, out);
    return out;
  };

  const valueOutcome = (expr: ts.Expression, visiting: Set<LocalVar>): Outcome => {
    const target = flowTarget(expr);
    // WP17: `return r` on a by-value `Result` copies the two live words into
    // the return register; the object itself does not leave the frame, so it
    // is as local as one that is never returned at all.
    if (target === "return")
      return { flow: returnsByValueResult ? "local" : "returned", stable: true, escapes: false };
    if (target) return localOutcome(target, visiting);
    return useOutcome(expr, visiting);
  };

  // ---- Decisions -----------------------------------------------------------------

  for (const site of sites) {
    let { flow, stable, escapes } = valueOutcome(site.node, new Set());
    // A `new` object is also handed to its constructor as `this`; a
    // constructor that captures it (`r.last = this`) makes the object escape
    // however the local is used afterwards.
    if (ts.isNewExpression(site.node)) {
      const t = intrinsicType(program, site.node);
      const ctor = t?.kind === "struct" ? program.structs.get(t.name)!.ctor : undefined;
      if (ctor && calleeCaptures(ctor, 0)) {
        flow = "leaks";
        escapes = true; // the constructor stored `this` somewhere the caller may reach
      }
    }
    if (escapes) result.allocEscapes = true;
    if (site.callee !== undefined) {
      result.callSites.push({ callee: site.callee, flow, escapes });
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

  // WP17: the same decision for each by-value `Result` parameter. A parameter
  // never referenced has no refs and therefore no way to escape, so its object
  // stays an alloca (and the unpack is dead code the optimiser removes).
  for (const p of sig.params) {
    if (!resultByValue(p.type)) continue;
    const v = byValueParams.get(p.name);
    const outcome = v
      ? localOutcome(v, new Set())
      : { flow: "local" as Flow, stable: true, escapes: false };
    if (outcome.escapes) result.allocEscapes = true;
    if (opts.stackAlloc && outcome.flow === "local" && outcome.stable) result.stackParams.add(p.name);
    else if (outcome.flow === "local") result.directArena = true;
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
    const outcome = v?.storage === "local" && ownsSite(v) ? localOutcome(v, new Set()) : undefined;
    // WP9: the growth is reachable exactly where the array it belongs to is.
    // An array this function allocated and only keeps or returns takes its
    // growth with it; anyone else's array leaves it reachable by the caller.
    if (!outcome || outcome.escapes) result.allocEscapes = true;
    if (outcome && outcome.flow === "local") result.directArena = true;
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
