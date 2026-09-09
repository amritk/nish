/**
 * `Result<T, E>` lowering (WP16), checked by `checker/result.ts`.
 *
 * Layout: `%struct.amrit_result.<T>.<E> = type { i1, <T>, <E> }`, one
 * monomorphisation per pair of payload types, laid out and allocated exactly
 * as a class is. `Result<void, E>` has no `value` field at all.
 *
 *   Ok(v)            `%0 = call i8* @amrit_alloc_struct(i64 <size>)`
 *                    `%1 = bitcast i8* %0 to %struct.amrit_result.<T>.<E>*`
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
 *
 * WP17 adds one thing and changes nothing else: a `Result` whose two payloads
 * are each a scalar of at most four bytes is *returned in a register*, packed
 * into an `i64` (`resultByValue` in `types.ts`; the reasoning and the measured
 * assembly are in `docs/wp17-result-abi.md`). The packed word exists only at
 * the return boundary —
 *
 *   callee   `pack*` where it would have allocated, then `ret i64`
 *   caller   `%w = call i64 @f(...)`, then `unpackResult` into the entry-block
 *            object every construct above already reads
 *
 * — so the in-memory layout, the narrowing, the payload accessors and the
 * escape analysis are WP16's, unchanged. The caller's object is an ordinary
 * allocation site of the caller, which is what keeps it an `alloca` that SROA
 * folds away with the shifts once the call is inlined.
 */
import ts from "typescript";
import { CheckedProgram } from "../../checker/index.js";
import { ResultLayout, ResultSlot, resultLayout, resultTypesIn } from "../../checker/result.js";
import {
  RESULT_PAIR,
  RESULT_PAYLOAD_SHIFT,
  ResultType,
  StaticType,
  llvmType,
  resultByValue,
} from "../../types.js";
import { BuiltinCall } from "./builtins.js";
import { EmitContext } from "./context.js";
import { MemoryFacts, factCollectors, isStackOwned, methodCallEmitters, propertyEmitters } from "./members.js";

// ---- Types and addresses ------------------------------------------------------------

const typeName = (layout: ResultLayout): string => `%struct.${layout.name}`;

/** `%struct.amrit_result.i32.str = type { i1, i32, i8* }`. */
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
const allocateIn = (ctx: EmitContext, layout: ResultLayout, stack: boolean): string => {
  const ty = typeName(layout);
  if (stack) return ctx.fn.emitAlloca(`${layout.name}.obj`, ty, 8);
  const raw = ctx.fn.emitValue(`call i8* ${ctx.useRuntime("amrit_alloc_struct")}(i64 ${layout.size})`);
  return ctx.fn.emitValue(`bitcast i8* ${raw} to ${ty}*`);
};

const allocate = (ctx: EmitContext, layout: ResultLayout, site?: ts.Node): string =>
  allocateIn(ctx, layout, site !== undefined && ctx.isStackSite(site));

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

// ---- The packed by-value word (WP17) ------------------------------------------------

/**
 * Widen one payload to the high half of the word. `f32` goes through a
 * bitcast rather than a conversion: the word carries the bits the caller
 * stored, not a number the ABI is free to round.
 *
 * The word is assembled with `shl`/`or` rather than coerced through a
 * two-word alloca the way clang lowers an eight-byte struct return. Both were
 * measured on `bench/result` and `llc` produces the same instructions from
 * either, so the shorter IR wins (`docs/wp17-result-abi.md` §4).
 */
const payloadToWord = (ctx: EmitContext, type: StaticType, value: string): string => {
  if (type.kind === "void") return "0";
  const bits = type.kind === "f32" ? ctx.fn.emitValue(`bitcast float ${value} to i32`) : value;
  const from = type.kind === "f32" ? "i32" : llvmType(type);
  return from === "i64" ? bits : ctx.fn.emitValue(`zext ${from} ${bits} to i64`);
};

