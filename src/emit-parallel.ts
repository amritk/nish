// WP29 P1: a `parallelMapInto` or `parallelReduce` instance, lowered onto the
// partitioner (docs/wp29-thread-surface.md §4.1, runtime/runtime-parallel.c).
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
// inside it was settled at the call (`src/parallel.ts`), and every fact the
// fixpoint holds about the instance counts the region (`markParallelEntry` in
// `src/attributes.ts`).
//
// The context is on the caller's stack, which is sound because
// `nish_parallel_range` joins every thread before it returns; a worker only
// ever reads it. The trampoline has no `-g` subprogram: it is not in the
// source, and a function without one may call one that has one.

import { Emitter, LoopTarget } from "./emit"
import { loadField, structFieldPointer, structInfoOf } from "./emit-classes"
import { internalErrorFor } from "./ice"
import { IRFunction, IRParam, paramValue } from "./ir"
import { loadLocal } from "./emit-ops"
import { isArenaCall, unwrapParens } from "./emit-util"
import { Node } from "./nodes"
import {
  isLockCall,
  isParallelEntry,
  mapGrain,
  parallelBodyOf,
  parallelRoleOf,
  taskStoreOf,
} from "./parallel"
import { FieldInfo, FunctionSig, PAR_CHUNK, PAR_MAP, PAR_SPAWN, PAR_TASK, StructInfo } from "./program"

