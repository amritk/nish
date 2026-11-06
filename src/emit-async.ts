/**
 * WP49 stage 4, part 2: async functions lowered to frame state machines.
 *
 * An async function that awaits ("suspends", `suspends`) is emitted as an
 * ordinary function first and then rewritten here (`transformAsync`) into
 * `i1 @F.resume(i8* frame)`: a switch on the frame's state number picks up
 * where the last `await` left off, every value live across an await is
 * spilled into the frame, every `alloca` becomes a frame field, and every
 * `ret` stores the answer and the finished state. It answers true when the
 * call has finished and false when it pends. An async function with no
 * `await` is a plain function, called directly.
 *
 *   %frame.F      = type { i32 state, <parameters...>, <answer>, %frame.F.rest }
 *   %frame.F.rest = type { [K x <2 x i64>] kids, <slots...>, <spills...> }
 *
 * The caller lays out the head (`frameHead`), which is the callee frame's
 * prefix, in its own `kids` area, so every frame has a size known when the
 * program is linked: `K` is the most any one await (or `awaitAll`) of `F`
 * needs, in 16-byte units, and is written as a placeholder the whole-program
 * pass (`finalizeAsync`) replaces once every module is emitted, since a
 * callee's frame may live in another module.
 *
 * `spawn(f(x))` puts `f`'s frame in a `malloc`ed node, resumes it once, and
 * files it on the in-process queue when it pends. The queue and its driver
 * (`@nish.async.step`, `@nish.async.drain`) are appended to one module by
 * `finalizeAsync`; it resumes a task through a switch on the task's kind,
 * never through a function pointer. Stage 5 replaces the queue, the `malloc`
 * and the trap on a stuck queue with the executor in `runtime-async.c`
 * (docs/wp49-async-server.md, "Stage 4, part 2").
 */

import { Emitter } from "./emit"
import { unpackReturnedResult } from "./emit-result"
import { unwrapParens } from "./emit-util"
import { internalErrorFor } from "./ice"
import { IRBlock, IRFunction, IRParam, paramValue } from "./ir"
import { isDigit } from "./lexer"
import { StringMap } from "./map"
import { N_UNARY, Node } from "./nodes"
import { FunctionSig } from "./program"
import { StringBuilder } from "./strings"
import { HARDENING_ATTRS } from "./target"

/** How `emitCall` lowers a call to a suspending function: awaited, spawned, or one of an `awaitAll`. */
export const ASYNC_AWAIT: i32 = 0
const ASYNC_SPAWN: i32 = 1
const ASYNC_ALL: i32 = 2

/** The bytes of a spawned task's node ahead of its frame: the queue link and the task kind. */
const NODE_HEADER: i32 = 16

/**
 * A placeholder opens and closes with a byte `irEscape` always writes as `\01`,
 * so no string constant or name of the program can spell one; the lines that
 * spell its paths unescaped are skipped (`writtenFromPaths`).
 */
const MARK_END: string = "\x01"
const MARK_START: string = "\x01async."
const KIDS_MARK: string = "\x01async.kids:"
const OFF_MARK: string = "\x01async.off:"
const BYTES_MARK: string = "\x01async.bytes:"

const ENQUEUE_DECL: string = "declare hidden void @nish.async.enqueue(i8*)"
const STEP_DECL: string = "declare hidden i1 @nish.async.step()"
const DRAIN_DECL: string = "declare hidden void @nish.async.drain()"

/** Whether `sig` is lowered to a frame: an async function whose body awaits. */
export const suspends = (sig: FunctionSig | null): boolean => sig !== null && sig.suspends()

/**
 * What the modules of one compilation learn about each other's frames,
 * keyed by `FunctionSig.name`, which is unique program-wide: which module
 * defines each frame, which frames each await lays out side by side (a
 * group), and which frames are spawned (a task kind each).
 */
export class AsyncRegistry {
  /** The index of the module being emitted, in `compilation.emit()`'s output. */
  module: i32
  /** The module holding an async `main`, which the driver goes into; -1 for none. */
  host: i32
  /** The first module that spawns, which holds the driver when there is no async `main`. */
  driverModule: i32
  usesDriver: boolean
  json: boolean
  ids: StringMap
  frameNames: string[]
  /** The module defining each frame, -1 until its function is emitted. */
  frameModules: i32[]
  groupOwners: i32[]
  groupMembers: i32[][]
  /** Task kind -> frame id. */
  spawnFrames: i32[]

  constructor() {
    this.module = 0
    this.host = -1
    this.driverModule = -1
    this.usesDriver = false
    this.json = false
    this.ids = new StringMap()
    this.frameNames = []
    this.frameModules = []
    this.groupOwners = []
    this.groupMembers = []
    this.spawnFrames = []
  }

  idOf(name: string): i32 {
    let id = this.ids.get(name, -1)
    if (id < 0) {
      id = this.frameNames.length
      this.ids.set(name, id)
      this.frameNames.push(name)
      this.frameModules.push(-1)
    }
    return id
  }

  spawnKindOf(id: i32): i32 {
    const kind = this.spawnFrames.indexOf(id)
    if (kind >= 0) {
      return kind
    }
    this.spawnFrames.push(id)
    return this.spawnFrames.length - 1
  }

  /** Record that one await of frame `owner` lays out `members` side by side in its kids area. */
  addGroup(owner: i32, members: i32[]): i32 {
    this.groupOwners.push(owner)
    this.groupMembers.push(members)
    return this.groupOwners.length - 1
  }
}

const asyncFail = (emitter: Emitter, message: string): void => {
  process.exit(internalErrorFor(`async lowering: ${message}`, emitter.opts.json))
}

/** `{ i32, <operands...>, <answer> }`: what a caller writes of a callee's frame, and where it reads the answer. */
const frameHead = (operandTypes: string[], answer: string): string => {
  const parts: string[] = ["i32"]
  for (const type of operandTypes) {
    parts.push(type)
  }
  if (answer !== "void") {
    parts.push(answer)
  }
  return `{ ${parts.join(", ")} }`
}

/** Write state 0 and the arguments into the frame at `base`. */
const storeHead = (
  emitter: Emitter,
  base: string,
  head: string,
  operandTypes: string[],
  operandValues: string[]
): void => {
  const fn = emitter.fn
  const frame = fn.emitValue(`bitcast i8* ${base} to ${head}*`)
  const state = fn.emitValue(`getelementptr inbounds ${head}, ${head}* ${frame}, i32 0, i32 0`)
  fn.emit(`store i32 0, i32* ${state}`)
  let k = 0
  while (k < operandTypes.length) {
    const at = fn.emitValue(`getelementptr inbounds ${head}, ${head}* ${frame}, i32 0, i32 ${k + 1}`)
    fn.emit(`store ${operandTypes[k]} ${operandValues[k]}, ${operandTypes[k]}* ${at}`)
    k = k + 1
  }
}

/** Where member `member` of group `group` keeps its frame in this function's kids area. */
const kidBase = (emitter: Emitter, group: i32, member: i32): string => {
  if (member === 0) {
    return "%async.kids"
  }
  return emitter.fn.emitValue(
    `getelementptr inbounds i8, i8* %async.kids, i64 ${OFF_MARK}${group}.${member}${MARK_END}`
  )
}

/** The attribute group of every resume function, its `define` and each `declare` of it alike. */
const resumeGroup = (emitter: Emitter): string =>
  emitter.opts.optimizeAttributes ? ` ${emitter.module.attrGroupFor(["nounwind"])}` : ""

const declareResume = (emitter: Emitter, sig: FunctionSig): void => {
  if (!sig.definedIn(emitter.program.source)) {
    emitter.declare(`declare i1 @${sig.name}.resume(i8*)${resumeGroup(emitter)}`)
  }
}

