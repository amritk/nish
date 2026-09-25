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
//   br i1 (<hi> <= <grain>), label %par.seq, label %par.region
// par.seq:                          ; one chunk: the loop, called directly
//   call void @<chunk>(<every argument>, i32 0, i32 <hi>)
// par.region:
//   store ... into each field
//   call void @nish_parallel_range(@<instance>$chunk, i8* <ctx>, i64 <hi>, i64 <grain>)
//
// where `<grain>` is a constant sized from the body (`regionGrain`), and
// `@<instance>$chunk(lo, hi, ctx)` loads the arguments back and calls the
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
import { isParallelEntry, mapGrain, parallelBodyOf, parallelRoleOf } from "./parallel";
import { FunctionSig, PAR_CHUNK, PAR_MAP } from "./program";

/**
 * The grain the region in `caller` is divided at: for a map, the one its body
 * earns (`mapGrain`, `self/parallel.ts`), so a map whose elements are cheap
 * stays one chunk on the calling thread — the loop it would have been — until
 * there is a millisecond of work for each thread, and one whose elements are
 * dear is divided sooner.
 *
 * A reduce's region divides its blocks, with a grain of one block. The block
 * width is `BLOCK` in `std/threads.ts`, which decides the reduce's answer and is
 * independent of this: the grain decides only how a map is divided, and moving
 * it never changes a result.
 */
const regionGrain = (caller: FunctionSig): i32 => {
  const body = parallelBodyOf(caller);
  return body === null || parallelRoleOf(caller) !== PAR_MAP ? 1 : mapGrain(body);
};

/** Whether the call from `caller` to `callee` is the one that becomes a region. */
export const isParallelRegionCall = (caller: FunctionSig | null, callee: FunctionSig): boolean =>
  caller !== null && isParallelEntry(caller) && parallelRoleOf(callee) === PAR_CHUNK;

/**
 * The region in place of `chunk(args..., 0, hi)`: `types` and `values` are the
 * lowered arguments, the range last. The start is always the literal `0` —
 * `std/threads.ts` writes it, and a region covers `[0, len)` — so anything else
 * is a broken invariant, not a program to compile.
 */
export const emitParallelRegion = (
  emitter: Emitter,
  chunk: FunctionSig,
  types: string[],
  values: string[]
): void => {
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
    process.exit(
      internalErrorFor(`emitter: \`${chunk.name}\` is not a chunk loop over [0, n)`, emitter.opts.json)
    );
  }
  const fieldTypes: string[] = [];
  let i = 0;
  while (i < count - 2 && i < types.length) {
    fieldTypes.push(types[i]);
    i = i + 1;
  }
  const ctxType = `{ ${fieldTypes.join(", ")} }`;
  const fn = emitter.fn;
  const slot = fn.emitAlloca("par.ctx", ctxType, emitter.opts.optimizeAttributes ? 8 : 0);
  const hi = values[count - 1];
  const grain = regionGrain(caller);
  // A range the partitioner would not divide is the chunk loop over all of it
  // on this thread, which is what `nish_parallel_range` would run too; called
  // directly it is a call LLVM can inline, where the partitioner's is through a
  // pointer. That is what keeps a short map as cheap as the loop it replaces.
  const seqBlock = fn.newBlock("par.seq");
  const regionBlock = fn.newBlock("par.region");
  const doneBlock = fn.newBlock("par.done");
  const small = fn.emitValue(`icmp sle i32 ${hi}, ${grain}`);
  fn.emit(`br i1 ${small}, label %${seqBlock.label}, label %${regionBlock.label}`);
  fn.placeBlock(seqBlock);
  const operands: string[] = [];
  i = 0;
  while (i < types.length && i < values.length) {
    operands.push(`${types[i]} ${values[i]}`);
    i = i + 1;
  }
  fn.emit(`call void @${chunk.name}(${operands.join(", ")})`);
  fn.emit(`br label %${doneBlock.label}`);
  fn.placeBlock(regionBlock);
  i = 0;
  while (i < fieldTypes.length && i < values.length) {
    // Read before the call below, which ends the length facts.
    const type = fieldTypes[i];
    const value = values[i];
    const at = fn.emitValue(`getelementptr inbounds ${ctxType}, ${ctxType}* ${slot}, i32 0, i32 ${i}`);
    fn.emit(`store ${type} ${value}, ${type}* ${at}`);
    i = i + 1;
  }
  const raw = fn.emitValue(`bitcast ${ctxType}* ${slot} to i8*`);
  const len = fn.emitValue(`sext i32 ${hi} to i64`);
  const trampoline = `${caller.name}$chunk`;
  fn.emit(
    `call void ${emitter.useRuntime("nish_parallel_range")}(void (i64, i64, i8*)* @${trampoline}, i8* ${raw}, i64 ${len}, i64 ${grain})`
  );
  fn.emit(`br label %${doneBlock.label}`);
  fn.placeBlock(doneBlock);
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
    const type = fieldTypes[i];
    const at = fn.emitValue(`getelementptr inbounds ${ctxType}, ${ctxType}* ${typed}, i32 0, i32 ${i}`);
    const value = fn.emitValue(`load ${type}, ${type}* ${at}`);
    operands.push(`${type} ${value}`);
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