/**
 * The grain the region in `caller` is divided at: for a map, the one its body
 * earns (`mapGrain`, `src/parallel.ts`), so a map whose elements are cheap
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
  const body = parallelBodyOf(caller)
  return body === null || parallelRoleOf(caller) !== PAR_MAP ? 1 : mapGrain(body)
}

/** Whether the call from `caller` to `callee` is the one that becomes a region. */
export const isParallelRegionCall = (caller: FunctionSig | null, callee: FunctionSig): boolean =>
  caller !== null && isParallelEntry(caller) && parallelRoleOf(callee) === PAR_CHUNK

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
  const caller = emitter.currentSig
  if (caller === null) {
    process.exit(internalErrorFor(`emitter: \`${chunk.name}\` called outside a function`, emitter.opts.json))
  }
  const count = types.length
  if (
    count < 2 ||
    values.length !== count ||
    values[count - 2] !== "0" ||
    types[count - 2] !== "i32" ||
    types[count - 1] !== "i32"
  ) {
    process.exit(
      internalErrorFor(`emitter: \`${chunk.name}\` is not a chunk loop over [0, n)`, emitter.opts.json)
    )
  }
  const fieldTypes: string[] = []
  let i = 0
  while (i < count - 2 && i < types.length) {
    fieldTypes.push(types[i])
    i = i + 1
  }
  const ctxType = `{ ${fieldTypes.join(", ")} }`
  const fn = emitter.fn
  const slot = fn.emitAlloca("par.ctx", ctxType, emitter.opts.optimizeAttributes ? 8 : 0)
  const hi = values[count - 1]
  const grain = regionGrain(caller)
  // A range the partitioner would not divide is the chunk loop over all of it
  // on this thread, which is what `nish_parallel_range` would run too; called
  // directly it is a call LLVM can inline, where the partitioner's is through a
  // pointer. That is what keeps a short map as cheap as the loop it replaces.
  const seqBlock = fn.newBlock("par.seq")
  const regionBlock = fn.newBlock("par.region")
  const doneBlock = fn.newBlock("par.done")
  const small = fn.emitValue(`icmp sle i32 ${hi}, ${grain}`)
  fn.emit(`br i1 ${small}, label %${seqBlock.label}, label %${regionBlock.label}`)
  fn.placeBlock(seqBlock)
  const operands: string[] = []
  i = 0
  while (i < types.length && i < values.length) {
    operands.push(`${types[i]} ${values[i]}`)
    i = i + 1
  }
  fn.emit(`call void @${chunk.name}(${operands.join(", ")})`)
  fn.emit(`br label %${doneBlock.label}`)
  fn.placeBlock(regionBlock)
  i = 0
  while (i < fieldTypes.length && i < values.length) {
    // Read before the call below, which ends the length facts.
    const type = fieldTypes[i]
    const value = values[i]
    const at = fn.emitValue(`getelementptr inbounds ${ctxType}, ${ctxType}* ${slot}, i32 0, i32 ${i}`)
    fn.emit(`store ${type} ${value}, ${type}* ${at}`)
    i = i + 1
  }
  const raw = fn.emitValue(`bitcast ${ctxType}* ${slot} to i8*`)
  const len = fn.emitValue(`sext i32 ${hi} to i64`)
  const trampoline = `${caller.name}$chunk`
  fn.emit(
    `call void ${emitter.useRuntime("nish_parallel_range")}(void (i64, i64, i8*)* @${trampoline}, i8* ${raw}, i64 ${len}, i64 ${grain})`
  )
  fn.emit(`br label %${doneBlock.label}`)
  fn.placeBlock(doneBlock)
  emitter.module.addFunction(chunkTrampoline(emitter, trampoline, chunk, ctxType, fieldTypes))
}

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
  const optimize = emitter.opts.optimizeAttributes
  const attrs: string[] = []
  if (optimize) {
    attrs.push("noundef")
  }
  const params: IRParam[] = []
  params.push(new IRParam("lo", "i64", attrs))
  params.push(new IRParam("hi", "i64", attrs))
  params.push(new IRParam("ctx", "i8*", attrs))
  const fn = new IRFunction(name, params, "void")
  fn.linkage = "internal"
  if (optimize) {
    // As `nish_parallel_range`'s entry says: nothing unwinds, and nothing
    // more is claimed about a body that runs a whole chunk.
    const group: string[] = []
    group.push("nounwind")
    fn.attrGroup = emitter.module.attrGroupFor(group)
  }
  const typed = fn.emitValue(`bitcast i8* %ctx to ${ctxType}*`)
  const operands: string[] = []
  let i = 0
  while (i < fieldTypes.length) {
    const type = fieldTypes[i]
    const at = fn.emitValue(`getelementptr inbounds ${ctxType}, ${ctxType}* ${typed}, i32 0, i32 ${i}`)
    const value = fn.emitValue(`load ${type}, ${type}* ${at}`)
    operands.push(`${type} ${value}`)
    i = i + 1
  }
  const lo = fn.emitValue("trunc i64 %lo to i32")
  const hi = fn.emitValue("trunc i64 %hi to i32")
  operands.push(`i32 ${lo}`)
  operands.push(`i32 ${hi}`)
  fn.emit(`call void @${chunk.name}(${operands.join(", ")})`)
  fn.emit("ret void")
  return fn
}

// ---- WP29 P2: a scope's tasks -----------------------------------------------------------
//
// `s.spawn(entry, arg, dst, at)` is an instance of `ThreadScope.spawn`, and
// its body's call `runTask(entry, arg, dst, at)` is the task
// (`std/threads.ts`). That call is split in two and filed on the scope:
//
//   %task.payload = alloca { A, R[]*, i32, R }         ; in the entry block
//   store arg, dst, at into its first three fields
//   call void @nish_scope_spawn(i8* %this, @<spawn>$run, @<spawn>$finish,
//                               i8* <payload>, i64 <size of the payload>)
//
// The runtime copies the payload, so the frame it came from may end.
// `<spawn>$run` is `entry(arg)` into the fourth field, and runs on a thread of
// its own when the scope joins; `<spawn>$finish` is the checked store
// `storeResult(dst, at, r)`, and runs on the thread that opened the scope once
// every task of it has finished. The join is `nish_scope_join(scope)`, emitted
// at every exit of the block that declared the scope: its end, a `return`, and
// a `break` or `continue` that leaves it — before the release of any arena
// scope around it, so a task never reads memory freed under it.

