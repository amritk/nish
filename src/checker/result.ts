/**
 * `Result<T, E>` and the rules that make an error impossible to ignore (WP16).
 *
 * The language has no exceptions and, since this work package, no `throw` either:
 * a function that can fail says so in its return type and hands the caller a
 * `Result<T, E>`. The three rules below are what "Rust-style" means here, and
 * each is a checker error rather than a lint:
 *
 *   1. **A `Result` cannot be dropped.** A call whose value is a `Result` may
 *      not stand as an expression statement, and a local that holds one must
 *      be read at least once. Nothing silently ignores a failure.
 *   2. **The error arm comes first.** `r.value` is only legal where the
 *      checker has proved `r.isOk()`, and `r.error` only where it has proved
 *      `r.isErr()`. There is no spelling that reaches the success payload
 *      without deciding what happens to the failure, so the success path
 *      cannot be written before the error path is handled.
 *   3. **Propagation is contagious.** `r.orReturn()` — the `?` of Rust — is
 *      only legal inside a function that itself returns a `Result` with a
 *      compatible error type. A function that propagates a callee's failure
 *      therefore has to admit it in its own signature.
 *
 * The surface is Rust's, in the spelling TypeScript already has — every line
 * below parses as TypeScript and type-checks against `runtime/amritc.d.ts`:
 *
 *   Result<T, E>       the type; `T` may be `void`, `E` may not
 *   Ok(v) / Ok()       the success value; takes its type from the context,
 *                      exactly as `null` does (WP6)
 *   Err(e)             the failure value, likewise
 *   r.isOk() / r.isErr()   the discriminant test, and what narrows `r`
 *   r.ok               the same bit as a plain boolean; `if (r.ok)` narrows
 *                      too, because a tagged union is how TypeScript itself
 *                      would spell this
 *   r.value            `T`, only where the checker proved `isOk()`
 *   r.error            `E`, only where it proved `isErr()`
 *   r.orReturn()       `T` when ok; otherwise returns `Err(r.error)` from the
 *                      enclosing function. This is Rust's `?`; TypeScript has
 *                      no postfix operator to spare, so it is a method
 *   r.unwrapOr(d)      `T` when ok, `d` otherwise
 *   r.expect(message)  `T` when ok; otherwise `message` on stderr and exit 1
 *
 * What is deliberately missing: Rust's `unwrap()` (`expect` says the same
 * thing and insists on a message), and `map` / `and_then` / `or_else`, which
 * need function values — forbidden here, because the whole-program
 * pass cannot prove purity, termination or escape through an unknown callee.
 * Narrowing plus `orReturn()` covers what those combinators are for.
 *
 * Representation in memory: one monomorphised `%struct.amrit_result.<T>.<E>`
 * per distinct pair of payload types, laid out exactly as `class` structs are,
 * and held by pointer. That is deliberate rather than a compromise — it means
 * a `Result` costs what a small object costs, the WP6 escape analysis turns
 * the ones that do not outlive their function into entry-block allocas, and
 * every existing pointer attribute (`align 8`, `nonnull`, `dereferenceable`)
 * stays true of it. The lowering is in `src/codegen/emit/result.ts`.
 *
 * At a call boundary a small one travels in a register instead (WP17). A
 * `Result` whose two payloads are each a scalar of at most four bytes is
 * returned *and* passed packed into one `i64`: the discriminant in bits 0..31,
 * the live arm's payload in bits 32..63, and the dead arm not represented at
 * all, which is what makes a twelve-byte struct fit in a word. `resultByValue`
 * in `../types` is the one place that decides and `llvmAbiType` is what the
 * emitter asks; everything wider keeps the pointer above, and so does a
 * `Result` stored in a field or an array element, because that one has to
 * outlive the frame which built it. The eight bytes are not a tuning knob:
 * `i64` is the only return width whose C-ABI lowering is the same LLVM type on
 * all six supported triples.
 *
 * That is also why a `Result` now crosses to a host. `--emit-header` declares
 * the packed word as a C struct with a static assertion on its size, so the
 * header is the declaration clang itself produces rather than a description of
 * one, and `--emit-dts` / `--emit-napi` hand JavaScript the tagged object it
 * already models. The measurements, and the two alternatives that were
 * rejected, are in `docs/wp17-result-abi.md`.
 */