/**
 * Resume every member of `group` and leave the function pending, at a new
 * state, unless all of them have finished. The state's block is the poll
 * itself, so a resumed frame polls its kids again.
 */
const emitPoll = (emitter: Emitter, group: i32, names: string[]): void => {
  const fn = emitter.fn
  const poll = fn.newBlock("await.poll")
  fn.emit(`br label %${poll.label}`)
  fn.placeBlock(poll)
  let done = ""
  let j = 0
  while (j < names.length) {
    const base = kidBase(emitter, group, j)
    const finished = fn.emitValue(`call i1 @${names[j]}.resume(i8* ${base})`)
    done = j === 0 ? finished : fn.emitValue(`and i1 ${done}, ${finished}`)
    j = j + 1
  }
  const ready = fn.newBlock("await.ready")
  const pending = fn.newBlock("await.pending")
  fn.emit(`br i1 ${done}, label %${ready.label}, label %${pending.label}`)
  fn.placeBlock(pending)
  emitter.asyncPolls.push(poll.label)
  fn.emit(`store i32 ${emitter.asyncPolls.length}, i32* %async.state`)
  fn.emit("br label %async.suspend")
  fn.placeBlock(ready)
}

/** The answer a finished kid left in its frame, unpacked as an ordinary call's would be. */
const loadAnswer = (
  emitter: Emitter,
  sig: FunctionSig,
  base: string,
  head: string,
  operandCount: i32,
  site: Node,
  calleePrivate: boolean
): string => {
  const answer = emitter.llvmAbi(sig.returnType, calleePrivate)
  if (answer === "void") {
    return "void"
  }
  const fn = emitter.fn
  const frame = fn.emitValue(`bitcast i8* ${base} to ${head}*`)
  const at = fn.emitValue(`getelementptr inbounds ${head}, ${head}* ${frame}, i32 0, i32 ${operandCount + 1}`)
  const value = fn.emitValue(`load ${answer}, ${answer}* ${at}`)
  if (emitter.table.resultByValue(sig.returnType)) {
    return unpackReturnedResult(emitter, sig.returnType, value, emitter.isStackSite(site), calleePrivate)
  }
  return value
}

/**
 * A call to the suspending `sig`, its arguments lowered: an `await` lays the
 * frame out in this function's kids and polls it; one of an `awaitAll`
 * lays it out at its member's place and starts it, for the declaration to
 * poll; a `spawn` starts it in a node of its own.
 */
export const emitAsyncCall = (
  emitter: Emitter,
  expr: Node,
  sig: FunctionSig,
  operandTypes: string[],
  operandValues: string[],
  calleePrivate: boolean,
  mode: i32
): string => {
  const registry = emitter.asyncRegistry
  const fn = emitter.fn
  const id = registry.idOf(sig.name)
  const head = frameHead(operandTypes, emitter.llvmAbi(sig.returnType, calleePrivate))
  declareResume(emitter, sig)
  if (mode === ASYNC_ALL) {
    const base = kidBase(emitter, emitter.asyncGroup, emitter.asyncMember)
    storeHead(emitter, base, head, operandTypes, operandValues)
    // Each member starts here, in argument order as Node starts them; its
    // answer is ignored, because the poll re-resumes every member and a
    // finished frame (state -1) answers true at once.
    fn.emitValue(`call i1 @${sig.name}.resume(i8* ${base})`)
    emitter.asyncHeads.push(head)
    emitter.asyncCounts.push(operandTypes.length)
    emitter.asyncPrivates.push(calleePrivate)
    return ""
  }
  if (mode === ASYNC_SPAWN) {
    emitSpawnedFrame(emitter, sig, id, head, operandTypes, operandValues)
    return "void"
  }
  const owner = emitter.currentSig
  if (!suspends(owner) || owner === null) {
    asyncFail(emitter, `an await of \`${sig.name}\` outside a suspending function`)
    return ""
  }
  const members: i32[] = [id]
  const group = registry.addGroup(registry.idOf(owner.name), members)
  storeHead(emitter, "%async.kids", head, operandTypes, operandValues)
  const names: string[] = [sig.name]
  emitPoll(emitter, group, names)
  return loadAnswer(emitter, sig, "%async.kids", head, operandTypes.length, expr, calleePrivate)
}

/** `spawn`'s node: allocated, started, and freed at once or filed on the queue. */
const emitSpawnedFrame = (
  emitter: Emitter,
  sig: FunctionSig,
  id: i32,
  head: string,
  operandTypes: string[],
  operandValues: string[]
): void => {
  const registry = emitter.asyncRegistry
  const fn = emitter.fn
  const kind = registry.spawnKindOf(id)
  registry.usesDriver = true
  if (registry.driverModule < 0) {
    registry.driverModule = registry.module
  }
  emitter.declare("declare noalias i8* @malloc(i64)")
  emitter.declare("declare void @free(i8*)")
  emitter.declare("declare void @llvm.trap()")
  emitter.declare(ENQUEUE_DECL)
  const attrs = emitter.module.definitionAttrs.length > 0 ? ` ${emitter.module.definitionAttrs}` : ""
  emitter.module.addRawDefinition(
    `define weak_odr hidden i1 @nish.async.task.${kind}(i8* %frame) nounwind${attrs} {\nentry:\n  %done = call i1 @${sig.name}.resume(i8* %frame)\n  ret i1 %done\n}`
  )
  const node = fn.emitValue(`call noalias i8* @malloc(i64 ${BYTES_MARK}${id}${MARK_END})`)
  const none = fn.emitValue(`icmp eq i8* ${node}, null`)
  const oom = fn.newBlock("spawn.oom")
  const go = fn.newBlock("spawn.go")
  fn.emit(`br i1 ${none}, label %${oom.label}, label %${go.label}`)
  fn.placeBlock(oom)
  fn.emit("call void @llvm.trap()")
  fn.emit("unreachable")
  fn.placeBlock(go)
  const frame = fn.emitValue(`getelementptr inbounds i8, i8* ${node}, i64 ${NODE_HEADER}`)
  storeHead(emitter, frame, head, operandTypes, operandValues)
  const finished = fn.emitValue(`call i1 @${sig.name}.resume(i8* ${frame})`)
  const done = fn.newBlock("spawn.done")
  const queue = fn.newBlock("spawn.queue")
  const join = fn.newBlock("spawn.join")
  fn.emit(`br i1 ${finished}, label %${done.label}, label %${queue.label}`)
  fn.placeBlock(done)
  fn.emit(`call void @free(i8* ${node})`)
  fn.emit(`br label %${join.label}`)
  fn.placeBlock(queue)
  const kindByte = fn.emitValue(`getelementptr inbounds i8, i8* ${node}, i64 8`)
  const kindAt = fn.emitValue(`bitcast i8* ${kindByte} to i32*`)
  fn.emit(`store i32 ${kind}, i32* ${kindAt}`)
  fn.emit(`call void @nish.async.enqueue(i8* ${node})`)
  fn.emit(`br label %${join.label}`)
  fn.placeBlock(join)
}

/** `spawn(f(x))`: a leaf `f` runs to completion here; a suspending one becomes a task. */
export const emitSpawn = (emitter: Emitter, expr: Node): string => {
  const call = unwrapParens(expr.children[1].children[0])
  if (suspends(emitter.program.nodeCallees[call.id])) {
    emitter.asyncMode = ASYNC_SPAWN
  }
  emitter.emitExpression(call)
  return "void"
}

/** Whether `decl` is `const [a, b] = await awaitAll(f(x), g(y))`, the checker having said so. */
export const isAwaitAllDeclaration = (emitter: Emitter, decl: Node): boolean => {
  if (decl.children.length < 3) {
    return false
  }
  const init = unwrapParens(decl.children[2])
  if (init.kind !== N_UNARY || init.text !== "await") {
    return false
  }
  const call = unwrapParens(init.children[0])
  return emitter.program.nodeBuiltins[call.id] === "async.awaitAll"
}

