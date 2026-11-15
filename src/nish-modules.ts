// The `nish:` modules for stage1 (stage0's `src/checker/nish-modules.ts`): the builtins
// a program may import by name instead of reaching for them as globals.
//
// A `nish:` specifier resolves to nothing on disk. There is no file to load,
// no signature to bind and no symbol to declare — the import *renames a
// builtin the checker already has*, so an imported `readFileSync` goes through
// the same check and lowers to the same IR as the global spelling.
//
// stage0 holds this as a table of objects and derives the diagnostics' lists
// from its keys. Here it is an `if` chain and the lists are written out, for
// the reason `builtins.ts` is an `if` chain: the language has no object
// literal to key by name, and a `StringMap` built at module load needs
// top-level code the language does not have either (its one mutable global,
// module storage, is zero-filled and holds no map). The lists therefore have
// to stay in the same order as stage0's table — the `.err` goldens match on
// the whole sentence.

import { BUILTIN_SCHEME } from "./branding"

/** One name a `nish:` module exports, and the builtin it stands for. */
export class BuiltinExport {
  /**
   * The spelling the builtin checkers are keyed by. It differs from the
   * exported name where the global form is dotted: `nish:process` exports
   * `exit`, and both compilers know it as `process.exit`.
   */
  canonical: string
  /**
   * The two halves of `canonical`, so that a dotted builtin can be dispatched
   * without taking the name apart again: `"process"` and `"exit"` for
   * `process.exit`, and `""` with the name itself for an undotted one like
   * `readFileSync`. stage0 looks the whole dotted name up in a table and needs
   * neither; here every builtin is reached through a namespace and a member,
   * so the pair is what the checkers actually want.
   */
  namespace: string
  member: string
  /**
   * Whether the name is read as a value rather than called. The two take
   * different paths on both sides, so the kind is carried rather than guessed
   * from the name.
   */
  isProperty: boolean

  constructor(namespace: string, member: string, isProperty: boolean) {
    this.canonical = namespace.length > 0 ? `${namespace}.${member}` : member
    this.namespace = namespace
    this.member = member
    this.isProperty = isProperty
  }
}

/**
 * Whether a specifier names a builtin module. A specifier that starts with
 * `nish:` is always one, even when the name after it is not a module: an
 * unknown `nish:sqlite` has to be reported as a bad module rather than as the
 * missing file it would become if it fell through to path resolution.
 */
export const isNishSpecifier = (specifier: string): boolean => specifier.startsWith(BUILTIN_SCHEME)

/**
 * `nish:unsafe`: the functions whose behaviour depends on the program being
 * right, where every other builtin checks. An unchecked element access is
 * undefined behaviour out of range, a wrapping operation is defined where
 * the operator it replaces is not, `readCString` (WP27 S3.3) reads a C
 * address until a `NUL` nothing proves is there, and `readStruct` (S4.2)
 * copies a struct's worth of bytes from one (each after a `NULL` test that
 * panics with `ffi-null`; nothing checks the `NUL` or the size), so a call to any of them has
 * to be visible where it is written. `cErrno` (WP27 S5) checks nothing either:
 * it answers whatever the last foreign call left, which is only meaningful
 * where C documents that it sets errno. The eight are reached only through an import of this module
 * (`isUnsafeExport`, and `checkBuiltinFunction` for the global spelling).
 */
export const unsafeModule = (): string => `${BUILTIN_SCHEME}unsafe`

/** Whether `nish:unsafe` exports `name`. */
export const isUnsafeExport = (name: string): boolean =>
  name === "uncheckedGet" ||
  name === "uncheckedSet" ||
  name === "wrappingAdd" ||
  name === "wrappingSub" ||
  name === "wrappingMul" ||
  name === "readCString" ||
  name === "readStruct" ||
  name === "cErrno"

/**
 * `nish:simd` (WP38 S3, docs/LANGUAGE.md, "Vectors"): the six 128-bit vector
 * types and the functions over them. Unlike every other builtin module its
 * names are not renames of globals: a vector type is spelled, and a vector
 * function called, only under an import of this module, so a program that
 * never imports it reads exactly as it did before vectors existed.
 */
export const SIMD_SPECIFIER: string = "nish:simd"

/** The six vector type names, which are also their constructors, in table order. */
const SIMD_TYPE_NAMES: string = "u8x16, u16x8, i32x4, u32x4, f32x4, f64x2"

