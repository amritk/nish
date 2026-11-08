/**
 * WP49 stage 4: the checker's half of `async` and `await`
 * (`docs/wp49-async-server.md` §2, `docs/LANGUAGE.md` → "Async functions").
 *
 * A promise is never a value. An `await` takes a direct call to an `async`
 * function, written where it is awaited, and stands at the top of an
 * expression statement, a `let`/`const` initializer, a `return` or a concise
 * body; `spawn` and `awaitAll` (`nish:async`) take such calls too; any other
 * call to an `async` function is refused. So no expression has a promise
 * type, and each `await` is an edge from its function to the callee, the
 * graph `rejectAwaitCycles` holds acyclic so that every task's frame has a
 * size the compiler knows (§3).
 */
import { CheckContext } from "./context"
import { checkExpression } from "./expressions"
import { unwrapParens } from "./emit-util"
import { BuiltinExport } from "./nish-modules"
import { AwaitEdge, FunctionSig, ParallelCall } from "./program"
import { Scope } from "./symbols"
import { T_BOOL, T_ERROR, T_I32, T_STRING, T_VOID, isNumeric } from "./types"
import {
  N_BINARY,
  N_BINDING_PATTERN,
  N_BLOCK,
  N_CALL,
  N_EXPR_STMT,
  N_IDENT,
  N_RETURN,
  N_UNARY,
  N_VAR,
  Node,
} from "./nodes"

/** `awaitAll`'s arity, WP24 §9.3's fixed-arity join. */
const AWAIT_ALL_MIN: i32 = 2
const AWAIT_ALL_MAX: i32 = 8

const AWAIT_ALL_FORM: string =
  "`awaitAll` is awaited into one name per call: `const [a, b] = await awaitAll(f(x), g(y))`, from two to eight calls"

/** `what` written outside an `async` function, where there is no task to suspend. */
export const outsideAsyncMessage = (what: string): string =>
  `\`${what}\` is only written inside an \`async\` function: make the function that holds it \`async\`, and \`await\` its calls`

/** An `await` (or `awaitAll`) somewhere other than an await site (`isAwaitSite`). */
const AWAIT_SITE_MESSAGE: string =
  "`await` stands at the top of a statement — an expression statement, a declaration's initializer, a `return` or the right side of `=` — and not inside another expression, which would hold a value across the wait"

/** The callee an `await`, a `spawn` or an `awaitAll` takes, refused as not a direct call. */
const directCallMessage = (what: string): string =>
  `\`${what}\` takes a direct call to an \`async\` function, written where it is made: a promise is never a value to hold and await later`

/**
 * The one call to an async function `await`, `spawn` or `awaitAll` takes:
 * `f(args)`, parenthesised or not, with a plain name for its callee. Null for
 * anything else.
 */
const directCall = (operand: Node): Node | null => {
  const call = unwrapParens(operand)
  return call.kind === N_CALL && call.children[0].kind === N_IDENT ? call : null
}

/**
 * Check `call` as the one an `await` (or `spawn`, `awaitAll`) takes, and
 * answer its callee when that is an async function — null, having said why,
 * when it is not.
 */
const checkTakenCall = (ctx: CheckContext, call: Node, scope: Scope, what: string): FunctionSig | null => {
  const saved = ctx.awaitedCall
  ctx.awaitedCall = call.id
  const type = checkExpression(ctx, call, scope, -1)
  ctx.awaitedCall = saved
  if (type === T_ERROR) {
    return null
  }
  const callee = ctx.program.nodeCallees[call.id]
  if (callee === null || !callee.isAsync()) {
    ctx.error(
      call,
      `\`${what}\` takes a call to an \`async\` function, and \`${call.children[0].text}\` is not one: call it without \`${what}\``
    )
    return null
  }
  return callee
}

/** Record the await edge `current -> callee` at `site`, for `rejectAwaitCycles`. */
const recordAwait = (ctx: CheckContext, callee: FunctionSig, site: Node): void => {
  const current = ctx.current
  if (current !== null) {
    current.awaits.push(new AwaitEdge(callee, site))
  }
}

