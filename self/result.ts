// `Result<T, E>` for stage1 (`src/checker/result.ts`, WP16): the type, the
// three rules that make an error impossible to ignore, and the layout the
// emitter shares with the checker.
//
// The rules are stage0's, and so is every message, because the `.err` goldens
// match on them:
//
//   1. A `Result` cannot be dropped: not as a bare expression statement, and
//      not as a local nobody reads.
//   2. The error arm comes first: `r.value` only where `isOk()` was proved,
//      `r.error` only where `isErr()` was.
//   3. Propagation is contagious: `orReturn()` only inside a function that
//      itself returns a `Result` with a compatible error arm.
//
// The layout is *derived* from the type rather than declared, exactly as in
// stage0, so nothing has to be registered and an imported signature that
// mentions a `Result` brings across only the layouts of its payloads.

import { checkBuiltinArity } from "./builtins";
import { roundUpTo } from "./structs";
import { CheckContext } from "./context";
import { checkExpression } from "./expressions";
import { N_BINARY, N_CALL, N_IDENT, N_MEMBER, N_VAR_DECL, Node } from "./nodes";
import { CheckedProgram, FunctionSig } from "./program";
import { Scope } from "./symbols";
import { R_ERR, R_OK, R_UNKNOWN, T_BOOL, T_ERROR, T_STRING, T_VOID, TypeTable } from "./types";

// ---- Layout ---------------------------------------------------------------

/**
 * The monomorphised struct behind one `Result<T, E>`, laid out exactly as
 * clang lays out `struct { bool ok; T value; E error; }`. `hasValue` is false
 * for `Result<void, E>`: there is no payload to store, and leaving the field
 * out keeps that shape one word smaller.
 */
export class ResultLayout {
  /** LLVM struct name without the `%struct.` prefix. */
  name: string;
  okIndex: i32;
  okOffset: i32;
  hasValue: boolean;
  valueIndex: i32;
  valueOffset: i32;
  valueType: i32;
  errorIndex: i32;
  errorOffset: i32;
  errorType: i32;
  size: i32;
  align: i32;

  constructor(name: string) {
    this.name = name;
    this.okIndex = 0;
    this.okOffset = 0;
    this.hasValue = false;
    this.valueIndex = -1;
    this.valueOffset = 0;
    this.valueType = T_VOID;
    this.errorIndex = 1;
    this.errorOffset = 0;
    this.errorType = T_ERROR;
    this.size = 0;
    this.align = 1;
  }
}

/** Lay `Result<T, E>` out; recomputed per ask, because it is a handful of adds. */
export function resultLayout(table: TypeTable, type: i32): ResultLayout {
  const layout = new ResultLayout(table.resultStructName(type));
  const ok = table.okOf(type);
  const err = table.errOf(type);
  // `bool` is one byte and one-aligned, so the discriminant always sits at 0.
  let offset = 1;
  let align = 1;
  let index = 1;
  if (ok !== T_VOID) {
    const valueAlign = table.alignOf(ok);
    offset = roundUpTo(offset, valueAlign);
    layout.hasValue = true;
    layout.valueIndex = index;
    layout.valueOffset = offset;
    layout.valueType = ok;
    offset = offset + valueAlign;
    if (valueAlign > align) {
      align = valueAlign;
    }
    index = index + 1;
  }
  const errAlign = table.alignOf(err);
  offset = roundUpTo(offset, errAlign);
  layout.errorIndex = index;
  layout.errorOffset = offset;
  layout.errorType = err;
  offset = offset + errAlign;
  if (errAlign > align) {
    align = errAlign;
  }
  layout.size = roundUpTo(offset, align);
  layout.align = align;
  return layout;
}

// ---- `Ok(...)` and `Err(...)` ---------------------------------------------

/** The two constructors, consulted only when no user function has the name. */
export function isResultConstructor(name: string): boolean {
  return name === "Ok" || name === "Err";
}

/**
 * `Ok(v)` / `Err(e)`. Like the `null` literal they carry no type of their
 * own: the return type, the annotation, or the parameter they feed decides
 * which monomorphisation is built, which is what keeps `return Ok(0)`
 * readable.
 */