import ts from "typescript";
import { CompileError } from "../diagnostics.js";
import {
  BOOL,
  ResultType,
  StaticType,
  alignOf,
  assignable,
  resultStructName,
  typeToString,
  withResultState,
} from "../types.js";
import { BuiltinCallChecker, checkArity } from "./builtins.js";
import { contextualType, sizeOf } from "./classes.js";
import { CheckContext } from "./context.js";
import { methodCallCheckers, propertyCheckers } from "./members.js";
import { Narrowings, conditionNarrowers } from "./narrowing.js";
import { FunctionSig, LocalVar } from "./program.js";
import { Scope } from "./scope.js";

// ---- Layout -------------------------------------------------------------------------

/** One field of a `Result` struct: its position in the LLVM body and its byte offset. */
export type ResultSlot = {
  index: number;
  offset: number;
  type: StaticType;
};

/**
 * The monomorphised struct behind one `Result<T, E>`. It is derived from the
 * type alone, never declared, so the checker and the emitter compute the same
 * layout without a registry entry to keep in sync — which also means an
 * imported signature mentioning a `Result` needs nothing brought across.
 *
 * `value` is absent for `Result<void, E>`: there is no payload to store, and
 * leaving the field out keeps that shape one word smaller.
 */
export type ResultLayout = {
  /** LLVM struct name without the `%struct.` prefix. */
  name: string;
  ok: ResultSlot;
  value?: ResultSlot;
  error: ResultSlot;
  size: number;
  align: number;
};

const layouts = new Map<string, ResultLayout>();

const roundUp = (n: number, align: number): number => Math.ceil(n / align) * align;

/** Lay `Result<T, E>` out exactly as clang lays out `struct { bool ok; T value; E error; }`. */
export const resultLayout = (t: StaticType): ResultLayout => {
  if (t.kind !== "result") throw new Error(`resultLayout: not a Result type (${t.kind})`);
  const name = resultStructName(t);
  const known = layouts.get(name);
  if (known) return known;
  let offset = 0;
  let align = 1;
  const slot = (type: StaticType, index: number): ResultSlot => {
    const a = alignOf(type);
    offset = roundUp(offset, a);
    const at = offset;
    offset += sizeOf(type);
    if (a > align) align = a;
    return { index, offset: at, type };
  };
  const ok = slot(BOOL, 0);
  const value = t.ok.kind === "void" ? undefined : slot(t.ok, 1);
  const error = slot(t.err, value ? 2 : 1);
  const layout: ResultLayout = { name, ok, value, error, size: roundUp(offset, align), align };
  layouts.set(name, layout);
  return layout;
};

/** Every `Result` type mentioned inside `t`, itself included, innermost first. */
export const resultTypesIn = (t: StaticType, out: StaticType[] = []): StaticType[] => {
  if (t.kind === "array") resultTypesIn(t.elem, out);
  else if (t.kind === "nullable") resultTypesIn(t.inner, out);
  else if (t.kind === "result") {
    resultTypesIn(t.ok, out);
    resultTypesIn(t.err, out);
    out.push(t);
  }
  return out;
};

// ---- `ok(...)` and `err(...)` -------------------------------------------------------

/** Named so a diagnostic can say which of the two the programmer wrote. */
type Arm = "Ok" | "Err";

/**
 * The `Result` type this `ok(...)` / `err(...)` is expected to produce. Like
 * the `null` literal (WP6) the constructors carry no type of their own: the
 * return type, the annotation, or the parameter they feed decides which
 * monomorphisation is built, which is what keeps `return ok(0)` readable.
 */
const resultContext = (ctx: CheckContext, expr: ts.CallExpression, scope: Scope, arm: Arm): ResultType => {
  const want = contextualType(ctx, expr, scope);
  if (!want) {
    throw ctx.error(
      `\`${arm}(...)\` needs a contextual \`Result<T, E>\` type (annotate the function's return type, e.g. \`function f(): Result<number, string>\`)`,
      expr
    );
  }
  if (want.kind !== "result") {
    throw ctx.error(`\`${arm}(...)\` is a \`Result<T, E>\`, not ${typeToString(want)}`, expr);
  }
  return want;
};