/** The function being checked is an async one: an `await`, `spawn` or `awaitAll` may stand in it. */
const insideAsync = (ctx: CheckContext): boolean => {
  const current = ctx.current
  return current !== null && current.isAsync()
}

/**
 * Whether `expr` stands at the top of the statement being checked — the
 * whole expression statement, the right side of a plain `=` one, a
 * declarator's initializer, a `return` value — or is the concise body of the
 * async function or arrow being checked. Nothing then holds the value while
 * the task is suspended, which is what lets the frame keep only locals.
 */
const isAwaitSite = (ctx: CheckContext, expr: Node): boolean => {
  const stmt = ctx.awaitStatement
  if (stmt === null) {
    const current = ctx.current
    const body: Node | null = current !== null ? current.body() : null
    return body !== null && body.kind !== N_BLOCK && unwrapParens(body) === expr
  }
  if (stmt.kind === N_EXPR_STMT) {
    const whole = unwrapParens(stmt.children[0])
    if (whole === expr) {
      return true
    }
    return whole.kind === N_BINARY && whole.text === "=" && unwrapParens(whole.children[1]) === expr
  }
  if (stmt.kind === N_RETURN) {
    return stmt.children.length > 0 && unwrapParens(stmt.children[0]) === expr
  }
  if (stmt.kind === N_VAR) {
    for (const decl of stmt.children[0].children) {
      if (decl.children.length > 2 && unwrapParens(decl.children[2]) === expr) {
        return true
      }
    }
  }
  return false
}

/**
 * Whether `expr`, an `await` (of a call or of an `awaitAll`), stands where
 * none may — outside an async function, or not at an await site — having
 * said why. Every form of `await` passes this one gate.
 */
const refuseAwaitHere = (ctx: CheckContext, expr: Node): boolean => {
  if (!insideAsync(ctx)) {
    ctx.error(expr, outsideAsyncMessage("await"))
    return true
  }
  if (!isAwaitSite(ctx, expr)) {
    ctx.error(expr, AWAIT_SITE_MESSAGE)
    return true
  }
  return false
}

/** A wait on the executor (`sleep`, `readable`, `writable`) written anywhere but `await wait(x)`. */
const waitSiteMessage = (name: string): string =>
  `\`${name}\` is a wait on the executor, written only where it is awaited: \`await sleep(ms)\`, \`await readable(fd)\` or \`await writable(fd)\`, inside an \`async\` function`

/** A wait on the executor given other than one `i32`. */
const waitArgumentMessage = (name: string): string =>
  `\`${name}\` takes one \`i32\`: the milliseconds \`sleep\` waits, or the descriptor \`readable\` and \`writable\` wait on`

/** Whether `name` is a `nish:async` wait on the executor. */
const isKernelWait = (name: string): boolean => name === "sleep" || name === "readable" || name === "writable"

/**
 * The `nish:async` wait on the executor `call` makes, or null: its callee
 * is a name no local shadows that the module imported from `nish:async`.
 */
const kernelWaitOf = (ctx: CheckContext, call: Node, scope: Scope): BuiltinExport | null => {
  const name = call.children[0].text
  const imported = ctx.program.builtinImport(name)
  if (scope.lookup(name) !== null || imported === null || !isKernelWait(asyncBuiltinOf(imported))) {
    return null
  }
  return imported
}

/**
 * `await sleep(ms)`, `await readable(fd)`, `await writable(fd)`: a wait the
 * executor makes for the task, which suspends the function as an await of a
 * call does. It answers `true` once the wait is over, and `false` when it
 * could not be made — a negative `ms`, a descriptor that is not open.
 */