export function checkResultConstructor(ctx: CheckContext, call: Node, scope: Scope, want: i32): i32 {
  const name = call.children[0].text;
  const args = call.children[1];
  if (want < 0) {
    return ctx.errorType(
      call,
      `\`${name}(...)\` needs a contextual \`Result<T, E>\` type (annotate the function's return type, e.g. \`function f(): Result<number, string>\`)`
    );
  }
  if (!ctx.table.isResult(want)) {
    return ctx.errorType(call, `\`${name}(...)\` is a \`Result<T, E>\`, not ${ctx.table.typeName(want)}`);
  }
  const isOk = name === "Ok";
  const payload = isOk ? ctx.table.okOf(want) : ctx.table.errOf(want);
  if (isOk && payload === T_VOID) {
    checkBuiltinArity(ctx, call, name, args, 0);
    return want;
  }
  if (!checkBuiltinArity(ctx, call, name, args, 1)) {
    return want;
  }
  const got = checkExpression(ctx, args.children[0], scope, payload);
  if (!ctx.table.assignable(got, payload)) {
    ctx.error(
      args.children[0],
      `\`${name}(...)\` expects ${ctx.table.typeName(payload)} for ${ctx.table.typeName(want)}, got ${ctx.table.typeName(got)}`
    );
  }
  return want;
}

// ---- `r.ok` / `r.value` / `r.error` ---------------------------------------

/**
 * How to get from an un-narrowed `Result` to the payload, phrased as the code
 * the programmer should write. The narrowing is keyed by local variable, so a
 * field or element holding a `Result` has to be bound first, exactly as a
 * nullable does.
 */
function narrowHint(ctx: CheckContext, receiverExpr: Node, payload: string): string {
  const test = payload === "value" ? "isOk()" : "isErr()";
  if (receiverExpr.kind !== N_IDENT) {
    const text = ctx.textOf(receiverExpr);
    return `only a local is narrowed, so bind it first: \`const r = ${text}; if (r.${test}) { ... r.${payload} ... }\``;
  }
  const name = receiverExpr.text;
  return `test it first: \`if (${name}.${test}) { ... ${name}.${payload} ... }\``;
}

/** `r.ok`, `r.value`, `r.error`. */
export function checkResultProperty(ctx: CheckContext, expr: Node, receiver: i32): i32 {
  const receiverExpr = expr.children[0];
  const spelled = ctx.table.typeName(receiver);
  if (expr.text === "ok") {
    // The discriminant is readable anywhere, and `if (r.ok)` narrows exactly
    // as `if (r.isOk())` does: it is the same fact, and it is the spelling a
    // TypeScript reader expects of a tagged union.
    return T_BOOL;
  }
  if (expr.text === "value") {
    if (ctx.table.okOf(receiver) === T_VOID) {
      return ctx.errorType(expr, `\`${spelled}\` has no \`value\`: its success arm carries nothing`);
    }
    if (ctx.table.stateOf(receiver) !== R_OK) {
      return ctx.errorType(
        expr,
        `Cannot read \`value\` of \`${spelled}\` before the error is handled; ${narrowHint(ctx, receiverExpr, "value")}`
      );
    }
    return ctx.table.okOf(receiver);
  }
  if (expr.text === "error") {
    if (ctx.table.stateOf(receiver) !== R_ERR) {
      return ctx.errorType(
        expr,
        `Cannot read \`error\` of \`${spelled}\` here: it only holds an error where the call failed; ${narrowHint(ctx, receiverExpr, "error")}`
      );
    }
    return ctx.table.errOf(receiver);
  }
  return ctx.errorType(
    expr,
    `Unknown property \`${expr.text}\` on ${spelled} (it has \`ok\`, \`value\` and \`error\`)`
  );
}

// ---- Methods --------------------------------------------------------------

/** `Result<void, E>` methods answer nothing, so they may only stand as a statement. */
function requireStatement(ctx: CheckContext, call: Node, method: string, receiver: i32): void {
  const statement = ctx.statementExpression;
  if (statement === null || statement !== call) {
    ctx.error(
      call,
      `\`${method}()\` on ${ctx.table.typeName(receiver)} produces no value and can only be used as a statement`
    );
  }
}

/**
 * `r.orReturn()`: the propagation rule. The enclosing function has to return a
 * `Result` whose error arm accepts this one's, which is exactly the contagion
 * Rust's `?` enforces through `From<E>` — without the conversion, because
 * StaticTS has no trait to hang one on.
 */