const checkOk: BuiltinCallChecker = (ctx, expr, scope) => {
  const want = resultContext(ctx, expr, scope, "Ok");
  if (want.ok.kind === "void") {
    checkArity(ctx, expr, "Ok", 0);
    return want;
  }
  checkArity(ctx, expr, "Ok", 1);
  const got = ctx.checkExpression(expr.arguments[0], scope);
  if (!assignable(got, want.ok)) {
    throw ctx.error(
      `\`Ok(...)\` expects ${typeToString(want.ok)} for ${typeToString(want)}, got ${typeToString(got)}`,
      expr.arguments[0]
    );
  }
  return want;
};

const checkErr: BuiltinCallChecker = (ctx, expr, scope) => {
  const want = resultContext(ctx, expr, scope, "Err");
  checkArity(ctx, expr, "Err", 1);
  const got = ctx.checkExpression(expr.arguments[0], scope);
  if (!assignable(got, want.err)) {
    throw ctx.error(
      `\`Err(...)\` expects ${typeToString(want.err)} for ${typeToString(want)}, got ${typeToString(got)}`,
      expr.arguments[0]
    );
  }
  return want;
};

/** Spread into `builtinFunctions`; a user function called `Ok` or `Err` shadows these. */
export const resultBuiltinFunctions: Record<string, BuiltinCallChecker> = {
  Ok: checkOk,
  Err: checkErr,
};

// ---- `r.ok` / `r.value` / `r.error` -------------------------------------------------

/** Which payload a diagnostic is about, and therefore which test proves it. */
type Payload = "value" | "error";

/**
 * How to get from an un-narrowed `Result` to the payload, phrased as the code
 * the programmer should write. The narrowing is keyed by local variable, so a
 * field or element holding a `Result` has to be bound first, exactly as a
 * nullable does.
 */
const narrowHint = (ctx: CheckContext, receiver: ts.Expression, payload: Payload): string => {
  const test = payload === "value" ? "isOk()" : "isErr()";
  if (!ts.isIdentifier(receiver)) {
    return `only a local is narrowed, so bind it first: \`const r = ${receiver.getText(ctx.sf)}; if (r.${test}) { ... r.${payload} ... }\``;
  }
  const r = receiver.text;
  return `test it first: \`if (${r}.${test}) { ... ${r}.${payload} ... }\``;
};

propertyCheckers.result = (ctx, expr, receiver) => {
  // The table is keyed by `receiver.kind`, which is the proof this cast needs.
  const result = receiver as ResultType;
  switch (expr.name.text) {
    case "ok":
      // The discriminant is readable anywhere, and `if (r.ok)` narrows exactly
      // as `if (r.isOk())` does: it is the same fact, and it is the spelling a
      // TypeScript reader expects of a tagged union.
      return BOOL;
    case "value":
      if (result.ok.kind === "void") {
        throw ctx.error(
          `\`${typeToString(result)}\` has no \`value\`: its success arm carries nothing`,
          expr.name
        );
      }
      if (result.state !== "ok") {
        throw ctx.error(
          `Cannot read \`value\` of \`${typeToString(result)}\` before the error is handled; ${narrowHint(ctx, expr.expression, "value")}`,
          expr.name
        );
      }
      return result.ok;
    case "error":
      if (result.state !== "err") {
        throw ctx.error(
          `Cannot read \`error\` of \`${typeToString(result)}\` here: it only holds an error where the call failed; ${narrowHint(ctx, expr.expression, "error")}`,
          expr.name
        );
      }
      return result.err;
    default:
      throw ctx.error(
        `Unknown property \`${expr.name.text}\` on ${typeToString(result)} (it has \`ok\`, \`value\` and \`error\`)`,
        expr.name
      );
  }
};

// ---- Methods ------------------------------------------------------------------------

