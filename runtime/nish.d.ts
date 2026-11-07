/**
 * Ambient declarations for the Nish global surface.
 *
 * Every Nish program is legal TypeScript syntax — the compiler parses it
 * with the official TypeScript parser and nothing else. This file is what
 * makes it legal TypeScript *semantics* too: reference it from a `tsconfig.json`
 * (or with `/// <reference path="..." />`) and `tsc --noEmit`, your editor and
 * your language server all accept `Result<T, E>`, `Ok(...)`, `i32` and the rest
 * without a red squiggle.
 *
 *   { "include": ["src/**\/*.ts", "node_modules/nish/runtime/nish.d.ts"] }
 *
 * **`nish` is still the authority.** TypeScript's structural checker is
 * weaker than this compiler's in the places where Nish is deliberately
 * stricter, and it cannot see the flow rules at all:
 *
 *   - the integer and float widths are aliases of `number` here, so `tsc`
 *     lets an `i32` and an `f64` mix where `nish` refuses;
 *   - `tsc` does not know that a `Result` may not be dropped, that
 *     `orReturn()` returns early, or that the enclosing function has to
 *     return a `Result` of its own for it to be legal at all;
 *   - everything Phase 0 forbids (`any`, `throw`, `try`, prototypes,
 *     arrow functions, ...) is ordinary TypeScript and passes `tsc` happily.
 *
 * So a program that `tsc` accepts may still be rejected by `nish`; the
 * reverse should never happen, and a case where it does is a bug in this file.
 * `docs/LANGUAGE.md` is the normative description.
 *
 * **`Map` and `Set` are not declared here**, although `nish` has them as
 * globals: the `"lib": ["ES2022"]` a program is checked against already
 * declares JavaScript's, and a second declaration would clash with it.
 * `nish`'s are that surface less what it defers — no `entries`, no `forEach`,
 * no `for...of` over a `Map` itself — with `keys()` and `values()` admitted
 * only as the iterable of a `for...of`, and `get`'s `V | undefined` only as a
 * `const`'s initialiser, the left of `??` or an operand of `=== undefined`,
 * none of which `tsc` can know (docs/LANGUAGE.md -> `Map` and `Set`).
 * `nish/map`'s `reserve` and `getOrInsert` are not declared here either: they
 * are ordinary source, `std/map.ts`, which `tsconfig.json` maps `nish/*` to.
 */

// ---- Numeric widths (docs/LANGUAGE.md -> Types) ------------------------------
//
// Nish treats these as distinct types that never mix implicitly. There is
// no way to say that in TypeScript without branding them, and a brand would
// break the literal syntax the language relies on (`let x: i32 = 5`), so they
// are aliases and the width check is left to `nish`.

type i32 = number;
type i64 = number;
type u8 = number;
type u16 = number;
type u32 = number;
type u64 = number;
type f32 = number;
type f64 = number;

// ---- Ranged integers (docs/wp31-ranged-integers.md) --------------------------
//
// An `i32` the compiler knows lies in `[Lo, Hi]`. The bounds are numeric
// literal types, and `tsc` checks only that; the range itself is `nish`'s.
type integer<Lo extends number, Hi extends number> = number;

// ---- Result (docs/LANGUAGE.md -> Result and error handling) ------------------
//
// Modelled as the tagged union TypeScript would use anyway, intersected with
// the method surface. That is what lets `if (r.ok)` and `if (r.isOk())` narrow
// `r` in `tsc` for the same reason and in the same places they narrow in
// `nish`.

/** The success arm of a `Result`, as the discriminant proves it. */
type ResultOk<T> = { readonly ok: true; readonly value: T };
/** The failure arm. */
type ResultErr<E> = { readonly ok: false; readonly error: E };

interface ResultMethods<T, E> {
  /** True when this is the success arm; narrows `r` where it is a condition. */
  isOk(): this is ResultOk<T> & ResultMethods<T, E>;
  /** True when this is the failure arm; narrows `r` the other way. */
  isErr(): this is ResultErr<E> & ResultMethods<T, E>;
  /**
   * The success payload, or an early `return Err(error)` from the enclosing
   * function — Rust's `?`. `nish` additionally requires that function to
   * return a `Result` whose error arm accepts `E`; `tsc` cannot check that.
   */
  orReturn(): T;
  /** The success payload, or `fallback` when this is the failure arm. */
  unwrapOr(fallback: T): T;
  /** The success payload, or `message` on stderr and exit 1. */
  expect(message: string): T;
}

/**
 * The outcome of an operation that can fail. `T` may be `void` for an
 * operation with nothing to hand back; `E` may not be.
 */
type Result<T, E> = (ResultOk<T> | ResultErr<E>) & ResultMethods<T, E>;

/** The success value. Its `Result` type comes from the context, as `null`'s does. */
declare function Ok<T, E>(value: T): Result<T, E>;
declare function Ok<E>(): Result<void, E>;
/** The failure value, likewise. */
declare function Err<T, E>(error: E): Result<T, E>;

// ---- console and process -----------------------------------------------------
//
// Declared here with *Nish's* signatures — one argument, no format string,
// statement position — rather than borrowed from `lib.dom` or `@types/node`,
// which describe something much wider. `Console` is an interface so that a
// project which does pull `lib.dom` in merges with it instead of colliding;
// `Process` is not that lucky, so a project that needs `@types/node` for other
// reasons should drop this file's `process` rather than fight it.

/**
 * The disposable protocol `using` reads (WP29 P2, docs/wp29-thread-surface.md
 * §5): declared here so that a program using `nish/threads`'s scope, a
 * `Mutex`'s lock or `arena()` needs no `"ESNext.Disposable"` in its `lib`.
 * `nish` itself takes `using` only for a `scope()`, a `lock()` or an
 * `arena()`, and `[Symbol.dispose]` only in `nish/threads`.
 */
interface SymbolConstructor {
  readonly dispose: unique symbol;
}
interface Disposable {
  [Symbol.dispose](): void;
}

/**
 * `String.fromBytes` is Nish's, not JavaScript's, so it merges into the
 * `StringConstructor` `lib.es2022` declares. Under `runtime/nish.mjs` each byte
 * becomes one UTF-16 unit, as `String.fromCharCode`'s does.
 */
interface StringConstructor {
  /** The bytes of `bytes[start..end)` as one string; panics unless `0 <= start <= end <= bytes.length`. */
  fromBytes(bytes: readonly u8[], start: number, end: number): string;
}

interface Console {
  /** `x` and a newline to stdout. Statement position; exactly one argument. */
  log(x: string | number | boolean): void;
  /** The same, on stderr. */
  error(x: string | number | boolean): void;
}
declare var console: Console;

interface Process {
  /**
   * Terminate with `code`. Statement position, and a terminator: `never` is
   * how TypeScript spells that, so a function ending in `process.exit(c)`
   * satisfies its return type in `tsc` as it does in `nish`.
   */
  exit(code: i32): never;
  /** The command line; `argv[0]` is the program path, as in C. Read-only. */
  readonly argv: string[];
  /** The operating system the program runs on: `"linux"`, `"darwin"`, or `"unknown"`. */
  readonly platform: string;
  /** The architecture: `"x64"`, `"arm64"`, or `"unknown"`. */
  readonly arch: string;
}
declare var process: Process;

// ---- Numeric conversions (there is no cast in Nish) ----------------------

declare function toI32(x: number | boolean): i32;
declare function toI64(x: number | boolean): i64;
declare function toU8(x: number | boolean): u8;
declare function toU16(x: number | boolean): u16;
declare function toU32(x: number | boolean): u32;
declare function toU64(x: number | boolean): u64;
declare function toF32(x: number | boolean): f32;
declare function toF64(x: number | boolean): f64;
/** Reinterpret the 64 bits of an `f64`, never convert the value. */
declare function f64ToBits(x: f64): i64;
declare function bitsToF64(bits: i64): f64;
/** Reinterpret the 32 bits of an `f32`, never convert the value. */
declare function f32ToBits(x: f32): i32;

// ---- Constant time (WP34 N6) ------------------------------------------------

/**
 * `(a & mask) | (b & ~mask)` with the mask hidden from the optimiser, so it is
 * never turned into a branch: `a` for an all-ones mask, `b` for zero. Every
 * operand is one type, `u32` or `u64`. Both are `number` here, so one generic
 * declaration stands for the two.
 */
declare function ctSelect<T extends u32 | u64>(mask: T, a: T, b: T): T;
/** All-ones of the operands' type when `a === b`, zero otherwise, without a branch. */
declare function ctEq<T extends u32 | u64>(a: T, b: T): T;
/**
 * Every byte of `bytes` set to zero, in stores neither `-O2` nor `-flto` may
 * drop as dead (#385): how a key, a secret scalar or another secret is cleared
 * once it is used. A statement.
 */
declare function secureZero(bytes: u8[]): void;
/**
 * One `lstat` of `path`, so a symbolic link answers for itself: the owner's uid
 * in the high 32 bits and `st_mode` in the low 32, or -1 when the path does not
 * resolve (#386).
 */
declare function lstatOwnerModeSync(path: string): i64;
/** The effective user id, the one to compare an owner from `lstatOwnerModeSync` with. */
declare function geteuid(): i64;
/** Whether the real user may run `path`: `access(path, X_OK)`. */
declare function isExecutableSync(path: string): boolean;

// ---- Unsafe (`nish:unsafe`) --------------------------------------------------
//
// Declared as globals so `tsc` reads a program that imports them, as every
// `nish:` export is, but `nish` refuses a call to any of the six that is not
// imported from `nish:unsafe`: the import is the module's visible opt-in.

/** `xs[i]` with no bounds check: undefined behaviour when `i` is out of range. */
declare function uncheckedGet<T extends number>(xs: readonly T[], i: i32): T;
/** `xs[i] = v` with no bounds check: undefined behaviour when `i` is out of range. */
declare function uncheckedSet<T extends number>(xs: T[], i: i32, v: T): void;
/** `a + b` wrapped to the operands' width, `i32` or `i64`: defined for every pair. */
declare function wrappingAdd<T extends i32 | i64>(a: T, b: T): T;
/** `a - b` wrapped to the operands' width. */
declare function wrappingSub<T extends i32 | i64>(a: T, b: T): T;
/** `a * b` wrapped to the operands' width. */
declare function wrappingMul<T extends i32 | i64>(a: T, b: T): T;
/** The `NUL`-terminated bytes at `p`, copied into a string: undefined behaviour unless `p` is a live C string. */
declare function readCString(p: CPtr): string;

// ---- Streams and files (globals: Nish has no package resolution) ---------

/** `s` to stdout with no trailing newline and no conversion. */
declare function write(s: string): void;
/** `s` to stderr, likewise. */
declare function writeError(s: string): void;
/**
 * `bytes[off .. off + len)` to stdout, every byte as it is, partial writes and
 * interruptions retried: the count, or a negative errno. A range outside
 * `bytes` panics, as `dst.set` does. The shape is `netWrite`'s.
 */
declare function writeBytes(bytes: readonly u8[], off: i32, len: i32): i32;
/**
 * `message` and a newline to stderr, then exit 1. Terminates control flow, so
 * it is `never`: that is what lets `tsc` agree that a function ending in a
 * `panic` returns, and that `x` is not null after `if (x === null) { panic(...); }`
 * — the guard-then-panic shape `src/` uses everywhere in place of an assert.
 */
declare function panic(message: string): never;
/**
 * The whole file as a string; a path that cannot be read as one — missing, a
 * directory, a parent that cannot be searched — prints `nish: cannot read
 * <path>` and exits 1.
 */
declare function readFileSync(path: string): string;
/** The same read, answering `null` for every path the other exits over. */
declare function readFileSyncOrNull(path: string): string | null;
/**
 * The file's bytes as they are on disk — no UTF-8 assumed, so a zero byte and
 * a byte of 0x80 or above survive — or `null` for every path
 * `readFileSyncOrNull` answers `null` for.
 */
declare function readFileBytesSync(path: string): u8[] | null;
/**
 * The file's contents replaced by `data`, created at 0644 when missing. A
 * symbolic link as the last component of the path is refused rather than
 * followed, natively and under Node alike, and a path that cannot be written
 * prints `nish: cannot write <path>` and exits 1.
 */
declare function writeFileSync(path: string, data: string): void;
/** `data` added at the end of the file, with the same refusal of a symbolic link. */
declare function appendFileSync(path: string, data: string): void;
/**
 * The file's contents replaced by `bytes`, created at 0644 when missing, with
 * the same refusal of a symbolic link: the byte count, or a negative errno.
 * Never an exit.
 */
declare function writeFileBytesSync(path: string, bytes: readonly u8[]): i32;
/**
 * `from` moved to `to`, replacing a file there in one step on one file system:
 * 0, or a negative errno (-18 across file systems, -2 for a missing `from`).
 */
declare function renameSync(from: string, to: string): i32;
/** The name `path` removed: 0, or a negative errno. A directory is refused, not removed. */
declare function unlinkSync(path: string): i32;
/**
 * `writeFileSync` with an explicit `mode`: the file is exactly `mode`
 * (`0o600` for a secret) before a byte of `data` is in it, whatever the umask
 * or a file already there had, and a symbolic link at the path is refused
 * (-40). The byte count, or a negative errno: -22 for a mode outside
 * 0..0o777, the setuid, setgid and sticky bits included. The file is
 * truncated and written in place, so a crash or a failed write leaves it
 * empty or partial, and a file this process may write but does not own is
 * emptied before the mode change answers -1 (`EPERM`). For a file that must
 * be the old one or the new one, write a temporary name with this and move it
 * with `renameSync`. Never an exit.
 */
declare function writeFileSyncMode(path: string, data: string, mode: i32): i32;
/**
 * `data` in a new file of exactly `mode`, created only if nothing is at `path`:
 * -17 when something is, a dangling symbolic link included. Of several
 * processes racing for one path exactly one succeeds, so it takes a lock. The
 * byte count, or a negative errno; a write that fails after the create
 * removes the file, so the lock is not left taken. Never an exit.
 */
declare function createFileExclusiveSync(path: string, data: string, mode: i32): i32;
/**
 * One directory made with `mode` less the umask (`0o700` is exact under any
 * umask that leaves the owner's bits): 0, or a negative errno. A path already
 * there is -17 and its mode is not changed; -22 for a mode outside 0..0o777.
 */
declare function mkdirSyncMode(path: string, mode: i32): i32;
/** One directory, not recursive; whether a directory is there afterwards. */
declare function mkdirSync(path: string): boolean;
/** Whether a directory is at `path` right now. One `stat`, and never an exit. */
declare function isDirectorySync(path: string): boolean;
/**
 * The directory's entries, sorted ascending by bytes and without `.` or `..`,
 * or `null` when it cannot be read. An empty directory is an empty array, so
 * the null check is about the directory and not about its contents.
 */
declare function readdirSync(path: string): string[] | null;
/**
 * `path` with every symbolic link resolved, as an absolute normalised path —
 * or `null` when it does not resolve, a path that does not exist included.
 */
declare function realpathSync(path: string): string | null;
/** Run `argv[0]` through `PATH` and wait: the exit status, `128 + n` for a signal, `-1` for a failure. */
declare function spawnSync(argv: string[]): number;
/**
 * The same run with each non-empty path receiving that stream, created or
 * truncated; an empty string leaves that stream inherited. A symbolic link at
 * either path is refused, as `writeFileSync` refuses one, and the answer is -1.
 */
declare function spawnSyncTo(argv: string[], stdoutPath: string, stderrPath: string): number;
/**
 * The same run with all three streams on pipes: `stdin` is written to the
 * child and closed, and what it prints is appended to `stdout` and `stderr`.
 * The status as `spawnSync` answers it, or -2 when a stream passed 16 MiB:
 * the child is then killed and each array keeps at most the first 16 MiB.
 */
declare function spawnPiped(argv: string[], stdin: readonly u8[], stdout: u8[], stderr: u8[]): i32;
/**
 * `spawn` with the child holding `fds[i]` as descriptor `3 + i`, inherited
 * across the exec; every other descriptor stays close-on-exec. The child's pid,
 * or a negative errno: -22 more than 64 descriptors or a negative one, -9 one
 * that is not open, -24 (or -22 above the descriptor limit) a scratch
 * descriptor the system cannot give. No reading under Node, which throws.
 */
declare function spawnWithFds(argv: string[], fds: readonly i32[]): i32;
/**
 * Start `argv[0]` through `PATH` without waiting: the child's pid, or a
 * negative errno. The child is the program's until `waitPid` reaps it. No
 * reading under Node, which throws.
 */
declare function spawn(argv: string[]): i32;
/**
 * Send `sig` to `pid`: 0, or a negative errno (-3 when no such process). `sig`
 * is 0, 2, 9 or 15, and anything else, like a `pid` of 0 or below, is -22.
 */
declare function kill(pid: i32, sig: i32): i32;
/**
 * Wait for the child `pid`, or any child for -1: `[pid, status]`, the status
 * as `spawnSync` answers it. Flag 1 is WNOHANG, under which `[0, 0]` means a
 * child remains and none has exited; a failure is `[-errno, 0]`, `[-10, 0]`
 * with no child to wait for. No reading under Node, which throws.
 */
declare function waitPid(pid: i32, flags: i32): i32[];
/** How many CPUs the program may use: at least 1, with or without `--threads`. */
declare function availableParallelism(): i32;
/** Bytes of physical memory, or -1 when the host does not say. */
declare function totalMemory(): i64;
/**
 * Set this process's nice value to `n`, which must be 0..19: 0, or a negative
 * errno. Lower-only, even as root: `n` outside 0..19 is -22 (EINVAL), and `n`
 * below the current value is -13 (EACCES), both with no system call. Children
 * started afterwards inherit it. Throws under Node.
 */
declare function setNice(n: i32): i32;
/**
 * Move this process to `SCHED_IDLE`, which runs it only when nothing else wants
 * the CPU: 0, or a negative errno, and -95 where the host has no such policy
 * (Darwin). An unprivileged process can never leave `SCHED_IDLE` again, and an
 * idle process can starve on a saturated machine, so a caller keeps a
 * normal-priority fallback for work that must finish. Throws under Node.
 */
declare function setIdlePriority(): i32;
/**
 * Pin this process to CPU `cpu` alone (`sched_setaffinity`): 0, or a negative
 * errno. Narrow-only: a CPU outside the mask the process already has (an
 * operator's `taskset` or cpuset), a negative one, or one past the kernel's
 * set size is -22 with no system call. -95 where the host has no affinity
 * call (Darwin, and under Node).
 */