function checkOrReturn(ctx: CheckContext, call: Node, receiver: i32): i32 {
  const current = ctx.current;
  const want = current === null ? T_ERROR : current.returnType;
  const named = current === null ? "this function" : `\`${current.sourceName}\``;
  if (want === T_ERROR) {
    return T_ERROR;
  }
  if (!ctx.table.isResult(want)) {
    return ctx.errorType(
      call,
      `\`orReturn()\` propagates the error, so ${named} must return a \`Result<T, E>\` (it returns ${ctx.table.typeName(want)}); handle it here instead: \`if (r.isErr()) { ... }\``
    );
  }
  if (!ctx.table.assignable(ctx.table.errOf(receiver), ctx.table.errOf(want))) {
    return ctx.errorType(
      call,
      `\`orReturn()\` would propagate ${ctx.table.typeName(ctx.table.errOf(receiver))} but ${named} returns ${ctx.table.typeName(want)}; convert the error first: \`if (r.isErr()) { return Err(...); }\``
    );
  }
  const ok = ctx.table.okOf(receiver);
  if (ok === T_VOID) {
    requireStatement(ctx, call, "orReturn", receiver);
  }
  return ok;
}

/** `r.unwrapOr(fallback)`: handle the failure by substituting a value of the same type. */
function checkUnwrapOr(ctx: CheckContext, call: Node, args: Node, receiver: i32, scope: Scope): i32 {
  const ok = ctx.table.okOf(receiver);
  if (ok === T_VOID) {
    return ctx.errorType(
      call,
      `\`unwrapOr(...)\` needs a success value to fall back to, and \`${ctx.table.typeName(receiver)}\` has none; use \`if (r.isErr()) { ... }\``
    );
  }
  if (!checkBuiltinArity(ctx, call, "unwrapOr", args, 1)) {
    return ok;
  }
  const got = checkExpression(ctx, args.children[0], scope, ok);
  if (!ctx.table.assignable(got, ok)) {
    ctx.error(
      args.children[0],
      `\`unwrapOr(...)\` expects ${ctx.table.typeName(ok)} to match ${ctx.table.typeName(receiver)}, got ${ctx.table.typeName(got)}`
    );
  }
  return ok;
}

/**
 * `r.expect(message)`: handle the failure by ending the process, the way an
 * unmet invariant should. It is the only unwrap here, and unlike Rust's
 * `unwrap()` it insists on a message, because a program that gives up should
 * say why. `message` is a plain string rather than a rendering of the error:
 * `E` is any type and StaticTS has no way to format one.
 */
function checkExpect(ctx: CheckContext, call: Node, args: Node, receiver: i32, scope: Scope): i32 {
  const ok = ctx.table.okOf(receiver);
  if (checkBuiltinArity(ctx, call, "expect", args, 1)) {
    const got = checkExpression(ctx, args.children[0], scope, T_STRING);
    if (got !== T_ERROR && got !== T_STRING) {
      ctx.error(args.children[0], `\`expect(...)\` expects string, got ${ctx.table.typeName(got)}`);
    }
  }
  if (ok === T_VOID) {
    requireStatement(ctx, call, "expect", receiver);
  }
  return ok;
}

/** `r.isOk()`, `r.isErr()`, `r.orReturn()`, `r.unwrapOr(d)`, `r.expect(m)`. */
export function checkResultMethod(
  ctx: CheckContext,
  call: Node,
  access: Node,
  args: Node,
  receiver: i32,
  scope: Scope
): i32 {
  const name = access.text;
  if (name === "isOk" || name === "isErr") {
    checkBuiltinArity(ctx, call, name, args, 0);
    return T_BOOL;
  }
  if (name === "orReturn") {
    checkBuiltinArity(ctx, call, "orReturn", args, 0);
    return checkOrReturn(ctx, call, receiver);
  }
  if (name === "unwrapOr") {
    return checkUnwrapOr(ctx, call, args, receiver, scope);
  }
  if (name === "expect") {
    return checkExpect(ctx, call, args, receiver, scope);
  }
  return ctx.errorType(
    access,
    `Unknown method \`${name}\` on ${ctx.table.typeName(receiver)} (it has \`isOk\`, \`isErr\`, \`orReturn\`, \`unwrapOr\` and \`expect\`)`
  );
}

// ---- Narrowing ------------------------------------------------------------

/**
 * The variable a discriminant test is about, or null. All three spellings —
 * `r.ok`, `r.isOk()`, `r.isErr()` — prove the same one bit, so they narrow
 * through one path and compose with `!`, `&&` and `||` exactly as a null test
 * does. `positive` is false only for `isErr()`.
 */