/**
 * `const [a, b] = await awaitAll(f(x), g(y))`: every call starts in order,
 * the suspending ones in their places in the kids area, then one poll waits
 * for all of them and each name takes its call's answer.
 */
export const emitAwaitAll = (emitter: Emitter, decl: Node): void => {
  const registry = emitter.asyncRegistry
  const owner = emitter.currentSig
  if (!suspends(owner) || owner === null) {
    asyncFail(emitter, "an `awaitAll` outside a suspending function")
    return
  }
  const init = unwrapParens(decl.children[2])
  const args = unwrapParens(init.children[0]).children[1].children
  const members: i32[] = []
  const memberNames: string[] = []
  const calls: Node[] = []
  for (const arg of args) {
    const call = unwrapParens(arg)
    calls.push(call)
    const callee = emitter.program.nodeCallees[call.id]
    if (callee !== null && suspends(callee)) {
      members.push(registry.idOf(callee.name))
      memberNames.push(callee.name)
    }
  }
  const group = registry.addGroup(registry.idOf(owner.name), members)
  const values: string[] = []
  emitter.asyncHeads = []
  emitter.asyncCounts = []
  emitter.asyncPrivates = []
  let member = 0
  for (const call of calls) {
    if (suspends(emitter.program.nodeCallees[call.id])) {
      emitter.asyncMode = ASYNC_ALL
      emitter.asyncGroup = group
      emitter.asyncMember = member
      member = member + 1
    }
    values.push(emitter.emitExpression(call))
  }
  if (memberNames.length > 0) {
    emitPoll(emitter, group, memberNames)
  }
  const names = decl.children[0].children
  const fn = emitter.fn
  member = 0
  let i = 0
  while (i < calls.length && i < names.length) {
    const call = calls[i]
    const callee = emitter.program.nodeCallees[call.id]
    let value = values[i]
    if (callee !== null && suspends(callee)) {
      const base = kidBase(emitter, group, member)
      value = loadAnswer(
        emitter,
        callee,
        base,
        emitter.asyncHeads[member],
        emitter.asyncCounts[member],
        call,
        emitter.asyncPrivates[member]
      )
      member = member + 1
    }
    const local = emitter.program.nodeLocals[names[i].id]
    if (local === null || emitter.table.isMaybe(local.type)) {
      asyncFail(emitter, "an `awaitAll` name with no plain local")
      return
    }
    const ty = emitter.llvm(local.type)
    const slot = fn.emitAlloca(`${local.name}.addr`, ty, emitter.align(local.type))
    emitter.setSlot(local, slot)
    fn.emit(`store ${ty} ${value}, ${ty}* ${slot}${emitter.alignSuffix(local.type)}`)
    const debug = emitter.debug
    if (debug !== null) {
      debug.declareLocal(fn, local, slot, names[i])
    }
    i = i + 1
  }
}

/**
 * An async `main`: run it, with the queue, until it finishes, then run the
 * queue dry, and answer its exit code. Emitted into the C `main` wrapper.
 */
export const emitAsyncMain = (emitter: Emitter, fn: IRFunction, userMain: FunctionSig): string => {
  const registry = emitter.asyncRegistry
  registry.host = registry.module
  registry.usesDriver = true
  emitter.declare(DRAIN_DECL)
  if (!suspends(userMain)) {
    let code = "0"
    if (emitter.llvm(userMain.returnType) === "void") {
      fn.emit(`call void @${userMain.name}()`)
    } else {
      code = fn.emitValue(`call i32 @${userMain.name}()`)
    }
    fn.emit("call void @nish.async.drain()")
    return code
  }
  emitter.declare(STEP_DECL)
  emitter.declare("declare void @llvm.trap()")
  const type = `%frame.${userMain.name}`
  const slot = fn.emitAlloca("async.main", type, 16)
  const state = fn.emitValue(`getelementptr inbounds ${type}, ${type}* ${slot}, i32 0, i32 0`)
  fn.emit(`store i32 0, i32* ${state}`)
  const raw = fn.emitValue(`bitcast ${type}* ${slot} to i8*`)
  const poll = fn.newBlock("async.poll")
  const wait = fn.newBlock("async.wait")
  const stuck = fn.newBlock("async.stuck")
  const done = fn.newBlock("async.done")
  fn.emit(`br label %${poll.label}`)
  fn.placeBlock(poll)
  const finished = fn.emitValue(`call i1 @${userMain.name}.resume(i8* ${raw})`)
  fn.emit(`br i1 ${finished}, label %${done.label}, label %${wait.label}`)
  fn.placeBlock(wait)
  const progress = fn.emitValue("call i1 @nish.async.step()")
  fn.emit(`br i1 ${progress}, label %${poll.label}, label %${stuck.label}`)
  fn.placeBlock(stuck)
  fn.emit("call void @llvm.trap()")
  fn.emit("unreachable")
  fn.placeBlock(done)
  fn.emit("call void @nish.async.drain()")
  if (emitter.llvm(userMain.returnType) === "void") {
    return "0"
  }
  const at = fn.emitValue(`getelementptr inbounds ${type}, ${type}* ${slot}, i32 0, i32 1`)
  return fn.emitValue(`load i32, i32* ${at}`)
}

// ---- Text helpers ---------------------------------------------------------

const isNameByte = (c: i32): boolean =>
  (c >= 97 && c <= 122) ||
  (c >= 65 && c <= 90) ||
  (c >= 48 && c <= 57) ||
  c === 46 ||
  c === 95 ||
  c === 36 ||
  c === 45

/** The end of the `%name` or `@name` token whose sigil is at `at`. */
const irNameEnd = (text: string, at: i32): i32 => {
  let i = at + 1
  while (i < text.length && isNameByte(text.charCodeAt(i))) {
    i = i + 1
  }
  return i
}

/** The decimal number at the start of `text`, or -1. */
const leadingNumber = (text: string): i32 => {
  if (text.length === 0 || !isDigit(text.charCodeAt(0))) {
    return -1
  }
  let value = 0
  let i = 0
  while (i < text.length && isDigit(text.charCodeAt(i))) {
    value = value * 10 + (text.charCodeAt(i) - 48)
    i = i + 1
  }
  return value
}

/** An instruction without its trailing `, !dbg !N` (or other) metadata. */
const withoutMetadata = (instr: string): string => {
  const at = instr.indexOf(", !")
  return at < 0 ? instr : instr.substring(0, at)
}

const metadataOf = (instr: string): string => {
  const at = instr.indexOf(", !")
  return at < 0 ? "" : instr.substring(at)
}

/**
 * The end of the LLVM type starting at `start`: a name, or a bracketed
 * aggregate, then any `*`s, and a function type's parameter list when a `*`
 * follows it.
 */
const typeEnd = (text: string, start: i32): i32 => {
  let i = start
  const first = text.charCodeAt(i)
  if (first === 91 || first === 60 || first === 123) {
    let depth = 0
    while (i < text.length) {
      const c = text.charCodeAt(i)
      if (c === 91 || c === 60 || c === 123 || c === 40) {
        depth = depth + 1
      } else if (c === 93 || c === 62 || c === 125 || c === 41) {
        depth = depth - 1
        if (depth === 0) {
          i = i + 1
          break
        }
      }
      i = i + 1
    }
  } else {
    while (i < text.length && (isNameByte(text.charCodeAt(i)) || text.charCodeAt(i) === 37)) {
      i = i + 1
    }
  }
  while (i < text.length && text.charCodeAt(i) === 42) {
    i = i + 1
  }
  if (i + 1 < text.length && text.charCodeAt(i) === 32 && text.charCodeAt(i + 1) === 40) {
    let depth = 0
    let j = i + 1
    while (j < text.length) {
      const c = text.charCodeAt(j)
      if (c === 40) {
        depth = depth + 1
      } else if (c === 41) {
        depth = depth - 1
        if (depth === 0) {
          break
        }
      }
      j = j + 1
    }
    if (j + 1 < text.length && text.charCodeAt(j + 1) === 42) {
      i = j + 1
      while (i < text.length && text.charCodeAt(i) === 42) {
        i = i + 1
      }
    }
  }
  return i
}

