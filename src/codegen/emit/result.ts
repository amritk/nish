/**
 * `Result<T, E>` lowering (WP16), checked by `checker/result.ts`.
 *
 * Layout: `%struct.sts_result.<T>.<E> = type { i1, <T>, <E> }`, one
 * monomorphisation per pair of payload types, laid out and allocated exactly
 * as a class is. `Result<void, E>` has no `value` field at all.
 *
 *   Ok(v)            `%0 = call i8* @sts_alloc_struct(i64 <size>)`
 *                    `%1 = bitcast i8* %0 to %struct.sts_result.<T>.<E>*`
 *                    `store i1 true, ...` then the payload store. Under WP6,
 *                    a `Result` that does not outlive its function is an
 *                    entry-block `alloca` and there is no call at all.
 *   Err(e)           the same with `i1 false` and the error payload.
 *   r.ok / r.isOk()  gep + `load i1`; `r.isErr()` is that with an `xor`
 *   r.value          gep + `load <T>`; the checker only allows it where `ok`
 *   r.error          gep + `load <E>`; likewise where `!ok`
 *   r.orReturn()     `br i1` on the discriminant: the error arm builds this
 *                    function's own `Err(...)`, releases the arena scope and
 *                    `ret`s it; the ok arm loads the payload and carries on,
 *                    so the expression's value is that load.
 *   r.unwrapOr(d)    `br i1`, the two arms meet in a `phi`. `d` is evaluated
 *                    only on the error arm.
 *   r.expect(m)      `br i1`; the error arm writes `m` to stderr and exits 1,
 *                    the same ending `panic(m)` has, then `unreachable`.
 *
 * The unused arm of a fresh `Result` is deliberately left uninitialised: the
 * checker proves no path can read it, and zeroing it would cost a store on
 * every construction to make a value nobody may observe.
 *
 * `collectResultFacts` reports what all of this does to memory (a payload
 * read, the allocator call, the stores), because `attributes.ts` may only
 * emit `readnone` / `readonly` on a function whose every construct reported.
 */
import ts from "typescript";
import { CheckedProgram } from "../../checker";
import { ResultLayout, ResultSlot, resultLayout, resultTypesIn } from "../../checker/result";
import { ResultType, StaticType, llvmType } from "../../types";
import { BuiltinCall } from "./builtins";
import { EmitContext } from "./context";
import { MemoryFacts, factCollectors, isStackOwned, methodCallEmitters, propertyEmitters } from "./members";

// ---- Types and addresses ------------------------------------------------------------

const typeName = (layout: ResultLayout): string => `%struct.${layout.name}`;

/** `%struct.sts_result.i32.str = type { i1, i32, i8* }`. */
export const resultTypeDecl = (t: StaticType): string => {
  const layout = resultLayout(t);
  const slots = [layout.ok, layout.value, layout.error].filter((s): s is ResultSlot => s !== undefined);
  return `${typeName(layout)} = type { ${slots.map((s) => llvmType(s.type)).join(", ")} }`;
};

/**
 * Make sure every `Result` struct mentioned by `t` is declared in this module.
 * Called from every site that can introduce one — a construction, a member
 * access, a signature — because a `Result` layout is derived from the type
 * rather than declared, so nothing else would put it in the module header.
 */
export const declareResultTypes = (ctx: EmitContext, t: StaticType): void => {
  for (const result of resultTypesIn(t)) ctx.declareType(resultTypeDecl(result));
};

const slotPointer = (ctx: EmitContext, layout: ResultLayout, receiver: string, slot: ResultSlot): string => {
  const ty = typeName(layout);
  return ctx.fn.emitValue(`getelementptr inbounds ${ty}, ${ty}* ${receiver}, i32 0, i32 ${slot.index}`);
};

const loadSlot = (ctx: EmitContext, layout: ResultLayout, receiver: string, slot: ResultSlot): string => {
  const ty = llvmType(slot.type);
  const ptr = slotPointer(ctx, layout, receiver, slot);
  return ctx.fn.emitValue(`load ${ty}, ${ty}* ${ptr}${ctx.alignSuffix(slot.type)}`);
};