/** `Result<void, E>` methods answer nothing, so they may only stand as a statement. */
const requireStatement = (
  ctx: CheckContext,
  expr: ts.CallExpression,
  method: string,
  receiver: StaticType
): void => {
  if (!ts.isExpressionStatement(expr.parent)) {
    throw ctx.error(
      `\`${method}()\` on ${typeToString(receiver)} produces no value and can only be used as a statement`,
      expr
    );
  }
};

/**
 * `r.orReturn()`: the propagation rule (3). The enclosing function has to
 * return a `Result` whose error arm accepts this one's, which is exactly the
 * contagion Rust's `?` enforces through `From<E>` — without the conversion,
 * because the language has no trait to hang one on.
 */
const checkOrReturn = (ctx: CheckContext, expr: ts.CallExpression, receiver: ResultType): StaticType => {
  checkArity(ctx, expr, "orReturn", 0);
  const want = ctx.current.returnType;
  if (want.kind !== "result") {
    throw ctx.error(
      `\`orReturn()\` propagates the error, so \`${ctx.current.sourceName}\` must return a \`Result<T, E>\` (it returns ${typeToString(want)}); handle it here instead: \`if (r.isErr()) { ... }\``,
      expr
    );
  }
  if (!assignable(receiver.err, want.err)) {
    throw ctx.error(
      `\`orReturn()\` would propagate ${typeToString(receiver.err)} but \`${ctx.current.sourceName}\` returns ${typeToString(want)}; convert the error first: \`if (r.isErr()) { return Err(...); }\``,
      expr
    );
  }
  if (receiver.ok.kind === "void") requireStatement(ctx, expr, "orReturn", receiver);
  return receiver.ok;
};

/** `r.unwrapOr(fallback)`: handle the failure by substituting a value of the same type. */
const checkUnwrapOr = (
  ctx: CheckContext,
  expr: ts.CallExpression,
  receiver: ResultType,
  scope: Scope
): StaticType => {
  checkArity(ctx, expr, "unwrapOr", 1);
  if (receiver.ok.kind === "void") {
    throw ctx.error(
      `\`unwrapOr(...)\` needs a success value to fall back to, and \`${typeToString(receiver)}\` has none; use \`if (r.isErr()) { ... }\``,
      expr
    );
  }
  const got = ctx.checkExpression(expr.arguments[0], scope);
  if (!assignable(got, receiver.ok)) {
    throw ctx.error(
      `\`unwrapOr(...)\` expects ${typeToString(receiver.ok)} to match ${typeToString(receiver)}, got ${typeToString(got)}`,
      expr.arguments[0]
    );
  }
  return receiver.ok;
};

/**
 * `r.expect(message)`: handle the failure by ending the process, the way an
 * unmet invariant should. It is the only unwrap here, and unlike Rust's
 * `unwrap()` it insists on a message, because a program that gives up should
 * say why. `message` is a plain string rather than a rendering of the error:
 * `E` is any type and the language has no way to format one, so a program that
 * wants the error in the text writes the branch out and calls
 * ``panic(`...${r.error}`)``.
 */
const checkExpect = (
  ctx: CheckContext,
  expr: ts.CallExpression,
  receiver: ResultType,
  scope: Scope
): StaticType => {
  checkArity(ctx, expr, "expect", 1);
  const got = ctx.checkExpression(expr.arguments[0], scope);
  if (got.kind !== "string") {
    throw ctx.error(`\`expect(...)\` expects string, got ${typeToString(got)}`, expr.arguments[0]);
  }
  if (receiver.ok.kind === "void") requireStatement(ctx, expr, "expect", receiver);
  return receiver.ok;
};

/** `r.isOk()` / `r.isErr()`: Rust's names for the discriminant test; both narrow. */
const checkDiscriminantTest = (ctx: CheckContext, expr: ts.CallExpression, name: string): StaticType => {
  checkArity(ctx, expr, name, 0);
  return BOOL;
};

methodCallCheckers.result = (ctx, expr, receiver, scope) => {
  const access = expr.expression as ts.PropertyAccessExpression;
  const result = receiver as ResultType; // the table key is the proof
  switch (access.name.text) {
    case "isOk":
    case "isErr":
      return checkDiscriminantTest(ctx, expr, access.name.text);
    case "orReturn":
      return checkOrReturn(ctx, expr, result);
    case "unwrapOr":
      return checkUnwrapOr(ctx, expr, result, scope);
    case "expect":
      return checkExpect(ctx, expr, result, scope);
    default:
      throw ctx.error(
        `Unknown method \`${access.name.text}\` on ${typeToString(result)} (it has \`isOk\`, \`isErr\`, \`orReturn\`, \`unwrapOr\` and \`expect\`)`,
        access.name
      );
  }
};