/** The inverse: the low bits of the high half, read back as the payload type. */
const wordToPayload = (ctx: EmitContext, type: StaticType, high: string): string => {
  const to = type.kind === "f32" ? "i32" : llvmType(type);
  const bits = to === "i64" ? high : ctx.fn.emitValue(`trunc i64 ${high} to ${to}`);
  return type.kind === "f32" ? ctx.fn.emitValue(`bitcast i32 ${bits} to float`) : bits;
};

/**
 * The word for an arm that is being built here and now — `return Ok(v)` and
 * the `Err(...)` `orReturn()` propagates. No object is constructed at all,
 * which is the whole point: the ok path of a small `Result` costs a shift.
 *
 * The tag is the low half, so `Err(e)` needs no `or` (its tag is zero) and
 * `Ok()` on a `Result<void, E>` is the constant `1`.
 */
const packArm = (
  ctx: EmitContext,
  type: ResultType,
  isOk: boolean,
  payload: string | undefined
): string => {
  const payloadType = isOk ? type.ok : type.err;
  if (payload === undefined || payloadType.kind === "void") return isOk ? "1" : "0";
  const wide = payloadToWord(ctx, payloadType, payload);
  const shifted = ctx.fn.emitValue(`shl i64 ${wide}, ${RESULT_PAYLOAD_SHIFT}`);
  return isOk ? ctx.fn.emitValue(`or i64 ${shifted}, 1`) : shifted;
};

/**
 * The word for a `Result` that already exists in memory — `return r` where
 * `r` is a variable. Both arms are loaded and a `select` keeps the live one:
 * the dead arm is `undef` in an alloca and a stale byte in the arena, and
 * `select` discards it either way, which is cheaper than a branch.
 */
const packObject = (ctx: EmitContext, type: ResultType, object: string): string => {
  const layout = resultLayout(type);
  const ok = loadSlot(ctx, layout, object, layout.ok);
  const error = payloadToWord(ctx, layout.error.type, loadSlot(ctx, layout, object, layout.error));
  let payload = error;
  if (layout.value) {
    const value = payloadToWord(ctx, layout.value.type, loadSlot(ctx, layout, object, layout.value));
    payload = ctx.fn.emitValue(`select i1 ${ok}, i64 ${value}, i64 ${error}`);
  }
  const shifted = ctx.fn.emitValue(`shl i64 ${payload}, ${RESULT_PAYLOAD_SHIFT}`);
  const tag = ctx.fn.emitValue(`zext i1 ${ok} to i64`);
  return ctx.fn.emitValue(`or i64 ${shifted}, ${tag}`);
};

/**
 * The word to hand across a call boundary — what a `Result`-returning
 * function `ret`s, and what a by-value `Result` argument is passed as. A
 * construction is packed without ever being built (`packArm`); anything else
 * is emitted as WP16's pointer and read back out of it. At a `return` this
 * runs before the arena scope is released, because the object it may be read
 * out of is arena memory the release reclaims.
 */
export const emitPackedResult = (ctx: EmitContext, expr: ts.Expression, type: ResultType): string => {
  declareResultTypes(ctx, type);
  const arm = constructedArm(ctx.program, expr);
  if (arm !== undefined) {
    const call = expr as ts.CallExpression;
    const payload = call.arguments.length > 0 ? ctx.emitExpression(call.arguments[0]) : undefined;
    return packArm(ctx, type, arm === "Ok", payload);
  }
  return packObject(ctx, type, ctx.emitExpression(expr));
};

/** `Ok` / `Err` when `expr` is one of them written out here, else undefined. */
const constructedArm = (program: CheckedProgram, expr: ts.Expression): string | undefined => {
  if (!ts.isCallExpression(expr) || !isResultConstructorCall(program, expr)) return undefined;
  return (expr.expression as ts.Identifier).text;
};