const storeSlot = (
  ctx: EmitContext,
  layout: ResultLayout,
  receiver: string,
  slot: ResultSlot,
  value: string
): void => {
  const ty = llvmType(slot.type);
  const ptr = slotPointer(ctx, layout, receiver, slot);
  ctx.fn.emit(`store ${ty} ${value}, ${ty}* ${ptr}${ctx.alignSuffix(slot.type)}`);
};

/**
 * Storage for one `Result`: an entry-block alloca when WP6 proved this site
 * does not outlive the function, else an arena bump. `site` is undefined for
 * the `Result` that `orReturn` builds, which is returned by construction and
 * therefore always arena memory.
 */
const allocate = (ctx: EmitContext, layout: ResultLayout, site?: ts.Node): string => {
  const ty = typeName(layout);
  if (site && ctx.isStackSite(site)) return ctx.fn.emitAlloca(`${layout.name}.obj`, ty, 8);
  const raw = ctx.fn.emitValue(`call i8* ${ctx.useRuntime("sts_alloc_struct")}(i64 ${layout.size})`);
  return ctx.fn.emitValue(`bitcast i8* ${raw} to ${ty}*`);
};

// ---- `ok(...)` and `err(...)` -------------------------------------------------------

const construct = (
  ctx: EmitContext,
  type: ResultType,
  isOk: boolean,
  payload: string | undefined,
  site?: ts.Node
): string => {
  declareResultTypes(ctx, type);
  const layout = resultLayout(type);
  const object = allocate(ctx, layout, site);
  storeSlot(ctx, layout, object, layout.ok, isOk ? "true" : "false");
  if (payload !== undefined) {
    storeSlot(ctx, layout, object, isOk ? layout.value! : layout.error, payload);
  }
  return object;
};

const resultConstructor = (isOk: boolean): BuiltinCall => {
  return {
    emit: (ctx, expr) => {
      const type = ctx.typeOf(expr) as ResultType;
      // `Ok()` on a `Result<void, E>` carries nothing; the checker enforced the arity.
      const payload = expr.arguments.length > 0 ? ctx.emitExpression(expr.arguments[0]) : undefined;
      return construct(ctx, type, isOk, payload, expr);
    },
    // The allocator call is reported by `collectResultFacts`, which knows
    // whether WP6 turned this site into an alloca; reporting it here too
    // would claim one on a stack site.
    callees: () => [],
  };
};

/** Spread into `builtinFunctionEmitters`; mirrors `resultBuiltinFunctions` in the checker. */
export const resultFunctionEmitters: Record<string, BuiltinCall> = {
  Ok: resultConstructor(true),
  Err: resultConstructor(false),
};

// ---- `r.ok` / `r.value` / `r.error` -------------------------------------------------

propertyEmitters.result = (ctx, expr, receiver) => {
  const type = receiver as ResultType;
  declareResultTypes(ctx, type);
  const layout = resultLayout(type);
  const object = ctx.emitExpression(expr.expression);
  switch (expr.name.text) {
    case "ok":
      return loadSlot(ctx, layout, object, layout.ok);
    case "value":
      // biome-ignore lint/style/noNonNullAssertion: the checker rejects `.value` on a `Result<void, E>`
      return loadSlot(ctx, layout, object, layout.value!);
    default:
      return loadSlot(ctx, layout, object, layout.error);
  }
};

// ---- `orReturn` / `unwrapOr` / `expect` ---------------------------------------------

/** Load the discriminant and branch; returns the two blocks, ok first. */
const branchOnOk = (ctx: EmitContext, layout: ResultLayout, object: string, errLabel: string) => {
  const okBlock = ctx.fn.newBlock("res.ok");
  const errBlock = ctx.fn.newBlock(errLabel);
  const flag = loadSlot(ctx, layout, object, layout.ok);
  ctx.fn.emit(`br i1 ${flag}, label %${okBlock.label}, label %${errBlock.label}`);
  return { okBlock, errBlock };
};

