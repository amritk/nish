// WP29 P1: a `parallelMapInto` or `parallelReduce` instance, lowered onto the
// partitioner (docs/wp29-thread-surface.md §4.1, runtime/runtime_parallel.c).
//
// The instance is emitted from its own body, as any instantiation is, so the
// length check and its panic, the reduce's block count and the in-order
// combine are `std/threads.ts`'s code and not this file's. One call is
// different: the one to the chunk loop that walks the whole range —
// `mapRange(src, dst, f, 0, n)` in a map, `reduceBlocks(src, f, identity,
// partials, 0, blocks)` in a reduce. It becomes a region:
//
//   %par.ctx = alloca { <every argument but the range> }   ; in the entry block
//   store ... into each field
//   call void @nish_parallel_range(@<instance>$chunk, i8* <ctx>, i64 <hi>, i64 <grain>)
//
// and `@<instance>$chunk(lo, hi, ctx)` loads the arguments back and calls the
// chunk loop over `[lo, hi)`. That loop is an ordinary instance of a private
// template, with its bounds proofs and TBAA, and the partitioner runs it once
// per contiguous chunk, chunk 0 on the calling thread. What each thread may do
// inside it was settled at the call (`self/parallel.ts`), and every fact the
// fixpoint holds about the instance counts the region (`markParallelEntry` in
// `self/attributes.ts`).
//
// The context is on the caller's stack, which is sound because
// `nish_parallel_range` joins every thread before it returns; a worker only
// ever reads it. The trampoline has no `-g` subprogram: it is not in the
// source, and a function without one may call one that has one.

import { Emitter } from "./emit";
import { internalErrorFor } from "./ice";
import { IRFunction, IRParam } from "./ir";
import { isParallelEntry, parallelRoleOf } from "./parallel";
import { FunctionSig, PAR_CHUNK, PAR_MAP } from "./program";

/**
 * Elements per chunk of a map region: 2^20, about a millisecond of simple
 * work, which is what a region has to carry before the ~125 µs of dividing it
 * four ways is under a tenth of its cost (docs/wp20-threads.md §8e). A map
 * over fewer elements than twice this is one chunk, and runs on the calling
 * thread as the loop it would have been.
 *
 * A reduce divides blocks, not elements, and a block is already about this
 * many (`BLOCK` in `std/threads.ts`), so its grain is one block.
 */
export const GRAIN: i32 = 1048576;

/** Whether the call from `caller` to `callee` is the one that becomes a region. */
export const isParallelRegionCall = (caller: FunctionSig | null, callee: FunctionSig): boolean =>
  caller !== null && isParallelEntry(caller) && parallelRoleOf(callee) === PAR_CHUNK;

/**
 * The region in place of `chunk(args..., 0, hi)`: `types` and `values` are the
 * lowered arguments, the range last. The start is always the literal `0` —
 * `std/threads.ts` writes it, and a region covers `[0, len)` — so anything else
 * is a broken invariant, not a program to compile.
 */
export const emitParallelRegion = (emitter: Emitter, chunk: FunctionSig, types: string[], values: string[]): void => {
  const caller = emitter.currentSig;
  if (caller === null) {
    process.exit(internalErrorFor(`emitter: \`${chunk.name}\` called outside a function`, emitter.opts.json));
  }
  const count = types.length;
  if (
    count < 2 ||
    values.length !== count ||
    values[count - 2] !== "0" ||
    types[count - 2] !== "i32" ||
    types[count - 1] !== "i32"
  ) {
    process.exit(internalErrorFor(`emitter: \`${chunk.name}\` is not a chunk loop over [0, n)`, emitter.opts.json));
  }
  const fieldTypes: string[] = [];
  let i = 0;
  while (i < count - 2) {
    fieldTypes.push(types[i]);
    i = i + 1;
  }
  const ctxType = `{ ${fieldTypes.join(", ")} }`;
  const fn = emitter.fn;
  const slot = fn.emitAlloca("par.ctx", ctxType, emitter.opts.optimizeAttributes ? 8 : 0);
  i = 0;
  while (i < fieldTypes.length) {
    const at = fn.emitValue(`getelementptr inbounds ${ctxType}, ${ctxType}* ${slot}, i32 0, i32 ${i}`);
    fn.emit(`store ${fieldTypes[i]} ${values[i]}, ${fieldTypes[i]}* ${at}`);
    i = i + 1;
  }
  const raw = fn.emitValue(`bitcast ${ctxType}* ${slot} to i8*`);
  const len = fn.emitValue(`sext i32 ${values[count - 1]} to i64`);
  const grain = parallelRoleOf(caller) === PAR_MAP ? GRAIN : 1;
  const trampoline = `${caller.name}$chunk`;
  fn.emit(
    `call void ${emitter.useRuntime("nish_parallel_range")}(void (i64, i64, i8*)* @${trampoline}, i8* ${raw}, i64 ${len}, i64 ${grain})`
  );
  emitter.module.addFunction(chunkTrampoline(emitter, trampoline, chunk, ctxType, fieldTypes));
};

/**
 * `void <name>(i64 lo, i64 hi, i8* ctx)`, the `nish_par_body` the partitioner
 * calls once per chunk: the arguments back out of the context, and the chunk
 * loop over `[lo, hi)`. The range fits an `i32` because it is inside
 * `[0, len)` of an array whose length does.
 */
const chunkTrampoline = (
  emitter: Emitter,
  name: string,
  chunk: FunctionSig,
  ctxType: string,
  fieldTypes: string[]
): IRFunction => {
  const optimize = emitter.opts.optimizeAttributes;
  const attrs: string[] = [];
  if (optimize) {
    attrs.push("noundef");
  }
  const params: IRParam[] = [];
  params.push(new IRParam("lo", "i64", attrs));
  params.push(new IRParam("hi", "i64", attrs));
  params.push(new IRParam("ctx", "i8*", attrs));
  const fn = new IRFunction(name, params, "void");
  fn.linkage = "internal";
  if (optimize) {
    // As `nish_parallel_range`'s entry says: nothing unwinds, and nothing
    // more is claimed about a body that runs a whole chunk.
    const group: string[] = [];
    group.push("nounwind");
    fn.attrGroup = emitter.module.attrGroupFor(group);
  }
  const typed = fn.emitValue(`bitcast i8* %ctx to ${ctxType}*`);
  const operands: string[] = [];
  let i = 0;
  while (i < fieldTypes.length) {
    const at = fn.emitValue(`getelementptr inbounds ${ctxType}, ${ctxType}* ${typed}, i32 0, i32 ${i}`);
    const value = fn.emitValue(`load ${fieldTypes[i]}, ${fieldTypes[i]}* ${at}`);
    operands.push(`${fieldTypes[i]} ${value}`);
    i = i + 1;
  }
  const lo = fn.emitValue("trunc i64 %lo to i32");
  const hi = fn.emitValue("trunc i64 %hi to i32");
  operands.push(`i32 ${lo}`);
  operands.push(`i32 ${hi}`);
  fn.emit(`call void @${chunk.name}(${operands.join(", ")})`);
  fn.emit("ret void");
  return fn;
};