export function narrowResultTest(cond: Node, scope: Scope, table: TypeTable, whenTrue: boolean): boolean {
  let receiver: Node | null = null;
  let positive = true;
  if (cond.kind === N_MEMBER && cond.text === "ok") {
    receiver = cond.children[0];
  } else if (cond.kind === N_CALL) {
    const access = cond.children[0];
    if (access.kind !== N_MEMBER || cond.children[1].children.length > 0) {
      return false;
    }
    if (access.text !== "isOk" && access.text !== "isErr") {
      return false;
    }
    receiver = access.children[0];
    positive = access.text === "isOk";
  } else {
    return false;
  }
  if (receiver === null || receiver.kind !== N_IDENT) {
    return false;
  }
  const local = scope.lookup(receiver.text);
  if (local === null) {
    return false;
  }
  const declared = scope.typeOf(local);
  if (!table.isResult(declared)) {
    return false;
  }
  const proves = positive === whenTrue ? R_OK : R_ERR;
  scope.narrow(local, table.withState(declared, proves));
  return true;
}

// ---- Rule 1: a `Result` cannot be dropped ---------------------------------

/**
 * Called for every expression statement. A bare call that answers a `Result`
 * is the one shape where a failure would vanish without a trace, so it is the
 * shape this rule names.
 */
export function rejectDiscardedResult(ctx: CheckContext, expr: Node, type: i32): void {
  if (!ctx.table.isResult(type)) {
    return;
  }
  ctx.error(
    expr,
    `\`${ctx.table.typeName(type)}\` must be handled, not discarded: bind it (\`const r = ${ctx.textOf(expr)}; if (r.isErr()) { ... }\`), propagate it with \`.orReturn()\`, or end on it with \`.expect(message)\``
  );
}

/**
 * Called once per function body. A local that holds a `Result` and is never
 * read is the other way a failure goes unnoticed; `const r = f();` on its own
 * would otherwise satisfy the statement rule above while ignoring exactly what
 * it is there to report.
 *
 * "Read" means any reference that is not the target of an assignment, so
 * handing the value on (an argument, a `return`) counts: the responsibility
 * moves with the value, and the receiving signature carries the same rules.
 */
export function checkResultLocalsHandled(ctx: CheckContext, sig: FunctionSig, body: Node): void {
  const declarations: Node[] = [];
  const read: boolean[] = [];
  collectResultLocals(ctx.program, ctx.table, body, declarations);
  for (const decl of declarations) {
    read.push(false);
  }
  markResultReads(ctx.program, body, declarations, read);
  let i = 0;
  while (i < declarations.length) {
    if (!read[i]) {
      const local = ctx.program.nodeLocals[declarations[i].id];
      if (local !== null) {
        ctx.error(
          declarations[i].children[0],
          `\`${local.name}\` holds a \`${ctx.table.typeName(local.type)}\` that is never inspected; test it with \`${local.name}.isErr()\`, or use \`.orReturn()\`, \`.unwrapOr(v)\` or \`.expect(message)\``
        );
      }
    }
    i = i + 1;
  }
}

/** Every `Result`-typed `let`/`const` declared anywhere in `node`, in source order. */
function collectResultLocals(program: CheckedProgram, table: TypeTable, node: Node, out: Node[]): void {
  if (node.kind === N_VAR_DECL) {
    const local = program.nodeLocals[node.id];
    if (local !== null && table.isResult(local.type)) {
      out.push(node);
    }
  }
  for (const child of node.children) {
    collectResultLocals(program, table, child, out);
  }
}

/**
 * Mark every declaration in `declarations` whose local is *read* somewhere in
 * `node`. The target of a plain `x = v` is a write, so the walk descends into
 * the right-hand side and skips a bare identifier on the left; `p.x = v` and
 * `x += v` both read `p` and `x`, so neither is skipped.
 */
function markResultReads(program: CheckedProgram, node: Node, declarations: Node[], read: boolean[]): void {
  if (node.kind === N_IDENT) {
    const local = program.nodeLocals[node.id];
    if (local !== null) {
      let i = 0;
      while (i < declarations.length) {
        const declared = program.nodeLocals[declarations[i].id];
        if (declared !== null && declared === local) {
          read[i] = true;
        }
        i = i + 1;
      }
    }
    return;
  }
  const assigns = node.kind === N_BINARY && node.text === "=" && node.children[0].kind === N_IDENT;
  let index = 0;
  for (const child of node.children) {
    if (!assigns || index !== 0) {
      markResultReads(program, child, declarations, read);
    }
    index = index + 1;
  }
}