declare function setCpuAffinity(cpu: i32): i32;
/** One environment variable, or `null` when it is unset (an empty value is a set variable). */
declare function getenv(name: string): string | null;
/**
 * A monotonic clock in nanoseconds, for timing a region of a program. The
 * origin is arbitrary, so only the difference between two reads is meaningful.
 */
declare function monotonicNanos(): i64;
/**
 * The wall clock in nanoseconds since the Unix epoch, for dating an event. It
 * steps when the system time is set, so a duration is `monotonicNanos`'s.
 */
declare function wallClockNanos(): i64;
/**
 * The modification time of `path` in milliseconds since the epoch, with the
 * sub-millisecond fraction the file system keeps (Node's `mtimeMs`), or NaN
 * when it cannot be stat'd. Follows a symbolic link; a directory has one too.
 */
declare function statMtimeSync(path: string): f64;
/**
 * A descriptor that becomes readable when SIGTERM or SIGINT arrives, whichever
 * thread the signal lands on, made once (every call answers the same one), or -1.
 */
declare function signalFd(): i32;
/**
 * Block until SIGTERM or SIGINT arrives and answer its number, 15 or 2; -1 for
 * any `fd` that is not `signalFd()`'s. No reading under Node, which throws.
 */
declare function readSignal(fd: i32): i32;

// ---- `nish:net` (WP34 N5) --------------------------------------------------------
//
// Every call answers an `i32`: `>= 0` on success, a negative errno otherwise, in
// Linux's numbering on every platform for -11 (would block), -95, -32, -104,
// -98, -111 (refused), -110 (timed out) and -22. An address is 18 bytes of a
// `u8[]`: 16 of IPv6 address (IPv4 as `::ffff:a.b.c.d`), then the port,
// big-endian. Every socket is non-blocking and close-on-exec. No reading under
// Node, where each throws.

/** Write the address form of a numeric `host` and `port` into `out`: 0, or -22. */
declare function netAddress(out: u8[], host: string, port: i32): i32;
/** The port the socket `fd` is bound to. */
declare function netLocalPort(fd: i32): i32;
/** A listening TCP socket with `SO_REUSEADDR`; `"::"` hears IPv4 and IPv6. */
declare function tcpListen(host: string, port: i32, backlog: i32): i32;
/**
 * `tcpListen`'s socket, with `SO_REUSEPORT` for flag 1 and `TCP_NODELAY` on
 * each accepted socket for flag 2. Flag 4, with flag 1, steers by CPU: a new
 * connection goes to the group's listener whose bind order is the index of the
 * CPU that received it (Linux; -95 elsewhere). Any other bit, or 4 without 1,
 * is -22.
 */
declare function tcpListenFlags(host: string, port: i32, backlog: i32, flags: i32): i32;
/** The next connection's descriptor, its address in `peer`; -11 when none waits. */
declare function tcpAccept(fd: i32, peer: u8[]): i32;
/** Up to `len` bytes into `buf` from `off`: the count, 0 at end of stream, or -11. */
declare function netRead(fd: i32, buf: u8[], off: i32, len: i32): i32;
/** Up to `len` bytes of `buf` from `off`: the count; a gone peer is -32, never SIGPIPE. */
declare function netWrite(fd: i32, buf: readonly u8[], off: i32, len: i32): i32;
/** `netWrite` of `a`'s range then `b`'s, in one system call: the count of both, at most `aLen + bLen`. */
declare function netWrite2(
  fd: i32,
  a: readonly u8[],
  aOff: i32,
  aLen: i32,
  b: readonly u8[],
  bOff: i32,
  bLen: i32
): i32;
/** Shut the read side (0), the write side (1) or both (2). */
declare function netShutdown(fd: i32, how: i32): i32;
/** Close the descriptor. */
declare function netClose(fd: i32): i32;
/** A TCP socket connecting to `addr`, answered while it connects: writable once it has, or has failed. It holds `TCP_NODELAY`, so a small write is sent at once. */
declare function tcpConnect(addr: readonly u8[]): i32;
/** Once `fd` is writable: 0 when the connection is made, else its failure (-111 refused). */
declare function connectResult(fd: i32): i32;
/** A UDP socket: flag 1 `SO_REUSEPORT`, flag 2 `UDP_GRO` (-95 on Darwin); ECN is always read. */
declare function udpBind(host: string, port: i32, flags: i32): i32;
/** `buf[off, off + len)` to `to`, cut into `segment`-byte datagrams when `segment > 0`, with ECN bits `ecn`. */
declare function udpSendTo(
  fd: i32,
  buf: readonly u8[],
  off: i32,
  len: i32,
  to: readonly u8[],
  segment: i32,
  ecn: i32
): i32;
/** One datagram, or several GRO coalesced, into `buf[off, off + len)`; the sender in `from`, `meta` [segment size, ECN]. */
declare function udpRecvFrom(fd: i32, buf: u8[], off: i32, len: i32, from: u8[], meta: i32[]): i32;
/** A readiness loop, level-triggered: epoll on Linux, kqueue on Darwin. */
declare function pollCreate(): i32;
/** Watch `fd` for `events` (1 readable, 2 writable) under `token`. */
declare function pollAdd(loop: i32, fd: i32, events: i32, token: i32): i32;
/** New events or a new token for a watched `fd`. */
declare function pollModify(loop: i32, fd: i32, events: i32, token: i32): i32;
/** Stop watching `fd`. */
declare function pollRemove(loop: i32, fd: i32): i32;
/** Wait up to `timeoutMs` (negative: forever); pairs `ready[2k]` token, `ready[2k + 1]` events (4: hang-up or error). */
declare function pollWait(loop: i32, ready: i32[], timeoutMs: i32): i32;
/**
 * Set one socket option from a whitelist: `option` is one of the `NET_*` ids
 * below, and any other is -22; there is no raw level and option number. 0, or
 * a negative errno (-9 a closed descriptor, -88 not a socket).
 */
declare function netSetOption(fd: i32, option: i32, value: i32): i32;
/**
 * A connected TCP socket's send MSS, the payload bytes one segment carries;
 * -1, never an errno, for anything else, and always on wasm.
 */
declare function netMss(fd: i32): i32;
/** `TCP_NODELAY`: `value` 1 sends a small write at once, 0 lets Nagle batch it. */
declare const NET_TCP_NODELAY: i32;
/**
 * `TCP_QUICKACK` (Linux; -95 elsewhere): `value` 1 acknowledges at once, 0
 * delays. Linux does not keep quick-ACK mode: the kernel leaves it on its own,
 * so a server that wants a mode sets it again after every response.
 */
declare const NET_TCP_QUICKACK: i32;
/** `SO_KEEPALIVE`: `value` 1 probes an idle connection, 0 does not. */
declare const NET_SO_KEEPALIVE: i32;
/** `SO_SNDBUF`: the send buffer, `value` in bytes; Linux doubles the value it stores. */
declare const NET_SO_SNDBUF: i32;
/** `SO_RCVBUF`: the receive buffer, `value` in bytes; Linux doubles the value it stores. */
declare const NET_SO_RCVBUF: i32;
/**
 * A listening Unix stream socket at `path` (`@name`: Linux's abstract
 * namespace), its file mode 0600. A path that exists is -98, unless `flags`
 * holds `NET_UNIX_UNLINK_STALE`; -36 a path too long, -22 an empty one.
 */
declare function unixListen(path: string, backlog: i32, flags: i32): i32;
/** `unixListen` with the socket file's mode chosen (0 to 0o777); -22 for an `@name`. */
declare function unixListenMode(path: string, backlog: i32, flags: i32, mode: i32): i32;
/** A non-blocking socket connected to the listener at `path`; -11 a full backlog on Linux (-111 on Darwin), -111 nothing listening. */
declare function unixConnect(path: string): i32;
/** The next connection on a Unix listener, non-blocking; -11 when none is waiting. */
declare function unixAccept(fd: i32): i32;
/**
 * Two connected sockets into `fds[0]` and `fds[1]`, and 0: `kind` is
 * `NET_UNIX_STREAM` or `NET_UNIX_SEQPACKET` (-95 on Darwin); -22 another kind
 * or an `fds` shorter than 2.
 */
declare function unixSocketPair(kind: i32, fds: i32[]): i32;
/**
 * Send `buf[off..off+len)` over the Unix socket `sock` with a copy of the
 * descriptor `fd` (`SCM_RIGHTS`): the bytes sent, or a negative errno; -22 a
 * zero `len` or a negative `fd`, -9 a closed `sock` or `fd`, -88 a `sock`
 * that is not a socket, -95 one that is not Unix. A stream socket can send
 * short: the descriptor travels with the first bytes, so send the rest with
 * `netWrite`.
 */
declare function sendFd(sock: i32, fd: i32, buf: readonly u8[], off: i32, len: i32): i32;
/**
 * Read at most `len` bytes into `buf[off..]` from the Unix socket `sock`, and
 * the first descriptor that came with them into `fd[0]`, or -1: the bytes read,
 * or a negative errno. Every other descriptor in the message is closed; the
 * one kept is close-on-exec and keeps the sender's blocking mode. -22 a zero
 * `len` or an empty `fd`, -9 a closed `sock`, -88 not a socket, -95 not
 * Unix.
 */
declare function recvFd(sock: i32, buf: u8[], off: i32, len: i32, fd: i32[]): i32;
/**
 * The peer of the Unix socket `fd` as of its connect: `out` gets its pid, uid
 * and gid, and the answer is 0; the pid is -1 where Darwin has no
 * `LOCAL_PEERPID`. A uid or gid of 2^31 or above wraps (-2 is uid
 * 4294967294). -22 an `out` shorter than 3, -9 a closed `fd`, -88 not a
 * socket, -95 not Unix, -107 a socket with no peer (a listener, or one never
 * connected).
 */
declare function peerCredentials(fd: i32, out: i32[]): i32;
/** `unixListen` flag: unlink a socket file nothing listens on, then bind. */
declare const NET_UNIX_UNLINK_STALE: i32;
/** `unixSocketPair` kind: a byte stream. */
declare const NET_UNIX_STREAM: i32;
/** `unixSocketPair` kind: each write one message (`SOCK_SEQPACKET`). */
declare const NET_UNIX_SEQPACKET: i32;

// ---- `nish:term` ------------------------------------------------------------------
//
// stdin without blocking and the terminal it may be: the frame clock and the
// keys of a terminal UI, with no `net` capability. -11 is "nothing is
// waiting" and -25 "not a terminal" on every platform; any other failure is
// the host's `-errno`. Under WASI the reading works, `readStdin` waiting for
// its bytes (ask `waitStdin` first), and the terminal answers -25. Under Node `isTerminal` and `terminalSize` answer and the other four
// throw.

/** Up to `len` bytes of stdin into `buf` from `off`, never blocking: the count, 0 at end of stream, or -11 when nothing is waiting. */
declare function readStdin(buf: u8[], off: i32, len: i32): i32;
/** Wait up to `timeoutMs` (negative: forever) for stdin to be readable (its end and an error count): `true` when it is, `false` when the time passed. */
declare function waitStdin(timeoutMs: i32): boolean;
/** Whether descriptor `fd` is a terminal (`isatty`). */
declare function isTerminal(fd: i32): boolean;
/** `[columns, rows]` of the terminal on stdout, else stderr; `[-25, 0]` when neither is one, `[0, 0]` when it has no size set. */
declare function terminalSize(): i32[];
/**
 * Raw mode on stdin's terminal, or the mode it had back: 0, -25 when stdin is
 * not a terminal. No echo, no line editing; Ctrl-C stays SIGINT and "\n"
 * still starts a line. The terminal is put back at exit, on a panic and on
 * every signal that ends the program, SIGKILL aside.
 */
declare function setRawMode(on: boolean): i32;
/** Bytes the runtime writes to the terminal on stdout at exit, on a panic and on every signal that ends the program (SIGKILL aside), before termios is restored. Replaces the previous string; "" clears it. 0, -25 when stdout is not a terminal, -7 (E2BIG) past NISH_TERM_RESTORE_MAX bytes. The cap is 4096 bytes. */
declare function setTerminalRestore(bytes: string): i32;

// ---- `Date` and `crypto` (WP34 N3) -----------------------------------------------
//
// `lib.es2022` already declares `Date`, whose `now()` is Nish's one member of it,
// so nothing is added: `tsc` accepting `new Date()` is `tsc` not being Nish's
// checker. `crypto` is a Web API that `lib.es2022` leaves out, so it is
// declared with its one member, typed as Nish types it.

declare var crypto: {
  /** Every byte of `bytes` from the system's CSPRNG; at most 65,536 bytes a call. */
  getRandomValues(bytes: u8[]): void;
};

// ---- The builtin modules (`nish:`) ---------------------------------------------
//
// The same builtins, importable. `nish:` resolves to no file — the import
// renames a builtin rather than introducing one, and the compiler emits the
// same IR for either spelling — but `tsc` still has to be told the modules
// exist, or an editor reports every one of these imports as unresolved. The
// signatures are deliberately the globals' own, repeated rather than aliased:
// `export { readFileSync }` inside a `declare module` would re-export the
// global and lose the doc comment an editor shows at the call site.
//
// `docs/LANGUAGE.md` -> Builtins -> Builtin modules is the normative list.

/**
 * Files and directories: read, write, rename, remove and list paths on the
 * host's file system.
 *
 *     import { readFileSyncOrNull, writeFileSyncMode, renameSync } from "nish:fs";
 *
 *     const text = readFileSyncOrNull("config.json");
 *     if (text !== null) {
 *       if (writeFileSyncMode("token.tmp", text, 0o600) >= 0) renameSync("token.tmp", "token");
 *     }
 *
 * Each export is the global of the same name, renamed: the compiler emits the
 * same IR for either spelling. Paths are relative to the working directory.
 * The calls that answer an `i32` answer the same numbers under Node, where
 * `runtime/nish.mjs` turns the error Node throws into `-errno` from its `code`
 * (`ERR_INVALID_ARG_VALUE`, Node's refusal of a NUL in a path, is `-22`).
 *
 * A `wasm32` build has none of these, and a WASI build answers `-ENOSYS` from
 * the three that take a mode. Every negative errno is the platform's own,
 * untranslated: the numbers shown here are Linux's, and another kernel's differ
 * (`ELOOP` is `-62` on Darwin), so compare against a negative result. A file
 * longer than 2^31 - 1 bytes is one the read calls cannot read, in both number
 * modes. A path that holds a NUL byte is refused as a missing path is.
 *
 * **Bytes and strings.** A native string is never validated as UTF-8, so
 * `writeFileSync` and `appendFileSync` send its bytes as they are; under the
 * prelude and under `--emit-ts` a string is UTF-16 and a byte above 127 does
 * not survive. `readFileBytesSync` and `writeFileBytesSync` move a `u8[]`
 * unchanged on every host and are the route for bytes that are not text.
 *
 * **Atomic replacement.** Write a temporary beside the target, then
 * `renameSync` it over: a reader sees the old file or the new one and never
 * neither. `writeFileSyncMode` writes in place, so a secret that replaces
 * another goes through the same temporary and rename.
 *
 * The rules: https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#file-io
 * and https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#directories-and-subprocesses
 */