const checkKernelWait = (ctx: CheckContext, call: Node, scope: Scope, imported: BuiltinExport): i32 => {
  ctx.program.nodeBuiltins[call.id] = imported.canonical
  const args = call.children[1].children
  if (args.length !== 1) {
    return ctx.errorType(call, waitArgumentMessage(imported.member))
  }
  const type = checkExpression(ctx, args[0], scope, T_I32)
  if (type === T_ERROR) {
    return T_ERROR
  }
  if (type !== T_I32) {
    return ctx.errorType(args[0], waitArgumentMessage(imported.member))
  }
  const current = ctx.current
  if (current !== null) {
    current.waits = true
  }
  return T_BOOL
}

/**
 * `await f(args)`: the answer type of `f`, an async function, called
 * directly at an await site inside an async function.
 */
export const checkAwait = (ctx: CheckContext, expr: Node, scope: Scope): i32 => {
  if (refuseAwaitHere(ctx, expr)) {
    return T_ERROR
  }
  const call = directCall(expr.children[0])
  if (call === null) {
    return ctx.errorType(expr.children[0], directCallMessage("await"))
  }
  const wait = kernelWaitOf(ctx, call, scope)
  if (wait !== null) {
    return checkKernelWait(ctx, call, scope, wait)
  }
  const callee = checkTakenCall(ctx, call, scope, "await")
  if (callee === null) {
    return T_ERROR
  }
  recordAwait(ctx, callee, call)
  return callee.returnType
}

/**
 * A call to an async function that nothing awaits: `f(x)` stored, passed,
 * returned, chained with `.then` or dropped. `true` when it refused.
 */
export const refuseUnawaitedCall = (ctx: CheckContext, expr: Node, isAsync: boolean): boolean => {
  if (!isAsync || ctx.awaitedCall === expr.id) {
    return false
  }
  ctx.error(
    expr,
    `\`${expr.children[0].text}\` is \`async\`: a call to it is awaited where it is made (\`await\`), or handed to \`spawn\` or \`awaitAll\` — a promise is never a value`
  )
  return true
}

/**
 * The refusal of a promise method or a `Promise` static, "" for a call that is
 * neither: `f(x).then(...)` on a call to an async function, and
 * `Promise.all(...)` and its siblings while no local is named `Promise`. Each
 * would hold a promise as a value, which Nish has no type for.
 */
export const promiseMethodMessage = (ctx: CheckContext, callee: Node, scope: Scope): string => {
  const receiver = unwrapParens(callee.children[0])
  if (receiver.kind === N_IDENT && receiver.text === "Promise" && scope.lookup("Promise") === null) {
    return `\`Promise.${callee.text}\` is not supported: a promise is never a value — \`await\` each call where it is made, or \`awaitAll(f(x), g(y))\` from \`nish:async\` to wait on several together`
  }
  if (
    (callee.text === "then" || callee.text === "catch" || callee.text === "finally") &&
    directCall(receiver) !== null &&
    scope.lookup(receiver.children[0].text) === null
  ) {
    const sig = ctx.signature(receiver.children[0].text)
    if (sig !== null && sig.isAsync()) {
      return `\`.${callee.text}\` is not supported: a promise is never a value — \`await\` the call to \`${receiver.children[0].text}\`, and use its answer in the statements after`
    }
  }
  return ""
}

/**
 * The refusal of `await(...)` outside an `async` body, which this parser
 * reads there, as TypeScript does, as a call to a function named `await`
 * (`tests/parser/names-operator-calls.ts`), when no such function is declared.
 */
export const AWAIT_CALL_MESSAGE: string =
  "`await(...)` outside an `async` function is a call to a function named `await`, and there is none: `await` is written inside an `async` function, before its call, `await f(x)`"

/** The `nish:async` builtin a call is to: `spawn`, `awaitAll`, or "" for another. */
export const asyncBuiltinOf = (imported: BuiltinExport): string =>
  imported.namespace === "async" ? imported.member : ""

/**
 * A call to `spawn` or `awaitAll` from `nish:async`. `spawn(f(x))` starts a
 * task whose answer is dropped, so `f` answers `void` or a `Result`;
 * `awaitAll` is legal only as the initializer `checkAwaitAllDeclaration`
 * takes, and reaching it here means it is written anywhere else.
 */
