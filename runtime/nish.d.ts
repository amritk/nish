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
 * §5): declared here so that a program using `nish/threads`'s scope or
 * `arena()` needs no `"ESNext.Disposable"` in its `lib`. `nish` itself takes
 * `using` only for a `scope()` or an `arena()`, and `[Symbol.dispose]` only in
 * `nish/threads`.
 */
interface SymbolConstructor {
  readonly dispose: unique symbol;
}
interface Disposable {
  [Symbol.dispose](): void;
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

// ---- Streams and files (globals: Nish has no package resolution) ---------

/** `s` to stdout with no trailing newline and no conversion. */
declare function write(s: string): void;
/** `s` to stderr, likewise. */
declare function writeError(s: string): void;
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
/** One environment variable, or `null` when it is unset (an empty value is a set variable). */
declare function getenv(name: string): string | null;
/**
 * A monotonic clock in nanoseconds, for timing a region of a program. The
 * origin is arbitrary, so only the difference between two reads is meaningful.
 */
declare function monotonicNanos(): i64;
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
/** The next connection's descriptor, its address in `peer`; -11 when none waits. */
declare function tcpAccept(fd: i32, peer: u8[]): i32;
/** Up to `len` bytes into `buf` from `off`: the count, 0 at end of stream, or -11. */
declare function netRead(fd: i32, buf: u8[], off: i32, len: i32): i32;
/** Up to `len` bytes of `buf` from `off`: the count; a gone peer is -32, never SIGPIPE. */
declare function netWrite(fd: i32, buf: readonly u8[], off: i32, len: i32): i32;
/** Shut the read side (0), the write side (1) or both (2). */
declare function netShutdown(fd: i32, how: i32): i32;
/** Close the descriptor. */
declare function netClose(fd: i32): i32;
/** A TCP socket connecting to `addr`, answered while it connects: writable once it has, or has failed. */
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

declare module "nish:fs" {
  export function readFileSync(path: string): string;
  export function readFileSyncOrNull(path: string): string | null;
  export function readFileBytesSync(path: string): u8[] | null;
  /** Refuses a symbolic link as the last component of the path, as the global does. */
  export function writeFileSync(path: string, data: string): void;
  /** Refuses a symbolic link as the last component of the path, as the global does. */
  export function appendFileSync(path: string, data: string): void;
  /** `true` when the directory was created, `false` when it already existed. */
  export function mkdirSync(path: string): boolean;
  export function isDirectorySync(path: string): boolean;
  /**
   * The directory's entries, sorted ascending by bytes and without `.` or
   * `..`, or `null` when it cannot be read.
   */
  export function readdirSync(path: string): string[] | null;
  export function realpathSync(path: string): string | null;
  /** Node's `mtimeMs` for the path, or NaN when it cannot be stat'd. */
  export function statMtimeSync(path: string): f64;
}

declare module "nish:process" {
  /** The global `process.exit`: a terminator, which `never` is how `tsc` spells it. */
  export function exit(code: i32): never;
  export function getenv(name: string): string | null;
  export function spawnSync(argv: string[]): number;
  /**
   * The same run with each non-empty path receiving that stream, created or
   * truncated; an empty string leaves that stream inherited. A symbolic link
   * at either path is refused, and the answer is -1.
   */
  export function spawnSyncTo(argv: string[], stdoutPath: string, stderrPath: string): number;
  /**
   * A monotonic clock in nanoseconds. The origin is arbitrary, so only the
   * difference between two reads is meaningful.
   */
  export function monotonicNanos(): i64;
  /** A descriptor readable when SIGTERM or SIGINT arrives; the same one every call, or -1. */
  export function signalFd(): i32;
  /** Block until SIGTERM or SIGINT arrives: 15 or 2, or -1 for a descriptor that is not `signalFd()`'s. */
  export function readSignal(fd: i32): i32;
  /** The command line; `argv[0]` is the program path, as in C. Read-only. */
  export const argv: readonly string[];
  /** The operating system the program runs on: `"linux"`, `"darwin"`, or `"unknown"`. */
  export const platform: string;
  /** The architecture: `"x64"`, `"arm64"`, or `"unknown"`. */
  export const arch: string;
}

declare module "nish:net" {
  /** The address form of a numeric `host` and `port` in `out`'s first 18 bytes: 0, or -22. */
  export function netAddress(out: u8[], host: string, port: i32): i32;
  /** The port the socket is bound to. */
  export function netLocalPort(fd: i32): i32;
  /** A listening TCP socket with `SO_REUSEADDR`; `"::"` hears IPv4 and IPv6. */
  export function tcpListen(host: string, port: i32, backlog: i32): i32;
  /** The next connection's descriptor, its address in `peer`; -11 when none waits. */
  export function tcpAccept(fd: i32, peer: u8[]): i32;
  /** Up to `len` bytes into `buf` from `off`: the count, 0 at end of stream, or -11. */
  export function netRead(fd: i32, buf: u8[], off: i32, len: i32): i32;
  /** Up to `len` bytes of `buf` from `off`: the count; a gone peer is -32, never SIGPIPE. */
  export function netWrite(fd: i32, buf: readonly u8[], off: i32, len: i32): i32;
  /** Shut the read side (0), the write side (1) or both (2). */
  export function netShutdown(fd: i32, how: i32): i32;
  export function netClose(fd: i32): i32;
  /** A TCP socket connecting to `addr`, answered while it connects: writable once it has, or has failed. */
  export function tcpConnect(addr: readonly u8[]): i32;
  /** Once `fd` is writable: 0 when the connection is made, else its failure (-111 refused). */
  export function connectResult(fd: i32): i32;
  /** A UDP socket: flag 1 `SO_REUSEPORT`, flag 2 `UDP_GRO` (-95 on Darwin); ECN is always read. */
  export function udpBind(host: string, port: i32, flags: i32): i32;
  /** `buf[off, off + len)` to `to`, cut into `segment`-byte datagrams when `segment > 0`, with ECN bits `ecn`. */
  export function udpSendTo(
    fd: i32,
    buf: readonly u8[],
    off: i32,
    len: i32,
    to: readonly u8[],
    segment: i32,
    ecn: i32
  ): i32;
  /** One datagram, or several GRO coalesced, into `buf[off, off + len)`; the sender in `from`, `meta` [segment size, ECN]. */
  export function udpRecvFrom(fd: i32, buf: u8[], off: i32, len: i32, from: u8[], meta: i32[]): i32;
  /** A readiness loop, level-triggered: epoll on Linux, kqueue on Darwin. */
  export function pollCreate(): i32;
  /** Watch `fd` for `events` (1 readable, 2 writable) under `token`. */
  export function pollAdd(loop: i32, fd: i32, events: i32, token: i32): i32;
  /** New events or a new token for a watched `fd`. */
  export function pollModify(loop: i32, fd: i32, events: i32, token: i32): i32;
  /** Stop watching `fd`. */
  export function pollRemove(loop: i32, fd: i32): i32;
  /** Wait up to `timeoutMs` (negative: forever); pairs `ready[2k]` token, `ready[2k + 1]` events (4: hang-up or error). */
  export function pollWait(loop: i32, ready: i32[], timeoutMs: i32): i32;
}

declare module "nish:io" {
  /** `s` to stdout with no trailing newline and no conversion. */
  export function write(s: string): void;
  /** The same, on stderr. */
  export function writeError(s: string): void;
  /** `message` to stderr, then exit 1. A terminator, as `process.exit` is. */
  export function panic(message: string): never;
}

// `nish:secret` has source behind it, `std/secret.ts`, but a program imports it
// by this name, so `tsc` reads these declarations rather than that file. The
// class is declared with a private constructor and a private field: `tsc` then
// refuses `new Secret(...)`, `s.value` and a structural look-alike, as `nish`
// does. Everything else `nish` refuses about a `Secret` — printing it,
// comparing it, branching on it, dropping it unwiped, an `expose` whose
// function does I/O — is flow, which `tsc` cannot see
// (docs/LANGUAGE.md -> Secrets).
declare module "nish:secret" {
  /**
   * Key material: an array of integers or a record of integer fields, held
   * opaque. Made by `secret`, read only through `expose`, and wiped or
   * returned by the function that made it.
   */
  export class Secret<T> {
    private constructor();
    private readonly value: T;
  }
  /** `value`, wrapped. A local handed in is moved: it may not be read again. */
  export function secret<T>(value: T): Secret<T>;
  /**
   * `f(value)`. `f` reaches no I/O and no C, keeps nothing of `value`, and
   * declares a return type that holds no `Secret`: that type is what leaves.
   */
  export function expose<T, R>(s: Secret<T>, f: (value: T) => R): R;
  /** `f(value, arg)`, under `expose`'s rules; `f` may not write `arg` either. */
  export function exposeWith<T, A, R>(s: Secret<T>, arg: A, f: (value: T, arg: A) => R): R;
  /** Zero the value's whole storage, with a store the optimiser may not remove. */
  export function wipe<T>(target: Secret<T>): void;
  /** Zero an array or record of integers that `expose`'s function holds, likewise. */
  export function wipe(target: object): void;
}

// ---- Arena (docs/LANGUAGE.md -> Arena) ---------------------------------------

declare const Arena: {
  /** The current bump address. */
  mark(): i64;
  /** Free everything allocated since `m`. */
  release(m: i64): void;
  /** Recycle everything in O(1), keeping the newest chunk. */
  reset(): void;
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