const typeAt = (text: string, start: i32): string => text.substring(start, typeEnd(text, start))

/** The word at `at` (up to a space), for skipping flags. */
const wordAt = (text: string, at: i32): string => {
  let i = at
  while (i < text.length && text.charCodeAt(i) !== 32) {
    i = i + 1
  }
  return text.substring(at, i)
}

/** The last place `needle` occurs in `text`, or -1. */
const lastIndexIn = (text: string, needle: string): i32 => {
  let last = -1
  let at = text.indexOf(needle)
  while (at >= 0) {
    last = at
    at = text.indexOf(needle, at + 1)
  }
  return last
}

/** Whether `word` is one of the space-separated words of `list`. */
const isWordIn = (list: string, word: string): boolean => word.length > 0 && list.indexOf(` ${word} `) >= 0

const FLAG_WORDS: string =
  " nuw nsw exact disjoint nneg fast nnan ninf nsz arcp contract afn reassoc volatile atomic tail musttail notail fastcc ccc coldcc tailcc noalias nonnull noundef zeroext signext inreg "

/** Skip flag words (and `align N`, `dereferenceable(N)`) from `at`; answer where the next thing starts. */
const skipFlags = (text: string, at: i32): i32 => {
  let i = at
  while (i < text.length) {
    const word = wordAt(text, i)
    if (isWordIn(FLAG_WORDS, word) || word.startsWith("dereferenceable") || word.startsWith("range(")) {
      i = i + word.length + 1
    } else if (word === "align") {
      i = i + word.length + 1
      i = i + wordAt(text, i).length + 1
    } else {
      return i
    }
  }
  return i
}

/** The index of the first top-level `, ` in `text` from `at`, or -1. */
const topComma = (text: string, at: i32): i32 => {
  let depth = 0
  let i = at
  while (i < text.length) {
    const c = text.charCodeAt(i)
    if (c === 91 || c === 60 || c === 123 || c === 40) {
      depth = depth + 1
    } else if (c === 93 || c === 62 || c === 125 || c === 41) {
      depth = depth - 1
    } else if (c === 44 && depth === 0) {
      return i
    }
    i = i + 1
  }
  return -1
}

/** The top-level comma-separated parts of `text`, trimmed of the spaces around them. */
const splitTop = (text: string): string[] => {
  const parts: string[] = []
  let at = 0
  while (at <= text.length) {
    const comma = topComma(text, at)
    const end = comma < 0 ? text.length : comma
    let from = at
    while (from < end && text.charCodeAt(from) === 32) {
      from = from + 1
    }
    let to = end
    while (to > from && text.charCodeAt(to - 1) === 32) {
      to = to - 1
    }
    if (to > from) {
      parts.push(text.substring(from, to))
    }
    if (comma < 0) {
      break
    }
    at = comma + 1
  }
  return parts
}

const BINARY_OPS: string =
  " add sub mul udiv sdiv urem srem shl lshr ashr and or xor fadd fsub fmul fdiv frem fneg "

const CAST_OPS: string =
  " trunc zext sext fptrunc fpext fptoui fptosi uitofp sitofp ptrtoint inttoptr bitcast addrspacecast "

// ---- Layout ---------------------------------------------------------------

/** The least power of two at least `n` (1 for `n` <= 1). */
const pow2Ceil = (n: i32): i32 => {
  let p = 1
  while (p < n) {
    p = p * 2
  }
  return p
}

/** Where each `%name = type ` line's body starts in `text`, one scan for every lookup. */
const indexTypes = (text: string): StringMap => {
  const out = new StringMap()
  let at = text.indexOf("\n%")
  while (at >= 0) {
    const end = text.indexOf("\n", at + 1)
    const line = end < 0 ? text.substring(at + 1) : text.substring(at + 1, end)
    const eq = line.indexOf(" = type ")
    if (eq > 0) {
      out.set(line.substring(0, eq), at + 1 + eq + 8)
    }
    at = end < 0 ? -1 : text.indexOf("\n%", end)
  }
  return out
}

/**
 * Sizes and alignments of LLVM types on x86-64, the target the async
 * lowering runs on (wasm32 refuses async with NL2652). Named types are read
 * from `text`, a module's IR; `layout` answers the kids-area placeholder.
 */
class TypeSizer {
  text: string
  /** Each named type's body offset in `text` (`indexTypes`). */
  bodies: StringMap
  layout: AsyncLayout | null
  soft: boolean
  json: boolean
  size: i32
  align: i32

  constructor(text: string, bodies: StringMap, layout: AsyncLayout | null, soft: boolean, json: boolean) {
    this.text = text
    this.bodies = bodies
    this.layout = layout
    this.soft = soft
    this.json = json
    this.size = 0
    this.align = 1
  }

  unknown(type: string): void {
    if (!this.soft) {
      process.exit(internalErrorFor(`async lowering: no size for \`${type}\``, this.json))
    }
    this.size = -1
    this.align = -1
  }

  /** The body of the named type `name`, or "". */
  body(name: string): string {
    const from = this.bodies.get(name, -1)
    if (from < 0) {
      return ""
    }
    let to = this.text.indexOf("\n", from)
    if (to < 0) {
      to = this.text.length
    }
    return this.text.substring(from, to)
  }

  /** Set `size` and `align` for `type`; -1 for both when soft and unknown. */
  measure(t: string): void {
    if (t.endsWith("*") || t === "ptr" || t.endsWith(")*")) {
      this.size = 8
      this.align = 8
      return
    }
    if (t.length > 1 && t.charCodeAt(0) === 105 && isDigit(t.charCodeAt(1))) {
      this.vector(pow2Ceil((leadingNumber(t.substring(1)) + 7) >> 3))
      return
    }
    if (t === "half" || t === "bfloat") {
      this.size = 2
      this.align = 2
      return
    }
    if (t === "float") {
      this.size = 4
      this.align = 4
      return
    }
    if (t === "double") {
      this.size = 8
      this.align = 8
      return
    }
    if (t === "fp128" || t === "x86_fp80") {
      this.size = 16
      this.align = 16
      return
    }
    if (t.startsWith("%")) {
      const body = this.body(t)
      if (body.length === 0 || body === "opaque") {
        this.unknown(t)
        return
      }
      this.measure(body)
      return
    }
    if (t.startsWith("<{")) {
      this.measureStruct(t.substring(2, t.length - 2), true)
      return
    }
    if (t.startsWith("{")) {
      this.measureStruct(t.substring(1, t.length - 1), false)
      return
    }
    if (t.startsWith("[") || t.startsWith("<")) {
      const inner = t.substring(1, t.length - 1)
      const x = inner.indexOf(" x ")
      if (x < 0) {
        this.unknown(t)
        return
      }
      const countText = inner.substring(0, x)
      let count = leadingNumber(countText)
      const layout = this.layout
      if (countText.startsWith(KIDS_MARK) && layout !== null) {
        count = layout.kids(leadingNumber(countText.substring(KIDS_MARK.length)))
      }
      if (count < 0) {
        this.unknown(t)
        return
      }
      const element = inner.substring(x + 3)
      if (t.startsWith("<") && element === "i1") {
        this.vector(pow2Ceil((count + 7) >> 3))
        return
      }
      this.measure(element)
      if (this.size < 0) {
        return
      }
      if (t.startsWith("[")) {
        this.size = this.size * count
        return
      }
      this.vector(pow2Ceil(this.size * count))
      return
    }
    this.unknown(t)
  }