// ---- Narrowing ----------------------------------------------------------------------

/** The variable a discriminant test is about, when the test is one. */
const okTest = (
  cond: ts.Expression,
  scope: Scope
): { v: LocalVar; type: ResultType; positive: boolean } | undefined => {
  let receiver: ts.Expression;
  let positive: boolean;
  if (ts.isPropertyAccessExpression(cond) && cond.name.text === "ok") {
    receiver = cond.expression;
    positive = true;
  } else if (
    ts.isCallExpression(cond) &&
    cond.arguments.length === 0 &&
    ts.isPropertyAccessExpression(cond.expression) &&
    (cond.expression.name.text === "isOk" || cond.expression.name.text === "isErr")
  ) {
    receiver = cond.expression.expression;
    positive = cond.expression.name.text === "isOk";
  } else {
    return undefined;
  }
  if (!ts.isIdentifier(receiver)) return undefined;
  const v = scope.lookup(receiver.text);
  if (!v) return undefined;
  const type = scope.typeOf(v);
  return type.kind === "result" ? { v, type, positive } : undefined;
};

/**
 * The `Result` rule for the shared narrowing engine (`narrowing.ts`). All
 * three spellings — `r.ok`, `r.isOk()`, `r.isErr()` — prove the same one bit,
 * so they narrow through the same path and compose with `!`, `&&` and `||`
 * exactly as a null test does.
 */
const narrowOkTest = (cond: ts.Expression, scope: Scope): Narrowings | undefined => {
  const test = okTest(cond, scope);
  if (!test) return undefined;
  const whenOk = [{ v: test.v, type: withResultState(test.type, "ok") }];
  const whenErr = [{ v: test.v, type: withResultState(test.type, "err") }];
  return test.positive ? { whenTrue: whenOk, whenFalse: whenErr } : { whenTrue: whenErr, whenFalse: whenOk };
};

conditionNarrowers.push(narrowOkTest);

// ---- Rule 1: a `Result` cannot be dropped -------------------------------------------

/**
 * Called for every expression statement. A bare call that answers a `Result`
 * is the one shape where a failure would vanish without a trace, so it is the
 * shape this rule names.
 */
export const rejectDiscardedResult = (ctx: CheckContext, expr: ts.Expression, type: StaticType): void => {
  if (type.kind !== "result") return;
  throw ctx.error(
    `\`${typeToString(type)}\` must be handled, not discarded: bind it (\`const r = ${expr.getText(ctx.sf)}; if (r.isErr()) { ... }\`), propagate it with \`.orReturn()\`, or end on it with \`.expect(message)\``,
    expr
  );
};

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
export const checkResultLocalsHandled = (ctx: CheckContext, sig: FunctionSig): void => {
  const declarations: ts.VariableDeclaration[] = [];
  const read = new Set<LocalVar>();
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node)) declarations.push(node);
    else if (ts.isIdentifier(node)) {
      const v = ctx.program.bindings.get(node);
      const parent = node.parent;
      const assigned =
        ts.isBinaryExpression(parent) &&
        parent.left === node &&
        parent.operatorToken.kind === ts.SyntaxKind.EqualsToken;
      if (v && !assigned) read.add(v);
    }
    ts.forEachChild(node, visit);
  };
  visit(sig.decl.body!);
  for (const decl of declarations) {
    const v = ctx.program.locals.get(decl);
    if (!v || v.type.kind !== "result" || read.has(v)) continue;
    ctx.report(
      new CompileError(
        `\`${v.name}\` holds a \`${typeToString(v.type)}\` that is never inspected; test it with \`${v.name}.isErr()\`, or use \`.orReturn()\`, \`.unwrapOr(v)\` or \`.expect(message)\``,
        decl.name,
        ctx.sf
      )
    );
  }
};