/** Whether the call from `caller` to `callee` is the one a `spawn` instance files as a task. */
export const isSpawnTaskCall = (caller: FunctionSig | null, callee: FunctionSig): boolean =>
  caller !== null && parallelRoleOf(caller) === PAR_SPAWN && parallelRoleOf(callee) === PAR_TASK

/** `taskStoreOf`, or an internal error when the template no longer has the shape this file reads. */
const storeOf = (emitter: Emitter, task: FunctionSig): FunctionSig => {
  const store = taskStoreOf(task)
  if (store === null) {
    process.exit(
      internalErrorFor(
        `emitter: \`${task.name}\` is not \`storeResult(dst, at, entry(arg))\``,
        emitter.opts.json
      )
    )
  }
  return store
}

/** `entry(arg)`'s function, or an internal error when the task was given none. */
const taskEntryOf = (emitter: Emitter, task: FunctionSig): FunctionSig => {
  const body = parallelBodyOf(task)
  if (body === null) {
    process.exit(internalErrorFor(`emitter: \`${task.name}\` has no task`, emitter.opts.json))
  }
  return body
}

/**
 * The task in place of `runTask(arg, dst, at)`, whose lowered operands are
 * `types` and `values` (the task itself is a compile-time argument and has
 * none). The receiver is the `spawn` instance's own `this`: the scope.
 */
export const emitSpawnTask = (
  emitter: Emitter,
  task: FunctionSig,
  types: string[],
  values: string[]
): void => {
  const caller = emitter.currentSig
  if (caller === null || types.length !== 3 || values.length !== 3) {
    process.exit(
      internalErrorFor(`emitter: \`${task.name}\` is not a task over (arg, dst, at)`, emitter.opts.json)
    )
  }
  const body = taskEntryOf(emitter, task)
  const store = storeOf(emitter, task)
  const result = emitter.llvm(body.returnType)
  const payloadType = `{ ${types[0]}, ${types[1]}, ${types[2]}, ${result} }`
  const fn = emitter.fn
  const slot = fn.emitAlloca("task.payload", payloadType, emitter.opts.optimizeAttributes ? 8 : 0)
  let i = 0
  while (i < types.length && i < values.length) {
    // Read before the call below, which ends the length facts.
    const type = types[i]
    const value = values[i]
    const at = fn.emitValue(`getelementptr inbounds ${payloadType}, ${payloadType}* ${slot}, i32 0, i32 ${i}`)
    fn.emit(`store ${type} ${value}, ${type}* ${at}`)
    i = i + 1
  }
  // WP29 P3: every channel the task may send on stays open until it returns.
  countSenders(emitter, fn, caller, values[0], 1)
  const raw = fn.emitValue(`bitcast ${payloadType}* ${slot} to i8*`)
  const scope = fn.emitValue(`bitcast ${emitter.llvm(caller.paramTypes[0])} %this to i8*`)
  const size = `ptrtoint (${payloadType}* getelementptr (${payloadType}, ${payloadType}* null, i32 1) to i64)`
  const run = `${caller.name}$run`
  const finish = `${caller.name}$finish`
  fn.emit(
    `call void ${emitter.useRuntime("nish_scope_spawn")}(i8* ${scope}, void (i8*)* @${run}, void (i8*)* @${finish}, i8* ${raw}, i64 ${size})`
  )
  emitter.module.addFunction(taskRun(emitter, run, caller, body, payloadType, types[0], result))
  emitter.module.addFunction(taskFinish(emitter, finish, store, payloadType, types, result))
}