declare module "nish:fs" {
  /**
   * Read the whole file as one arena string. A failure prints
   * `nish: cannot read <path>` to stderr and exits 1; `readFileSyncOrNull` is
   * the call that answers instead.
   *
   * @param path The file to read.
   * @returns The file's contents.
   */
  export function readFileSync(path: string): string;
  /**
   * The same read as `readFileSync`, answering `null` where that call exits,
   * so a program can report the missing file itself and carry on. `null` when
   * the path cannot be read as a file: missing, a directory, a parent that
   * cannot be searched, a pipe with no length to ask for. It subsumes an
   * `existsSync` and has no time-of-check race; narrow the result with
   * `if (text !== null)`. It answers `null` for exactly the paths
   * `readFileSync` prints "cannot read" for.
   *
   * @param path The file to read.
   * @returns The file's contents, or `null` when it cannot be read as a file.
   */
  export function readFileSyncOrNull(path: string): string | null;
  /**
   * The file's bytes, as they are on disk: nothing assumes UTF-8, so a zero
   * byte, a byte of `0x80` or above and an invalid sequence all come back
   * unchanged. The array is an ordinary arena `u8[]` whose `length` is the
   * file's size and equals its capacity. There is no exiting twin. Under Node
   * the answer is `Array.from(fs.readFileSync(path))` or `null`.
   *
   * @param path The file to read.
   * @returns The bytes, or `null` for exactly the paths `readFileSyncOrNull`
   *   answers `null` for.
   */
  export function readFileBytesSync(path: string): u8[] | null;
  /**
   * Create or truncate the file at mode `0644` and write `data`; a statement,
   * not a value. A symbolic link as the last component of `path` is refused
   * with `nish: cannot write <path>`, where Node follows it.
   *
   * @param path The file to write.
   * @param data The bytes of the string, sent as they are.
   */
  export function writeFileSync(path: string, data: string): void;
  /**
   * Create the file or append to it, and write `data`; a statement, not a
   * value. A symbolic link as the last component of `path` is refused, as for
   * `writeFileSync`.
   *
   * @param path The file to append to.
   * @param data The bytes of the string, sent as they are.
   */
  export function appendFileSync(path: string, data: string): void;
  /**
   * Create or truncate the file at mode `0644` and write the array's bytes as
   * they are: `readFileBytesSync`'s other half. A symbolic link as the last
   * component is refused, as for `writeFileSync`. Where `writeFileSync` exits,
   * this answers, and it never panics.
   *
   * @param path The file to write.
   * @param bytes The bytes to write.
   * @returns `bytes.length`, or a negative errno: `-2` ENOENT for a missing
   *   directory, `-13` EACCES, `-21` EISDIR, `-40` ELOOP for the refused link,
   *   `-22` EINVAL for a NUL in `path`.
   */
  export function writeFileBytesSync(path: string, bytes: readonly u8[]): i32;
  /**
   * `rename(2)`: `from` takes the name `to`, replacing a file already there in
   * one step, so a reader sees the old file or the new one and never neither.
   * Nothing is copied across file systems: write the temporary in the target's
   * directory. Never a panic.
   *
   * @param from The current name.
   * @param to The new name.
   * @returns `0`, or a negative errno: `-2` ENOENT for a missing `from`, `-18`
   *   EXDEV when the two are on different file systems, `-21` EISDIR or `-20`
   *   ENOTDIR for a file against a directory, `-22` EINVAL for a NUL in either
   *   path.
   */
  export function renameSync(from: string, to: string): i32;
  /**
   * `unlink(2)`: remove the name, and a symbolic link itself rather than what
   * it names. A directory is refused, not removed: there is no fallback to
   * `rmdir`. Never a panic.
   *
   * @param path The name to remove.
   * @returns `0`, or a negative errno: `-2` ENOENT for a missing path, `-21`
   *   EISDIR for a directory on Linux or `-1` EPERM where the kernel answers
   *   so, `-22` EINVAL for a NUL in `path`.
   */
  export function unlinkSync(path: string): i32;
  /**
   * Create or truncate the file and write `data`, as `writeFileSync` does,
   * with the file left at exactly `mode` (`0o600` for a secret). The open
   * passes `mode` and an `fchmod(2)` sets it before the first byte is written,
   * so the umask cannot widen it, a file that already existed at `0644` is
   * narrowed before it holds the new contents, and no reader that opens it
   * afterwards finds the secret under the old mode. A descriptor opened before,
   * while the file was wider, is not revoked and still reads what is written.
   *
   * The file is truncated and written in place, not through a temporary: a
   * crash or a failed write leaves it empty or partial, and a file this process
   * may write but does not own is emptied before the mode change answers `-1`
   * EPERM. To replace a secret, write it to a temporary beside the target and
   * `renameSync` it over. A symbolic link as the last component is refused
   * with `-40` ELOOP, its target untouched. Never a panic.
   *
   * @param path The file to write.
   * @param data The bytes of the string, sent as they are.
   * @param mode The file's mode, `0..0o777`; the setuid, setgid and sticky
   *   bits are refused, not applied.
   * @returns The length written, or a negative errno: `-22` EINVAL for a mode
   *   outside `0..0o777` or a NUL in `path`, `-2` ENOENT for a missing
   *   directory, `-13` EACCES, `-40` ELOOP for the refused link, `-1` EPERM as
   *   above.
   */
  export function writeFileSyncMode(path: string, data: string, mode: i32): i32;
  /**
   * `O_CREAT|O_EXCL`: create `path` at exactly `mode`, set as for
   * `writeFileSyncMode`, and write `data`. Exactly one of any number of
   * processes racing for one path wins, so it is a lock file: create it, and
   * `unlinkSync` it to release. A winner whose write then fails removes the
   * file before it answers, so a failed create never leaves a half-written lock
   * behind. Never a panic.
   *
   * @param path The file to create.
   * @param data The bytes of the string, sent as they are.
   * @param mode The file's mode, `0..0o777`, as for `writeFileSyncMode`.
   * @returns The length written, `-17` EEXIST when any name is already at
   *   `path` (a dangling symbolic link included, which is never followed), or
   *   another negative errno as for `writeFileSyncMode`.
   */
  export function createFileExclusiveSync(path: string, data: string, mode: i32): i32;
  /**
   * `mkdir(2)` of one level at `mode`. The kernel applies the process umask to
   * `mode`: a `0o700` directory stays `0o700` under any umask that leaves the
   * owner's bits, and a wider mode may come out narrower. An existing name
   * keeps its mode, never changed. Never a panic.
   *
   * @param path The directory to create; its parent must exist.
   * @param mode The directory's mode, `0..0o777`; the sticky, setuid and
   *   setgid bits are refused.
   * @returns `0`, or a negative errno: `-17` EEXIST for a name already there,
   *   `-2` ENOENT for a missing parent, `-22` EINVAL for a mode outside
   *   `0..0o777` or a NUL in `path`.
   */
  export function mkdirSyncMode(path: string, mode: i32): i32;
  /**
   * Create one directory at mode `0777 & ~umask`. It is not recursive, exactly
   * like Node's `fs.mkdirSync(p)` with no options, so a missing parent is a
   * failure and not a reason to create it.
   *
   * @param path The directory to create.
   * @returns `true` when a directory exists at `path` once the call returns,
   *   whether this call created it or it was already there; `false` for every
   *   other outcome, a plain file at `path` included.
   */
  export function mkdirSync(path: string): boolean;
  /**
   * One `stat` of `path`. The answer can be stale by the time the caller acts
   * on it: `mkdirSync` is still the call that decides whether a directory was
   * made, and `readFileSyncOrNull` the way to read a file without racing a
   * check against it.
   *
   * @param path The path to ask about.
   * @returns `true` when a directory exists at `path` as the call runs; `false`
   *   for everything else, including a missing path, a plain file, a device
   *   node and a parent that cannot be searched.
   */
  export function isDirectorySync(path: string): boolean;
  /**
   * The directory's entries, sorted ascending by bytes, without `.` and `..`;
   * every other dotfile is an entry. The sort makes a listing the same on
   * every machine; it agrees with Node's `.sort()` for ASCII names and can
   * differ for names that are not.
   *
   * @param path The directory to list.
   * @returns The sorted entries, an empty array for an empty directory, or
   *   `null` when the directory cannot be read at all (a missing path, a plain
   *   file, a parent that cannot be searched). A WASI build always answers
   *   `null`.
   */
  export function readdirSync(path: string): string[] | null;
  /**
   * `path` with every symbolic link resolved and every `.`, `..` and repeated
   * separator removed. Every component but the last must exist for POSIX
   * `realpath` to answer at all. The bytes are copied into the arena, so the
   * result is an ordinary string; narrow it with `if (p !== null)`.
   *
   * @param path The path to resolve.
   * @returns The absolute resolved path, or `null` when it does not resolve,
   *   which a path that does not exist is.
   */
  export function realpathSync(path: string): string | null;
  /**
   * The path's modification time, following symbolic links, as Node's
   * `mtimeMs`: milliseconds since the epoch with the sub-millisecond fraction
   * kept.
   *
   * @param path The path to `stat`.
   * @returns The modification time, or NaN when the path cannot be stat'd
   *   (missing, or a parent that cannot be searched), which `m !== m` tests.
   */
  export function statMtimeSync(path: string): f64;
}

/**
 * The process and its host: exit, the environment, children, signals, the
 * clocks, scheduling, and the size of the machine.
 *
 *     import { spawn, waitPid, kill, availableParallelism } from "nish:process";
 *
 *     const pid = spawn(["sleep", "5"]);
 *     if (pid > 0) {
 *       kill(pid, 15);
 *       const done = waitPid(pid, 0);
 *     }
 *     const workers = availableParallelism();
 *
 * Each export is the global of the same name, renamed: the compiler emits the
 * same IR for either spelling. A call that can fail answers a value, a
 * negative errno or `-1` or `null`, rather than exiting, because the language
 * has no exceptions and a caller has to be able to turn the failure into its
 * own diagnostic.
 *
 * A `wasm32` target has no processes and no host to ask, so the checker
 * refuses `spawn`, `spawnWithFds`, `kill`, `waitPid`, `availableParallelism`,
 * `totalMemory`, the scheduling calls, `signalFd` and `readSignal` there;
 * a WASI build answers `-1` from `spawnSync`,
 * `spawnSyncTo` and `spawnPiped`. `spawn`, `kill`, `waitPid` and the scheduling
 * calls write state outside the program, so a scope's task or a parallel body
 * that calls one is refused as any shared write is.
 *
 * **A supervisor polls.** A blocking `waitPid(pid, 0)` cannot be woken by
 * SIGTERM once `signalFd()` is installed, so a supervisor that must answer a
 * signal while its children run reaps with flag 1 (WNOHANG) on each tick of a
 * `pollWait` loop that also watches the signal descriptor, and stops its
 * children with `kill` when `readSignal` answers.
 *
 * The rules: https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#directories-and-subprocesses,
 * https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#the-environment,
 * https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#the-clock,
 * https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#the-host-the-wall-clock-entropy-file-times-and-signals,
 * https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#children-and-the-machine-spawn-kill-waitpid-availableparallelism-totalmemory
 * and https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#scheduling-setnice-setidlepriority-setcpuaffinity
 */
declare module "nish:process" {
  /**
   * The global `process.exit`: a terminator, which `never` is how `tsc`
   * spells it.
   *
   * @param code The exit status.
   * @returns Never: the program ends.
   */
  export function exit(code: i32): never;
  /**
   * The value of environment variable `name` as the call runs. The bytes are
   * copied into the arena, so the result is an ordinary string that outlives
   * any later change to the environment, and it is bytes: a value that is not
   * valid UTF-8 comes back as those bytes. Two reads are two calls, never
   * folded into one, because linked C may change the environment between
   * them. There is no `setenv`.
   *
   * @param name The variable's name.
   * @returns The value, a zero-length string for a variable set to nothing
   *   (`CC=`), or `null` when the variable is unset; narrow it with
   *   `if (cc !== null)`.
   */
  export function getenv(name: string): string | null;
  /**
   * Run `argv[0]`, searched on `PATH`, with `argv` as its argument vector, and
   * wait for it. The child inherits this process's environment, streams and
   * working directory. The runtime keeps each element's bytes pointer for the
   * child, so the array escapes; an embedded NUL truncates an argument.
   *
   * @param argv The program and its arguments.
   * @returns The child's exit status, `128 + n` when signal `n` killed it, or
   *   `-1` when the vector is empty, when the child cannot be started or waited
   *   for, and always on WASI.
   */
  export function spawnSync(argv: string[]): number;
  /**
   * The same run as `spawnSync`, with each stream sent to a file rather than
   * inherited. Each path is created or truncated at `0644`, as `writeFileSync`
   * does, and an empty path leaves that stream inherited, so one call can
   * capture stdout and let stderr through. The two paths must not name one
   * file: each is opened separately, with its own offset, so the streams
   * would overwrite rather than interleave.
   *
   * @param argv The program and its arguments.
   * @param stdoutPath The file for the child's stdout, or `""` to inherit it.
   * @param stderrPath The file for the child's stderr, or `""` to inherit it.
   * @returns Every answer `spawnSync` gives, and `-1` when a symbolic link is
   *   the last component of either path.
   */
  export function spawnSyncTo(argv: string[], stdoutPath: string, stderrPath: string): number;
  /**
   * The same run as `spawnSync`, with every stream a pipe: the child reads
   * `stdin`'s bytes and then end of file, and whatever it writes to its stdout
   * and stderr is appended to `stdout` and `stderr`, which keep what they
   * held. It is the run for a child that takes a secret on stdin, which `ps`
   * and `/proc` do not show. A child that exits without reading its stdin is
   * not a failure. The child inherits the environment and working directory,
   * and no descriptor of the program but its three streams; it starts with
   * SIGPIPE as the program had it, and the program's own SIGPIPE from writing
   * to a child that stopped reading is absorbed. One `poll` loop writes and
   * drains, so a child that fills one pipe cannot deadlock the parent.
   *
   * @param argv The program and its arguments.
   * @param stdin The bytes the child reads.
   * @param stdout Grows by the child's stdout; neither `readonly` nor a typed
   *   array, since the runtime pushes onto it.
   * @param stderr Grows by the child's stderr, under the same rule.
   * @returns The status or `128 + n` as `spawnSync` answers; `-1` for an empty
   *   vector, a child that cannot be started, a pipe or `poll` that fails, and
   *   a WASI build; `-2` when a stream passes 16 MiB (`NISH_PIPED_CAP`), which
   *   kills the child with `SIGKILL` and leaves that array holding the first
   *   16 MiB.
   */
  export function spawnPiped(argv: string[], stdin: readonly u8[], stdout: u8[], stderr: u8[]): i32;
  /**
   * Start `argv[0]`, searched on `PATH`, exactly as `spawnSync` does (the same
   * vector, environment, streams and working directory), without waiting. The
   * child is this process's until `waitPid` reaps it; one never reaped stays a
   * zombie until the program exits, as in C. Test `pid > 0` before handing the
   * answer on: a failure such as `-1` passed to `waitPid` reads as "any child".
   *
   * @param argv The program and its arguments.
   * @returns The child's pid, or a negative errno: `-22` EINVAL for an empty
   *   vector or an argument holding a NUL, `posix_spawnp`'s own error
   *   otherwise, so a program that is not there is `-2` ENOENT.
   */
  export function spawn(argv: string[]): i32;
  /**
   * `spawn`, with the child holding `fds[i]` as descriptor `3 + i`,
   * close-on-exec cleared there. Its streams 0 to 2 are this process's, and no
   * other descriptor of this process reaches it but one opened without
   * close-on-exec, which nothing the runtime opens is. Any order works: `fds`
   * may list a descriptor that is already its own target (`[3]`), another
   * entry's target (`[4, 3]`), or the same one twice. The child shares each
   * descriptor's open file, its offset and its status flags, `O_NONBLOCK`
   * among them, and this process keeps its own. Reap the pid with `waitPid`.
   *
   * @param argv The program and its arguments.
   * @param fds The descriptors the child receives from 3 onward; an empty
   *   array is `spawn` exactly.
   * @returns The child's pid, or a negative errno: `-22` for more than 64
   *   descriptors or a negative one (before anything is opened or started),
   *   `-9` for one that is not open, `-24` (or `-22` above the descriptor
   *   limit) for a scratch descriptor the system cannot give, and `spawn`'s
   *   errors.
   */
  export function spawnWithFds(argv: string[], fds: readonly i32[]): i32;
  /**
   * Send `sig` to `pid`. Only 0, 2 (SIGINT), 9 (SIGKILL) and 15 (SIGTERM) are
   * taken, whose numbers are the same on Linux and Darwin, so a number means
   * the same signal on every host. A positive pid may be any process of this
   * user, not only a child.
   *
   * @param pid The process, above 0.
   * @param sig 0, 2, 9 or 15.
   * @returns `0`, or a negative errno: `-22` for any other `sig` or a `pid` of
   *   0 or below (which `kill(2)` reads as a group), `-3` ESRCH when no process
   *   has the pid (a child already reaped included), `-1` EPERM when it is
   *   another user's.
   */
  export function kill(pid: i32, sig: i32): i32;
  /**
   * Reap a child. The status is `spawnSync`'s: the exit code, or `128 + n`
   * when signal `n` ended it. An array because the language has no tuple.
   *
   * @param pid A child's pid, or `-1` for any child.
   * @param flags `0` to block, or `1` for WNOHANG.
   * @returns A fresh `[pid, status]`; `[0, 0]` for a WNOHANG wait with a child
   *   left and none exited; `[-10, 0]` ECHILD with no child to wait for,
   *   `[-4, 0]` EINTR when a signal interrupted the wait (after `signalFd()` a
   *   blocking wait restarts and never sees it), `[-22, 0]` for any other flag
   *   bit or a pid that is neither `-1` nor positive.
   */
  export function waitPid(pid: i32, flags: i32): i32[];
  /**
   * How many CPUs the program may use: the smallest of the CPUs online, the
   * ones its thread may run on (an affinity mask, a container's cpuset), a
   * cgroup v2 CPU quota rounded up, and `NISH_NUM_THREADS` when that is a
   * positive number, which can lower the count and never raise it. It needs no
   * `--threads`, and a task may call it.
   *
   * @returns The count, at least 1.
   */
  export function availableParallelism(): i32;
  /**
   * The machine's physical memory: `_SC_PHYS_PAGES` times the page size on
   * Linux, `hw.memsize` on Darwin. The machine's, not a cgroup's limit. A task
   * may call it.
   *
   * @returns The bytes, or `-1` where the host does not say.
   */
  export function totalMemory(): i64;
  /**
   * Set the nice value with `setpriority(PRIO_PROCESS, 0, n)`. Lower-only, even
   * as root: the priority never rises. It sets the calling thread's value and
   * every thread's started after it, so it belongs at the top of `main`;
   * children started afterwards inherit it.
   *
   * @param n The nice value, 0..19.
   * @returns `0`, or a negative errno: `-22` EINVAL outside 0..19 and `-13`
   *   EACCES below the current value, both with no system call.
   */
  export function setNice(n: i32): i32;
  /**
   * Move this process to `SCHED_IDLE`, which runs it only when nothing else
   * wants the CPU. An unprivileged process can never leave it, and an idle
   * process can starve on a saturated machine, so a caller keeps a
   * normal-priority fallback (`setNice(19)`, or a deadline) for work that must
   * finish. Per thread, as `setNice` is.
   *
   * @returns `0`, a negative errno, or `-95` on Darwin, which has no such
   *   policy.
   */
  export function setIdlePriority(): i32;
  /**
   * Pin the calling process to the one CPU `cpu` with `sched_setaffinity`.
   * Narrow-only: it never moves a process onto a CPU it was kept off.
   * `availableParallelism()` answers 1 afterwards, and children started
   * afterwards inherit the mask.
   *
   * @param cpu The CPU's index.
   * @returns `0`; `-22` with no change for a `cpu` below 0, at or past
   *   `CPU_SETSIZE`, or outside the CPUs the process may already run on; `-95`
   *   on Darwin and under Node, which have no affinity call.
   */
  export function setCpuAffinity(cpu: i32): i32;
  /**
   * `CLOCK_MONOTONIC` in nanoseconds. The origin is arbitrary, so only the
   * difference between two reads means anything: it is not comparable between
   * two processes or two machines, and it is not a date. Two reads with work
   * between them never fold into one.
   *
   * @returns The clock's reading.
   */
  export function monotonicNanos(): i64;
  /**
   * `CLOCK_REALTIME` in nanoseconds since 1970-01-01 UTC: `Date.now`'s clock
   * at a nanosecond's grain. It steps, and can go backwards, when the system
   * time is set, so a duration is `monotonicNanos`'s job. Not refused on wasm.
   *
   * @returns The timestamp.
   */
  export function wallClockNanos(): i64;
  /**
   * A descriptor that becomes readable when SIGTERM or SIGINT arrives: the
   * read end of a pipe a `sigaction` handler writes one byte to per signal, so
   * the signals' default action never runs, whichever thread a signal lands
   * on. Installing the handler overrides a disposition the process started
   * with, so a signal its parent ignored is heard. Made once.
   *
   * @returns The same descriptor every call, or `-1` when it cannot be made.
   */
  export function signalFd(): i32;
  /**
   * Block until SIGTERM or SIGINT arrives. It can wait forever.
   *
   * @param fd The descriptor `signalFd()` answered; an `i32` in both number
   *   modes, and an `f64`, `i64` or string is refused rather than converted.
   * @returns 15 or 2, or `-1` for a descriptor that is not `signalFd()`'s and
   *   for a read that fails.
   */
  export function readSignal(fd: i32): i32;
  /** The command line; `argv[0]` is the program path, as in C. Read-only. */
  export const argv: readonly string[];
  /** The operating system the program runs on: `"linux"`, `"darwin"`, or `"unknown"`. */
  export const platform: string;
  /** The architecture: `"x64"`, `"arm64"`, or `"unknown"`. */
  export const arch: string;
}