/**
 * `r.orReturn()`: Rust's `?`. The error arm is an early `return err(r.error)`
 * of *this* function's `Result` type, so the payload is copied into a fresh
 * object rather than the callee's being handed on — the two monomorphisations
 * are different structs even when the error types agree.
 */
const emitOrReturn = (ctx: EmitContext, expr: ts.CallExpression, receiver: ResultType): string => {
  const returnType = ctx.currentSig.returnType as ResultType;
  declareResultTypes(ctx, receiver);
  declareResultTypes(ctx, returnType);
  const layout = resultLayout(receiver);
  const access = expr.expression as ts.PropertyAccessExpression;
  const object = ctx.emitExpression(access.expression);
  const { okBlock, errBlock } = branchOnOk(ctx, layout, object, "res.propagate");

  ctx.fn.placeBlock(errBlock);
  const error = loadSlot(ctx, layout, object, layout.error);
  const propagated = construct(ctx, returnType, false, error);
  ctx.emitScopeExit();
  ctx.fn.emit(`ret ${llvmType(returnType)} ${propagated}`);

  ctx.fn.placeBlock(okBlock);
  return layout.value ? loadSlot(ctx, layout, object, layout.value) : "void";
};

/** `r.unwrapOr(d)`: the fallback is evaluated only where it is needed. */
const emitUnwrapOr = (ctx: EmitContext, expr: ts.CallExpression, receiver: ResultType): string => {
  declareResultTypes(ctx, receiver);
  const layout = resultLayout(receiver);
  const access = expr.expression as ts.PropertyAccessExpression;
  const object = ctx.emitExpression(access.expression);
  const endBlock = ctx.fn.newBlock("res.end");
  const { okBlock, errBlock } = branchOnOk(ctx, layout, object, "res.alt");

  ctx.fn.placeBlock(okBlock);
  // biome-ignore lint/style/noNonNullAssertion: the checker rejects `unwrapOr` on a `Result<void, E>`
  const value = loadSlot(ctx, layout, object, layout.value!);
  const okEdge = ctx.fn.currentBlock.label;
  ctx.fn.emit(`br label %${endBlock.label}`);

  ctx.fn.placeBlock(errBlock);
  const fallback = ctx.emitExpression(expr.arguments[0]);
  const errEdge = ctx.fn.currentBlock.label;
  ctx.fn.emit(`br label %${endBlock.label}`);

  ctx.fn.placeBlock(endBlock);
  return ctx.fn.emitValue(
    `phi ${llvmType(receiver.ok)} [ ${value}, %${okEdge} ], [ ${fallback}, %${errEdge} ]`
  );
};

/**
 * `r.expect(message)`: the message on stderr and exit 1, the same ending
 * `panic(message)` and an out-of-range index have. `sts_exit` is `noreturn`,
 * which is what makes the `unreachable` legal.
 */
const emitExpect = (ctx: EmitContext, expr: ts.CallExpression, receiver: ResultType): string => {
  declareResultTypes(ctx, receiver);
  const layout = resultLayout(receiver);
  const access = expr.expression as ts.PropertyAccessExpression;
  const object = ctx.emitExpression(access.expression);
  const { okBlock, errBlock } = branchOnOk(ctx, layout, object, "res.panic");

  ctx.fn.placeBlock(errBlock);
  const message = ctx.emitExpression(expr.arguments[0]);
  ctx.fn.emit(`call void ${ctx.useRuntime("sts_write")}(i8* ${message}, i32 2, i1 true)`);
  ctx.fn.emit(`call void ${ctx.useRuntime("sts_exit")}(i32 1)`);
  ctx.fn.emit("unreachable");

  ctx.fn.placeBlock(okBlock);
  return layout.value ? loadSlot(ctx, layout, object, layout.value) : "void";
};