/** An internal `void <name>(i8* %p)`, the shape of both halves of a task. */
const taskFunction = (emitter: Emitter, name: string): IRFunction => {
  const attrs: string[] = []
  if (emitter.opts.optimizeAttributes) {
    attrs.push("noundef")
  }
  const params: IRParam[] = []
  params.push(new IRParam("p", "i8*", attrs))
  const fn = new IRFunction(name, params, "void")
  fn.linkage = "internal"
  if (emitter.opts.optimizeAttributes) {
    // As `nish_scope_join`'s callbacks: nothing unwinds, and nothing more is
    // claimed about a function that runs a whole task.
    const group: string[] = []
    group.push("nounwind")
    fn.attrGroup = emitter.module.attrGroupFor(group)
  }
  return fn
}

/** Field `index` of the payload `%p` points at, loaded as `type`. */
const loadPayload = (
  fn: IRFunction,
  typed: string,
  payloadType: string,
  index: i32,
  type: string
): string => {
  const at = fn.emitValue(
    `getelementptr inbounds ${payloadType}, ${payloadType}* ${typed}, i32 0, i32 ${index}`
  )
  return fn.emitValue(`load ${type}, ${type}* ${at}`)
}

/** `<spawn>$run`: `entry(arg)`, into the payload's last field. It runs on the task's thread. */
const taskRun = (
  emitter: Emitter,
  name: string,
  spawn: FunctionSig,
  body: FunctionSig,
  payloadType: string,
  argType: string,
  result: string
): IRFunction => {
  const fn = taskFunction(emitter, name)
  const typed = fn.emitValue(`bitcast i8* %p to ${payloadType}*`)
  const arg = loadPayload(fn, typed, payloadType, 0, argType)
  const r = fn.emitValue(`call ${result} @${body.name}(${argType} ${arg})`)
  const at = fn.emitValue(`getelementptr inbounds ${payloadType}, ${payloadType}* ${typed}, i32 0, i32 3`)
  fn.emit(`store ${result} ${r}, ${result}* ${at}`)
  countSenders(emitter, fn, spawn, arg, -1) // WP29 P3: it has sent all it will
  fn.emit("ret void")
  return fn
}

/** `<spawn>$finish`: `storeResult(dst, at, r)`, on the thread that opened the scope, after the join. */
const taskFinish = (
  emitter: Emitter,
  name: string,
  store: FunctionSig,
  payloadType: string,
  types: string[],
  result: string
): IRFunction => {
  const fn = taskFunction(emitter, name)
  const typed = fn.emitValue(`bitcast i8* %p to ${payloadType}*`)
  const dst = loadPayload(fn, typed, payloadType, 1, types[1])
  const at = loadPayload(fn, typed, payloadType, 2, types[2])
  const r = loadPayload(fn, typed, payloadType, 3, result)
  fn.emit(`call void @${store.name}(${types[1]} ${dst}, ${types[2]} ${at}, ${result} ${r})`)
  fn.emit("ret void")
  return fn
}

// ---- WP29 P3: a lock that owns its data -----------------------------------------------
//
// `using g = m.lock()` calls `Mutex<T>.lock`, whose body this file writes in
// place of `std/threads.ts`'s `return this.guard`:
//
//   %guard = load %struct.MutexGuard$$T*, ... ; the one guard the `Mutex` holds
//   %swap = cmpxchg i32* <guard.word>, i32 0, i32 1 acquire monotonic
//   br i1 <swapped>, label %lock.held, label %lock.wait
// lock.wait:                          ; held by another task: wait, and take it
//   call void @nish_mutex_wait(i32* <guard.word>)
//
// and the release is a release store of 0 into the same word, emitted at every
// exit of the guard's block — its end, a `break` or `continue` that leaves it,
// and a `return` or an `orReturn`, after the value is computed (unlike a
// scope's join, which runs before it), since the value may read through the
// guard. The acquire keeps every guarded access after the swap, and the
// release every one before the store, which is the whole of what the lock has
// to promise; there is nothing to create or destroy, because the word is a
// field of the guard and lives where the `Mutex` does.