/** The four mask type names, narrowest lane first; a mask is a type and not a function. */
const SIMD_MASK_NAMES: string = "mask8x16, mask16x8, mask32x4, mask64x2"

/**
 * The lane operations (WP38 S3 "s3-ops", docs/wp38-simd.md §3.2), in the
 * order the module's export list spells them. Each takes its vectors whole
 * and is chosen by its first argument's type, so one name serves every
 * vector it applies to.
 */
const SIMD_OP_NAMES: string =
  "add, sub, mul, div, neg, abs, sqrt, addWrapping, subWrapping, mulWrapping, and, or, xor, not, min, max, " +
  "eq, ne, lt, le, gt, ge, select, any, all, bitmask, sum, sumWrapping, shuffle, shl, shr, rotl, rotr, " +
  "asU8x16, asU16x8, asI32x4, asU32x4, asF32x4, asF64x2"

/**
 * Whether `nish:simd` exports `name`: a type (which is also its constructor),
 * its `splat` and its `load`, a mask type, or one of the functions every
 * vector shares.
 */
export const isSimdExport = (name: string): boolean =>
  simdTypeLane(name).length > 0 ||
  simdTypeLane(simdSuffix(name, "splat")).length > 0 ||
  simdTypeLane(simdSuffix(name, "load")).length > 0 ||
  name === "store" ||
  name === "extract" ||
  name === "replace" ||
  simdMaskWidth(name) > 0 ||
  isSimdOp(name)

/** Whether `name` is one of the lane operations in `SIMD_OP_NAMES`. */
export const isSimdOp = (name: string): boolean => {
  if (name.length === 0 || name.indexOf(",") >= 0 || name.indexOf(" ") >= 0) {
    return false
  }
  const list = `, ${SIMD_OP_NAMES}, `
  return list.indexOf(`, ${name}, `) >= 0
}

/** The lane width in bits a mask type's name spells (`32` for `mask32x4`), or 0 for anything else. */
export const simdMaskWidth = (name: string): i32 => {
  if (name === "mask8x16") {
    return 8
  }
  if (name === "mask16x8") {
    return 16
  }
  if (name === "mask32x4") {
    return 32
  }
  return name === "mask64x2" ? 64 : 0
}

/**
 * The lane name of a vector type name: `u8` for `u8x16`, and "" for anything
 * else. The checker turns it into a type, so this file needs no type table.
 */
export const simdTypeLane = (name: string): string => {
  if (name === "u8x16") {
    return "u8"
  }
  if (name === "u16x8") {
    return "u16"
  }
  if (name === "i32x4") {
    return "i32"
  }
  if (name === "u32x4") {
    return "u32"
  }
  if (name === "f32x4") {
    return "f32"
  }
  return name === "f64x2" ? "f64" : ""
}

/**
 * The type a `splat` or `load` name is of, as the type spells it: `u8x16` for
 * `splatU8x16` under the prefix `splat`, and "" when `name` is not the prefix
 * and a capitalised type name.
 */
export const simdSuffix = (name: string, prefix: string): string => {
  if (!name.startsWith(prefix) || name.length <= prefix.length) {
    return ""
  }
  // The six lane types start with `u`, `i` or `f`, so those three capitals are
  // the only ones a type name can follow the prefix with.
  const first = name.charCodeAt(prefix.length)
  const rest = name.slice(prefix.length + 1)
  if (first === 85) {
    return `u${rest}`
  }
  if (first === 73) {
    return `i${rest}`
  }
  return first === 70 ? `f${rest}` : ""
}

/**
 * `nish:async` (WP49, docs/LANGUAGE.md, "Async functions"): `spawn`, which
 * starts an async call and keeps no answer, and `awaitAll`, which awaits
 * several at once. Neither is a function a value could reach: each takes
 * direct calls to async functions, and the checker holds them to that
 * (`src/async-check.ts`). They are dotted under `async` so that `spawn` is
 * not `nish:process`'s, which the global name already is. Stage 5 adds the
 * waits on the executor, `sleep`, `readable` and `writable`, each written
 * only as `await sleep(ms)`; part 7 the bounded waits `readableWithin` and
 * `writableWithin`, and the cancellation calls `taskId`, `cancel`,
 * `cancelled` and `cancelAfter`, which are plain calls.
 */
const ASYNC_SPECIFIER: string = "nish:async"