/**
 * Non-blocking sockets for a program that owns its loop: TCP, UDP,
 * Unix-domain sockets, and a level-triggered readiness loop to wait on them.
 *
 *     import { netAddress, tcpListen, tcpAccept, netRead, netWrite, pollCreate, pollAdd, pollWait } from "nish:net";
 *
 *     const server = tcpListen("::", 8080, 128);
 *     const loop = pollCreate();
 *     pollAdd(loop, server, 1, 1);
 *     const ready: i32[] = new Array<i32>(32);
 *     const peer: u8[] = new Array<u8>(18);
 *     const n = pollWait(loop, ready, -1);
 *     const conn = tcpAccept(server, peer);  // -11 when none is waiting
 *
 * Every socket is non-blocking and close-on-exec, so a call that would wait
 * answers `-11` and a child that `spawnSync` starts inherits none of them.
 * Each export is the global of the same name, renamed. Every call answers an
 * `i32`: `>= 0` is success and a negative number is the failure's errno,
 * negated, with Linux's numbers on every platform for the codes a loop
 * branches on (`-11` would block, `-95` unsupported, `-32` the peer has gone,
 * `-104` reset, `-98` in use, `-111` refused, `-110` timed out, `-88` not a
 * socket, `-22` a bad argument); any other failure is the host's `-errno`. No
 * call touches the arena.
 *
 * A `wasm32` target and the `wasi` profile have no sockets, so the checker
 * refuses every call there with NL2404, except `netMss`, which compiles to
 * `-1`. No call may be made in a `scope()` task or a parallel body. Under Node
 * every call throws, because a socket is ready only to Node's event loop,
 * which a program that owns its loop never returns to; the option ids and the
 * `NET_UNIX_` constants still read as numbers. No call resolves a name:
 * `nish/net/dns` does that on the program's own loop.
 *
 * **The address form.** An address is 18 bytes of a `u8[]`: the 16 bytes of
 * an IPv6 address, with IPv4 written as the mapped `::ffff:a.b.c.d`, then the
 * port, big-endian. One form for both families, in memory the caller owns, so
 * a server that accepts a million connections allocates nothing to learn who
 * they are from. An array longer than 18 bytes is fine; the rest is not
 * touched. An address array shorter than 18 bytes is `-22`, not a panic.
 *
 * **Bounds.** Every `off`/`len` range is checked in the compiled code before
 * the call, as `dst.set(src, at)` checks its range, and a range outside the
 * array panics with `slice out of range`, exit 1.
 *
 * **Level-triggered.** A descriptor still ready when the program waits again
 * is reported again, so a loop that handles one ready pair of several, or
 * leaves a datagram unread, loses nothing.
 *
 * The rules: https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#nishnet-addresses-non-blocking-tcp-and-udp-and-the-readiness-loop
 */
declare module "nish:net" {
  /**
   * Write the address form of a numeric host and a port. No call looks a name
   * up; `nish/net/dns` resolves one first.
   *
   * @param out The array the 18 bytes are written into; one shorter than 18
   *   bytes is left as it was.
   * @param host An IPv4 dotted quad or an IPv6 literal.
   * @param port The port, `0..65535`.
   * @returns `0`, or `-22` for a name, a string with a NUL inside it, a port
   *   outside `0..65535`, or an `out` shorter than 18 bytes.
   */
  export function netAddress(out: u8[], host: string, port: i32): i32;
  /**
   * The port the socket is bound to, which is how a program that listened on
   * port `0` learns the one the kernel chose.
   *
   * @param fd A bound socket.
   * @returns The port, or the failure.
   */
  export function netLocalPort(fd: i32): i32;
  /**
   * A listening TCP socket on a numeric host, with `SO_REUSEADDR`, so a
   * restarted server rebinds a port its old connections still hold in
   * `TIME_WAIT`. An IPv4 host is an IPv4 socket; any other is IPv6 with
   * `IPV6_V6ONLY` off, so `"::"` hears both families, and on a kernel without
   * IPv6 `"::"` is IPv4's `0.0.0.0`.
   *
   * @param host A numeric host.
   * @param port The port; `0` lets the kernel choose (read it with
   *   `netLocalPort`).
   * @param backlog The length of the accept queue.
   * @returns The listener's descriptor, `-98` when the port is in use, or
   *   `-22` for a host that is not a literal.
   */
  export function tcpListen(host: string, port: i32, backlog: i32): i32;
  /**
   * `tcpListen`'s socket, with flags.
   *
   * Flag 1 sets `SO_REUSEPORT` before the bind, so several listeners that all
   * ask for it share one port, each with its own accept queue, in one process
   * or several. On Linux they each get new connections, spread by a hash of
   * the 4-tuple, and only listeners of one user may share; on Darwin one of
   * them takes the connections, which buys a restart without a gap rather
   * than a spread. A port held by a listener without flag 1 is `-98` to one
   * that asks for it, and the other way round.
   *
   * Flag 2 sets `TCP_NODELAY` on every connection `tcpAccept` takes from the
   * listener, on every platform: the runtime sets it on each accepted socket
   * rather than trusting the kernel to copy it, and a connection on which it
   * cannot be set is closed and its failure answered.
   *
   * Flag 4, with flag 1 and on Linux only, attaches a classic BPF program
   * (`SO_ATTACH_REUSEPORT_CBPF`) that hands each connection to the listener at
   * the index of the CPU that received it, in the order the group's listeners
   * were bound; a CPU past the group's size falls back to the hash.
   *
   * @param host A numeric host, as for `tcpListen`.
   * @param port The port.
   * @param backlog The length of the accept queue.
   * @param flags The sum of the flags: `3` is both, `5` and `7` steer, and `0`
   *   is `tcpListen` exactly.
   * @returns The listener's descriptor or the failure: `-22` for any other
   *   bit, a negative `flags`, or flag 4 without 1, before a socket is made;
   *   `-95` for flag 4 off Linux.
   */
  export function tcpListenFlags(host: string, port: i32, backlog: i32, flags: i32): i32;
  /**
   * The next waiting connection, as a descriptor of its own, non-blocking and
   * close-on-exec. Not `willreturn`: on a blocking socket the program
   * inherited, it waits.
   *
   * @param fd The listener.
   * @param peer The array the peer's address form is written into.
   * @returns The connection's descriptor, `-11` when none is waiting, `-22`
   *   for a `peer` shorter than 18 bytes before anything is accepted (so no
   *   connection is taken and lost), or `-95` for a datagram socket.
   */
  export function tcpAccept(fd: i32, peer: u8[]): i32;
  /**
   * Read at most `len` bytes into `buf[off, off + len)`. The range is checked.
   *
   * @param fd A connected socket.
   * @param buf The array the bytes are written into.
   * @param off The first index written.
   * @param len The most bytes read; a `len` of `0` answers `0`, so ask for at
   *   least one byte.
   * @returns The count, `0` at the end of the stream, `-11` when nothing is
   *   waiting, or the failure.
   */
  export function netRead(fd: i32, buf: u8[], off: i32, len: i32): i32;
  /**
   * Write at most `len` bytes of `buf[off, off + len)`. The range is checked.
   * A peer that has gone is `-32`, never SIGPIPE, so a closed connection
   * cannot end the process.
   *
   * @param fd A connected socket.
   * @param buf The bytes; it may be `readonly`.
   * @param off The first index sent.
   * @param len The most bytes sent.
   * @returns The count, which may be fewer than `len`, `-11` when the send
   *   buffer is full, `-32` for a gone peer, or the failure.
   */
  export function netWrite(fd: i32, buf: readonly u8[], off: i32, len: i32): i32;
  /**
   * Write `a[aOff, aOff + aLen)` and then `b[bOff, bOff + bLen)` in one system
   * call (`sendmsg` with two `iovec`s), so a header and a body leave together
   * with no copy into one buffer. The program sends the rest of a short
   * write, as after `netWrite`. Both ranges are checked, `a`'s first, and
   * either may be empty. A gone peer is `-32`, never SIGPIPE.
   *
   * @param fd A connected socket.
   * @param a The first bytes; it may be `readonly`.
   * @param aOff The first index of `a` sent.
   * @param aLen The bytes of `a` sent.
   * @param b The second bytes; it may be `readonly`.
   * @param bOff The first index of `b` sent.
   * @param bLen The bytes of `b` sent.
   * @returns The count of bytes taken, which may be fewer than `aLen + bLen`
   *   and may end inside `a`, `-11` when the send buffer is full, `-32` for a
   *   gone peer, or the failure.
   */
  export function netWrite2(
    fd: i32,
    a: readonly u8[],
    aOff: i32,
    aLen: i32,
    b: readonly u8[],
    bOff: i32,
    bLen: i32
  ): i32;
  /**
   * Shut one side of a connection, or both.
   *
   * @param fd A connected socket.
   * @param how `0` the read side, `1` the write side, `2` both.
   * @returns `0`, `-22` for any other `how`, or the failure.
   */
  export function netShutdown(fd: i32, how: i32): i32;
  /**
   * Close the descriptor. It is gone after the call whatever the answer, as
   * `close(2)` promises on Linux. Closing a descriptor also stops a loop
   * watching it. Not `willreturn`, because a socket the program inherited
   * with a linger time can wait.
   *
   * @param fd The descriptor.
   * @returns `0`, or the failure.
   */
  export function netClose(fd: i32): i32;
  /**
   * A new TCP socket, non-blocking and close-on-exec, that starts connecting
   * to `addr` and is answered at once, while the connection is still being
   * made: the `EINPROGRESS` (`-115`) of a non-blocking `connect` is not a
   * failure.
   * Watch the descriptor for writability, then ask `connectResult`. It holds
   * `TCP_NODELAY`, so a small write is sent at once. It does not wait and does
   * not allocate.
   *
   * @param addr The address form; an IPv4 address connects from an IPv4
   *   socket, any other from an IPv6 one. It may be `readonly`.
   * @returns The descriptor; any other failure closes the socket and is
   *   answered instead, and an `addr` shorter than 18 bytes is `-22` before
   *   any socket exists.
   */
  export function tcpConnect(addr: readonly u8[]): i32;
  /**
   * How a connection `tcpConnect` started went, asked once `fd` is writable.
   * The kernel clears the failure as it is read, so a second call answers
   * `0`; close the descriptor with `netClose` either way.
   *
   * @param fd The descriptor `tcpConnect` answered.
   * @returns `0` when the connection is made, or its failure from `SO_ERROR`,
   *   such as `-111` for a port nobody listens on and `-110` for one that
   *   never answered.
   */
  export function connectResult(fd: i32): i32;
  /**
   * A datagram socket, non-blocking and close-on-exec, bound to a numeric
   * host and port as `tcpListen`'s is, `"::"` and its IPv4 fallback included.
   * The ECN bits of every datagram are always read.
   *
   * @param host A numeric host.
   * @param port The port.
   * @param flags `1` is `SO_REUSEPORT`, so several sockets that all ask for it
   *   share a port and the kernel spreads the datagrams across them; `2` is
   *   `UDP_GRO`, so the kernel may coalesce a flow's datagrams that arrive
   *   after the bind into one receive (`-95` on Darwin).
   * @returns The descriptor, `-22` for any other bit, `-98` for a port in use
   *   without flag 1, or the failure.
   */
  export function udpBind(host: string, port: i32, flags: i32): i32;
  /**
   * Send `buf[off, off + len)` to `to` in one `sendmsg`. The range is checked.
   * Not `willreturn`: on a blocking socket the program inherited, it waits.
   * An IPv4 socket sends to a mapped `::ffff:a.b.c.d` address as IPv4.
   *
   * @param fd A datagram socket.
   * @param buf The payload; it may be `readonly`.
   * @param off The first index sent.
   * @param len The payload's length.
   * @param to The address form of the receiver; it may be `readonly`.
   * @param segment Above `0`, GSO: the kernel cuts the payload into datagrams
   *   of `segment` bytes, the last one shorter, so one call sends many; `0`
   *   sends one datagram. `0..65535`; above `0` is `-95` on Darwin.
   * @param ecn The two ECN bits of the IP header: `0` not ECN-capable, `1`
   *   ECT(1), `2` ECT(0), `3` CE. Above `0` is `-95` on Darwin.
   * @returns The bytes sent, `-11` when the send buffer is full, or `-22` for
   *   a `to` shorter than 18 bytes, a `segment` outside `0..65535`, an `ecn`
   *   outside `0..3`, or a payload the kernel will not cut (more segments than
   *   it takes in one call, or a segment the route cannot carry).
   */
  export function udpSendTo(
    fd: i32,
    buf: readonly u8[],
    off: i32,
    len: i32,
    to: readonly u8[],
    segment: i32,
    ecn: i32
  ): i32;
  /**
   * Receive the next datagram into `buf[off, off + len)`, cut to `len` if it
   * is longer, in one `recvmsg`. The range is checked. An empty datagram is a
   * datagram and answers `0`. Not `willreturn`, as `udpSendTo`.
   *
   * @param fd A datagram socket.
   * @param buf The array the payload is written into.
   * @param off The first index written.
   * @param len The most bytes taken.
   * @param from The array the sender's address form is written into, ready to
   *   pass to `udpSendTo` as a reply's `to`.
   * @param meta Two numbers written: `meta[0]` the GRO segment size, the size
   *   of each datagram the kernel coalesced into this one (`0` when it
   *   coalesced none; walk the buffer in steps of it, the last possibly
   *   shorter), and `meta[1]` the ECN bits the datagram arrived with. Always
   *   `0, 0` on Darwin, where a `meta[1]` of `0` cannot say ECN is unsupported.
   * @returns The datagram's length, `-11` when none is waiting, or `-22` for
   *   a `from` shorter than 18 bytes or a `meta` shorter than 2, before
   *   anything is taken.
   */
  export function udpRecvFrom(fd: i32, buf: u8[], off: i32, len: i32, from: u8[], meta: i32[]): i32;
  /**
   * A readiness loop: a descriptor, close-on-exec, that watches others,
   * level-triggered. Epoll on Linux; kqueue on Darwin, from whose filters the
   * runtime builds epoll's answers.
   *
   * @returns The loop's descriptor, or the failure.
   */
  export function pollCreate(): i32;
  /**
   * Watch `fd` and report it under `token`.
   *
   * @param loop The loop.
   * @param fd The descriptor to watch.
   * @param events `1` readable, `2` writable, `3` both, `0` neither.
   * @param token An `i32` of the program's choosing that comes back as it went
   *   in.
   * @returns `0`, `-17` for a descriptor the loop already watches (on Darwin
   *   it is left under the new token), or `-22` for an event bit past `2`.
   */
  export function pollAdd(loop: i32, fd: i32, events: i32, token: i32): i32;
  /**
   * New events or a new token for a descriptor the loop watches.
   *
   * @param loop The loop.
   * @param fd The watched descriptor.
   * @param events `1` readable, `2` writable, `3` both, `0` neither.
   * @param token The token it is reported under from now on.
   * @returns `0`, or `-2` for a descriptor the loop does not watch.
   */
  export function pollModify(loop: i32, fd: i32, events: i32, token: i32): i32;
  /**
   * Stop watching `fd`. Closing a descriptor stops the watching too.
   *
   * @param loop The loop.
   * @param fd The watched descriptor.
   * @returns `0`, or `-2` for a descriptor the loop does not watch.
   */
  export function pollRemove(loop: i32, fd: i32): i32;
  /**
   * Wait until a watched descriptor is ready or the timeout passes, and write
   * one pair per ready descriptor: `ready[2k]` its token and `ready[2k + 1]`
   * its events, `1` readable and `2` writable, with `4` added for a hang-up or
   * an error. A signal that interrupts the wait answers `0`, as a timeout
   * does. Not `willreturn`, because it can wait forever. Nothing allocates,
   * and `ready` is never written past its length.
   *
   * @param loop The loop.
   * @param ready The array the pairs are written into.
   * @param timeoutMs The most milliseconds to wait; any negative number waits
   *   forever.
   * @returns The count of pairs, at most `ready.length / 2` and at most 64
   *   (the rest are still ready at the next wait), `0` on a timeout, or `-22`
   *   for a `ready` shorter than 2.
   */
  export function pollWait(loop: i32, ready: i32[], timeoutMs: i32): i32;
  /**
   * Set one socket option from a whitelist. There is no way to pass a raw
   * level and option number, because that would be an untyped call into the
   * kernel. Refused at compile time on wasm, and it throws under Node.
   *
   * @param fd A socket.
   * @param option One of the `NET_*` option ids.
   * @param value `0` or `1` for the switches, a byte count for the buffer
   *   sizes.
   * @returns `0`, or the failure: `-9` for a closed descriptor, `-88` for one
   *   that is not a socket, `-22` for any other `option`, and `-95` for
   *   `NET_TCP_QUICKACK` off Linux.
   */
  export function netSetOption(fd: i32, option: i32, value: i32): i32;
  /**
   * The maximum segment size a connected TCP socket sends, the payload bytes
   * one segment carries, so that one write can fill whole segments: Linux's
   * `TCP_INFO` `tcpi_snd_mss`, or `TCP_MAXSEG` where that is not above `0`
   * and on Darwin. It never panics. The answer moves as the path does, so
   * read it when it is needed rather than once.
   *
   *     // A batch of whole segments, or the caller's own size where there is no MSS.
   *     export const batch = (conn: i32, fallback: i32): i32 => {
   *       const mss = netMss(conn);
   *       return mss > 0 ? mss * 8 : fallback;
   *     };
   *
   * @param fd A connected TCP socket.
   * @returns The size, or a plain `-1`, never an errno, for anything else: a
   *   descriptor that is not open, a socket with no peer (a listener, or one
   *   never connected, though the kernel answers its default `536` for
   *   those), a socket that is not TCP, and every call on wasm, where it
   *   compiles to the constant with the descriptor still evaluated. It throws
   *   under Node.
   */
  export function netMss(fd: i32): i32;
  /** `TCP_NODELAY`, option id 1: `value` 1 sends a small write at once, 0 lets Nagle batch it. */
  export const NET_TCP_NODELAY: i32;
  /**
   * `TCP_QUICKACK`, option id 2 (Linux; -95 elsewhere): `value` 1 acknowledges at once, 0
   * delays. Linux does not keep quick-ACK mode: the kernel leaves it on its own,
   * so a server that wants a mode sets it again after every response.
   *
   *     // After each response: Linux may have left quick-ACK mode.
   *     export const answered = (conn: i32): i32 => netSetOption(conn, NET_TCP_QUICKACK, 1);
   */
  export const NET_TCP_QUICKACK: i32;
  /** `SO_KEEPALIVE`, option id 3: `value` 1 probes an idle connection, 0 does not. */
  export const NET_SO_KEEPALIVE: i32;
  /** `SO_SNDBUF`, option id 4: the send buffer, `value` in bytes; Linux doubles the value it stores. */
  export const NET_SO_SNDBUF: i32;
  /** `SO_RCVBUF`, option id 5: the receive buffer, `value` in bytes; Linux doubles the value it stores. */
  export const NET_SO_RCVBUF: i32;
  /**
   * A listening Unix-domain stream socket at `path`, whose file is `0600`, so
   * only its owner may connect. A bind never replaces a file. Closing the
   * listener does not unlink its file: `unlinkSync` it when the server stops,
   * or let the next start's `NET_UNIX_UNLINK_STALE` clear it. A call that
   * fails after its bind closes the socket and unlinks the file it made.
   *
   * @param path Bytes up to the first NUL, at most 107 bytes on Linux and 103
   *   on Darwin, relative to the working directory. A leading `@` names
   *   Linux's abstract namespace, which leaves no file (`-95` on Darwin).
   * @param backlog The length of the accept queue.
   * @param flags `0`, or `NET_UNIX_UNLINK_STALE` to clear a socket file
   *   nothing listens on, found by a probe connect, and bind again.
   * @returns The listener's descriptor or the failure: `-98` when the path
   *   exists (a live listener stays `-98`); `-17` when the flag finds
   *   something that is not a socket; `-95` on Darwin when the flag finds a
   *   socket file, which it cannot probe; `-36` for a path too long; `-22` for
   *   an empty path, a bare `@`, a NUL inside, or any other flag bit.
   */
  export function unixListen(path: string, backlog: i32, flags: i32): i32;
  /**
   * `unixListen`'s socket with the file's mode chosen, set between the bind
   * and the listen, so no connect gets in under a wider one.
   *
   * @param path As for `unixListen`.
   * @param backlog The length of the accept queue.
   * @param flags As for `unixListen`.
   * @param mode `0` to `0o777`, and no other bits.
   * @returns The listener's descriptor, `unixListen`'s failures, or `-22` for
   *   a mode outside that range or an abstract name, which has no file to
   *   give a mode to.
   */
  export function unixListenMode(path: string, backlog: i32, flags: i32, mode: i32): i32;
  /**
   * A new socket, non-blocking and close-on-exec, connected to the listener
   * at `path`. A connect needs write permission on the file and search
   * permission on every directory above it.
   *
   * @param path As for `unixListen`.
   * @returns The descriptor; `-111` when nothing listens there; `-2` when
   *   there is no such file; `-11` on Linux and `-111` on Darwin when the
   *   listener's backlog is full (the socket is closed; try again later); or
   *   the path refusals `unixListen` has.
   */
  export function unixConnect(path: string): i32;
  /**
   * The next waiting connection on a Unix listener, non-blocking and
   * close-on-exec. No peer address is written: a Unix client is seldom
   * bound.
   *
   * @param fd The listener.
   * @returns The connection's descriptor, `-11` when none is waiting, or the
   *   failure.
   */
  export function unixAccept(fd: i32): i32;
  /**
   * Two sockets already connected to each other, non-blocking and
   * close-on-exec: a channel without a name, for a child process or for one
   * side of a program.
   *
   * @param kind `NET_UNIX_STREAM` (`1`), a byte stream, or
   *   `NET_UNIX_SEQPACKET` (`2`), where each write is one message and a read
   *   returns one message, never two run together; `2` is `-95` on Darwin.
   * @param fds The array the two descriptors are written into, as `fds[0]`
   *   and `fds[1]`.
   * @returns `0`, or `-22` for any other kind or an `fds` shorter than 2,
   *   before a socket exists.
   */
  export function unixSocketPair(kind: i32, fds: i32[]): i32;
  /**
   * Send `buf[off, off + len)` over the Unix socket `sock`, with one copy of
   * the descriptor `fd` riding on them (`SCM_RIGHTS`). The receiver's
   * `recvFd` gets a new descriptor for the same open file, offset and status
   * flags shared, as `dup` gives; `fd` stays open here. On a stream socket
   * the count can be short of `len`: the descriptor has travelled with the
   * first bytes, so send the rest with `netWrite`, not `sendFd`, or the
   * receiver gets a second copy. The range is checked.
   *
   * @param sock A connected Unix socket.
   * @param fd The descriptor to send.
   * @param buf The bytes the descriptor rides on; it may be `readonly`.
   * @param off The first index sent.
   * @param len The bytes sent; at least one, because a descriptor travels
   *   with data.
   * @returns The bytes sent, or the failure: `-22` for a `len` of `0` or a
   *   negative `fd`; `-9` for an `fd` that is not open or a closed `sock`;
   *   `-88` for a `sock` that is not a socket; `-95` for a socket of another
   *   family; `-32` for a gone peer, never SIGPIPE.
   */
  export function sendFd(sock: i32, fd: i32, buf: readonly u8[], off: i32, len: i32): i32;
  /**
   * Read at most `len` bytes into `buf[off, off + len)` from the Unix socket
   * `sock`, with the first descriptor that came with them. Every further
   * descriptor in the message is closed before the answer, and room is made
   * for 8, so the kernel drops the rest of a message that carries more and
   * the bytes are still answered. The descriptor kept is close-on-exec and is
   * not made non-blocking: its status flags are the open file's, which the
   * sender shares, so set what the program needs before it joins a loop. The
   * range is checked.
   *
   * @param sock A connected Unix socket, refused as `sendFd`'s is.
   * @param buf The array the bytes are written into.
   * @param off The first index written.
   * @param len The most bytes read.
   * @param fd `fd[0]` is written with the descriptor, or `-1` when the message
   *   carried none.
   * @returns The count, `0` at the end of the stream, `-11` when nothing is
   *   waiting, `-22` for a `len` of `0` or an empty `fd` before anything is
   *   read, or the failure.
   */
  export function recvFd(sock: i32, buf: u8[], off: i32, len: i32, fd: i32[]): i32;
  /**
   * The process at the other end of a connected Unix socket, as the kernel
   * recorded it when the connection was made (the `connect`, or the
   * `socketpair`), not who holds the other end now: a peer that has changed
   * its uid since, passed the socket on, or closed, still reads as it was.
   *
   * @param fd A connected Unix socket, refused as `sendFd`'s `sock` is.
   * @param out `out[0]`, `out[1]`, `out[2]` are written with the pid, uid and
   *   gid. A uid or gid of 2^31 or above wraps into the `i32` (`-2` is uid
   *   4294967294). On Darwin the pid is `-1` where the SDK has no
   *   `LOCAL_PEERPID` or the kernel refuses it.
   * @returns `0`, `-107` on every platform for a socket with no peer (a
   *   listener, or one never connected), `-22` for an `out` shorter than 3
   *   before anything is asked, or the failure.
   */
  export function peerCredentials(fd: i32, out: i32[]): i32;
  /** `unixListen` flag 1: unlink a socket file nothing listens on, then bind. */
  export const NET_UNIX_UNLINK_STALE: i32;
  /** `unixSocketPair` kind: a byte stream. */
  export const NET_UNIX_STREAM: i32;
  /** `unixSocketPair` kind: each write one message (`SOCK_SEQPACKET`). */
  export const NET_UNIX_SEQPACKET: i32;
}