  /** A scalar or vector of `bytes` (a power of two): aligned to itself, at most 16. */
  vector(bytes: i32): void {
    this.size = bytes
    this.align = bytes > 16 ? 16 : bytes
  }

  measureStruct(fields: string, packed: boolean): void {
    let offset = 0
    let most = 1
    for (const field of splitTop(fields)) {
      this.measure(field)
      if (this.size < 0) {
        return
      }
      const align = packed ? 1 : this.align
      while (offset % align !== 0) {
        offset = offset + 1
      }
      offset = offset + this.size
      if (align > most) {
        most = align
      }
    }
    while (offset % most !== 0) {
      offset = offset + 1
    }
    this.size = offset
    this.align = most
  }
}

// ---- The rewrite ----------------------------------------------------------

/**
 * Spills every value an await separates from a use. The function's blocks,
 * entered from a virtual entry at `entry` and at every poll, are a new CFG
 * whose dominators decide it: a use its definition does not dominate reads
 * the value back from the frame, where the definition stored it.
 */
class Demoter {
  emitter: Emitter
  fn: IRFunction
  blocks: IRBlock[]
  labels: StringMap
  succs: i32[][]
  preds: i32[][]
  rpoNum: i32[]
  idom: i32[]
  defBlock: StringMap
  defIndex: StringMap
  defTexts: string[]
  /** Each def's index in `defTexts`. */
  defSlots: StringMap
  spilled: StringMap
  spillTypes: string[]
  /** Pass two: the reloads to put ahead of the instruction being rewritten, and at the end of each predecessor. */
  pending: string[]
  endReloads: string[][]
  reloads: i32
  rewriting: boolean
  sizer: TypeSizer

  constructor(emitter: Emitter, polls: string[], sizer: TypeSizer) {
    this.emitter = emitter
    this.fn = emitter.fn
    this.blocks = emitter.fn.blocks
    this.sizer = sizer
    this.labels = new StringMap()
    this.succs = []
    this.preds = []
    this.rpoNum = []
    this.idom = []
    this.defBlock = new StringMap()
    this.defIndex = new StringMap()
    this.defTexts = []
    this.defSlots = new StringMap()
    this.spilled = new StringMap()
    this.spillTypes = []
    this.pending = []
    this.endReloads = []
    this.reloads = 0
    this.rewriting = false
    const n = this.blocks.length
    let b = 0
    while (b < n) {
      this.labels.set(this.blocks[b].label, b)
      b = b + 1
    }
    b = 0
    while (b <= n) {
      const none: i32[] = []
      const nonePreds: i32[] = []
      this.succs.push(none)
      this.preds.push(nonePreds)
      b = b + 1
    }
    b = 0
    while (b < n) {
      const instrs = this.blocks[b].instructions
      if (instrs.length > 0) {
        const last = withoutMetadata(instrs[instrs.length - 1])
        let at = last.indexOf("label %")
        while (at >= 0) {
          const end = irNameEnd(last, at + 6)
          const target = this.labels.get(last.substring(at + 7, end), -1)
          if (target >= 0) {
            this.edge(b, target)
          }
          at = last.indexOf("label %", end)
        }
      }
      b = b + 1
    }
    this.edge(n, 0)
    for (const poll of polls) {
      this.edge(n, this.labels.get(poll, -1))
    }
    this.dominators()
  }

  edge(from: i32, to: i32): void {
    if (to < 0 || this.succs[from].indexOf(to) >= 0) {
      return
    }
    this.succs[from].push(to)
    this.preds[to].push(from)
  }

  /** Reverse postorder from the virtual entry, then Cooper-Harvey-Kennedy dominators. */
  dominators(): void {
    const n = this.blocks.length
    const visited: boolean[] = []
    let b = 0
    while (b <= n) {
      visited.push(false)
      this.rpoNum.push(-1)
      this.idom.push(-1)
      b = b + 1
    }
    const post: i32[] = []
    const stack: i32[] = [n]
    const next: i32[] = [0]
    visited[n] = true
    while (stack.length > 0) {
      const top = stack[stack.length - 1]
      const k = next[next.length - 1]
      if (k < this.succs[top].length) {
        next[next.length - 1] = k + 1
        const s = this.succs[top][k]
        if (!visited[s]) {
          visited[s] = true
          stack.push(s)
          next.push(0)
        }
      } else {
        stack.pop()
        next.pop()
        post.push(top)
      }
    }
    const order: i32[] = []
    let i = post.length - 1
    while (i >= 0) {
      this.rpoNum[post[i]] = order.length
      order.push(post[i])
      i = i - 1
    }
    this.idom[n] = n
    let changed = true
    while (changed) {
      changed = false
      for (const node of order) {
        if (node === n) {
          continue
        }
        let chosen = -1
        for (const p of this.preds[node]) {
          if (this.idom[p] < 0) {
            continue
          }
          chosen = chosen < 0 ? p : this.intersect(p, chosen)
        }
        if (chosen !== this.idom[node]) {
          this.idom[node] = chosen
          changed = true
        }
      }
    }
  }

  intersect(a: i32, b: i32): i32 {
    let x = a
    let y = b
    while (x !== y) {
      while (this.rpoNum[x] > this.rpoNum[y]) {
        x = this.idom[x]
      }
      while (this.rpoNum[y] > this.rpoNum[x]) {
        y = this.idom[y]
      }
    }
    return x
  }

  /** Whether block `a` dominates block `b`; a block no entry reaches is dominated by everything. */
  dominates(a: i32, b: i32): boolean {
    if (this.rpoNum[b] < 0) {
      return true
    }
    const n = this.blocks.length
    let x = b
    while (true) {
      if (x === a) {
        return true
      }
      if (x === n) {
        return false
      }
      x = this.idom[x]
    }
  }

  run(): void {
    let b = 0
    while (b < this.blocks.length) {
      const instrs = this.blocks[b].instructions
      let i = 0
      while (i < instrs.length) {
        const def = this.defName(instrs[i])
        if (def.length > 0) {
          this.defBlock.set(def, b)
          this.defIndex.set(def, i)
          this.defSlots.set(def, this.defTexts.length)
          this.defTexts.push(withoutMetadata(instrs[i]).substring(def.length + 4))
        }
        i = i + 1
      }
      const none: string[] = []
      this.endReloads.push(none)
      b = b + 1
    }
    this.pass()
    if (this.spillTypes.length === 0) {
      return
    }
    this.rewriting = true
    this.pass()
  }

  /** The `%name` an instruction defines, without the sigil, or "". */
  defName(instr: string): string {
    if (instr.length === 0 || instr.charCodeAt(0) !== 37) {
      return ""
    }
    const end = irNameEnd(instr, 0)
    if (instr.substring(end, end + 3) !== " = ") {
      return ""
    }
    return instr.substring(1, end)
  }