/** The guard's lock word, as `field` of its layout, or an internal error when the layout lacks it. */
const lockWord = (emitter: Emitter, info: StructInfo, name: string): FieldInfo => {
  const field = info.field(name)
  if (field === null) {
    process.exit(internalErrorFor(`emitter: \`${info.name}\` has no field \`${name}\``, emitter.opts.json))
  }
  return field
}

/** The body of `Mutex<T>.lock`: the guard, once its word is taken. */
export const emitLockBody = (emitter: Emitter, sig: FunctionSig): void => {
  const mutex = sig.owner
  if (mutex === null) {
    process.exit(internalErrorFor(`emitter: \`${sig.name}\` is not a method`, emitter.opts.json))
  }
  const fn = emitter.fn
  const guardField = lockWord(emitter, mutex, "guard")
  const guardInfo = structInfoOf(emitter, guardField.type)
  const guard = loadField(emitter, mutex, "%this", guardField)
  const word = structFieldPointer(emitter, guardInfo, guard, lockWord(emitter, guardInfo, "word"))
  const swap = fn.emitValue(`cmpxchg i32* ${word}, i32 0, i32 1 acquire monotonic`)
  const took = fn.emitValue(`extractvalue { i32, i1 } ${swap}, 1`)
  const wait = fn.newBlock("lock.wait")
  const held = fn.newBlock("lock.held")
  fn.emit(`br i1 ${took}, label %${held.label}, label %${wait.label}`)
  fn.placeBlock(wait)
  fn.emit(`call void ${emitter.useRuntime("nish_mutex_wait")}(i32* ${word})`)
  fn.emit(`br label %${held.label}`)
  fn.placeBlock(held)
  fn.emit(`ret ${emitter.llvm(sig.returnType)} ${guard}`)
}

/**
 * A `using` declaration has just been emitted: its scope is open until the
 * block that declared it ends. The scope's address, as the `i8*` its tasks
 * are filed under, is read once here; every exit of the block is dominated by
 * the declaration, so each join can name the same value. A `using a = arena()`
 * goes on the same stack, as the mark its local holds, and a guard as the
 * address of its lock word, so that every exit closes the three kinds in the
 * reverse of the order they opened in.
 */
export const openScope = (emitter: Emitter, list: Node): void => {
  for (const decl of list.children) {
    openOneScope(emitter, decl)
  }
}

/**
 * One declarator of `openScope`'s. What it allocates is the name of a value
 * every exit of the block reads, so it is kept on purpose, and a function of
 * its own keeps the declarator loop from owning it.
 */
const openOneScope = (emitter: Emitter, decl: Node): void => {
  const local = emitter.program.nodeLocals[decl.id]
  if (local === null) {
    process.exit(internalErrorFor("emitter: a `using` declaration with no local recorded", emitter.opts.json))
  }
  const value = loadLocal(emitter, local)
  const init = unwrapParens(decl.children[2])
  const arena = isArenaCall(emitter.program, init)
  const lock = isLockCall(emitter.program, init)
  if (lock) {
    const info = structInfoOf(emitter, local.type)
    emitter.openScopes.push(structFieldPointer(emitter, info, value, lockWord(emitter, info, "word")))
  } else {
    emitter.openScopes.push(
      arena ? value : emitter.fn.emitValue(`bitcast ${emitter.llvm(local.type)} ${value} to i8*`)
    )
  }
  emitter.openScopeLoops.push(emitter.loops.length)
  emitter.openScopeArenas.push(arena)
  emitter.openScopeLocks.push(lock)
  const none: string[] = []
  emitter.openScopeSeals.push(arena || lock ? none : scopeSeals(emitter, decl))
}

/**
 * WP29 P3: the `state` word of every channel the scope declared by `decl`
 * seals at each exit, read once here: each is a `const` declared before the
 * `using` (C2), so the value dominates every exit, as the scope's does.
 */