/**
 * Element access with no bounds check, signed arithmetic that wraps, and a C
 * string read through a pointer nothing proves.
 *
 *     import { uncheckedGet, uncheckedSet, wrappingAdd } from "nish:unsafe";
 *
 *     export const mix = (h: i32[], i: i32, x: i32): void => {
 *       uncheckedSet(h, i, wrappingAdd(uncheckedGet(h, i), x));
 *     };
 *
 * Each function gives up one check the language otherwise always makes, at
 * one site. A program reaches them only through an import, so every module
 * that gives up a check or defines a wrap says so at its top, and every site
 * is a call a reader can find. `--emit-checked` prints an `unsafe import` line
 * for each name imported and an `unsafe call` line for each site.
 *
 * The global spelling is refused (NL2456): the six are called only through an
 * import of `nish:unsafe`. An index outside `[0, xs.length)` is undefined
 * behaviour, which is the whole of the trade. There is no flag that turns the
 * checks off: `--unchecked-indexing` and `--wrapping` are gone, and the CLI
 * refuses each with exit 2. `readCString` has no Node form, because its
 * `CPtr` comes only from a `declare function`, which Node cannot call.
 *
 * **Under Node.** `runtime/nish.mjs` answers the import: the get and set are
 * `xs[i]` and `xs[i] = v`, the wrapping three are `(a + b) | 0`,
 * `(a - b) | 0` and `Math.imul` on an `i32` and `BigInt.asIntN(64, …)` on an
 * `i64`. A program that stays in range prints the same as natively.
 *
 * **The no-panic scope.** Under `--deny-panics` or `"nish".noPanic`,
 * `uncheckedGet`, `uncheckedSet` and `readCString` are allowed `unchecked`
 * sites, because the import has already said that an index out of range is
 * the author's to rule out. The wrapping three are not sites at all: they
 * are defined for every pair.
 *
 * Rules: https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#nishunsafe-unchecked-access-and-defined-wrapping
 */
declare module "nish:unsafe" {
  /**
   * `xs[i]` with no bounds check: the same GEP and load, with no `len` load,
   * no compare and no branch to the bounds panic. A call moves no length, so
   * an index proven before it stays proven after; it records no passed check
   * of its own.
   *
   * @param xs An array of numbers: `i32`, `i64`, `u8`, `u16`, `u32`, `u64`,
   *   `f32` or `f64` elements (NL2455 otherwise). A `readonly` array may be
   *   read.
   * @param i The index, an `i32`. Undefined behaviour outside
   *   `[0, xs.length)`.
   * @returns The element at `i`.
   */
  export function uncheckedGet<T extends number>(xs: readonly T[], i: i32): T;
  /**
   * `xs[i] = v` with no bounds check; a statement. It is a write of `xs` for
   * every rule that asks, the parallel-body rule included.
   *
   * @param xs An array of numbers, as `uncheckedGet` takes, and not
   *   `readonly`. An array field handed in is a value and is not stored
   *   inline.
   * @param i The index, an `i32`. Undefined behaviour outside
   *   `[0, xs.length)`.
   * @param v The value to store, of the element type.
   */
  export function uncheckedSet<T extends number>(xs: T[], i: i32, v: T): void;
  /**
   * `a + b` as `add` with no `nsw` and no check: the two's-complement wrap,
   * defined for every pair (`wrappingAdd(2147483647, 1)` is `-2147483648`).
   * In a module constant's initialiser the call folds, wrapping.
   *
   * @param a An `i32` or `i64` (NL2454 otherwise; an unsigned operator
   *   already wraps).
   * @param b The same type as `a` (NL2400 otherwise). A bare literal takes
   *   the other operand's type.
   * @returns The sum, wrapped to the operands' width.
   */
  export function wrappingAdd<T extends i32 | i64>(a: T, b: T): T;
  /**
   * `a - b` as `sub` with no `nsw` and no check, wrapping.
   *
   * @param a An `i32` or `i64`.
   * @param b The same type as `a`.
   * @returns The difference, wrapped to the operands' width.
   */
  export function wrappingSub<T extends i32 | i64>(a: T, b: T): T;
  /**
   * `a * b` as `mul` with no `nsw` and no check, wrapping
   * (`wrappingMul(INT64_MAX, 2)` is `-2`).
   *
   * @param a An `i32` or `i64`.
   * @param b The same type as `a`.
   * @returns The product, wrapped to the operands' width.
   */
  export function wrappingMul<T extends i32 | i64>(a: T, b: T): T;
  /**
   * The `NUL`-terminated bytes at `p`, copied into a new string by
   * `@nish.ffi.str`, the scan-and-copy a `string` result of a
   * `declare function` uses. It reads and allocates, and is native only.
   *
   * @param p A pointer from a `declare function`. Undefined behaviour unless
   *   it points at a live C string.
   * @returns A copy of the bytes before the `NUL`; C keeps its buffer.
   */
  export function readCString(p: CPtr): string;
}

/**
 * Sixteen-byte vectors of one lane type, and the lane-wise operations on them,
 * each lowered to target-independent LLVM vector IR.
 *
 *     import { u32x4, loadI32x4, store, extract, replace, addWrapping, xor, rotl } from "nish:simd";
 *
 *     export const bumpFirst = (xs: i32[], at: i32): i32 => {
 *       const v = loadI32x4(xs, at);
 *       store(replace(v, 0, extract(v, 0) + 1), xs, at);
 *       return extract(v, 3);
 *     };
 *
 *     // One ChaCha20 quarter-round step on four blocks at once: lane k is block k.
 *     export const step = (a: u32x4, b: u32x4, d: u32x4): u32 => {
 *       const a2 = addWrapping(a, b);
 *       return extract(rotl(xor(d, a2), 16), 0);
 *     };
 *
 * A vector is a value: copied by assignment, passed and returned in
 * registers, held in a local, a class field or an array. Every operation is a
 * free function, because TypeScript cannot overload `+`, and the operand
 * types pick the lowering. Nothing names a target: no golden holds
 * `llvm.x86.` or `llvm.aarch64.`, and LLVM picks the instructions.
 *
 * Every name is used only through an import of `nish:simd` (NL2578). A
 * vector has no operators and no comparison: `+`, a truthiness test and
 * printing a whole vector are refused, and `===` and `<` are NL2581; compare
 * with `eq` and the rest and ask the mask `all` or `any`. Every operand of one call is
 * one vector type (NL2623, NL2638). A lane index, a shift count and a
 * shuffle index are integer literals in range (NL2580, NL2583, NL2630 to
 * NL2635). A mask is held only in a local, a parameter or a return of a
 * function the module keeps (NL2622). A vector is not a `Map` key, not
 * `Secret`, not nullable, and does not cross the interop boundary yet.
 *
 * **Layout.** In an object or an array a vector is sixteen bytes aligned to
 * sixteen, as clang lays out `__attribute__((vector_size(16)))`; an array of
 * vectors steps by sixteen. A load or store is aligned to the lane, not to
 * sixteen.
 *
 * **Integer lanes wrap, and the names say so.** `add` is float arithmetic;
 * an integer lane's form is `addWrapping`, because making a lane trap as
 * scalar `+` does would cost the speed the type is for. A `sum` that could
 * overflow is `sumWrapping`.
 *
 * **Under Node.** `runtime/nish.mjs` answers the import with
 * `runtime/core.mjs`, where a vector is a fresh typed array of its lanes,
 * made once and never written after, whose element type does the lane's
 * arithmetic; a mask is an array of booleans, and a rotate is two shifts and
 * an `or`. `tests/run.js`'s `simd` section holds the native, WASI and Node
 * outputs to one.
 *
 * Rules: https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#nishsimd-sixteen-byte-vectors
 * and https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#nishsimd-lane-operations-and-masks
 */