  pass(): void {
    let b = 0
    while (b < this.blocks.length) {
      const block = this.blocks[b]
      const out: string[] = []
      const phiStores: string[] = []
      let i = 0
      while (i < block.instructions.length) {
        const instr = block.instructions[i]
        const def = this.defName(instr)
        const body = def.length > 0 ? instr.substring(def.length + 4) : instr
        const isPhi = body.startsWith("phi ")
        this.pending = []
        const rewritten = isPhi ? this.phiUses(instr, def.length + 4) : this.uses(instr, def.length + 4, b, i)
        for (const reload of this.pending) {
          out.push(reload)
        }
        out.push(rewritten)
        if (def.length > 0 && this.spilled.has(def)) {
          const k = this.spilled.get(def, 0)
          const store = `store ${this.spillTypes[k]} %${def}, ${this.spillTypes[k]}* %async.spill.${k}`
          if (isPhi) {
            phiStores.push(store)
          } else {
            out.push(store)
          }
        }
        const nextIsPhi =
          i + 1 < block.instructions.length && block.instructions[i + 1].indexOf(" = phi ") > 0
        if (isPhi && !nextIsPhi) {
          for (const store of phiStores) {
            out.push(store)
          }
        }
        i = i + 1
      }
      if (this.rewriting) {
        block.instructions = out
      }
      b = b + 1
    }
    if (!this.rewriting) {
      return
    }
    b = 0
    while (b < this.blocks.length) {
      const extra = this.endReloads[b]
      if (extra.length > 0) {
        const instrs = this.blocks[b].instructions
        const last = instrs[instrs.length - 1]
        const out: string[] = []
        let i = 0
        while (i < instrs.length - 1) {
          out.push(instrs[i])
          i = i + 1
        }
        for (const reload of extra) {
          out.push(reload)
        }
        out.push(last)
        this.blocks[b].instructions = out
      }
      b = b + 1
    }
  }

  /** Mark (pass one) or reload (pass two) the def `name` used where it is not dominated; answer the name to use. */
  reach(name: string, dominated: boolean, endOf: i32): string {
    if (dominated) {
      return name
    }
    let k = this.spilled.get(name, -1)
    if (k < 0) {
      k = this.spillTypes.length
      this.spilled.set(name, k)
      this.spillTypes.push(this.typeOfDef(this.defTexts[this.defSlots.get(name, 0)], name))
    }
    if (!this.rewriting) {
      return name
    }
    const reload = `async.reload.${this.reloads}`
    this.reloads = this.reloads + 1
    const line = `%${reload} = load ${this.spillTypes[k]}, ${this.spillTypes[k]}* %async.spill.${k}`
    if (endOf >= 0) {
      this.endReloads[endOf].push(line)
    } else {
      this.pending.push(line)
    }
    return reload
  }

  /** `instr` with every non-dominated use from `from` on rewritten; the use is at instruction `i` of block `b`. */
  uses(instr: string, from: i32, b: i32, i: i32): string {
    const out = new StringBuilder()
    out.add(instr.substring(0, from))
    let at = from
    let copied = from
    while (at < instr.length) {
      if (instr.charCodeAt(at) !== 37) {
        at = at + 1
        continue
      }
      const end = irNameEnd(instr, at)
      const name = instr.substring(at + 1, end)
      const isLabel = at >= 6 && instr.substring(at - 6, at) === "label "
      if (!isLabel && this.defBlock.has(name)) {
        const db = this.defBlock.get(name, 0)
        const dominated = db === b ? this.defIndex.get(name, 0) < i : this.dominates(db, b)
        const use = this.reach(name, dominated, -1)
        out.add(instr.substring(copied, at + 1))
        out.add(use)
        copied = end
      }
      at = end
    }
    out.add(instr.substring(copied))
    return out.toText()
  }

  /** A phi's incoming values, each used at the end of its predecessor. */
  phiUses(instr: string, from: i32): string {
    const out = new StringBuilder()
    let copied = 0
    let open = instr.indexOf("[ ", from)
    while (open >= 0) {
      const close = instr.indexOf(" ]", open)
      const pair = instr.substring(open + 2, close)
      const comma = lastIndexIn(pair, ", %")
      const pred = this.labels.get(pair.substring(comma + 3), -1)
      const value = pair.substring(0, comma)
      if (value.startsWith("%") && this.defBlock.has(value.substring(1)) && pred >= 0) {
        const name = value.substring(1)
        const use = this.reach(name, this.dominates(this.defBlock.get(name, 0), pred), pred)
        out.add(instr.substring(copied, open + 2))
        out.add(`%${use}`)
        copied = open + 2 + comma
      }
      open = instr.indexOf("[ ", close)
    }
    out.add(instr.substring(copied))
    return out.toText()
  }

  /** The LLVM type of the value an instruction defines, read off its text (`rest` is after `%x = `). */
  typeOfDef(rest: string, name: string): string {
    const op = wordAt(rest, 0)
    const after = op.length + 1
    if (op === "load" || op === "phi" || op === "freeze" || op === "insertvalue" || op === "insertelement") {
      return typeAt(rest, skipFlags(rest, after))
    }
    if (op === "select") {
      const comma = topComma(rest, after)
      return typeAt(rest, comma + 2)
    }
    if (op === "icmp" || op === "fcmp") {
      let at = skipFlags(rest, after)
      at = at + wordAt(rest, at).length + 1
      const type = typeAt(rest, at)
      if (type.startsWith("<")) {
        return `<${type.substring(1, type.indexOf(" x "))} x i1>`
      }
      return "i1"
    }
    if (isWordIn(BINARY_OPS, op)) {
      return typeAt(rest, skipFlags(rest, after))
    }
    if (isWordIn(CAST_OPS, op)) {
      const to = lastIndexIn(rest, " to ")
      return typeAt(rest, to + 4)
    }
    if (op === "call" || op === "tail" || op === "musttail" || op === "notail") {
      let at = skipFlags(rest, 0)
      if (wordAt(rest, at) === "call") {
        at = skipFlags(rest, at + 5)
      }
      return typeAt(rest, at)
    }
    if (op === "getelementptr") {
      // The first index steps over the pointer; each later one enters a component.
      const at = skipFlags(rest, after)
      const source = typeAt(rest, at)
      const parts = splitTop(rest.substring(at + source.length))
      let type = source
      let k = 2
      while (k < parts.length) {
        const index = parts[k]
        type = this.component(type, leadingNumber(index.substring(index.indexOf(" ") + 1)))
        k = k + 1
      }
      return `${type}*`
    }
    if (op === "extractvalue") {
      const aggregate = typeAt(rest, after)
      const tail = rest.substring(after + aggregate.length)
      const parts = splitTop(tail)
      let type = aggregate
      let k = 1
      while (k < parts.length) {
        type = this.component(type, leadingNumber(parts[k]))
        k = k + 1
      }
      return type
    }
    if (op === "extractelement") {
      const vector = typeAt(rest, after)
      return vector.substring(vector.indexOf(" x ") + 3, vector.length - 1)
    }
    if (op === "atomicrmw") {
      const comma = topComma(rest, after)
      return typeAt(rest, comma + 2)
    }
    if (op === "cmpxchg") {
      const comma = topComma(rest, after)
      return `{ ${typeAt(rest, comma + 2)}, i1 }`
    }
    asyncFail(this.emitter, `cannot keep \`%${name} = ${op} ...\` across an await`)
    return ""
  }

  /** Field `index` of the aggregate `type`. */
  component(type: string, index: i32): string {
    let t = type
    if (t.startsWith("%")) {
      t = this.sizer.body(t)
    }
    if (t.startsWith("[") || (t.startsWith("<") && !t.startsWith("<{"))) {
      return t.substring(t.indexOf(" x ") + 3, t.length - 1)
    }
    const packed = t.startsWith("<{")
    const fields = splitTop(packed ? t.substring(2, t.length - 2) : t.substring(1, t.length - 1))
    if (index < 0 || index >= fields.length) {
      asyncFail(this.emitter, `no field ${index} in \`${type}\``)
      return ""
    }
    return fields[index]
  }
}

/**
 * Rewrite the function `emitFunction` just emitted for the suspending `sig`
 * into its resume function, and declare its frame type.
 */