const scopeSeals = (emitter: Emitter, decl: Node): string[] => {
  const seals: string[] = []
  for (const record of emitter.program.scopeChannels) {
    if (record.scope === decl) {
      for (const channel of record.channels) {
        const local = emitter.program.nodeLocals[channel.id]
        if (local === null) {
          process.exit(internalErrorFor("emitter: a channel with no local recorded", emitter.opts.json))
        }
        seals.push(channelStateIn(emitter, emitter.fn, local.type, loadLocal(emitter, local)))
      }
    }
  }
  return seals
}

/** Close open entry `i`: join a scope's tasks, release an arena to its mark, or give a lock back. */
const closeScope = (emitter: Emitter, i: i32): void => {
  if (emitter.openScopeLocks[i]) {
    emitter.fn.emit(`store atomic i32 0, i32* ${emitter.openScopes[i]} release, align 4`)
  } else if (emitter.openScopeArenas[i]) {
    emitter.fn.emit(`call void ${emitter.useRuntime("nish_arena_release")}(i64 ${emitter.openScopes[i]})`)
  } else {
    // WP29 P3: the scope's own count on each of its channels goes first, so a
    // channel no task may send on is closed before any task waits on it.
    for (const state of emitter.openScopeSeals[i]) {
      emitter.fn.emit(`call void ${emitter.useRuntime("nish_channel_count")}(i64* ${state}, i64 -1)`)
    }
    emitter.fn.emit(`call void ${emitter.useRuntime("nish_scope_join")}(i8* ${emitter.openScopes[i]})`)
  }
}

/**
 * Close, innermost first, every open entry that `minLoops` or more loops
 * enclosed: 0 for a `return`, which leaves them all, and one more than the
 * target's position for a `break` or `continue`, which leaves the ones
 * opened inside the loop it targets. They stay open for the paths that did
 * not take this exit. A `return` passes `arenas` false: its scopes join
 * before its value is computed, which may read what the tasks stored, and its
 * arenas and locks are given back after (`Emitter.emitScopeExit`), because the
 * value may read what the block allocated or what a guard reaches.
 */
export const emitScopeJoins = (emitter: Emitter, minLoops: i32, arenas: boolean): void => {
  let i = emitter.openScopes.length - 1
  while (i >= 0) {
    const later = emitter.openScopeArenas[i] || emitter.openScopeLocks[i]
    if (emitter.openScopeLoops[i] >= minLoops && (arenas || !later)) {
      closeScope(emitter, i)
    }
    i = i - 1
  }
}

/**
 * The end of a block that had `count` entries open when it began: the ones
 * it opened close, innermost first, if control reaches the end, and are
 * popped either way.
 */
export const closeBlockScopes = (emitter: Emitter, count: i32): void => {
  if (!emitter.fn.currentBlock().terminated()) {
    let i = emitter.openScopes.length - 1
    while (i >= count) {
      closeScope(emitter, i)
      i = i - 1
    }
  }
  while (emitter.openScopes.length > count) {
    emitter.openScopes.pop()
    emitter.openScopeLoops.pop()
    emitter.openScopeArenas.pop()
    emitter.openScopeLocks.pop()
    emitter.openScopeSeals.pop()
  }
}

/** Give back every lock still held, innermost first: a function's exit, after its value (`emitScopeExit`). */
export const emitLockReleases = (emitter: Emitter): void => {
  let i = emitter.openScopes.length - 1
  while (i >= 0) {
    if (emitter.openScopeLocks[i]) {
      closeScope(emitter, i)
    }
    i = i - 1
  }
}

/** Whether a lock is held where the emitter stands, which keeps a `return`'s call from being a tail call. */
export const holdsLock = (emitter: Emitter): boolean => emitter.openScopeLocks.indexOf(true) >= 0