declare module "nish:simd" {
  /**
   * Sixteen bytes as 16 `u8` lanes, an LLVM `<16 x i8>`.
   * Opaque: TypeScript refuses `+` on one, as `nish` does, but lets `===` and
   * `<` through, which `nish` refuses. Under Node it is a typed array made
   * once and never written after.
   */
  export interface u8x16 {
    /** The type's brand, which keeps the six vector types apart. Not a field: it has no value. */
    readonly __nishSimd: "u8x16";
    /** The lane type, `u8`, for signatures to name. Not a field. */
    readonly __lane: u8;
    /** The mask a compare of two `u8x16` answers, `mask8x16`, for signatures to name. Not a field. */
    readonly __mask: mask8x16;
  }
  /**
   * Sixteen bytes as 8 `u16` lanes, an LLVM `<8 x i16>`. Opaque, as `u8x16` is.
   */
  export interface u16x8 {
    /** The type's brand, which keeps the six vector types apart. Not a field: it has no value. */
    readonly __nishSimd: "u16x8";
    /** The lane type, `u16`, for signatures to name. Not a field. */
    readonly __lane: u16;
    /** The mask a compare of two `u16x8` answers, `mask16x8`, for signatures to name. Not a field. */
    readonly __mask: mask16x8;
  }
  /**
   * Sixteen bytes as 4 `i32` lanes, an LLVM `<4 x i32>`. Opaque, as `u8x16` is.
   */
  export interface i32x4 {
    /** The type's brand, which keeps the six vector types apart. Not a field: it has no value. */
    readonly __nishSimd: "i32x4";
    /** The lane type, `i32`, for signatures to name. Not a field. */
    readonly __lane: i32;
    /** The mask a compare of two `i32x4` answers, `mask32x4`, for signatures to name. Not a field. */
    readonly __mask: mask32x4;
  }
  /**
   * Sixteen bytes as 4 `u32` lanes, an LLVM `<4 x i32>`. Opaque, as `u8x16` is.
   */
  export interface u32x4 {
    /** The type's brand, which keeps the six vector types apart. Not a field: it has no value. */
    readonly __nishSimd: "u32x4";
    /** The lane type, `u32`, for signatures to name. Not a field. */
    readonly __lane: u32;
    /** The mask a compare of two `u32x4` answers, `mask32x4`, for signatures to name. Not a field. */
    readonly __mask: mask32x4;
  }
  /**
   * Sixteen bytes as 4 `f32` lanes, an LLVM `<4 x float>`. Opaque, as `u8x16` is.
   */
  export interface f32x4 {
    /** The type's brand, which keeps the six vector types apart. Not a field: it has no value. */
    readonly __nishSimd: "f32x4";
    /** The lane type, `f32`, for signatures to name. Not a field. */
    readonly __lane: f32;
    /** The mask a compare of two `f32x4` answers, `mask32x4`, for signatures to name. Not a field. */
    readonly __mask: mask32x4;
  }
  /**
   * Sixteen bytes as 2 `f64` lanes, an LLVM `<2 x double>`. Opaque, as `u8x16` is.
   */
  export interface f64x2 {
    /** The type's brand, which keeps the six vector types apart. Not a field: it has no value. */
    readonly __nishSimd: "f64x2";
    /** The lane type, `f64`, for signatures to name. Not a field. */
    readonly __lane: f64;
    /** The mask a compare of two `f64x2` answers, `mask64x2`, for signatures to name. Not a field. */
    readonly __mask: mask64x2;
  }
  /** Any of the six vector types. */
  export type SimdVector = u8x16 | u16x8 | i32x4 | u32x4 | f32x4 | f64x2;
  /** The four with integer lanes. */
  export type IntegerVector = u8x16 | u16x8 | i32x4 | u32x4;
  /** The two with float lanes. */
  export type FloatVector = f32x4 | f64x2;
  /**
   * One boolean per lane of 16, an LLVM `<16 x i1>`, which a lane-wise
   * compare of `u8x16` answers.
   * Under Node an array of booleans. `nish` keeps a mask in a local, a
   * parameter or a return of a function the module keeps, and nowhere else;
   * it has no constructor.
   */
  export interface mask8x16 {
    /** The type's brand, which keeps the four mask types apart. Not a field. */
    readonly __nishMask: "mask8x16";
  }
  /**
   * One boolean per lane of 8, an LLVM `<8 x i1>`, which a lane-wise
   * compare of `u16x8` answers. Held and made as `mask8x16` is.
   */
  export interface mask16x8 {
    /** The type's brand, which keeps the four mask types apart. Not a field. */
    readonly __nishMask: "mask16x8";
  }
  /**
   * One boolean per lane of 4, an LLVM `<4 x i1>`, which a lane-wise
   * compare of `i32x4`, `u32x4` and `f32x4` answers. Held and made as `mask8x16` is.
   */
  export interface mask32x4 {
    /** The type's brand, which keeps the four mask types apart. Not a field. */
    readonly __nishMask: "mask32x4";
  }
  /**
   * One boolean per lane of 2, an LLVM `<2 x i1>`, which a lane-wise
   * compare of `f64x2` answers. Held and made as `mask8x16` is.
   */
  export interface mask64x2 {
    /** The type's brand, which keeps the four mask types apart. Not a field. */
    readonly __nishMask: "mask64x2";
  }
  /** Any of the four mask types. */
  export type SimdMask = mask8x16 | mask16x8 | mask32x4 | mask64x2;
  /**
   * A `u8x16` of sixteen lanes: one `insertelement` per lane, which `opt`
   * folds to a constant vector when every lane is one.
   *
   * @param a0 Lane 0, a `u8`; `a1` to `a15` are lanes 1 to 15 in order.
   * @returns The vector.
   */
  export function u8x16(
    a0: u8, a1: u8, a2: u8, a3: u8, a4: u8, a5: u8, a6: u8, a7: u8,
    a8: u8, a9: u8, a10: u8, a11: u8, a12: u8, a13: u8, a14: u8, a15: u8
  ): u8x16;
  /**
   * A `u16x8` of 8 lanes, one argument per lane, lane 0 first.
   *
   * @param a0 Lane 0, a `u16`; `a1` to `a7` are lanes 1 to 7 in order.
   * @returns The vector.
   */
  export function u16x8(a0: u16, a1: u16, a2: u16, a3: u16, a4: u16, a5: u16, a6: u16, a7: u16): u16x8;
  /**
   * An `i32x4` of 4 lanes, one argument per lane, lane 0 first.
   *
   * @param a0 Lane 0, an `i32`; `a1` to `a3` are lanes 1 to 3 in order.
   * @returns The vector.
   */
  export function i32x4(a0: i32, a1: i32, a2: i32, a3: i32): i32x4;
  /**
   * A `u32x4` of 4 lanes, one argument per lane, lane 0 first.
   *
   * @param a0 Lane 0, a `u32`; `a1` to `a3` are lanes 1 to 3 in order.
   * @returns The vector.
   */
  export function u32x4(a0: u32, a1: u32, a2: u32, a3: u32): u32x4;
  /**
   * An `f32x4` of 4 lanes, one argument per lane, lane 0 first.
   *
   * @param a0 Lane 0, an `f32`; `a1` to `a3` are lanes 1 to 3 in order.
   * @returns The vector.
   */
  export function f32x4(a0: f32, a1: f32, a2: f32, a3: f32): f32x4;
  /**
   * An `f64x2` of 2 lanes, one argument per lane, lane 0 first.
   *
   * @param a0 Lane 0, an `f64`; `a1` is lane 1.
   * @returns The vector.
   */
  export function f64x2(a0: f64, a1: f64): f64x2;
  /**
   * `x` in all 16 lanes: one `insertelement` and a `shufflevector` with a
   * `zeroinitializer` mask.
   *
   * @param x The lane value, a `u8`.
   * @returns The vector.
   */
  export function splatU8x16(x: u8): u8x16;
  /**
   * `x` in all 8 lanes: one `insertelement` and a `shufflevector` with a
   * `zeroinitializer` mask.
   *
   * @param x The lane value, a `u16`.
   * @returns The vector.
   */
  export function splatU16x8(x: u16): u16x8;
  /**
   * `x` in all 4 lanes: one `insertelement` and a `shufflevector` with a
   * `zeroinitializer` mask.
   *
   * @param x The lane value, an `i32`.
   * @returns The vector.
   */
  export function splatI32x4(x: i32): i32x4;
  /**
   * `x` in all 4 lanes: one `insertelement` and a `shufflevector` with a
   * `zeroinitializer` mask.
   *
   * @param x The lane value, a `u32`.
   * @returns The vector.
   */
  export function splatU32x4(x: u32): u32x4;
  /**
   * `x` in all 4 lanes: one `insertelement` and a `shufflevector` with a
   * `zeroinitializer` mask.
   *
   * @param x The lane value, an `f32`.
   * @returns The vector.
   */
  export function splatF32x4(x: f32): f32x4;
  /**
   * `x` in all 2 lanes: one `insertelement` and a `shufflevector` with a
   * `zeroinitializer` mask.
   *
   * @param x The lane value, an `f64`.
   * @returns The vector.
   */
  export function splatF64x2(x: f64): f64x2;
  /**
   * `xs[i]` to `xs[i + 15]` as one `u8x16`, bounds-checked once for the whole
   * vector: a load whose last lane is past the end panics before it reads,
   * naming a lane past the end (the first when it is out of range, else the
   * last) and the length, as `xs[i]` does.
   *
   * @param xs A `u8[]`, exactly the lane type (NL2579 otherwise); a
   *   `readonly` array may be loaded from.
   * @param i The index of lane 0, an `i32`.
   * @returns The vector.
   */
  export function loadU8x16(xs: readonly u8[], i: i32): u8x16;
  /**
   * `xs[i]` to `xs[i + 7]` as one `u16x8`, bounds-checked once for the whole
   * vector: a load whose last lane is past the end panics before it reads,
   * naming a lane past the end (the first when it is out of range, else the
   * last) and the length, as `xs[i]` does.
   *
   * @param xs A `u16[]`, exactly the lane type (NL2579 otherwise); a
   *   `readonly` array may be loaded from.
   * @param i The index of lane 0, an `i32`.
   * @returns The vector.
   */
  export function loadU16x8(xs: readonly u16[], i: i32): u16x8;
  /**
   * `xs[i]` to `xs[i + 3]` as one `i32x4`, bounds-checked once for the whole
   * vector: a load whose last lane is past the end panics before it reads,
   * naming a lane past the end (the first when it is out of range, else the
   * last) and the length, as `xs[i]` does.
   *
   * @param xs An `i32[]`, exactly the lane type (NL2579 otherwise); a
   *   `readonly` array may be loaded from.
   * @param i The index of lane 0, an `i32`.
   * @returns The vector.
   */
  export function loadI32x4(xs: readonly i32[], i: i32): i32x4;
  /**
   * `xs[i]` to `xs[i + 3]` as one `u32x4`, bounds-checked once for the whole
   * vector: a load whose last lane is past the end panics before it reads,
   * naming a lane past the end (the first when it is out of range, else the
   * last) and the length, as `xs[i]` does.
   *
   * @param xs A `u32[]`, exactly the lane type (NL2579 otherwise); a
   *   `readonly` array may be loaded from.
   * @param i The index of lane 0, an `i32`.
   * @returns The vector.
   */
  export function loadU32x4(xs: readonly u32[], i: i32): u32x4;
  /**
   * `xs[i]` to `xs[i + 3]` as one `f32x4`, bounds-checked once for the whole
   * vector: a load whose last lane is past the end panics before it reads,
   * naming a lane past the end (the first when it is out of range, else the
   * last) and the length, as `xs[i]` does.
   *
   * @param xs An `f32[]`, exactly the lane type (NL2579 otherwise); a
   *   `readonly` array may be loaded from.
   * @param i The index of lane 0, an `i32`.
   * @returns The vector.
   */
  export function loadF32x4(xs: readonly f32[], i: i32): f32x4;
  /**
   * `xs[i]` to `xs[i + 1]` as one `f64x2`, bounds-checked once for the whole
   * vector: a load whose last lane is past the end panics before it reads,
   * naming a lane past the end (the first when it is out of range, else the
   * last) and the length, as `xs[i]` does.
   *
   * @param xs An `f64[]`, exactly the lane type (NL2579 otherwise); a
   *   `readonly` array may be loaded from.
   * @param i The index of lane 0, an `i32`.
   * @returns The vector.
   */
  export function loadF64x2(xs: readonly f64[], i: i32): f64x2;
  /**
   * The lanes of `v` into `xs[i]` to `xs[i + N - 1]`, `N` the lane count,
   * under the same single check as a load, then one `store`; a statement.
   *
   * @param v The vector.
   * @param xs An array of exactly `v`'s lane type, not `readonly`.
   * @param i The index lane 0 goes to, an `i32`.
   */
  export function store<V extends SimdVector>(v: V, xs: V["__lane"][], i: i32): void;
  /**
   * Lane `k` of `v`, one `extractelement` at a constant.
   *
   * @param v The vector (NL2582 when it is not one).
   * @param k An integer literal from 0 to one less than the lane count
   *   (NL2580 for a variable, NL2583 for a literal past the end).
   * @returns The lane, of the lane type.
   */
  export function extract<V extends SimdVector>(v: V, k: i32): V["__lane"];
  /**
   * A new vector: `v` with lane `k` set to `x`, one `insertelement` at a
   * constant. `v` is unchanged; under Node `replace` copies.
   *
   * @param v The vector.
   * @param k An integer literal lane index in range, as `extract` takes.
   * @param x The new lane, of the lane type.
   * @returns The new vector.
   */
  export function replace<V extends SimdVector>(v: V, k: i32, x: V["__lane"]): V;
  /**
   * The lane-wise sum of two float vectors, `fadd` with no fast-math flags. An integer vector is refused (NL2623): its form is `addWrapping`.
   *
   * @param a An `f32x4` or `f64x2`.
   * @param b A vector of `a`'s type.
   * @returns Each lane's sum.
   */
  export function add<V extends FloatVector>(a: V, b: V): V;
  /**
   * The lane-wise difference of two float vectors, `fsub` with no fast-math flags. An integer vector is refused (NL2623): its form is `subWrapping`.
   *
   * @param a An `f32x4` or `f64x2`.
   * @param b A vector of `a`'s type.
   * @returns Each lane's difference.
   */
  export function sub<V extends FloatVector>(a: V, b: V): V;
  /**
   * The lane-wise product of two float vectors, `fmul` with no fast-math flags. An integer vector is refused (NL2623): its form is `mulWrapping`.
   *
   * @param a An `f32x4` or `f64x2`.
   * @param b A vector of `a`'s type.
   * @returns Each lane's product.
   */
  export function mul<V extends FloatVector>(a: V, b: V): V;
  /**
   * The lane-wise quotient of two float vectors, `fdiv` with no fast-math flags. An integer vector is refused (NL2623).
   *
   * @param a An `f32x4` or `f64x2`.
   * @param b A vector of `a`'s type.
   * @returns Each lane's quotient.
   */
  export function div<V extends FloatVector>(a: V, b: V): V;
  /**
   * The square root of each float lane, `llvm.sqrt`.
   *
   * @param a An `f32x4` or `f64x2`.
   * @returns Each lane's square root.
   */
  export function sqrt<V extends FloatVector>(a: V): V;
  /**
   * The lane-wise sum of two integer vectors, `add` with no `nsw` or
   * `nuw`: each lane wraps at the lane width.
   *
   * @param a A `u8x16`, `u16x8`, `i32x4` or `u32x4`.
   * @param b A vector of `a`'s type.
   * @returns Each lane's sum, wrapped.
   */
  export function addWrapping<V extends IntegerVector>(a: V, b: V): V;
  /**
   * The lane-wise difference of two integer vectors, `sub` with no `nsw` or
   * `nuw`: each lane wraps at the lane width.
   *
   * @param a A `u8x16`, `u16x8`, `i32x4` or `u32x4`.
   * @param b A vector of `a`'s type.
   * @returns Each lane's difference, wrapped.
   */
  export function subWrapping<V extends IntegerVector>(a: V, b: V): V;
  /**
   * The lane-wise product of two integer vectors, `mul` with no `nsw` or
   * `nuw`: each lane wraps at the lane width.
   *
   * @param a A `u8x16`, `u16x8`, `i32x4` or `u32x4`.
   * @param b A vector of `a`'s type.
   * @returns Each lane's product, wrapped.
   */
  export function mulWrapping<V extends IntegerVector>(a: V, b: V): V;
  /**
   * Each float lane negated, `fneg`: the sign bit flipped.
   *
   * @param a An `f32x4` or `f64x2`.
   * @returns The negated vector.
   */
  export function neg<V extends FloatVector>(a: V): V;
  /**
   * Each float lane's absolute value, `llvm.fabs`: the sign bit cleared.
   *
   * @param a An `f32x4` or `f64x2`.
   * @returns The vector of absolute values.
   */
  export function abs<V extends FloatVector>(a: V): V;
  /**
   * The lesser of each pair of lanes: `llvm.umin` or `llvm.smin` on integer
   * lanes, `llvm.minimum` on float lanes, where a NaN lane answers NaN and -0
   * is below +0, as `Math.min`.
   *
   * @param a Any vector.
   * @param b A vector of `a`'s type (NL2623 otherwise).
   * @returns Each lane's lesser.
   */
  export function min<V extends SimdVector>(a: V, b: V): V;
  /**
   * The greater of each pair of lanes: `llvm.umax` or `llvm.smax` on integer
   * lanes, `llvm.maximum` on float lanes, where a NaN lane answers NaN and -0
   * is below +0, as `Math.max`.
   *
   * @param a Any vector.
   * @param b A vector of `a`'s type (NL2623 otherwise).
   * @returns Each lane's greater.
   */
  export function max<V extends SimdVector>(a: V, b: V): V;
  /**
   * Bitwise `and`, on integer lanes or lane by lane on two masks.
   *
   * @param a An integer vector or a mask.
   * @param b A vector or mask of `a`'s type.
   * @returns The bitwise `and`, of `a`'s type.
   */
  export function and<V extends IntegerVector | SimdMask>(a: V, b: V): V;
  /**
   * Bitwise `or`, on integer lanes or lane by lane on two masks.
   *
   * @param a An integer vector or a mask.
   * @param b A vector or mask of `a`'s type.
   * @returns The bitwise `or`, of `a`'s type.
   */
  export function or<V extends IntegerVector | SimdMask>(a: V, b: V): V;
  /**
   * Bitwise `xor`, on integer lanes or lane by lane on two masks.
   *
   * @param a An integer vector or a mask.
   * @param b A vector or mask of `a`'s type.
   * @returns The bitwise `xor`, of `a`'s type.
   */
  export function xor<V extends IntegerVector | SimdMask>(a: V, b: V): V;
  /**
   * Every bit flipped, `xor` with all-ones, on integer lanes or a mask.
   *
   * @param a An integer vector or a mask.
   * @returns The complement, of `a`'s type.
   */
  export function not<V extends IntegerVector | SimdMask>(a: V): V;
  /**
   * Whether each lane of `a` is equal the lane of `b`: `icmp`, unsigned on a
   * `u*` lane, or on float lanes `fcmp oeq`.
   *
   * @param a Any vector (NL2638 for a scalar).
   * @param b A vector of `a`'s type.
   * @returns The mask of the lane width: `mask8x16`, `mask16x8`, `mask32x4`
   *   or `mask64x2`.
   */
  export function eq<V extends SimdVector>(a: V, b: V): V["__mask"];
  /**
   * Whether each lane of `a` is not equal the lane of `b`: `icmp`, unsigned on a
   * `u*` lane, or on float lanes `fcmp une`, unordered, so a NaN lane is not equal.
   *
   * @param a Any vector (NL2638 for a scalar).
   * @param b A vector of `a`'s type.
   * @returns The mask of the lane width: `mask8x16`, `mask16x8`, `mask32x4`
   *   or `mask64x2`.
   */
  export function ne<V extends SimdVector>(a: V, b: V): V["__mask"];
  /**
   * Whether each lane of `a` is less than the lane of `b`: `icmp`, unsigned on a
   * `u*` lane, or on float lanes ordered `fcmp`.
   *
   * @param a Any vector (NL2638 for a scalar).
   * @param b A vector of `a`'s type.
   * @returns The mask of the lane width: `mask8x16`, `mask16x8`, `mask32x4`
   *   or `mask64x2`.
   */
  export function lt<V extends SimdVector>(a: V, b: V): V["__mask"];
  /**
   * Whether each lane of `a` is at most the lane of `b`: `icmp`, unsigned on a
   * `u*` lane, or on float lanes ordered `fcmp`.
   *
   * @param a Any vector (NL2638 for a scalar).
   * @param b A vector of `a`'s type.
   * @returns The mask of the lane width: `mask8x16`, `mask16x8`, `mask32x4`
   *   or `mask64x2`.
   */
  export function le<V extends SimdVector>(a: V, b: V): V["__mask"];
  /**
   * Whether each lane of `a` is greater than the lane of `b`: `icmp`, unsigned on a
   * `u*` lane, or on float lanes ordered `fcmp`.
   *
   * @param a Any vector (NL2638 for a scalar).
   * @param b A vector of `a`'s type.
   * @returns The mask of the lane width: `mask8x16`, `mask16x8`, `mask32x4`
   *   or `mask64x2`.
   */
  export function gt<V extends SimdVector>(a: V, b: V): V["__mask"];
  /**
   * Whether each lane of `a` is at least the lane of `b`: `icmp`, unsigned on a
   * `u*` lane, or on float lanes ordered `fcmp`.
   *
   * @param a Any vector (NL2638 for a scalar).
   * @param b A vector of `a`'s type.
   * @returns The mask of the lane width: `mask8x16`, `mask16x8`, `mask32x4`
   *   or `mask64x2`.
   */
  export function ge<V extends SimdVector>(a: V, b: V): V["__mask"];
  /**
   * Lane `k` of `a` where lane `k` of `m` is set, else lane `k` of `b`, one
   * `select`.
   *
   * @param m The mask of `a`'s lane width, the one a compare of two such
   *   vectors answers (NL2629 otherwise).
   * @param a The vector lanes come from where `m` is set.
   * @param b A vector of `a`'s type, for the lanes where `m` is clear.
   * @returns The blended vector.
   */
  export function select<V extends SimdVector>(m: V["__mask"], a: V, b: V): V;
  /**
   * Whether any lane of `m` is set, `llvm.vector.reduce.or`.
   *
   * @param m A mask.
   * @returns `true` when one lane or more is set.
   */
  export function any(m: SimdMask): boolean;
  /**
   * Whether every lane of `m` is set, `llvm.vector.reduce.and`.
   *
   * @param m A mask.
   * @returns `true` when no lane is clear.
   */
  export function all(m: SimdMask): boolean;
  /**
   * The mask as bits: a `bitcast` of `<N x i1>` to `iN`, zero-extended.
   * Storable where the mask is not.
   *
   * @param m A mask.
   * @returns An `i32` with bit `k` set when lane `k` is.
   */
  export function bitmask(m: SimdMask): i32;
  /**
   * The lanes of a `u8x16` or `u16x8` added in an `i32`, `zext` then
   * `llvm.vector.reduce.add`: exact, since it cannot overflow. An `i32x4` or
   * `u32x4` can, and is refused (NL2636): its total is `sumWrapping`.
   *
   * @param v A `u8x16` or `u16x8`.
   * @returns The exact total.
   */
  export function sum(v: u8x16 | u16x8): i32;
  /**
   * The lanes of an `f32x4` added from lane 0 to lane 3,
   * `llvm.vector.reduce.fadd` without `reassoc`, so the bits are the same on
   * every target.
   *
   * @param v An `f32x4`.
   * @returns The total, an `f32`.
   */
  export function sum(v: f32x4): f32;
  /**
   * The lanes of an `f64x2` added, lane 0 first, likewise in order.
   *
   * @param v An `f64x2`.
   * @returns The total, an `f64`.
   */
  export function sum(v: f64x2): f64;
  /**
   * The lanes of an `i32x4` added, `llvm.vector.reduce.add`, wrapping as the
   * lanes do.
   *
   * @param v An `i32x4`.
   * @returns The wrapped total, an `i32`.
   */
  export function sumWrapping(v: i32x4): i32;
  /**
   * The lanes of a `u32x4` added, wrapping.
   *
   * @param v A `u32x4`.
   * @returns The wrapped total, a `u32`.
   */
  export function sumWrapping(v: u32x4): u32;
  /**
   * Lanes picked from `a` then `b`, one `shufflevector`.
   *
   * @param a The vector whose lanes are indices 0 to N-1.
   * @param b A vector of `a`'s type, whose lanes are indices N to 2N-1.
   * @param lanes One integer literal per lane of the answer, each from 0 to
   *   2N-1; a wrong count, a variable or an index past the end is refused
   *   (NL2632 to NL2635).
   * @returns The vector of the picked lanes, lane 0 first.
   */
  export function shuffle<V extends SimdVector>(a: V, b: V, ...lanes: i32[]): V;
  /**
   * Each lane shifted left by `count`, `shl`.
   *
   * @param v A `u8x16`, `u16x8`, `i32x4` or `u32x4`.
   * @param count An integer literal below the lane width: 0 to 7, 15 or 31
   *   (NL2630 for a variable, NL2631 for the width or more).
   * @returns The vector of shifted lanes.
   */
  export function shl<V extends IntegerVector>(v: V, count: i32): V;
  /**
   * Each lane shifted right by `count`: `lshr`, logical, on `u8x16`, `u16x8`
   * and `u32x4`, and `ashr`, copying the sign, on `i32x4`.
   *
   * @param v A `u8x16`, `u16x8`, `i32x4` or `u32x4`.
   * @param count An integer literal below the lane width: 0 to 7, 15 or 31
   *   (NL2630 for a variable, NL2631 for the width or more).
   * @returns The vector of shifted lanes.
   */
  export function shr<V extends IntegerVector>(v: V, count: i32): V;
  /**
   * Each lane rotated left by `count`, `llvm.fshl` with `v` as both halves.
   *
   * @param v A `u8x16`, `u16x8`, `i32x4` or `u32x4`.
   * @param count An integer literal below the lane width: 0 to 7, 15 or 31
   *   (NL2630 for a variable, NL2631 for the width or more).
   * @returns The vector of rotated lanes.
   */
  export function rotl<V extends IntegerVector>(v: V, count: i32): V;
  /**
   * Each lane rotated right by `count`, `llvm.fshr` with `v` as both halves.
   *
   * @param v A `u8x16`, `u16x8`, `i32x4` or `u32x4`.
   * @param count An integer literal below the lane width: 0 to 7, 15 or 31
   *   (NL2630 for a variable, NL2631 for the width or more).
   * @returns The vector of rotated lanes.
   */
  export function rotr<V extends IntegerVector>(v: V, count: i32): V;
  /**
   * The same sixteen bytes read as a `u8x16`, one `bitcast`.
   *
   * @param v Any vector.
   * @returns The bytes as 16 `u8` lanes.
   */
  export function asU8x16(v: SimdVector): u8x16;
  /**
   * The same sixteen bytes read as a `u16x8`, one `bitcast`.
   *
   * @param v Any vector.
   * @returns The bytes as 8 `u16` lanes.
   */
  export function asU16x8(v: SimdVector): u16x8;
  /**
   * The same sixteen bytes read as an `i32x4`, one `bitcast`.
   *
   * @param v Any vector.
   * @returns The bytes as 4 `i32` lanes.
   */
  export function asI32x4(v: SimdVector): i32x4;
  /**
   * The same sixteen bytes read as a `u32x4`, one `bitcast`.
   *
   * @param v Any vector.
   * @returns The bytes as 4 `u32` lanes.
   */
  export function asU32x4(v: SimdVector): u32x4;
  /**
   * The same sixteen bytes read as an `f32x4`, one `bitcast`.
   *
   * @param v Any vector.
   * @returns The bytes as 4 `f32` lanes.
   */
  export function asF32x4(v: SimdVector): f32x4;
  /**
   * The same sixteen bytes read as an `f64x2`, one `bitcast`.
   *
   * @param v Any vector.
   * @returns The bytes as 2 `f64` lanes.
   */
  export function asF64x2(v: SimdVector): f64x2;
}