const isAsyncExport = (name: string): boolean =>
  name === "spawn" ||
  name === "awaitAll" ||
  name === "sleep" ||
  name === "readable" ||
  name === "writable" ||
  name === "readableWithin" ||
  name === "writableWithin" ||
  name === "taskId" ||
  name === "cancel" ||
  name === "cancelled" ||
  name === "cancelAfter"

/**
 * Whether `canonical`, a builtin's canonical name, is a `nish:async` call on
 * the executor's state: a wait (`async.sleep`, `async.readable`, ...) or a
 * cancellation call (`async.cancel`, ...). Each writes the executor, and a
 * wait may suspend its function, so the attribute walk gives them the same
 * facts.
 */
export const isExecutorCall = (canonical: string): boolean =>
  canonical.startsWith("async.") && canonical !== "async.spawn" && canonical !== "async.awaitAll"

/** Whether the specifier is a module that exists. */
export const isNishModule = (specifier: string): boolean =>
  specifier === `${BUILTIN_SCHEME}fs` ||
  specifier === `${BUILTIN_SCHEME}process` ||
  specifier === `${BUILTIN_SCHEME}io` ||
  specifier === `${BUILTIN_SCHEME}net` ||
  specifier === `${BUILTIN_SCHEME}term` ||
  specifier === SIMD_SPECIFIER ||
  specifier === ASYNC_SPECIFIER ||
  specifier === unsafeModule() ||
  isNishSourceModule(specifier)

/** Every module name, for the diagnostic that lists them. */
export const nishModuleNames = (): string =>
  `${BUILTIN_SCHEME}fs, ${BUILTIN_SCHEME}process, ${BUILTIN_SCHEME}io, ${BUILTIN_SCHEME}net, ${BUILTIN_SCHEME}term, ${BUILTIN_SCHEME}secret, ${BUILTIN_SCHEME}region, ${SIMD_SPECIFIER}, ${ASYNC_SPECIFIER}, ${unsafeModule()}`

/**
 * `nish:secret`: key material and the rules that keep it in (docs/LANGUAGE.md,
 * "Secrets"). It is a builtin module that, unlike the others, has source
 * behind it: `Secret<T>` is a generic class and `expose` a template taking a
 * function parameter, and both are ordinary Nish once the checker knows which
 * module declared them. So the specifier resolves to `std/secret.ts`, loaded
 * like a standard-library module, and the rules are keyed on that module
 * (`src/secret.ts`). Its one primitive, `wipe`, is lowered by the emitter.
 */
export const SECRET_SPECIFIER: string = "nish:secret"

/**
 * `nish:region`: memory a program frees when it says so (docs/LANGUAGE.md,
 * "Regions"). Like `nish:secret` it has source behind it, `std/region.ts`,
 * whose rules are keyed on that module (`src/region-check.ts`) and whose
 * five functions the emitter writes (`src/emit-region.ts`).
 */
export const REGION_SPECIFIER: string = "nish:region"

/** Whether a `nish:` specifier is one with source behind it, resolved and bound as a module rather than renamed. */
export const isNishSourceModule = (specifier: string): boolean =>
  specifier === SECRET_SPECIFIER || specifier === REGION_SPECIFIER

/**
 * Whether an import names a builtin the checker renames, with no file behind
 * it: every `nish:` specifier but `nish:secret` and `nish:region`, an unknown one included, so
 * that it is still reported as a bad module rather than as a missing file.
 */
export const isBuiltinSpecifier = (specifier: string): boolean =>
  isNishSpecifier(specifier) && !isNishSourceModule(specifier)