// ---- WP29 P3: a channel of scalars ---------------------------------------------------
//
// A `Channel<T>` object holds an `i64` word, `state`, that the runtime owns
// (runtime/runtime-parallel.c), and every operation passes the word's address.
// A value travels as one `i64` slot, widened from `T` and narrowed back:
//
//   ch.send(x)          call void @nish_channel_send(i64* <state>, i64 <x, widened>)
//   for (const x of ch) chan.recv:  %got = call i32 @nish_channel_receive(i64* <state>, i64* %chan.slot)
//                                   br i1 (%got != 0), label %chan.body, label %chan.end
//                       chan.body:  x = <the slot, narrowed>; the body; br label %chan.recv
//
// What closes a channel is a count the runtime keeps, which starts at one for
// the scope: a `spawn` whose task may send on it adds one before the task is
// filed, the task's `$run` takes it away once the task has returned, and the
// scope's own one is taken away at every exit of its block, just before the
// join — whether or not the join finds a task to run, so a channel whose only
// sender was never spawned closes too. Which tasks may send, and which
// channels a scope seals, the checker records (`Instantiation.channelSenders`,
// `CheckedProgram.scopeChannels`).

/** The address of the `state` word of the `Channel` `receiver` points at, emitted into `fn`. */
const channelStateIn = (emitter: Emitter, fn: IRFunction, type: i32, receiver: string): string => {
  const info = structInfoOf(emitter, type)
  const field = info.field("state")
  if (field === null) {
    process.exit(internalErrorFor(`emitter: \`${info.name}\` has no \`state\``, emitter.opts.json))
  }
  const ty = `%struct.${info.name}`
  return fn.emitValue(`getelementptr inbounds ${ty}, ${ty}* ${receiver}, i32 0, i32 ${field.index}`)
}

/**
 * The `state` word of the channel at `path` from a task's argument `arg` of
 * type `type`: the argument itself for `""`, or its field `path`, read here.
 */
const senderStateIn = (emitter: Emitter, fn: IRFunction, type: i32, arg: string, path: string): string => {
  if (path.length === 0) {
    return channelStateIn(emitter, fn, type, arg)
  }
  const info = structInfoOf(emitter, type)
  const field = info.field(path)
  if (field === null) {
    process.exit(internalErrorFor(`emitter: \`${info.name}\` has no \`${path}\``, emitter.opts.json))
  }
  const ty = `%struct.${info.name}`
  const fieldType = emitter.llvm(field.type)
  const at = fn.emitValue(`getelementptr inbounds ${ty}, ${ty}* ${arg}, i32 0, i32 ${field.index}`)
  const channel = fn.emitValue(`load ${fieldType}, ${fieldType}* ${at}`)
  return channelStateIn(emitter, fn, field.type, channel)
}

/** `count` added to the live count of every channel the task given `arg` may send on, emitted into `fn`. */
const countSenders = (
  emitter: Emitter,
  fn: IRFunction,
  spawn: FunctionSig,
  arg: string,
  count: i32
): void => {
  const instance = spawn.instance
  if (instance === null || instance.typeArgs.length === 0) {
    return
  }
  for (const path of instance.channelSenders) {
    const state = senderStateIn(emitter, fn, instance.typeArgs[0], arg, path)
    fn.emit(`call void ${emitter.useRuntime("nish_channel_count")}(i64* ${state}, i64 ${count})`)
  }
}

/** A scalar of LLVM type `type` widened into a channel's `i64` slot. */
const widenToSlot = (fn: IRFunction, type: string, value: string): string => {
  if (type === "i64") {
    return value
  }
  if (type === "double") {
    return fn.emitValue(`bitcast double ${value} to i64`)
  }
  if (type === "float") {
    const bits = fn.emitValue(`bitcast float ${value} to i32`)
    return fn.emitValue(`zext i32 ${bits} to i64`)
  }
  return fn.emitValue(`zext ${type} ${value} to i64`)
}