export const transformAsync = (emitter: Emitter, sig: FunctionSig): void => {
  const fn = emitter.fn
  const registry = emitter.asyncRegistry
  const id = registry.idOf(sig.name)
  registry.frameModules[id] = registry.module
  const frame = `%frame.${sig.name}`
  const rest = `%frame.${sig.name}.rest`
  const head: string[] = ["i32"]
  for (const param of fn.params) {
    head.push(param.type)
  }
  const answer = fn.returnType
  const answerIndex = head.length
  if (answer !== "void") {
    head.push(answer)
  }
  const restIndex = head.length

  // Every `ret` stores the answer and the finished state, and answers true.
  for (const block of fn.blocks) {
    const out: string[] = []
    for (const instr of block.instructions) {
      if (!instr.startsWith("ret ")) {
        out.push(instr)
        continue
      }
      const meta = metadataOf(instr)
      const plain = withoutMetadata(instr)
      if (plain !== "ret void") {
        const type = typeAt(plain, 4)
        out.push(`store ${type} ${plain.substring(4 + type.length + 1)}, ${type}* %async.answer${meta}`)
      }
      out.push(`store i32 -1, i32* %async.state${meta}`)
      out.push(`ret i1 true${meta}`)
    }
    block.instructions = out
  }

  // The allocas become fields of the frame, aligned as they asked.
  const typeText = `\n${emitter.module.typeDecls.join("\n")}\n`
  const sizer = new TypeSizer(typeText, indexTypes(typeText), null, true, emitter.opts.json)
  const restFields: string[] = [`[${KIDS_MARK}${id}${MARK_END} x <2 x i64>]`]
  const slotLines: string[] = []
  for (const line of fn.entryPrelude) {
    const eq = line.indexOf(" = alloca ")
    const slot = line.substring(0, eq)
    const typeFrom = eq + 10
    const type = typeAt(line, typeFrom)
    const alignAt = line.indexOf(", align ", typeFrom + type.length)
    const align = alignAt < 0 ? 0 : leadingNumber(line.substring(alignAt + 8))
    if (align > 16) {
      asyncFail(emitter, `\`${slot}\` asks for alignment ${align}`)
    }
    sizer.measure(type)
    const field = restFields.length
    if (align > 0 && (sizer.align < 0 || align > sizer.align)) {
      const pad = align === 16 ? "<2 x i64>" : `i${align * 8}`
      restFields.push(`{ [0 x ${pad}], ${type} }`)
      slotLines.push(
        `${slot} = getelementptr inbounds ${rest}, ${rest}* %async.rest, i32 0, i32 ${field}, i32 1`
      )
    } else {
      restFields.push(type)
      slotLines.push(`${slot} = getelementptr inbounds ${rest}, ${rest}* %async.rest, i32 0, i32 ${field}`)
    }
  }
  fn.entryPrelude = []

  const demoter = new Demoter(emitter, emitter.asyncPolls, sizer)
  demoter.run()
  const spillLines: string[] = []
  let k = 0
  while (k < demoter.spillTypes.length) {
    spillLines.push(
      `%async.spill.${k} = getelementptr inbounds ${rest}, ${rest}* %async.rest, i32 0, i32 ${restFields.length}`
    )
    restFields.push(demoter.spillTypes[k])
    k = k + 1
  }

  const bad = new IRBlock("async.bad")
  bad.instructions.push("unreachable")
  const finished = new IRBlock("async.finished")
  finished.instructions.push("ret i1 true")
  const suspend = new IRBlock("async.suspend")
  suspend.instructions.push("ret i1 false")
  fn.blocks.push(bad)
  fn.blocks.push(finished)
  fn.blocks.push(suspend)

  const entry = new IRBlock("async.entry")
  const e = entry.instructions
  e.push(`%async.frame = bitcast i8* %async.raw to ${frame}*`)
  e.push(`%async.state = getelementptr inbounds ${frame}, ${frame}* %async.frame, i32 0, i32 0`)
  let p = 0
  while (p < fn.params.length) {
    const param = fn.params[p]
    const value = paramValue(param.name)
    e.push(`${value}.at = getelementptr inbounds ${frame}, ${frame}* %async.frame, i32 0, i32 ${p + 1}`)
    e.push(`${value} = load ${param.type}, ${param.type}* ${value}.at`)
    p = p + 1
  }
  if (answer !== "void") {
    e.push(
      `%async.answer = getelementptr inbounds ${frame}, ${frame}* %async.frame, i32 0, i32 ${answerIndex}`
    )
  }
  e.push(`%async.rest = getelementptr inbounds ${frame}, ${frame}* %async.frame, i32 0, i32 ${restIndex}`)
  e.push(`%async.kids = bitcast ${rest}* %async.rest to i8*`)
  for (const line of slotLines) {
    e.push(line)
  }
  for (const line of spillLines) {
    e.push(line)
  }
  e.push("%async.at = load i32, i32* %async.state")
  const cases: string[] = [`i32 0, label %${fn.blocks[0].label}`, "i32 -1, label %async.finished"]
  let state = 0
  while (state < emitter.asyncPolls.length) {
    cases.push(`i32 ${state + 1}, label %${emitter.asyncPolls[state]}`)
    state = state + 1
  }
  e.push(`switch i32 %async.at, label %async.bad [ ${cases.join(" ")} ]`)
  const blocks: IRBlock[] = [entry]
  for (const block of fn.blocks) {
    blocks.push(block)
  }
  fn.blocks = blocks

  fn.name = `${sig.name}.resume`
  const params: IRParam[] = [new IRParam("async.raw", "i8*", [])]
  fn.params = params
  fn.returnType = "i1"
  fn.returnAttrs = []
  if (emitter.opts.optimizeAttributes) {
    fn.attrGroup = emitter.module.attrGroupFor(["nounwind"])
  }
  head.push(rest)
  emitter.module.addTypeDecl(`${frame} = type { ${head.join(", ")} }`)
  emitter.module.addTypeDecl(`${rest} = type { ${restFields.join(", ")} }`)
}

// ---- The whole program ----------------------------------------------------

/**
 * Whether the line holding `at` is metadata, a comment or `source_filename`,
 * which spell the program's file paths without `irEscape` and never hold a
 * placeholder, so a path that happens to look like one is left as written.
 */
const writtenFromPaths = (text: string, at: i32): boolean => {
  let start = at
  while (start > 0 && text.charCodeAt(start - 1) !== 10) {
    start = start - 1
  }
  const head = text.charCodeAt(start)
  return head === 33 || head === 59 || text.substring(start, start + 15) === "source_filename"
}

/** The frame sizes, once every module is emitted. */
class AsyncLayout {
  registry: AsyncRegistry
  texts: string[]
  kidsMemo: i32[]
  unitsMemo: i32[]
  /** Each module's `indexTypes`, built on its first frame. */
  typeIndexes: StringMap[]
  typeIndexed: boolean[]

  constructor(registry: AsyncRegistry, texts: string[]) {
    this.registry = registry
    this.texts = texts
    this.kidsMemo = []
    this.unitsMemo = []
    this.typeIndexes = []
    this.typeIndexed = []
    for (const _ of texts) {
      this.typeIndexes.push(new StringMap())
      this.typeIndexed.push(false)
    }
    for (const _ of registry.frameNames) {
      this.kidsMemo.push(-1)
      this.unitsMemo.push(-1)
    }
  }

  asyncFail(message: string): void {
    process.exit(internalErrorFor(`async lowering: ${message}`, this.registry.json))
  }

  /** The 16-byte units frame `id`'s kids area takes: the widest group it owns. */
  kids(id: i32): i32 {
    if (this.kidsMemo[id] >= 0) {
      return this.kidsMemo[id]
    }
    if (this.kidsMemo[id] === -2) {
      this.asyncFail(`\`${this.registry.frameNames[id]}\` holds its own frame`)
    }
    this.kidsMemo[id] = -2
    let most = 0
    let g = 0
    while (g < this.registry.groupOwners.length) {
      if (this.registry.groupOwners[g] === id) {
        let sum = 0
        for (const member of this.registry.groupMembers[g]) {
          sum = sum + this.units(member)
        }
        if (sum > most) {
          most = sum
        }
      }
      g = g + 1
    }
    this.kidsMemo[id] = most
    return most
  }