/**
 * The caller's half: materialise the word as the object every other construct
 * reads. `site` is the call, which the escape analysis records as an ordinary
 * allocation site of the *caller* — so this is an entry-block `alloca` unless
 * the `Result` is handed on to something that keeps the pointer, and SROA
 * folds the alloca, the stores and the shifts away once the call is inlined.
 *
 * Both payload slots get the same bits. Only the arm the discriminant selects
 * may be read (the checker proves it), so the copy in the dead slot is never
 * observed, and writing it unconditionally costs less than a branch.
 *
 * The same function serves a `Result` *parameter* (WP17): the word arrives in
 * a register and the callee builds the object once, in its prologue, with
 * `stack` from `EscapeResult.stackParams` rather than from a call site.
 */
export const unpackResult = (
  ctx: EmitContext,
  type: ResultType,
  word: string,
  stack: boolean
): string => {
  declareResultTypes(ctx, type);
  const layout = resultLayout(type);
  const object = allocateIn(ctx, layout, stack);
  const ok = ctx.fn.emitValue(`trunc i64 ${word} to i1`);
  storeSlot(ctx, layout, object, layout.ok, ok);
  const high = ctx.fn.emitValue(`lshr i64 ${word}, ${RESULT_PAYLOAD_SHIFT}`);
  let value: string | undefined;
  if (layout.value) {
    value = wordToPayload(ctx, layout.value.type, high);
    storeSlot(ctx, layout, object, layout.value, value);
  }
  // The two arms share the narrowing when they narrow to the same LLVM type,
  // which is the common `Result<i32, i32>` shape.
  const sameShape = layout.value !== undefined && llvmType(layout.value.type) === llvmType(layout.error.type);
  storeSlot(ctx, layout, object, layout.error, sameShape ? value! : wordToPayload(ctx, layout.error.type, high));
  return object;
};

// ---- The private two-scalar ABI (WP15) ----------------------------------------------

/**
 * Whether `sig` may use the private `{ i1, i32 }` ABI for a by-value `Result`
 * rather than the packed word. The condition is exactly the one that decides
 * `internal` linkage in `emitter.ts`, and it has to stay that way: the private
 * shape is only safe because no host can name the symbol. `--no-strict-exports`
 * makes every function external and so turns this off everywhere.
 *
 * An imported function is always exported by definition — a module cannot
 * import what its exporter kept internal — so a cross-module call is packed,
 * which is what makes the two modules agree without consulting each other.
 */
export const privateResultAbi = (ctx: EmitContext, sig: { exported: boolean }): boolean =>
  ctx.opts.strictExports && !sig.exported;

/**
 * Split the packed word into the pair, at a boundary that uses the private
 * ABI. The word is still built exactly as the packed ABI builds it and taken
 * apart again here, which reads like waste and is not: LLVM folds the round
 * trip away entirely, and the two spellings measure the same (464 ms against
 * 467 ms for a hand-written two-scalar lowering of `bench/result`). Keeping
 * the packing in one place is worth more than the instructions it appears to
 * cost, so `packArm`, `packObject` and `unpackResult` stay the packed ABI's.
 */
export const resultWordToPair = (ctx: EmitContext, word: string): string => {
  const tag = ctx.fn.emitValue(`trunc i64 ${word} to i1`);
  const high = ctx.fn.emitValue(`lshr i64 ${word}, ${RESULT_PAYLOAD_SHIFT}`);
  const payload = ctx.fn.emitValue(`trunc i64 ${high} to i32`);
  const withTag = ctx.fn.emitValue(`insertvalue ${RESULT_PAIR} undef, i1 ${tag}, 0`);
  return ctx.fn.emitValue(`insertvalue ${RESULT_PAIR} ${withTag}, i32 ${payload}, 1`);
};

/** The inverse, on the other side of the same boundary. */
export const resultPairToWord = (ctx: EmitContext, pair: string): string => {
  const tag = ctx.fn.emitValue(`extractvalue ${RESULT_PAIR} ${pair}, 0`);
  const payload = ctx.fn.emitValue(`extractvalue ${RESULT_PAIR} ${pair}, 1`);
  const wide = ctx.fn.emitValue(`zext i32 ${payload} to i64`);
  const shifted = ctx.fn.emitValue(`shl i64 ${wide}, ${RESULT_PAYLOAD_SHIFT}`);
  const low = ctx.fn.emitValue(`zext i1 ${tag} to i64`);
  return ctx.fn.emitValue(`or i64 ${shifted}, ${low}`);
};