/** A channel's `i64` slot narrowed back to the scalar of LLVM type `type` it was widened from. */
const narrowFromSlot = (fn: IRFunction, type: string, raw: string): string => {
  if (type === "i64") {
    return raw
  }
  if (type === "double") {
    return fn.emitValue(`bitcast i64 ${raw} to double`)
  }
  if (type === "float") {
    const bits = fn.emitValue(`trunc i64 ${raw} to i32`)
    return fn.emitValue(`bitcast i32 ${bits} to float`)
  }
  return fn.emitValue(`trunc i64 ${raw} to ${type}`)
}

/** The body of `Channel<T>.send`: the value, widened, onto the runtime's buffer. */
export const emitChannelSendBody = (emitter: Emitter, sig: FunctionSig): void => {
  const owner = sig.owner
  if (owner === null || sig.paramNames.length !== 2) {
    process.exit(internalErrorFor(`emitter: \`${sig.name}\` is not \`send(x)\``, emitter.opts.json))
  }
  const fn = emitter.fn
  const state = channelStateIn(emitter, fn, owner.type, "%this")
  const raw = widenToSlot(fn, emitter.llvm(sig.paramTypes[1]), paramValue(sig.paramNames[1]))
  fn.emit(`call void ${emitter.useRuntime("nish_channel_send")}(i64* ${state}, i64 ${raw})`)
  fn.emit("ret void")
}

/**
 * `for (const x of ch)` over a `Channel`: a receive at the top of every pass,
 * which waits while the channel is empty and open and ends the loop once it is
 * closed and drained. `continue` receives again and `break` leaves; nothing is
 * left to close on either, or on a `return`, because a loop that stops early
 * leaves the rest where it is.
 */
export const emitChannelWalk = (emitter: Emitter, stmt: Node): void => {
  const decl = stmt.children[0].children[0].children[0]
  const local = emitter.program.nodeLocals[decl.id]
  if (local === null) {
    process.exit(internalErrorFor("emitter: a channel loop with no variable recorded", emitter.opts.json))
  }
  const fn = emitter.fn
  const elem = local.type
  const ty = emitter.llvm(elem)
  const recvBlock = fn.newBlock("chan.recv")
  const bodyBlock = fn.newBlock("chan.body")
  const endBlock = fn.newBlock("chan.end")
  const slot = fn.emitAlloca(`${local.name}.addr`, ty, emitter.align(elem))
  emitter.setSlot(local, slot)
  const debug = emitter.debug
  if (debug !== null) {
    debug.declareLocal(fn, local, slot, decl) // `-g`
  }
  const raw = fn.emitAlloca("chan.slot", "i64", emitter.opts.optimizeAttributes ? 8 : 0)
  const iterable = stmt.children[1]
  const channel = emitter.emitExpression(iterable)
  const state = channelStateIn(emitter, fn, emitter.program.nodeTypes[unwrapParens(iterable).id], channel)
  fn.emit(`br label %${recvBlock.label}`)

  fn.placeBlock(recvBlock)
  const got = fn.emitValue(
    `call i32 ${emitter.useRuntime("nish_channel_receive")}(i64* ${state}, i64* ${raw})`
  )
  const more = fn.emitValue(`icmp ne i32 ${got}, 0`)
  fn.emit(`br i1 ${more}, label %${bodyBlock.label}, label %${endBlock.label}`)

  fn.placeBlock(bodyBlock)
  const bits = fn.emitValue(`load i64, i64* ${raw}${emitter.align8()}`)
  const value = narrowFromSlot(fn, ty, bits)
  fn.emit(`store ${ty} ${value}, ${ty}* ${slot}${emitter.alignSuffix(elem)}`)
  emitter.loops.push(new LoopTarget(endBlock, recvBlock))
  emitter.emitStatement(stmt.children[2])
  emitter.loops.pop()
  if (!fn.currentBlock().terminated()) {
    fn.emit(`br label %${recvBlock.label}`)
  }

  fn.placeBlock(endBlock)
}
