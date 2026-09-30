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
// literal to key by name, and a `StringMap` built at module load needs a
// mutable global the language does not have either. The lists therefore have
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

/** Whether the specifier is a module that exists. */
export const isNishModule = (specifier: string): boolean =>
  specifier === `${BUILTIN_SCHEME}fs` ||
  specifier === `${BUILTIN_SCHEME}process` ||
  specifier === `${BUILTIN_SCHEME}io` ||
  specifier === `${BUILTIN_SCHEME}net`

/** Every module name, for the diagnostic that lists them. */
export const nishModuleNames = (): string =>
  `${BUILTIN_SCHEME}fs, ${BUILTIN_SCHEME}process, ${BUILTIN_SCHEME}io, ${BUILTIN_SCHEME}net`

/** The names one module exports, in table order, for the diagnostic that lists them. */
export const nishModuleExports = (specifier: string): string => {
  if (specifier === `${BUILTIN_SCHEME}fs`) {
    return "readFileSync, readFileSyncOrNull, readFileBytesSync, writeFileSync, appendFileSync, mkdirSync, isDirectorySync, readdirSync, realpathSync, statMtimeSync"
  }
  if (specifier === `${BUILTIN_SCHEME}process`) {
    return "exit, getenv, spawnSync, spawnSyncTo, monotonicNanos, signalFd, readSignal, argv, platform, arch"
  }
  if (specifier === `${BUILTIN_SCHEME}net`) {
    return "netAddress, netLocalPort, tcpListen, tcpAccept, netRead, netWrite, netShutdown, netClose, udpBind, udpSendTo, udpRecvFrom"
  }
  return "write, writeError, panic"
}

/**
 * WP34 N5: the parameters of a `nish:net` function, one letter each, or "" for
 * a name `nish:net` does not export. Every one answers an `i32`. The checker,
 * the emitter and the written-argument rule all read this one string, through
 * the letters below, so the three cannot disagree about which argument is
 * which.
 *
 * Each name is a global too, as every `nish:` export is, and each carries a
 * `net`, `tcp` or `udp` prefix so that none of them collides with a global that
 * already exists (`write`).
 */
export const netSignature = (name: string): string => {
  if (name === "netAddress") {
    return "wsi"
  }
  if (name === "netLocalPort" || name === "netClose") {
    return "i"
  }
  if (name === "tcpListen") {
    return "sii"
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
  return ""
}

/** `i`: an `i32` (a descriptor, a port, a backlog, `how`, flags, a segment size, ECN bits). */
export const NET_INT: i32 = 105
/** `s`: a `string`, a numeric host. */
export const NET_STRING: i32 = 115
/** `w`: a `u8[]` the call writes. */
export const NET_WRITTEN: i32 = 119
/** `r`: a `u8[]` the call only reads. */
export const NET_READ: i32 = 114
/** `m`: an `i32[]` the call writes, `udpRecvFrom`'s `meta`. */
export const NET_WORDS: i32 = 109
/**
 * `n`: an `i32` offset or length into the `u8[]` before it, which the call
 * range-checks in the IR and hands to the runtime widened to an `i64`.
 */
export const NET_RANGE: i32 = 110

/**
 * Where a `nish:net` call's range-checked `(buf, off, len)` triple starts, or
 * -1: the buffer is the argument before the first `n`. `netRead`, `netWrite`,
 * `udpSendTo` and `udpRecvFrom` have one, at 1.
 */
export const netRangeBuffer = (name: string): i32 => {
  const at = netSignature(name).indexOf("n")
  return at < 0 ? -1 : at - 1
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

/** Whether `nish:net` exports `name`. */
export const isNetExport = (name: string): boolean => netSignature(name).length > 0

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
      name === "statMtimeSync"
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
      name === "monotonicNanos" ||
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
    if (name === "write" || name === "writeError" || name === "panic") {
      return new BuiltinExport("", name, false)
    }
    return null
  }
  if (specifier === `${BUILTIN_SCHEME}net`) {
    return isNetExport(name) ? new BuiltinExport("", name, false) : null
  }
  return null
}
