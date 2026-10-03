// The capabilities a program can reach (docs/wp35-capabilities.md): the
// set, and the audit that gives every builtin exactly one of them.
//
// A capability is one bit of an `i32`, so a function's set is a mask and the
// fixpoint step that carries a callee's set to its caller is an `|`
// (`propagateCapabilities` in `src/attributes.ts`). The bit's index is the
// capability's place in the fixed order every report prints, which is what
// keeps `--emit-capabilities` byte-stable: a list is read off a mask in index
// order, never in the order the analysis happened to find the bits.
//
// The audit is keyed by the checker-facing name (`readFileSync`,
// `process.exit`, `netRead`) rather than by the runtime symbol a call lowers
// to, because one runtime symbol can serve several builtins and a witness
// names the call the program wrote. A `nish:` export reaches this table under
// the builtin it renames (`BuiltinExport.canonical`), so `exit` from
// `nish:process` is `process.exit`'s row and cannot be labelled apart from it.
//
// **Unlabelled is a bug.** `builtinCapability` answers `CAP_UNLABELLED` for a
// name it has no row for, and the walk that meets one is an internal compiler
// error. `tests/capabilities.js` enumerates every name the checker accepts and
// fails the suite when one has no row here, before any program calls it.

import { isNetExport } from "./nish-modules"

/** A deliberate "none": the builtin has a row, and the row says it reaches nothing. */
export const CAP_NONE: i32 = -1
/** No row at all. Never a label; what the walk refuses with exit 70. */
export const CAP_UNLABELLED: i32 = -2

// A capability is named by its index, which is also its bit (`1 << index`) in
// a mask and its place in every per-capability array. The indices are in the
// order every report prints them, which is alphabetical so that a reader finds
// a name where they expect it.
const CAP_CLOCK: i32 = 0
const CAP_ENTROPY: i32 = 1
const CAP_ENV: i32 = 2
const CAP_EXIT: i32 = 3
/** A call to a `declare function`. Not a table row: it is the kind of callee, read off its signature. */
export const CAP_FFI: i32 = 4
const CAP_FS_READ: i32 = 5
const CAP_FS_WRITE: i32 = 6
const CAP_NET: i32 = 7
const CAP_PROCESS_SPAWN: i32 = 8
const CAP_SIGNAL: i32 = 9
// 10, `unsafe`, is reserved for `nish:unsafe`, which has not landed: nothing
// answers it yet, so it is the last name in `capabilityName` and no constant
// until something does.

/** How many capabilities there are, and so how long a per-capability array is. */
export const CAPABILITY_COUNT: i32 = 11

/**
 * The capabilities a deterministic program reaches none of: the inputs that
 * are not argv or stdin, and the effects whose outcome depends on the world.
 * `exit` and `signal` are not in it (docs/wp35-capabilities.md §1). A function
 * rather than a constant because a module constant is a literal.
 */
const nondeterministic = (): i32 =>
  (1 << CAP_CLOCK) |
  (1 << CAP_ENTROPY) |
  (1 << CAP_ENV) |
  (1 << CAP_FS_READ) |
  (1 << CAP_FS_WRITE) |
  (1 << CAP_NET) |
  (1 << CAP_PROCESS_SPAWN) |
  (1 << CAP_FFI)

/** The name of the capability with index `index`, as every report spells it. */
export const capabilityName = (index: i32): string => {
  if (index === 0) {
    return "clock"
  }
  if (index === 1) {
    return "entropy"
  }
  if (index === 2) {
    return "env"
  }
  if (index === 3) {
    return "exit"
  }
  if (index === 4) {
    return "ffi"
  }
  if (index === 5) {
    return "fs.read"
  }
  if (index === 6) {
    return "fs.write"
  }
  if (index === 7) {
    return "net"
  }
  if (index === 8) {
    return "process.spawn"
  }
  if (index === 9) {
    return "signal"
  }
  return index === 10 ? "unsafe" : ""
}

/** Whether a set reaches none of the nondeterministic capabilities. */
export const isDeterministic = (mask: i32): boolean => (mask & nondeterministic()) === 0