/** The names one module exports, in table order, for the diagnostic that lists them. */
export const nishModuleExports = (specifier: string): string => {
  if (specifier === `${BUILTIN_SCHEME}fs`) {
    return "readFileSync, readFileSyncOrNull, readFileBytesSync, writeFileSync, appendFileSync, mkdirSync, isDirectorySync, readdirSync, realpathSync, statMtimeSync, renameSync, unlinkSync, writeFileBytesSync, writeFileSyncMode, createFileExclusiveSync, mkdirSyncMode, fileOpen, fileReadAt, fileSize, fileClose"
  }
  if (specifier === `${BUILTIN_SCHEME}process`) {
    return "exit, getenv, spawnSync, spawnSyncTo, spawn, spawnPiped, spawnPipedWithin, spawnWithFds, kill, waitPid, availableParallelism, totalMemory, setNice, setIdlePriority, setCpuAffinity, monotonicNanos, wallClockNanos, signalFd, readSignal, argv, platform, arch"
  }
  if (specifier === `${BUILTIN_SCHEME}net`) {
    return "netAddress, netLocalPort, tcpListen, tcpListenFlags, tcpAccept, netRead, netWrite, netWrite2, netShutdown, netClose, tcpConnect, connectResult, udpBind, udpSendTo, udpRecvFrom, pollCreate, pollAdd, pollModify, pollRemove, pollWait, netSetOption, netMss, unixListen, unixListenMode, unixConnect, unixAccept, unixSocketPair, sendFd, recvFd, peerCredentials, NET_TCP_NODELAY, NET_TCP_QUICKACK, NET_SO_KEEPALIVE, NET_SO_SNDBUF, NET_SO_RCVBUF, NET_UNIX_UNLINK_STALE, NET_UNIX_STREAM, NET_UNIX_SEQPACKET"
  }
  if (specifier === `${BUILTIN_SCHEME}term`) {
    return "readStdin, waitStdin, isTerminal, terminalSize, setRawMode, setTerminalRestore"
  }
  if (specifier === SIMD_SPECIFIER) {
    return `${SIMD_TYPE_NAMES}, splatU8x16, splatU16x8, splatI32x4, splatU32x4, splatF32x4, splatF64x2, loadU8x16, loadU16x8, loadI32x4, loadU32x4, loadF32x4, loadF64x2, store, extract, replace, ${SIMD_MASK_NAMES}, ${SIMD_OP_NAMES}`
  }
  if (specifier === ASYNC_SPECIFIER) {
    return "spawn, awaitAll, sleep, readable, writable, readableWithin, writableWithin, taskId, cancel, cancelled, cancelAfter"
  }
  if (specifier === unsafeModule()) {
    return "uncheckedGet, uncheckedSet, wrappingAdd, wrappingSub, wrappingMul, readCString, readStruct, cErrno"
  }
  return "write, writeError, writeBytes, panic"
}

/**
 * WP34 N5: the parameters of a `nish:net` function, one letter each, or "" for
 * a name `nish:net` does not export (and for `pollCreate`, which takes none). Every one answers an `i32`. The checker,
 * the emitter and the written-argument rule all read this one string, through
 * the letters below, so the three cannot disagree about which argument is
 * which.
 *
 * Each name is a global too, as every `nish:` export is, and each carries a
 * `net`, `tcp`, `udp`, `unix`, `poll` or `connect` prefix, or is one of the
 * three descriptor calls (`sendFd`, `recvFd`, `peerCredentials`), so that none
 * of them collides with a global that already exists (`write`). `pollCreate` takes
 * nothing, so its signature is the one empty answer that is an export
 * (`isNetExport`).
 */
export const netSignature = (name: string): string => {
  if (name === "netAddress") {
    return "wsi"
  }
  if (name === "netLocalPort" || name === "netClose" || name === "connectResult" || name === "netMss") {
    return "i"
  }
  if (name === "tcpListen") {
    return "sii"
  }
  if (name === "tcpListenFlags") {
    return "siii"
  }
  if (name === "tcpAccept") {
    return "iw"
  }
  if (name === "netRead") {
    return "iwnn"
  }
  if (name === "netWrite") {
    return "irnn"
  }
  if (name === "netWrite2") {
    return "irnnrnn"
  }
  if (name === "tcpConnect") {
    return "r"
  }
  if (name === "netShutdown") {
    return "ii"
  }
  if (name === "udpBind") {
    return "sii"
  }
  if (name === "udpSendTo") {
    return "irnnrii"
  }
  if (name === "udpRecvFrom") {
    return "iwnnwm"
  }
  if (name === "pollAdd" || name === "pollModify") {
    return "iiii"
  }
  if (name === "pollRemove") {
    return "ii"
  }
  if (name === "pollWait") {
    return "imi"
  }
  if (name === "netSetOption") {
    return "iii"
  }
  if (name === "unixListen") {
    return "sii"
  }
  if (name === "unixListenMode") {
    return "siii"
  }
  if (name === "unixConnect") {
    return "s"
  }
  if (name === "unixAccept") {
    return "i"
  }
  if (name === "unixSocketPair" || name === "peerCredentials") {
    return "im"
  }
  if (name === "sendFd") {
    return "iirnn"
  }
  if (name === "recvFd") {
    return "iwnnm"
  }
  return ""
}

/**
 * `i`: an `i32` (a descriptor, a port, a backlog, `how`, flags, a segment
 * size, ECN bits, a loop, readiness events, a token, a timeout).
 */