/**
 * Text and bytes to stdout and stderr with nothing added, and the panic that
 * ends a program on an unmet invariant.
 *
 *     import { write, writeError, writeBytes, panic } from "nish:io";
 *
 *     write("progress: ");
 *     write("done\n");
 *     const bytes: u8[] = [0x89, 0x50, 0x4e, 0x47];
 *     if (writeBytes(bytes, 0, bytes.length) < 0) {
 *       panic("stdout refused the bytes");
 *     }
 *
 * Each export is the global of the same name, renamed: the call checks through
 * the same rule and emits the same IR as the global spelling, and an imported
 * name cannot be shadowed by a user function. None needs a capability; each
 * has the `write` effect.
 *
 * A `wasm32` build has no stdout to reach and refuses `writeBytes`. A
 * `writeBytes` range outside `bytes` panics, as `dst.set` does, rather than
 * answering an error.
 *
 * **Bytes out, and the string route.** A native string is `{len, bytes}`,
 * never validated as UTF-8, and `write` and `writeError` send its `len` bytes
 * as they are. That route is native only: under the prelude a byte above 127
 * that `String.fromBytes` made becomes two. `writeBytes` sends a `u8[]` as it
 * is on every host, and is the route for bytes that are not text.
 *
 * Rules: https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#builtin-modules-nish
 * and https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#console
 */
declare module "nish:io" {
  /**
   * `s` to stdout with no trailing newline and no conversion; a statement.
   *
   * @param s The text, a `string` only, sent as its bytes.
   */
  export function write(s: string): void;
  /**
   * `s` to stderr with no trailing newline and no conversion; a statement.
   *
   * @param s The text, a `string` only, sent as its bytes.
   */
  export function writeError(s: string): void;
  /**
   * `bytes[off .. off + len)` to stdout, every byte as it is: the one way to
   * send bytes that are not text, a byte of `0x80` or above or a zero byte
   * included. A loop of `write(2)` sends them all, retried on an interrupted
   * call. A pipe whose reader has gone raises SIGPIPE natively, as it does for
   * `write`, where Node answers `-32` (EPIPE). The shape is `netWrite`'s with
   * the descriptor fixed at 1; under Node the bytes go to `fs.writeSync(1, …)`.
   *
   * @param bytes The bytes, a `u8[]` (NL2268 otherwise), `readonly` or not.
   * @param off The first byte to send. The range is checked once after the
   *   arguments are evaluated: `0 <= off`, `0 <= len` and
   *   `off + len <= bytes.length`, else it panics with
   *   `slice out of range: [off, off+len) of length n` and exits 1 (a `slice`
   *   site).
   * @param len How many bytes to send.
   * @returns `len`, or a negative errno when the stream refuses them (`-9`,
   *   EBADF, on a closed descriptor); never a panic for a refused write.
   */
  export function writeBytes(bytes: readonly u8[], off: i32, len: i32): i32;
  /**
   * `message` and a newline to stderr, then exit 1: the same ending an
   * out-of-range index has. A statement and a terminator, as `process.exit`
   * is, so a non-`void` function may end with it; `never` is how `tsc` spells
   * that. It is how a program ends on an unmet invariant, since there is no
   * `throw`.
   *
   * @param message The text written before the program exits.
   * @returns Never: the program has ended.
   */
  export function panic(message: string): never;
}

/**
 * Terminal input for a full-screen program: read a key the moment it is
 * pressed, wait for one with a timeout that doubles as a frame clock, and ask
 * the terminal whether it is one, how big it is, and to stop echoing.
 *
 *     import { readStdin, setRawMode, waitStdin } from "nish:term";
 *
 *     export const main = (): number => {
 *       setRawMode(true);
 *       const keys: u8[] = new Array<u8>(16);
 *       let running = true;
 *       while (running) {
 *         if (waitStdin(16)) {
 *           const n = readStdin(keys, 0, keys.length);
 *           if (n === 0 || (n < 0 && n !== -11)) {
 *             running = false; // stdin ended, or reading it failed
 *           }
 *           for (let i = 0; i < n && i < keys.length; i++) {
 *             if (keys[i] === 113) {
 *               running = false; // q
 *             }
 *           }
 *         }
 *         // advance and draw one frame
 *       }
 *       setRawMode(false);
 *       return 0;
 *     };
 *
 * Each export is the global of the same name, renamed. The six carry the
 * `tty` capability, not `net`, and are C in `runtime/runtime-term.c`, which
 * section GC leaves out of a program that calls none of them. Errors are
 * numbers in `nish:net`'s shape: `>= 0` is success and a negative number the
 * errno, negated; `-11` (nothing is waiting) and `-25` (not a terminal) are
 * the same on every platform. stdin is never made non-blocking, because
 * `O_NONBLOCK` would be shared with the shell.
 *
 * Linux and Darwin only, and WASI with differences: there `readStdin` waits
 * for its bytes (call `waitStdin` first), a `waitStdin` waits at least 10 ms,
 * and there is no terminal. A freestanding `--target wasm32` build refuses all
 * six. Under Node `readStdin`, `waitStdin`, `setRawMode` and
 * `setTerminalRestore` throw, each naming itself; in a browser so do they, and
 * there `isTerminal` answers `false` and `terminalSize` `[-25, 0]`.
 *
 * **Raw mode.** It is `cfmakeraw`'s input side without its output side: echo,
 * line editing, CR-to-NL, flow control and parity stripping are off, and a key
 * arrives as its bytes (an arrow as `ESC [ A`). `ISIG` stays on, so Ctrl-C is
 * still SIGINT; `OPOST` stays on, so `"\n"` needs no `"\r"`.
 *
 * **The terminal is always put back**: on `setRawMode(false)`, when `main`
 * returns or `process.exit` is called, on every panic, and on every signal
 * whose default action ends the program, SIGKILL aside. Ctrl-Z restores it
 * while the program is stopped and enters raw mode again on `fg`.
 *
 * Rules: https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#nishterm-terminal-input
 */
declare module "nish:term" {
  /**
   * Up to `len` bytes of stdin into `buf`, without waiting: it asks `select`
   * with a zero timeout before it reads. Under `--profile wasi` it waits for
   * its bytes instead.
   *
   * @param buf A writable `u8[]`.
   * @param off Where the first byte goes. The range `[off, off + len)` is
   *   checked as `netRead`'s is.
   * @param len The most bytes to read. A `len` of `0` answers `0`, so ask for
   *   at least one.
   * @returns The count, `0` at the end of the stream, `-11` when nothing is
   *   waiting, or another negative errno.
   */
  export function readStdin(buf: u8[], off: i32, len: i32): i32;
  /**
   * Wait until stdin is readable or the time passes. Readable includes its end
   * and an error, so the read after it answers at once, with `0` or a negative
   * errno that is not `-11`. A Ctrl-Z and `fg` after `setRawMode(true)` does
   * not end the wait early: it goes on for what is left of the timeout. Before
   * raw mode Linux goes on and Darwin ends the wait. Not `willreturn`.
   *
   * @param timeoutMs The most milliseconds to wait; negative waits for ever.
   *   Under WASI a wait is at least 10 ms.
   * @returns `true` when stdin is readable, `false` when the time ran out
   *   first or a signal ended the wait.
   */
  export function waitStdin(timeoutMs: i32): boolean;
  /**
   * Whether a descriptor is a terminal, `isatty`; under Node `tty.isatty`.
   *
   * @param fd The descriptor, `0` for stdin, `1` stdout, `2` stderr.
   * @returns `true` for a terminal; `false` for a pipe, a file, and always
   *   under WASI.
   */
  export function isTerminal(fd: i32): boolean;
  /**
   * The size of the terminal on stdout, or on stderr when stdout is not one,
   * read fresh on each call: read it again each frame to follow a resize.
   * Under Node, its `columns` and `rows`.
   *
   * @returns A new `[columns, rows]`; `[-errno, 0]` when neither stream is a
   *   terminal, `[-25, 0]` for "not a terminal", and `[0, 0]` for a terminal no
   *   one set a size for.
   */
  export function terminalSize(): i32[];
  /**
   * Put stdin's terminal in raw mode, or back as it was. Each switch into raw
   * mode saves the termios that was there; asking for the mode it is already
   * in changes nothing, so `setRawMode(false)` is always safe. The terminal is
   * restored at exit, on a panic and on every signal that ends the program,
   * SIGKILL aside. A program started in the background is stopped by SIGTTOU
   * here until `fg`.
   *
   * @param on `true` for raw mode, `false` for the mode it had.
   * @returns `0`, `-25` when stdin is not a terminal (and `0` for `false`
   *   there), or the host's `-errno` when the terminal refuses.
   */
  export function setRawMode(on: boolean): i32;
  /**
   * Keep a copy of `bytes` for the runtime to write to the terminal on stdout
   * as the program ends, before termios is restored: the escapes that leave an
   * alternate screen, show the cursor or turn mouse reporting off. They go out
   * once, with `write` alone, when `main` returns or `process.exit` is called,
   * on every panic and on every signal whose default ends the program, raw
   * mode or not; Ctrl-Z and `setRawMode(false)` write nothing. Set them again
   * with each change, last the set that undoes them all.
   *
   * @param bytes The bytes to keep, replacing what was kept before; `""`
   *   keeps nothing.
   * @returns `0`; `-25` when stdout is not a terminal and `-7` (E2BIG) past
   *   `NISH_TERM_RESTORE_MAX`, 4096 bytes, both keeping what was there.
   */
  export function setTerminalRestore(bytes: string): i32;
}

// `nish:secret` has source behind it, `std/secret.ts`, but a program imports it
// by this name, so `tsc` reads these declarations rather than that file. The
// class is declared with a private constructor and a private field: `tsc` then
// refuses `new Secret(...)`, `s.value` and a structural look-alike, as `nish`
// does. Everything else `nish` refuses about a `Secret` — printing it,
// comparing it, branching on it, dropping it unwiped, an `expose` whose
// function does I/O — is flow, which `tsc` cannot see
// (docs/LANGUAGE.md -> Secrets).
/**
 * Key material as an opaque value that the checker keeps from leaving the
 * program by any road but one, and that is zeroed, with a store no optimiser
 * may remove, before the function that made it lets go of it.
 *
 *     import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
 *     import { hmacSha256 } from "nish/crypto/hmac";
 *
 *     const tag = (key: u8[], message: u8[]): u8[] => hmacSha256(key, message);
 *
 *     export const main = (): i32 => {
 *       const key: Secret<u8[]> = secret(readKey()); // moved in; `readKey()` is fresh
 *       const mac: u8[] = exposeWith(key, message(), tag); // the one way in, and what leaves
 *       wipe(key); // a volatile llvm.memset
 *       console.log(mac.length);
 *       return 0;
 *     };
 *
 * The one builtin module with source behind it, `std/secret.ts`, imported
 * only by this name (`nish/secret` is NL2453) and copied into each module that
 * uses it, so it writes no `.ll` of its own. A `Secret` local needs no
 * annotation: `const k = secret(v)` is `Secret<T>` for the `T` that `v` is,
 * under every rule. Under Node (`runtime/nish.mjs`) a `Secret` is a plain
 * wrapper and `wipe` zero-fills it.
 *
 * A `Secret` may not reach a template hole (NL2431), a builtin's argument
 * (NL2432), `===` against anything but a `Secret` or `null` (NL2433), a
 * condition (NL2434), an index (NL2435), a member access outside
 * `std/secret.ts` (NL2436), `new` (NL2437), or an array element, a `Result`
 * payload or a type argument (NL2429); it lives in a local, a parameter or a
 * holder's `readonly` field. The function that made one returns it or wipes
 * it on every path (NL2439 to NL2443), and a copy is refused (NL2444, NL2446).
 * A `Secret` parameter is borrowed: the callee neither returns it (NL2546)
 * nor wipes it (NL2548).
 *
 * **What a `Secret` may hold.** One run of integers, so that `wipe` reaches
 * every byte with one store: an array of integers (`u8[]`, `u32[]`, `i64[]`,
 * ...) or a class or interface whose every field is an integer.
 * `Secret<string>` is not key material (NL2428).
 *
 * **The wipe.** One `llvm.memset` with its volatile flag set, over an array's
 * whole capacity, since a `pop` leaves the old element in the buffer, or a
 * record's `sizeof`. LLVM never removes, merges or narrows a volatile memory
 * intrinsic, so the store survives every optimisation, inlining included. It
 * does not reach a buffer a `push` outgrew, which is no longer the array's,
 * or a string. `secureZero` is the global for a bare `u8[]` that never was a
 * `Secret`.
 *
 * Rules: https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#secrets-nishsecret
 * and https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#a-secret-field
 */