export const checkAsyncBuiltin = (
  ctx: CheckContext,
  expr: Node,
  scope: Scope,
  imported: BuiltinExport
): i32 => {
  ctx.program.nodeBuiltins[expr.id] = imported.canonical
  const what = imported.member
  if (what === "awaitAll") {
    return ctx.errorType(expr, AWAIT_ALL_FORM)
  }
  if (isKernelWait(what)) {
    return ctx.errorType(expr, waitSiteMessage(what))
  }
  if (!insideAsync(ctx)) {
    return ctx.errorType(expr, outsideAsyncMessage(what))
  }
  const args = expr.children[1].children
  let call: Node | null = null
  if (args.length === 1) {
    call = directCall(args[0])
  }
  if (call === null) {
    return ctx.errorType(args.length === 1 ? args[0] : expr, directCallMessage(what))
  }
  const callee = checkTakenCall(ctx, call, scope, what)
  if (callee === null) {
    return T_ERROR
  }
  const answer = callee.returnType
  if (answer !== T_VOID && answer !== T_ERROR && !ctx.table.isResult(answer)) {
    return ctx.errorType(
      call,
      `\`spawn\` drops its task's answer, and \`${call.children[0].text}\` answers ${ctx.table.typeName(answer)}: a spawned task answers \`void\` or a \`Result\` it reports itself`
    )
  }
  let refused = -1
  for (let i = 0; i < callee.paramTypes.length && refused < 0; i++) {
    // A compile-time function argument is not in the frame: the call is an
    // instantiation with the function in its body (WP29).
    if (!callee.isCompileTime(i) && !isSpawnable(ctx, callee.paramTypes[i])) {
      refused = i
    }
  }
  if (refused >= 0) {
    return ctx.errorType(
      call,
      `\`spawn\` hands \`${call.children[0].text}\` an argument of type ${ctx.table.typeName(callee.paramTypes[refused])}, which lives in the spawner's region and is freed when the spawner returns, while the task may still wait: a spawned task takes numbers, \`boolean\`s, enums and \`string\`s, which are copied into its own region, and objects and arrays, which it shares with the spawner`
    )
  }
  recordSpawn(ctx.program.asyncSpawns, expr, callee)
  return T_VOID
}

/**
 * Remember a `spawn` for the region rules, once: a generic caller's body is
 * checked once per instantiation and reaches here again with the same node.
 */
const recordSpawn = (spawns: ParallelCall[], node: Node, task: FunctionSig): void => {
  for (const spawn of spawns) {
    if (spawn.node === node && spawn.sig === task) {
      return
    }
  }
  spawns.push(new ParallelCall(node, task, null))
}

/**
 * WP49 stage 5: whether a spawned task may take a `type` argument. The task
 * outlives its spawner's call, so an argument is a value the frame holds (a
 * number, a `boolean`, an enum), a `string` the task copies into its own
 * region when it starts, or an object or array the task shares with its
 * spawner (`TypeTable.sharedWithTask`): the spawner keeps no arena scope that
 * could release it (`FunctionFacts.feedsTasks`), and the region rules hold the
 * task to them as memory outside its region (`taskFindings`).
 */
const isSpawnable = (ctx: CheckContext, type: i32): boolean =>
  type === T_ERROR ||
  isNumeric(type) ||
  type === T_BOOL ||
  type === T_STRING ||
  ctx.table.isEnum(type) ||
  ctx.table.sharedWithTask(type)

/**
 * `const [a, b] = await awaitAll(f(x), g(y))`, read off the tree: a
 * declarator whose names the parser kept (`parseNamePattern`) and whose
 * initializer is an `await` of a call. The checker decides whether the call
 * is to `awaitAll`; the sweep that refuses every other pattern leaves this
 * one to it.
 */