export const NET_INT: i32 = 105
/** `s`: a `string`, a numeric host. */
export const NET_STRING: i32 = 115
/** `w`: a `u8[]` the call writes. */
const NET_WRITTEN: i32 = 119
/** `r`: a `u8[]` the call only reads. */
const NET_READ: i32 = 114
/** `m`: an `i32[]` the call writes, `udpRecvFrom`'s `meta` and `pollWait`'s `ready`. */
export const NET_WORDS: i32 = 109
/**
 * `n`: an `i32` offset or length into the `u8[]` before it, which the call
 * range-checks in the IR and hands to the runtime widened to an `i64`.
 */
export const NET_RANGE: i32 = 110
/** `l`: an `i64` passed as it is, `fileReadAt`'s position. */
export const NET_WIDE: i32 = 108

/** Whether a letter is an array the call writes the elements of: `w` and `m`. */
export const isNetWrittenLetter = (letter: i32): boolean => letter === NET_WRITTEN || letter === NET_WORDS

/** Whether a letter is an array at all: the two written ones and `r`. */
export const isNetBufferLetter = (letter: i32): boolean => isNetWrittenLetter(letter) || letter === NET_READ

/**
 * The buffer letters of a call that takes a range-checked `(buf, off, len)`
 * triple: a `nish:net` signature, `readStdin`'s, which is `netRead`'s
 * without the descriptor, `writeBytes`'s, which is `netWrite`'s to stdout,
 * and `fileReadAt`'s, which is `netRead`'s with an `i64` position after it.
 * One string, so the emitter's range check, the written-argument rule and the
 * panic set read the three as they read `netRead` and `netWrite`.
 */
export const bufferSignature = (name: string): string => {
  if (name === "readStdin") {
    return "wnn"
  }
  if (name === "fileReadAt") {
    return "iwnnl"
  }
  return name === "writeBytes" ? "rnn" : netSignature(name)
}

/**
 * Where a `nish:net` call's first range-checked `(buf, off, len)` triple
 * starts, or -1: the buffer is the argument before the first `n`. `netRead`,
 * `netWrite`, `udpSendTo` and `udpRecvFrom` have one, at 1, `netWrite2` a
 * second at 4 (`isNetRangeBuffer` finds every one), and `readStdin` and
 * `writeBytes` one at 0.
 */
export const netRangeBuffer = (name: string): i32 => {
  const at = bufferSignature(name).indexOf("n")
  return at < 0 ? -1 : at - 1
}

/**
 * Whether argument `at` of `name` is the buffer of a range-checked triple: a
 * buffer letter followed by two `n`s. The emitter checks each such triple.
 */
export const isNetRangeBuffer = (name: string, at: i32): boolean => {
  const params = bufferSignature(name)
  return (
    at >= 0 &&
    at + 2 < params.length &&
    isNetBufferLetter(params.charCodeAt(at)) &&
    params.charCodeAt(at + 1) === NET_RANGE &&
    params.charCodeAt(at + 2) === NET_RANGE
  )
}

/**
 * The runtime-net.c symbol a `nish:net` function lowers to: `nish_` and the
 * name in snake case, so `netLocalPort` is `nish_net_local_port`. Derived
 * rather than listed, so a new export cannot fall through to another's.
 */
export const netSymbol = (name: string): string => {
  const parts: string[] = ["nish_"]
  for (let i = 0; i < name.length; i++) {
    const c = name.charCodeAt(i)
    if (c >= 65 && c <= 90) {
      parts.push("_")
      parts.push(String.fromCharCode(c + 32))
    } else {
      parts.push(String.fromCharCode(c))
    }
  }
  return parts.join("")
}

/**
 * The number an integer constant of `nish:net` folds to, or 0 for a name
 * that is not one. Most are the ids `netSetOption` takes for a socket
 * option: the runtime's own, not the kernel's level and option pair, so that
 * runtime-net.c's switch over them is the whole of what a program can set,
 * with no raw `setsockopt`. The `NET_UNIX_` ones are `unixListen`'s flag and
 * `unixSocketPair`'s two kinds, which share 1 because no call takes both.
 */
export const netOption = (name: string): i32 => {
  if (name === "NET_TCP_NODELAY") {
    return 1
  }
  if (name === "NET_TCP_QUICKACK") {
    return 2
  }
  if (name === "NET_SO_KEEPALIVE") {
    return 3
  }
  if (name === "NET_SO_SNDBUF") {
    return 4
  }
  if (name === "NET_SO_RCVBUF") {
    return 5
  }
  if (name === "NET_UNIX_UNLINK_STALE" || name === "NET_UNIX_STREAM") {
    return 1
  }
  if (name === "NET_UNIX_SEQPACKET") {
    return 2
  }
  return 0
}