/** The names of a set, in the fixed order. */
export const capabilityNames = (mask: i32): string[] => {
  const out: string[] = []
  let i = 0
  while (i < CAPABILITY_COUNT) {
    if ((mask & (1 << i)) !== 0) {
      out.push(capabilityName(i))
    }
    i = i + 1
  }
  return out
}

/**
 * The one label of a builtin, by the name the checker knows it by: a
 * capability's index, `CAP_NONE`, or `CAP_UNLABELLED` when the table has no
 * row for it.
 *
 * Every row is a builtin of `src/builtins.ts` (a plain callee, a dotted
 * callee or a namespace property), a `Result` constructor, or a `nish:`
 * export's canonical name. docs/wp35-capabilities.md §2 is this table with a
 * reason beside the rows that need one.
 */
export const builtinCapability = (name: string): i32 => {
  // The rows a program calls most come first; the rows are disjoint, so the
  // order changes the time a lookup takes and never its answer.
  if (
    name === "toI32" ||
    name === "toI64" ||
    name === "toU8" ||
    name === "toU16" ||
    name === "toU32" ||
    name === "toU64" ||
    name === "toF32" ||
    name === "toF64" ||
    name === "f64ToBits" ||
    name === "bitsToF64" ||
    name === "ctSelect" ||
    name === "ctEq" ||
    name === "secureZero" ||
    name === "parseInt" ||
    name === "parseFloat" ||
    name === "Number" ||
    name === "Ok" ||
    name === "Err" ||
    name === "write" ||
    name === "writeError" ||
    name === "panic" ||
    name === "console.log" ||
    name === "console.error" ||
    name === "String.fromCharCode" ||
    name === "Math.sqrt" ||
    name === "Math.floor" ||
    name === "Math.ceil" ||
    name === "Math.trunc" ||
    name === "Math.round" ||
    name === "Math.sin" ||
    name === "Math.cos" ||
    name === "Math.exp" ||
    name === "Math.log" ||
    name === "Math.pow" ||
    name === "Math.abs" ||
    name === "Math.min" ||
    name === "Math.max" ||
    name === "Arena.reset" ||
    name === "Arena.mark" ||
    name === "Arena.release" ||
    name === "Arena.used" ||
    name === "arena" ||
    name === "Math.PI" ||
    name === "Math.E" ||
    name === "process.argv" ||
    name === "process.platform" ||
    name === "process.arch"
  ) {
    return CAP_NONE
  }
  if (
    name === "readFileSync" ||
    name === "readFileSyncOrNull" ||
    name === "readFileBytesSync" ||
    name === "readdirSync" ||
    name === "realpathSync" ||
    name === "isDirectorySync" ||
    name === "lstatOwnerModeSync" ||
    name === "isExecutableSync"
  ) {
    return CAP_FS_READ
  }
  if (name === "writeFileSync" || name === "appendFileSync" || name === "mkdirSync") {
    return CAP_FS_WRITE
  }
  // The child can write anything, so `spawnSyncTo` writing its streams to
  // files needs no `fs.write` beside this.
  if (name === "spawnSync" || name === "spawnSyncTo") {
    return CAP_PROCESS_SPAWN
  }
  if (isNetExport(name)) {
    return CAP_NET
  }
  // `geteuid` reads no file: the user the process runs as is part of the
  // environment it was started in, as its variables are.
  if (name === "getenv" || name === "geteuid") {
    return CAP_ENV
  }
  // `statMtimeSync` reads the file system, but what it answers is a time.
  if (name === "Date.now" || name === "monotonicNanos" || name === "statMtimeSync") {
    return CAP_CLOCK
  }
  // runtime.c's `nish_random` seeds itself from `time(0)` and `getpid()`.
  if (name === "crypto.getRandomValues" || name === "Math.random") {
    return CAP_ENTROPY
  }
  if (name === "signalFd" || name === "readSignal") {
    return CAP_SIGNAL
  }
  if (name === "process.exit") {
    return CAP_EXIT
  }
  return CAP_UNLABELLED
}