  /** The 16-byte units frame `id` takes. */
  units(id: i32): i32 {
    if (this.unitsMemo[id] >= 0) {
      return this.unitsMemo[id]
    }
    const module = this.registry.frameModules[id]
    if (module < 0 || module >= this.texts.length) {
      this.asyncFail(`the frame of \`${this.registry.frameNames[id]}\` was not emitted`)
    }
    if (!this.typeIndexed[module]) {
      this.typeIndexes[module] = indexTypes(this.texts[module])
      this.typeIndexed[module] = true
    }
    const sizer = new TypeSizer(this.texts[module], this.typeIndexes[module], this, false, this.registry.json)
    sizer.measure(`%frame.${this.registry.frameNames[id]}`)
    const units = (sizer.size + 15) >> 4
    this.unitsMemo[id] = units
    return units
  }

  /** Where member `member` of group `group` starts, in bytes. */
  offset(group: i32, member: i32): i32 {
    let bytes = 0
    let j = 0
    while (j < member) {
      bytes = bytes + 16 * this.units(this.registry.groupMembers[group][j])
      j = j + 1
    }
    return bytes
  }

  /** `text` with every placeholder replaced by its number. */
  resolve(text: string): string {
    const out = new StringBuilder()
    let copied = 0
    let at = text.indexOf(MARK_START)
    while (at >= 0) {
      if (writtenFromPaths(text, at)) {
        const lineEnd = text.indexOf("\n", at)
        at = lineEnd < 0 ? -1 : text.indexOf(MARK_START, lineEnd)
        continue
      }
      const end = text.indexOf(MARK_END, at + 1)
      const mark = text.substring(at, end)
      let value = 0
      if (mark.startsWith(KIDS_MARK)) {
        value = this.kids(leadingNumber(mark.substring(KIDS_MARK.length)))
      } else if (mark.startsWith(BYTES_MARK)) {
        value = NODE_HEADER + 16 * this.units(leadingNumber(mark.substring(BYTES_MARK.length)))
      } else {
        const pair = mark.substring(OFF_MARK.length)
        const dot = pair.indexOf(".")
        value = this.offset(leadingNumber(pair), leadingNumber(pair.substring(dot + 1)))
      }
      out.add(text.substring(copied, at))
      out.add(`${value}`)
      copied = end + 1
      at = text.indexOf(MARK_START, copied)
    }
    out.add(text.substring(copied))
    return out.toText()
  }
}

const removeLine = (text: string, line: string): string => {
  const at = text.indexOf(`${line}\n`)
  if (at < 0) {
    return text
  }
  return text.substring(0, at) + text.substring(at + line.length + 1)
}

/** The queue, its driver, and the resume switch over the task kinds, for the module that holds them. */
const driverText = (registry: AsyncRegistry, text: string): string => {
  const attrs = `nounwind ${HARDENING_ATTRS}`
  const out = new StringBuilder()
  out.add("\n; WP49 stage 4: the in-process task queue (docs/wp49-async-server.md)\n")
  out.add("@nish.async.head = internal global i8* null, align 8\n")
  out.add("@nish.async.tail = internal global i8* null, align 8\n\n")
  if (text.indexOf("declare void @free(i8*)") < 0) {
    out.add("declare void @free(i8*)\n")
  }
  if (text.indexOf("declare void @llvm.trap()") < 0) {
    out.add("declare void @llvm.trap()\n")
  }
  let kind = 0
  while (kind < registry.spawnFrames.length) {
    if (text.indexOf(`@nish.async.task.${kind}(`) < 0) {
      out.add(`declare hidden i1 @nish.async.task.${kind}(i8*)\n`)
    }
    kind = kind + 1
  }
  out.add(`
define hidden void @nish.async.enqueue(i8* %node) ${attrs} {
entry:
  %link = bitcast i8* %node to i8**
  store i8* null, i8** %link, align 8
  %tail = load i8*, i8** @nish.async.tail, align 8
  %empty = icmp eq i8* %tail, null
  br i1 %empty, label %first, label %append

first:
  store i8* %node, i8** @nish.async.head, align 8
  br label %done

append:
  %prev = bitcast i8* %tail to i8**
  store i8* %node, i8** %prev, align 8
  br label %done

done:
  store i8* %node, i8** @nish.async.tail, align 8
  ret void
}

define hidden i1 @nish.async.step() ${attrs} {
entry:
  %first = load i8*, i8** @nish.async.head, align 8
  store i8* null, i8** @nish.async.head, align 8
  store i8* null, i8** @nish.async.tail, align 8
  br label %loop

loop:
  %node = phi i8* [ %first, %entry ], [ %next, %advance ]
  %progress = phi i1 [ false, %entry ], [ %progress.next, %advance ]
  %more = icmp ne i8* %node, null
  br i1 %more, label %run, label %out

run:
  %link = bitcast i8* %node to i8**
  %next = load i8*, i8** %link, align 8
  %kind.at = getelementptr inbounds i8, i8* %node, i64 8
  %kind.ptr = bitcast i8* %kind.at to i32*
  %kind = load i32, i32* %kind.ptr, align 8
  %frame = getelementptr inbounds i8, i8* %node, i64 ${NODE_HEADER}
  %finished = call i1 @nish.async.resume(i32 %kind, i8* %frame)
  br i1 %finished, label %release, label %again

release:
  call void @free(i8* %node)
  br label %advance

again:
  call void @nish.async.enqueue(i8* %node)
  br label %advance

advance:
  %progress.next = or i1 %progress, %finished
  br label %loop

out:
  ret i1 %progress
}

define hidden void @nish.async.drain() ${attrs} {
entry:
  br label %check

check:
  %head = load i8*, i8** @nish.async.head, align 8
  %empty = icmp eq i8* %head, null
  br i1 %empty, label %done, label %step

step:
  %progress = call i1 @nish.async.step()
  br i1 %progress, label %check, label %stuck

stuck:
  call void @llvm.trap()
  unreachable

done:
  ret void
}

define internal i1 @nish.async.resume(i32 %kind, i8* %frame) ${attrs} {
entry:
`)
  const cases: string[] = []
  kind = 0
  while (kind < registry.spawnFrames.length) {
    cases.push(`i32 ${kind}, label %kind.${kind}`)
    kind = kind + 1
  }
  out.add(`  switch i32 %kind, label %bad [ ${cases.join(" ")} ]\n`)
  kind = 0
  while (kind < registry.spawnFrames.length) {
    out.add(
      `\nkind.${kind}:\n  %done.${kind} = call i1 @nish.async.task.${kind}(i8* %frame)\n  ret i1 %done.${kind}\n`
    )
    kind = kind + 1
  }
  out.add("\nbad:\n  call void @llvm.trap()\n  unreachable\n}\n")
  return out.toText()
}

/**
 * After every module is emitted: size the frames, write the sizes in, and
 * add the driver to the module that holds it. A program with no suspending
 * function and no driver is left exactly as it was.
 */
export const finalizeAsync = (registry: AsyncRegistry, texts: string[]): string[] => {
  if (registry.frameNames.length === 0 && !registry.usesDriver) {
    return texts
  }
  const layout = new AsyncLayout(registry, texts)
  const out: string[] = []
  for (const text of texts) {
    out.push(layout.resolve(text))
  }
  if (registry.usesDriver) {
    const host = registry.host >= 0 ? registry.host : registry.driverModule
    let text = out[host]
    text = removeLine(text, ENQUEUE_DECL)
    text = removeLine(text, STEP_DECL)
    text = removeLine(text, DRAIN_DECL)
    out[host] = text + driverText(registry, text)
  }
  return out
}