/**
 * A by-value `Result` argument, in whichever ABI the *callee* uses. The value
 * handed in is always the packed word, so this is where it becomes the pair.
 */
export const emitResultArgument = (
  ctx: EmitContext,
  want: StaticType,
  value: string,
  privateAbi: boolean
): string => (privateAbi && resultByValue(want) ? resultWordToPair(ctx, value) : value);

/** `ret` a by-value `Result`, in whichever ABI the enclosing function uses. */
export const emitResultReturn = (ctx: EmitContext, word: string): void => {
  if (!privateResultAbi(ctx, ctx.currentSig)) {
    ctx.fn.emit(`ret i64 ${word}`);
    return;
  }
  ctx.fn.emit(`ret ${RESULT_PAIR} ${resultWordToPair(ctx, word)}`);
};

/**
 * Wrap a call that answers a by-value `Result`: the call itself, then the
 * unpack. `emitCall` hands the finished `call` text in, because who builds the
 * operand list differs between a plain call and a method call.
 */
export const emitResultReturningCall = (
  ctx: EmitContext,
  call: string,
  type: StaticType,
  site: ts.Node,
  privateAbi = false
): string => {
  const returned = ctx.fn.emitValue(call);
  const word = privateAbi ? resultPairToWord(ctx, returned) : returned;
  return unpackResult(ctx, type as ResultType, word, ctx.isStackSite(site));
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
 * `r.orReturn()`: Rust's `?`. The error arm is an early `return Err(r.error)`
 * of *this* function's `Result` type, so the payload is copied into a fresh
 * object rather than the callee's being handed on — the two monomorphisations
 * are different structs even when the error types agree. When this function
 * returns by value (WP17) there is no object at all: the propagated error is
 * packed into the word and `ret`urned, so propagation costs a shift.
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
  if (resultByValue(returnType)) {
    const word = packArm(ctx, returnType, false, error);
    ctx.emitScopeExit();
    emitResultReturn(ctx, word);
  } else {
    const propagated = construct(ctx, returnType, false, error);
    ctx.emitScopeExit();
    ctx.fn.emit(`ret ${llvmType(returnType)} ${propagated}`);
  }

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
 * `panic(message)` and an out-of-range index have. `amrit_exit` is `noreturn`,
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
  ctx.fn.emit(`call void ${ctx.useRuntime("amrit_write")}(i8* ${message}, i32 2, i1 true)`);
  ctx.fn.emit(`call void ${ctx.useRuntime("amrit_exit")}(i32 1)`);
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
    // WP17: a call that answers a `Result` in a register hands back no memory,
    // so the *caller* builds the object the rest of the lowering reads. That is
    // an allocation of this function — an own alloca when the escape analysis
    // says so, an arena bump otherwise — and the allocator call has to be
    // reported here, because the callee no longer makes it.
    const callee = program.callees.get(node);
    if (callee !== undefined) {
      if (resultByValue(callee.returnType)) {
        if (!facts.stackSites.has(node)) facts.callees.add("amrit_alloc_struct");
        facts.effect = "write";
      }
      return;
    }
    if (ts.isPropertyAccessExpression(node.expression)) {
      const method = resultMethodName(program, node);
      if (method === undefined) return;
      if (isStackOwned(program, facts, node.expression.expression)) return; // own alloca (WP6)
      facts.readsMemory = true;
      if (method === "orReturn") {
        facts.effect = "write";
        facts.callees.add("amrit_alloc_struct");
      } else if (method === "expect") {
        facts.callees.add("amrit_write");
        facts.callees.add("amrit_exit");
      }
      return;
    }
    // `ok(...)` / `err(...)`: a user function of that name is in `callees` and
    // is reported through the call graph instead.
    if (!isResultConstructorCall(program, node)) return;
    if (!facts.stackSites.has(node)) {
      facts.callees.add("amrit_alloc_struct");
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