/** Whether `nish:net` exports `name`: every name with a signature, and `pollCreate`, whose is empty. */
export const isNetExport = (name: string): boolean => netSignature(name).length > 0 || name === "pollCreate"

/**
 * `nish:term`: the terminal a program runs in (docs/LANGUAGE.md, "Terminal
 * input"). Reading stdin, waiting on it with a timeout, the TTY questions a
 * full-screen program asks, and the bytes it leaves the terminal with, without the `net` capability a `pollAdd(0)`
 * would carry. Each name is a global too, as every `nish:` export is.
 */
export const isTermExport = (name: string): boolean =>
  name === "readStdin" ||
  name === "waitStdin" ||
  name === "isTerminal" ||
  name === "terminalSize" ||
  name === "setRawMode" ||
  name === "setTerminalRestore"

/**
 * WP44: the four builtins that read a regular file a window at a time
 * (docs/LANGUAGE.md, "File I/O"). `nish:fs` exports them, and they are `fs.read`,
 * not `net`, so they stay out of `isNetExport`.
 */
export const isFileStreamExport = (name: string): boolean =>
  name === "fileOpen" || name === "fileReadAt" || name === "fileSize" || name === "fileClose"

/** The builtin `specifier` exports under `name`, or null when it exports no such name. */
export const nishExport = (specifier: string, name: string): BuiltinExport | null => {
  if (specifier === `${BUILTIN_SCHEME}fs`) {
    if (
      name === "readFileSync" ||
      name === "readFileSyncOrNull" ||
      name === "readFileBytesSync" ||
      name === "writeFileSync" ||
      name === "appendFileSync" ||
      name === "mkdirSync" ||
      name === "isDirectorySync" ||
      name === "readdirSync" ||
      name === "realpathSync" ||
      name === "statMtimeSync" ||
      name === "renameSync" ||
      name === "unlinkSync" ||
      name === "writeFileBytesSync" ||
      name === "writeFileSyncMode" ||
      name === "createFileExclusiveSync" ||
      name === "mkdirSyncMode" ||
      isFileStreamExport(name)
    ) {
      return new BuiltinExport("", name, false)
    }
    return null
  }
  if (specifier === `${BUILTIN_SCHEME}process`) {
    if (name === "exit") {
      return new BuiltinExport("process", "exit", false)
    }
    if (
      name === "getenv" ||
      name === "spawnSync" ||
      name === "spawnSyncTo" ||
      name === "spawn" ||
      name === "spawnPiped" ||
      name === "spawnPipedWithin" ||
      name === "spawnWithFds" ||
      name === "kill" ||
      name === "waitPid" ||
      name === "availableParallelism" ||
      name === "totalMemory" ||
      name === "setNice" ||
      name === "setIdlePriority" ||
      name === "setCpuAffinity" ||
      name === "monotonicNanos" ||
      name === "wallClockNanos" ||
      name === "signalFd" ||
      name === "readSignal"
    ) {
      return new BuiltinExport("", name, false)
    }
    if (name === "argv" || name === "platform" || name === "arch") {
      return new BuiltinExport("process", name, true)
    }
    return null
  }
  if (specifier === `${BUILTIN_SCHEME}io`) {
    if (name === "write" || name === "writeError" || name === "writeBytes" || name === "panic") {
      return new BuiltinExport("", name, false)
    }
    return null
  }
  if (specifier === `${BUILTIN_SCHEME}net`) {
    if (netOption(name) > 0) {
      return new BuiltinExport("", name, true)
    }
    return isNetExport(name) ? new BuiltinExport("", name, false) : null
  }
  if (specifier === `${BUILTIN_SCHEME}term`) {
    return isTermExport(name) ? new BuiltinExport("", name, false) : null
  }
  if (specifier === SIMD_SPECIFIER) {
    return isSimdExport(name) ? new BuiltinExport("", name, false) : null
  }
  if (specifier === ASYNC_SPECIFIER) {
    return isAsyncExport(name) ? new BuiltinExport("async", name, false) : null
  }
  if (specifier === unsafeModule()) {
    return isUnsafeExport(name) ? new BuiltinExport("", name, false) : null
  }
  return null
}