declare module "nish:secret" {
  /**
   * Key material: an array of integers or a record of integer fields, held
   * opaque. Made by `secret`, read only through `expose`, and wiped or
   * returned by the function that made it.
   */
  export class Secret<T> {
    /**
     * Private, so that `tsc` refuses `new Secret(...)` as `nish` does
     * (NL2437): a `Secret` is made only by `secret`.
     */
    private constructor();
    /**
     * The wrapped value. Private, so that `tsc` refuses `s.value` and a
     * structural look-alike; `nish` refuses a member read outside
     * `std/secret.ts` (NL2436). Reach it through `expose` or `exposeWith`.
     */
    private readonly value: T;
  }
  /**
   * `value`, wrapped. `value` is one nothing else holds: an array or object
   * literal, `null`, a ternary of fresh values, a `new` whose constructor
   * keeps no `this`, a call whose callee answers a fresh value, or a local
   * that is the sole reference to its value. A local handed in is moved and
   * may not be read again (NL2445); a parameter, a field or an element is
   * refused (NL2447); a local with a second reference is NL2512, naming it.
   * Pass a copy instead: `const copy: u8[] = new Array<u8>(raw.length);
   * copy.set(raw)`, then `secret(copy)`.
   *
   * @param value The key material, of a shape a `Secret` may hold (NL2428).
   * @returns The `Secret`, which needs an owner: a `const` or `let`, a
   *   `return`, or `wipe` (NL2439 otherwise).
   */
  export function secret<T>(value: T): Secret<T>;
  /**
   * `f(value)`: the one way to read a `Secret`. `f` is a top-level function
   * named at the call or an arrow written there, judged once the whole-program
   * facts are in. It reaches no I/O and no C through any depth of calls
   * (NL2448), panics or exits only with a literal, keeps nothing of `value`
   * (NL2449), and declares a return type that holds no `Secret` (NL2451; an
   * arrow writes it down, NL2452): that type is what leaves.
   *
   * @param s The `Secret` to read, borrowed.
   * @param f The function the value is handed to.
   * @returns What `f` answers.
   */
  export function expose<T, R>(s: Secret<T>, f: (value: T) => R): R;
  /**
   * `f(value, arg)`, under `expose`'s rules, because the arrow `expose` runs
   * captures nothing. `f` writes nothing through `arg` either (NL2450), which
   * would be a road out its result type does not name.
   *
   * @param s The `Secret` to read, borrowed.
   * @param arg The second argument `f` is handed, read only.
   * @param f The function the value and `arg` are handed to.
   * @returns What `f` answers.
   */
  export function exposeWith<T, A, R>(s: Secret<T>, arg: A, f: (value: T, arg: A) => R): R;
  /**
   * Zero every byte of the value, with a volatile store the optimiser may not
   * remove. The `Secret` may not be read again (NL2443). A holder's field is
   * wiped only in that holder's own `wipe()` (NL2547).
   *
   * @param target The `Secret`, never a nullable one: narrow it first
   *   (NL2438).
   */
  export function wipe<T>(target: Secret<T>): void;
  /**
   * Zero an array or record of integers that `expose`'s function holds, with
   * the same volatile store. Anything else, a `string` included, is NL2438.
   *
   * @param target The array or record of integers.
   */
  export function wipe(target: object): void;
}

// `nish:region` has source behind it, `std/region.ts`, but a program imports it
// by this name. The class has a private constructor, so `tsc` refuses
// `new Region()` as `nish` does (NL2618). What `nish` refuses about the
// functions a region runs — keeping its memory outside it, growing outer
// storage, reaching threads — is flow, which `tsc` cannot see
// (docs/LANGUAGE.md -> Regions).
/**
 * Memory a program frees when it says so: an arena of its own, reached
 * through a handle, so that what lives and dies together goes back with one
 * `free` where the thread's arena would hold it until the program ends.
 *
 *     import { Region, enterWith, free, regionWith } from "nish:region";
 *
 *     class Session {
 *       hits: i32 = 0;
 *       payload: u8[];
 *       constructor(size: i32) {
 *         this.payload = new Array<u8>(size);
 *       }
 *     }
 *
 *     const open = (size: i32): Session => new Session(size);
 *
 *     const serve = (s: Session, out: u8[]): i32 => {
 *       s.hits = s.hits + 1;
 *       for (let k: i32 = 0; k < s.payload.length && k < out.length; k++) {
 *         out[k] = s.payload[k]; // a number is copied out
 *       }
 *       return s.payload.length;
 *     };
 *
 *     const r: Region<Session> = regionWith(16, open);
 *     const n: i32 = enterWith(r, new Array<u8>(64), serve);
 *     free(r);
 *
 * Each function's `f` is an arrow or a named function, and an arrow captures
 * nothing (NL2335), so the ways into a region are its root, `arg` and module
 * state. The checker tells *region memory* (the root, and whatever `f`
 * allocates) from *outer memory* (`arg`, module state, what a callee answers
 * from outside). A number, a `boolean`, an `enum` and a `Region` are copied,
 * never pointed at, so they cross freely.
 *
 * Region memory stored into outer memory is NL2609, and outer memory other
 * than a number, `boolean`, `enum` or string literal stored into region
 * memory NL2610. Outer storage may not grow inside `f` (NL2615), threads may
 * not start there (NL2612), a value holding a `Region` may not cross to
 * another thread (NL2613), and `Arena.mark` and `Arena.used` are refused there
 * (NL2617). None of the five runs in a parallel body or a spawned function
 * (NL2351), and `using` does not take a region (NL2387).
 *
 * **Every call checks its handle at run time.** `enter`, `enterWith` and
 * `free` stop the program on a handle that is 0, freed already or another
 * thread's, and `enter` of an entered region and `free` of one stop it too,
 * so freeing twice is a panic and never a double free. Past 16,777,216 live
 * regions `region` stops the program as well.
 *
 * **Under Node.** `runtime/nish.mjs` keeps a region as an entry in a table,
 * `free` drops it, and the same handle checks throw. `--emit-ts` refuses the
 * module (NL4015).
 *
 * Rules: https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#regions-nishregion
 */
declare module "nish:region" {
  /** A handle to a region whose root is a `T`: 64 bits, not a pointer. */
  export class Region<T> {
    /**
     * Private, so that `tsc` refuses `new Region()` as `nish` does (NL2618):
     * a region is made only by `region` or `regionWith`.
     */
    private constructor();
    /**
     * The region's root, what `region`'s `f` answered. Private: it is reached
     * only as `enter`'s or `enterWith`'s `root`.
     */
    private readonly root: T;
  }
  /**
   * A new region: `f()` runs with every allocation landing in it, and what it
   * answers is the root.
   *
   * @param f Makes the root. It answers memory it allocated, never a module
   *   value (NL2614).
   * @returns The handle.
   */
  export function region<T>(f: () => T): Region<T>;
  /**
   * `region`, with one outside argument handed to `f`.
   *
   * @param arg Outer memory `f` may read but not keep in the region (NL2610)
   *   or grow (NL2615).
   * @param f Makes the root from `arg`. It answers memory it allocated, never
   *   `arg` itself (NL2614).
   * @returns The handle.
   */
  export function regionWith<A, T>(arg: A, f: (arg: A) => T): Region<T>;
  /**
   * `f(root)`, with every allocation landing in the region. Stops the program
   * on a dead, foreign or already-entered handle.
   *
   * @param r The region to enter.
   * @param f Runs on the root. It answers a number, a `boolean`, an `enum` or
   *   a `Region`, never an array, an object or a string (NL2611).
   * @returns What `f` answers.
   */
  export function enter<T, R>(r: Region<T>, f: (root: T) => R): R;
  /**
   * `f(root, arg)`, under `enter`'s rules.
   *
   * @param r The region to enter.
   * @param arg Outer memory `f` may read but not keep in the region (NL2610)
   *   or grow (NL2615).
   * @param f Runs on the root and `arg`, answering as `enter`'s does.
   * @returns What `f` answers.
   */
  export function enterWith<T, A, R>(r: Region<T>, arg: A, f: (root: T, arg: A) => R): R;
  /**
   * Give the region's memory back: `r` and every copy of it are dead. Stops
   * the program on a dead, foreign or entered handle, so freeing twice is a
   * panic.
   *
   * @param r The region to free.
   */
  export function free<T>(r: Region<T>): void;
}

// `nish:async` (WP49, docs/LANGUAGE.md -> Async functions). `tsc` sees ordinary
// promises; what `nish` adds is that each argument is a direct call to an
// `async` function, written where it is made, which the checker holds it to
// (`src/async-check.ts`), and that `awaitAll` takes two to eight of them.
/**
 * Tasks for `async` functions: start one and go on, or await two to eight at
 * once.
 *
 *     import { awaitAll, spawn } from "nish:async";
 *
 *     async function double(x: i32): Promise<i32> {
 *       return x * 2;
 *     }
 *
 *     async function log(x: i32): Promise<void> {
 *       console.log(x);
 *     }
 *
 *     async function run(): Promise<void> {
 *       const [c, d] = await awaitAll(double(1), double(2));
 *       spawn(log(c + d));
 *     }
 *
 * The two are reached only through the import. Each argument is a direct call
 * to an `async` function, written where it is made, which the checker holds
 * it to (`src/async-check.ts`); `tsc` sees ordinary promises.
 *
 * There is no `async` in a wasm build: under a `wasm32` target or
 * `--profile wasi` an `async` function is NL2652.
 *
 * **Under `--emit-ts`.** `nish:async` is `nish/runtime/async.mjs`: `awaitAll`
 * is `Promise.all` over its calls, and `spawn` starts its task without
 * awaiting it and keeps it, for the launcher to wait on before it exits. The
 * output resumes in Node's order, not the native one.
 *
 * Rules: https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#async-functions-async-and-await
 */
declare module "nish:async" {
  /**
   * Start `task` as a task of its own and go on without waiting for it. It
   * runs at once until it first waits on the outside world, then `spawn`
   * returns; a task that never waits has finished before `spawn` returns.
   *
   * @param task A direct call to an `async` function (NL2644). Nothing reads
   *   its answer, so it answers `void` or a `Result` it reports itself
   *   (NL2646).
   */
  export function spawn(task: Promise<void>): void;
  /**
   * Wait for two calls at once. It is awaited into one name per call,
   * `const [a, b] = await awaitAll(...)`; one call, or an `awaitAll` not so
   * destructured, is NL2647.
   *
   * @param a The first direct call to an `async` function.
   * @param b The next direct call to an `async` function.
   * @returns The answers, in the order the calls are written.
   */
  export function awaitAll<A, B>(a: Promise<A>, b: Promise<B>): Promise<[A, B]>;
  /**
   * Wait for three calls at once. It is awaited into one name per call,
   * `const [a, b, c] = await awaitAll(...)`; one call, or an `awaitAll` not so
   * destructured, is NL2647.
   *
   * @param a The first direct call to an `async` function.
   * @param b The next direct call to an `async` function.
   * @param c The next direct call to an `async` function.
   * @returns The answers, in the order the calls are written.
   */
  export function awaitAll<A, B, C>(a: Promise<A>, b: Promise<B>, c: Promise<C>): Promise<[A, B, C]>;
  /**
   * Wait for four calls at once. It is awaited into one name per call,
   * `const [a, b, c, d] = await awaitAll(...)`; one call, or an `awaitAll` not so
   * destructured, is NL2647.
   *
   * @param a The first direct call to an `async` function.
   * @param b The next direct call to an `async` function.
   * @param c The next direct call to an `async` function.
   * @param d The next direct call to an `async` function.
   * @returns The answers, in the order the calls are written.
   */
  export function awaitAll<A, B, C, D>(
    a: Promise<A>,
    b: Promise<B>,
    c: Promise<C>,
    d: Promise<D>,
  ): Promise<[A, B, C, D]>;
  /**
   * Wait for five calls at once. It is awaited into one name per call,
   * `const [a, b, c, d, e] = await awaitAll(...)`; one call, or an `awaitAll` not so
   * destructured, is NL2647.
   *
   * @param a The first direct call to an `async` function.
   * @param b The next direct call to an `async` function.
   * @param c The next direct call to an `async` function.
   * @param d The next direct call to an `async` function.
   * @param e The next direct call to an `async` function.
   * @returns The answers, in the order the calls are written.
   */
  export function awaitAll<A, B, C, D, E>(
    a: Promise<A>,
    b: Promise<B>,
    c: Promise<C>,
    d: Promise<D>,
    e: Promise<E>,
  ): Promise<[A, B, C, D, E]>;
  /**
   * Wait for six calls at once. It is awaited into one name per call,
   * `const [a, b, c, d, e, f] = await awaitAll(...)`; one call, or an `awaitAll` not so
   * destructured, is NL2647.
   *
   * @param a The first direct call to an `async` function.
   * @param b The next direct call to an `async` function.
   * @param c The next direct call to an `async` function.
   * @param d The next direct call to an `async` function.
   * @param e The next direct call to an `async` function.
   * @param f The next direct call to an `async` function.
   * @returns The answers, in the order the calls are written.
   */
  export function awaitAll<A, B, C, D, E, F>(
    a: Promise<A>,
    b: Promise<B>,
    c: Promise<C>,
    d: Promise<D>,
    e: Promise<E>,
    f: Promise<F>,
  ): Promise<[A, B, C, D, E, F]>;
  /**
   * Wait for seven calls at once. It is awaited into one name per call,
   * `const [a, b, c, d, e, f, g] = await awaitAll(...)`; one call, or an `awaitAll` not so
   * destructured, is NL2647.
   *
   * @param a The first direct call to an `async` function.
   * @param b The next direct call to an `async` function.
   * @param c The next direct call to an `async` function.
   * @param d The next direct call to an `async` function.
   * @param e The next direct call to an `async` function.
   * @param f The next direct call to an `async` function.
   * @param g The next direct call to an `async` function.
   * @returns The answers, in the order the calls are written.
   */
  export function awaitAll<A, B, C, D, E, F, G>(
    a: Promise<A>,
    b: Promise<B>,
    c: Promise<C>,
    d: Promise<D>,
    e: Promise<E>,
    f: Promise<F>,
    g: Promise<G>,
  ): Promise<[A, B, C, D, E, F, G]>;
  /**
   * Wait for eight calls at once. It is awaited into one name per call,
   * `const [a, b, c, d, e, f, g, h] = await awaitAll(...)`; one call, or an `awaitAll` not so
   * destructured, is NL2647.
   *
   * @param a The first direct call to an `async` function.
   * @param b The next direct call to an `async` function.
   * @param c The next direct call to an `async` function.
   * @param d The next direct call to an `async` function.
   * @param e The next direct call to an `async` function.
   * @param f The next direct call to an `async` function.
   * @param g The next direct call to an `async` function.
   * @param h The next direct call to an `async` function.
   * @returns The answers, in the order the calls are written.
   */
  export function awaitAll<A, B, C, D, E, F, G, H>(
    a: Promise<A>,
    b: Promise<B>,
    c: Promise<C>,
    d: Promise<D>,
    e: Promise<E>,
    f: Promise<F>,
    g: Promise<G>,
    h: Promise<H>,
  ): Promise<[A, B, C, D, E, F, G, H]>;
}

// ---- Arena (docs/LANGUAGE.md -> Arena) ---------------------------------------

declare const Arena: {
  /** The current bump address. */
  mark(): i64;
  /** Bytes bumped in the current chunk. */
  used(): i64;
};

/**
 * `using a = arena()` (docs/LANGUAGE.md -> Arena): everything the block
 * allocates after this declaration is released when the block ends, on every
 * exit, and the compiler refuses the block if anything allocated in it could
 * outlive it. Only a `using` initialiser, and the binding is never read; under
 * Node there is no arena and the disposal does nothing.
 */
declare function arena(): Disposable;

/**
 * `CPtr` (WP27 S2): the address a `declare function` hands back, opaque and
 * eight bytes wide. `docs/LANGUAGE.md` has the rules — it may be written in a
 * `declare function` signature and on a local, compared with `null` or with
 * another `CPtr`, and passed back to C, and that is all.
 *
 * An empty interface with a private brand rather than `unknown` or a type
 * alias: `tsc` has to refuse the arithmetic and the dereference `nish` refuses,
 * and it has to refuse assigning any other value to one. The brand is what makes
 * it nominal, so a `{}` does not satisfy it; the name is never written, so the
 * declaration costs a reader nothing.
 */
declare interface CPtr {
  readonly __nishForeignPointer: unique symbol;
}

// ---- `set` on an array ----------------------------------------------------------
//
// `dst.set(src, offset)` copies all of `src` into `dst` from `offset` on, with
// `TypedArray.prototype.set`'s meaning (WP34 N2). A `u8[]` is an `Array` to
// `tsc`, and `lib.es5.d.ts` gives `Array` a `fill` of the same meaning but no
// `set`, so this is the one method added to it; `runtime/nish.mjs` installs it
// under Node. Nish admits it on an array of numbers only.

interface Array<T> {
  set(source: readonly T[], offset?: number): void;
}

// ---- What this file cannot say ----------------------------------------------
//
// The typed-array aliases (`Int32Array`, `Float32Array`, `Float64Array`,
// `BigInt64Array`) are *not* declared here. In Nish each one names the
// element-typed array itself — `Int32Array` is `i32[]` — but redeclaring them
// would collide with `lib.es5.d.ts` and break every other type in the standard
// library. So `tsc` reads them as the JavaScript views it knows, which accept
// indexing and `.length` but not an array literal; write `i32[]` where you
// want both compilers to agree.
//
// `a.pop()` is `T` in Nish — an empty array panics, because there is no
// `undefined` to answer with — and `T | undefined` in `lib.es5.d.ts`. Narrowing
// the standard `Array<T>` would need a global augmentation that changed the
// method for every array in the project, including a host's, so this one is
// left as it is: `tsc` asks for a null check that `nish` does not need.