/** `r.isOk()` / `r.isErr()`: the discriminant, inverted for `isErr`. */
const emitDiscriminantTest = (
  ctx: EmitContext,
  expr: ts.CallExpression,
  receiver: ResultType,
  positive: boolean
): string => {
  declareResultTypes(ctx, receiver);
  const layout = resultLayout(receiver);
  const access = expr.expression as ts.PropertyAccessExpression;
  const flag = loadSlot(ctx, layout, ctx.emitExpression(access.expression), layout.ok);
  return positive ? flag : ctx.fn.emitValue(`xor i1 ${flag}, true`);
};

methodCallEmitters.result = (ctx, expr, receiver) => {
  const result = receiver as ResultType;
  const name = (expr.expression as ts.PropertyAccessExpression).name.text;
  if (name === "isOk" || name === "isErr") return emitDiscriminantTest(ctx, expr, result, name === "isOk");
  if (name === "orReturn") return emitOrReturn(ctx, expr, result);
  if (name === "unwrapOr") return emitUnwrapOr(ctx, expr, result);
  return emitExpect(ctx, expr, result);
};

// ---- Facts for attributes.ts --------------------------------------------------------

const RESULT_METHODS = new Set(["isOk", "isErr", "orReturn", "unwrapOr", "expect"]);

/**
 * The `Result` method a call invokes, or undefined for anything else. Shared
 * with `attributes.ts` and `escape.ts`, which have to know that `orReturn`
 * returns memory and that these receivers are only read.
 */
export const resultMethodName = (program: CheckedProgram, call: ts.CallExpression): string | undefined => {
  if (!ts.isPropertyAccessExpression(call.expression)) return undefined;
  if (program.types.get(call.expression.expression)?.kind !== "result") return undefined;
  const name = call.expression.name.text;
  return RESULT_METHODS.has(name) ? name : undefined;
};

/**
 * True for the builtin `ok(...)` / `err(...)`. Both *store* their argument
 * into the object they build, so a pointer passed to one escapes exactly as
 * one pushed onto an array does.
 */
export const isResultConstructorCall = (program: CheckedProgram, call: ts.CallExpression): boolean => {
  if (!ts.isIdentifier(call.expression) || program.callees.has(call)) return false;
  if (call.expression.text !== "Ok" && call.expression.text !== "Err") return false;
  return program.types.get(call)?.kind === "result";
};

/**
 * Memory facts for the constructs above:
 *   ok / err            write, calls the inline allocator (unless it is a stack site)
 *   r.ok / value / error read
 *   orReturn            read plus the allocation of the propagated Result
 *   unwrapOr / expect   read; `expect` also calls the two runtime symbols
 */
export const collectResultFacts = (program: CheckedProgram, node: ts.Node, facts: MemoryFacts): void => {
  if (ts.isCallExpression(node)) {
    if (ts.isPropertyAccessExpression(node.expression)) {
      const method = resultMethodName(program, node);
      if (method === undefined) return;
      if (isStackOwned(program, facts, node.expression.expression)) return; // own alloca (WP6)
      facts.readsMemory = true;
      if (method === "orReturn") {
        facts.effect = "write";
        facts.callees.add("sts_alloc_struct");
      } else if (method === "expect") {
        facts.callees.add("sts_write");
        facts.callees.add("sts_exit");
      }
      return;
    }
    // `ok(...)` / `err(...)`: a user function of that name is in `callees` and
    // is reported through the call graph instead.
    if (!isResultConstructorCall(program, node)) return;
    if (!facts.stackSites.has(node)) {
      facts.callees.add("sts_alloc_struct");
    }
    facts.effect = "write";
    return;
  }
  if (ts.isPropertyAccessExpression(node) && program.types.get(node.expression)?.kind === "result") {
    if (ts.isCallExpression(node.parent) && node.parent.expression === node) return; // the method call above
    if (isStackOwned(program, facts, node.expression)) return; // own alloca (WP6)
    facts.readsMemory = true;
  }
};

factCollectors.push(collectResultFacts);