export const isAwaitAllShape = (decl: Node): boolean => {
  const pattern = decl.children[0]
  if (pattern.kind !== N_BINDING_PATTERN || pattern.children.length === 0 || decl.children.length < 3) {
    return false
  }
  const init = unwrapParens(decl.children[2])
  return init.kind === N_UNARY && init.text === "await" && directCall(init.children[0]) !== null
}

/**
 * The declarator `isAwaitAllShape` read: the answer type of each call, one
 * per name, or null having refused. The calls are awaited together, so each
 * is an await edge of its own.
 */
export const checkAwaitAllDeclaration = (ctx: CheckContext, decl: Node, scope: Scope): i32[] | null => {
  const pattern = decl.children[0]
  const init = unwrapParens(decl.children[2])
  const call = unwrapParens(init.children[0])
  const imported = ctx.program.builtinImport(call.children[0].text)
  if (
    scope.lookup(call.children[0].text) !== null ||
    imported === null ||
    asyncBuiltinOf(imported) !== "awaitAll"
  ) {
    ctx.error(decl, "Destructuring is not supported")
    return null
  }
  ctx.program.nodeBuiltins[call.id] = imported.canonical
  if (refuseAwaitHere(ctx, init)) {
    return null
  }
  const args = call.children[1].children
  if (args.length < AWAIT_ALL_MIN || args.length > AWAIT_ALL_MAX || args.length !== pattern.children.length) {
    ctx.error(call, AWAIT_ALL_FORM)
    return null
  }
  const types: i32[] = []
  for (const arg of args) {
    const taken = directCall(arg)
    if (taken === null) {
      ctx.error(arg, directCallMessage("awaitAll"))
      return null
    }
    const callee = checkTakenCall(ctx, taken, scope, "awaitAll")
    if (callee === null) {
      return null
    }
    recordAwait(ctx, callee, taken)
    types.push(callee.returnType)
  }
  return types
}

/** One await cycle `rejectAwaitCycles` found: reported at `site`, an await in `fn`. */
export class AwaitCycle {
  fn: FunctionSig
  site: Node
  message: string

  constructor(fn: FunctionSig, site: Node, message: string) {
    this.fn = fn
    this.site = site
    this.message = message
  }
}

/**
 * No recursion through `await` (§2): a cycle of await edges would nest a
 * callee's frame inside its own. Each function is walked once, depth first;
 * an edge back to a function still on the path closes a cycle, answered at
 * that edge's call with the cycle spelled out, for the caller to report in
 * the module `fn` is checked in.
 */
export const rejectAwaitCycles = (functions: FunctionSig[]): AwaitCycle[] => {
  const path: FunctionSig[] = []
  const found: AwaitCycle[] = []
  for (const fn of functions) {
    if (fn.awaitMark === 0) {
      walkAwaits(fn, path, found)
    }
  }
  return found
}

const walkAwaits = (fn: FunctionSig, path: FunctionSig[], found: AwaitCycle[]): void => {
  fn.awaitMark = 1
  path.push(fn)
  let i = 0
  while (i < fn.awaits.length) {
    const callee = fn.awaits[i].callee
    if (callee.awaitMark === 1) {
      found.push(new AwaitCycle(fn, fn.awaits[i].site, cycleMessage(path, callee)))
    } else if (callee.awaitMark === 0) {
      walkAwaits(callee, path, found)
    }
    i = i + 1
  }
  path.pop()
  fn.awaitMark = 2
}

/** `a -> b -> a`, from where the cycle starts on the path. */
const cycleMessage = (path: FunctionSig[], back: FunctionSig): string => {
  const names: string[] = []
  let on = false
  for (const fn of path) {
    on = on || fn === back
    if (on) {
      names.push(`\`${fn.sourceName}\` -> `)
    }
  }
  return `\`${back.sourceName}\` awaits itself (${names.join("")}\`${back.sourceName}\`): an awaited call's frame is nested in its caller's, so recursion through \`await\` has no size — write it as a loop`
}
