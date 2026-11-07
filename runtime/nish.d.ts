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
 * `docs/LANGUAGE.md` is the normative description; the doc comments here are
 * the reference for each builtin, and each ends with the capability a call
 * needs (docs/LANGUAGE.md -> Capabilities), `none` for a call that needs none.
 *
 * **`Map`, `Set`, `Math`, `Array`, `ReadonlyArray` and `String` are
 * `lib.es2022`'s**, which a program is checked against: a second declaration
 * would clash with it, so the interfaces at the foot of this file merge into
 * lib's, adding Nish's documentation and no signature narrower than lib's.
 * `nish`'s surface is lib's less what it defers — no `entries`, no `forEach`,
 * no `for...of` over a `Map` itself — with `keys()` and `values()` admitted
 * only as the iterable of a `for...of`, and `get`'s `V | undefined` only as a
 * `const`'s initialiser, the left of `??` or an operand of `=== undefined`,
 * none of which `tsc` can know (docs/LANGUAGE.md -> `Map` and `Set`).
 * `nish/map`'s `reserve` and `getOrInsert` are not declared here: they are
 * ordinary source, `std/map.ts`, which `tsconfig.json` maps `nish/*` to.
 */

// ---- Numeric widths (docs/LANGUAGE.md -> Types) ------------------------------
//
// Nish treats these as distinct types that never mix implicitly. There is
// no way to say that in TypeScript without branding them, and a brand would
// break the literal syntax the language relies on (`let x: i32 = 5`), so they
// are aliases and the width check is left to `nish`.

/** A 32-bit signed integer: `number` in i32 mode, and the type of an array index. */
type i32 = number;
/** A 64-bit signed integer; it never mixes with an `i32` without `toI64` or `toI32`. */
type i64 = number;
/** An 8-bit unsigned integer, the element of a byte buffer (`u8[]`). */
type u8 = number;
/** A 16-bit unsigned integer. */
type u16 = number;
/** A 32-bit unsigned integer: same width as `i32`, the other signedness. */
type u32 = number;
/** A 64-bit unsigned integer: same width as `i64`, the other signedness. */
type u64 = number;
/** A 32-bit IEEE-754 float. */
type f32 = number;
/** A 64-bit IEEE-754 float: `number` in f64 mode, and JavaScript's `number`. */
type f64 = number;

// ---- Ranged integers (docs/wp31-ranged-integers.md) --------------------------

/**
 * An `i32` the compiler knows lies in `[Lo, Hi]`. The bounds are numeric
 * literal types, and `tsc` checks only that; the range itself is `nish`'s.
 * A ranged value is its base type wherever one is expected, and arithmetic on
 * it that provably stays inside 32 bits needs no overflow check: `Math.clz32`
 * answers an `integer<0, 32>`, so `31 - Math.clz32(w)` is checked by nothing
 * (docs/LANGUAGE.md -> Types).
 */
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

/** The methods every `Result` carries. Capability: none. */
interface ResultMethods<T, E> {
  /**
   * True when this is the success arm; narrows `r` where it is a condition.
   *
   * @returns whether `r` holds a value.
   */
  isOk(): this is ResultOk<T> & ResultMethods<T, E>;
  /**
   * True when this is the failure arm; narrows `r` the other way.
   *
   * @returns whether `r` holds an error.
   */
  isErr(): this is ResultErr<E> & ResultMethods<T, E>;
  /**
   * The success payload, or an early `return Err(error)` from the enclosing
   * function — Rust's `?`. `nish` additionally requires that function to
   * return a `Result` whose error arm accepts `E`; `tsc` cannot check that.
   *
   * @returns the success payload; the failure arm never returns here.
   */
  orReturn(): T;
  /**
   * The success payload, or `fallback` when this is the failure arm.
   *
   * @param fallback the value answered for the failure arm.
   * @returns the payload or `fallback`.
   */
  unwrapOr(fallback: T): T;
  /**
   * The success payload, or `message` on stderr and exit 1: the failure arm
   * ends the program.
   *
   * @param message what stderr says before the exit.
   * @returns the success payload.
   */
  expect(message: string): T;
}

/**
 * The outcome of an operation that can fail. `T` may be `void` for an
 * operation with nothing to hand back; `E` may not be.
 */
type Result<T, E> = (ResultOk<T> | ResultErr<E>) & ResultMethods<T, E>;

/**
 * The success value. Its `Result` type comes from the context, as `null`'s
 * does; `Ok()` with no argument is a `Result<void, E>`. Capability: none.
 *
 * @param value the payload.
 * @returns a `Result` on its success arm.
 */
declare function Ok<T, E>(value: T): Result<T, E>;
declare function Ok<E>(): Result<void, E>;
/**
 * The failure value, likewise. Capability: none.
 *
 * @param error the error payload.
 * @returns a `Result` on its failure arm.
 */
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
  /** The key of the method `using` calls when its block ends. */
  readonly dispose: unique symbol;
}
/** A value `using` may bind: one whose `[Symbol.dispose]()` ends its scope. */
interface Disposable {
  /** Ends the value's scope; `using` calls it on every exit from the block. */
  [Symbol.dispose](): void;
}

/**
 * `String.fromBytes` is Nish's, not JavaScript's, so it merges into the
 * `StringConstructor` `lib.es2022` declares. Under `runtime/nish.mjs` each byte
 * becomes one UTF-16 unit, as `String.fromCharCode`'s does.
 */
interface StringConstructor {
  /**
   * The bytes of `bytes[start..end)` as one string; panics unless
   * `0 <= start <= end <= bytes.length`, the range `s.slice` checks. Nothing
   * validates the bytes as UTF-8. Capability: none.
   *
   * @param bytes the buffer to read.
   * @param start the first byte taken.
   * @param end one past the last byte taken.
   * @returns a new string of `end - start` bytes.
   */
  fromBytes(bytes: readonly u8[], start: number, end: number): string;
}

/**
 * The two output streams, with Nish's one-argument signatures. Numbers print
 * as JavaScript's `String(x)`: exact decimal for `i32`/`i64`, shortest
 * round-trip digits for `f64` (`0.1`, `1e+21`, `1e-7`, `NaN`, `Infinity`,
 * `-0` as `0`); booleans print `true`/`false`.
 */
interface Console {
  /**
   * Writes `x` and a newline to stdout with one `write(2)`; statement position
   * only; exactly one argument. Arrays and objects are rejected.
   * Capability: none.
   *
   * @param x the string, number or boolean to print.
   */
  log(x: string | number | boolean): void;
  /**
   * The same, on stderr — the stream a compiler's diagnostics belong on.
   * Identical rules under its own name. Capability: none.
   *
   * @param x the string, number or boolean to print.
   */
  error(x: string | number | boolean): void;
}
/** The program's `console`: `log` to stdout, `error` to stderr. */
declare var console: Console;

/** The running process: its exit, its command line and its host. */
interface Process {
  /**
   * Ends the program with `code`, through libc's `exit(code)`, which flushes
   * stdio; the arena is abandoned to the operating system. Statement
   * position, and a terminator: `never` is how TypeScript spells that, so a
   * function ending in `process.exit(c)` satisfies its return type in `tsc` as
   * it does in `nish`. Capability: exit.
   *
   * @param code the exit status.
   */
  exit(code: i32): never;
  /**
   * The command line; `argv[0]` is the program path, as in C — one index
   * earlier than Node's, which puts `node` first. Each argument is the bytes
   * the operating system passed, as a UTF-8 string. Read-only, and it needs a
   * `main` entry point. Capability: none.
   */
  readonly argv: string[];
  /** The operating system the program runs on: `"linux"`, `"darwin"`, or `"unknown"` (every WASI build). Capability: none. */
  readonly platform: string;
  /** The architecture: `"x64"`, `"arm64"`, or `"unknown"`. Capability: none. */
  readonly arch: string;
}
/** The running process. */
declare var process: Process;

// ---- Numeric conversions (there is no cast in Nish) ----------------------
//
// `Number`, `parseInt` and `parseFloat` are `lib.es2022`'s and are not
// declared here; docs/LANGUAGE.md -> Numeric conversions has their rules.

/**
 * `x` as an `i32`. A narrower or equal-width integer wraps, a wider one is
 * sign- or zero-extended by its own signedness, and a float saturates (NaN is
 * 0, out of range clamps). Capability: none.
 *
 * @param x the value to convert.
 * @returns `x` in 32 signed bits.
 */
declare function toI32(x: number | boolean): i32;
/**
 * `x` as an `i64`: a signed source is sign-extended, an unsigned one
 * zero-extended, and a float saturates. Capability: none.
 *
 * @param x the value to convert.
 * @returns `x` in 64 signed bits.
 */
declare function toI64(x: number | boolean): i64;
/**
 * `x` as a `u8`: a wider integer is truncated, and a float saturates into
 * `0 .. 255`, so a negative value is 0. Capability: none.
 *
 * @param x the value to convert.
 * @returns `x` in 8 unsigned bits.
 */
declare function toU8(x: number | boolean): u8;
/**
 * `x` as a `u16`, by `toU8`'s rules at 16 bits. Capability: none.
 *
 * @param x the value to convert.
 * @returns `x` in 16 unsigned bits.
 */
declare function toU16(x: number | boolean): u16;
/**
 * `x` as a `u32`, by `toU8`'s rules at 32 bits; from an `i32` the bits do not
 * move. Capability: none.
 *
 * @param x the value to convert.
 * @returns `x` in 32 unsigned bits.
 */
declare function toU32(x: number | boolean): u32;
/**
 * `x` as a `u64`. Widening sign-extends a signed source, so `toU64(-1: i32)`
 * is 2^64 - 1; a float saturates, so a negative value is 0. Capability: none.
 *
 * @param x the value to convert.
 * @returns `x` in 64 unsigned bits.
 */
declare function toU64(x: number | boolean): u64;
/**
 * `x` as an `f32`; from an `f64` it rounds to nearest. Capability: none.
 *
 * @param x the value to convert.
 * @returns the nearest `f32`.
 */
declare function toF32(x: number | boolean): f32;
/**
 * `x` as an `f64`; from an `f32` it is exact. Capability: none.
 *
 * @param x the value to convert.
 * @returns `x` as an `f64`.
 */
declare function toF64(x: number | boolean): f64;
/**
 * Reinterpret the 64 bits of an `f64`, never convert the value: `toI64(1.5)`
 * is `1`, `f64ToBits(1.5)` is `0x3FF8000000000000`. Capability: none.
 *
 * @param x the float whose bits are read.
 * @returns the same 64 bits as an `i64`.
 */
declare function f64ToBits(x: f64): i64;
/**
 * The inverse of `f64ToBits`: `bitsToF64(f64ToBits(x)) === x` for every `x`
 * except `NaN`, which is not `===` to itself. Capability: none.
 *
 * @param bits the 64 bits to read as a float.
 * @returns the `f64` those bits are.
 */
declare function bitsToF64(bits: i64): f64;
/**
 * Reinterpret the 32 bits of an `f32`, never convert the value, signed as an
 * `i32`: `f32ToBits(1.5)` is `0x3FC00000`, and `f32ToBits(-0)` is
 * `-2147483648`. Capability: none.
 *
 * @param x the float whose bits are read.
 * @returns the same 32 bits as an `i32`.
 */
declare function f32ToBits(x: f32): i32;

// ---- Constant time (WP34 N6) ------------------------------------------------

/**
 * `(a & mask) | (b & ~mask)` with the mask hidden from the optimiser, so it is
 * never turned into a branch: `a` for an all-ones mask, `b` for zero. Every
 * operand is one type, `u32` or `u64`. Both are `number` here, so one generic
 * declaration stands for the two. Capability: none.
 *
 * @param mask all ones to choose `a`, zero to choose `b`.
 * @param a the value an all-ones mask selects.
 * @param b the value a zero mask selects.
 * @returns `a` or `b`, chosen without a branch.
 */
declare function ctSelect<T extends u32 | u64>(mask: T, a: T, b: T): T;
/**
 * All-ones of the operands' type when `a === b`, zero otherwise, without a
 * branch. Capability: none.
 *
 * @param a one operand.
 * @param b the other, of the same type.
 * @returns a mask for `ctSelect`.
 */
declare function ctEq<T extends u32 | u64>(a: T, b: T): T;
/**
 * Every byte of `bytes` set to zero, in stores neither `-O2` nor `-flto` may
 * drop as dead (#385): how a key, a secret scalar or another secret is cleared
 * once it is used. A statement. Capability: none.
 *
 * @param bytes the buffer to clear.
 */
declare function secureZero(bytes: u8[]): void;
/**
 * One `lstat` of `path`, so a symbolic link answers for itself: the owner's uid
 * in the high 32 bits and `st_mode` in the low 32, or -1 when the path does not
 * resolve (#386). Capability: fs.read.
 *
 * @param path the path to stat, not followed through a final link.
 * @returns `(uid << 32) | st_mode`, or -1.
 */
declare function lstatOwnerModeSync(path: string): i64;
/**
 * The effective user id, the one to compare an owner from `lstatOwnerModeSync`
 * with. Capability: env.
 *
 * @returns the process's effective uid.
 */
declare function geteuid(): i64;
/**
 * Whether the real user may run `path`: `access(path, X_OK)`.
 * Capability: fs.read.
 *
 * @param path the file to ask about.
 * @returns whether it is executable by the real user.
 */
declare function isExecutableSync(path: string): boolean;

// ---- Unsafe (`nish:unsafe`) --------------------------------------------------
//
// Declared as globals so `tsc` reads a program that imports them, as every
// `nish:` export is, but `nish` refuses a call to any of the six that is not
// imported from `nish:unsafe`: the import is the module's visible opt-in.

/**
 * `xs[i]` with no bounds check: undefined behaviour when `i` is out of range.
 * Capability: unsafe.
 *
 * @param xs the array of numbers to read.
 * @param i the index, trusted to be in range.
 * @returns the element at `i`.
 */
declare function uncheckedGet<T extends number>(xs: readonly T[], i: i32): T;
/**
 * `xs[i] = v` with no bounds check: undefined behaviour when `i` is out of
 * range. Capability: unsafe.
 *
 * @param xs the array of numbers to write.
 * @param i the index, trusted to be in range.
 * @param v the value stored.
 */
declare function uncheckedSet<T extends number>(xs: T[], i: i32, v: T): void;
/**
 * `a + b` wrapped to the operands' width, `i32` or `i64`: defined for every
 * pair. Capability: unsafe.
 *
 * @param a one operand.
 * @param b the other, of the same type.
 * @returns the low bits of the sum.
 */
declare function wrappingAdd<T extends i32 | i64>(a: T, b: T): T;
/**
 * `a - b` wrapped to the operands' width. Capability: unsafe.
 *
 * @param a the minuend.
 * @param b the subtrahend, of the same type.
 * @returns the low bits of the difference.
 */
declare function wrappingSub<T extends i32 | i64>(a: T, b: T): T;
/**
 * `a * b` wrapped to the operands' width. Capability: unsafe.
 *
 * @param a one operand.
 * @param b the other, of the same type.
 * @returns the low bits of the product.
 */
declare function wrappingMul<T extends i32 | i64>(a: T, b: T): T;
/**
 * The `NUL`-terminated bytes at `p`, copied into a string: undefined behaviour
 * unless `p` is a live C string. Capability: unsafe.
 *
 * @param p the address a `declare function` handed back.
 * @returns a copy of the bytes before the first `NUL`.
 */
declare function readCString(p: CPtr): string;

// ---- Streams and files (globals: Nish has no package resolution) ---------

/**
 * `s` to stdout with no trailing newline and no conversion (a `string` only);
 * statement position. Capability: none.
 *
 * @param s the text written.
 */
declare function write(s: string): void;
/**
 * `s` to stderr, likewise. Capability: none.
 *
 * @param s the text written.
 */
declare function writeError(s: string): void;
/**
 * `bytes[off .. off + len)` to stdout, every byte as it is — the one way to
 * send bytes that are not text. A loop of `write(2)` sends them all, retried
 * on an interrupted call. A pipe whose reader has gone raises SIGPIPE
 * natively, as it does for `write`, where Node answers `-32` EPIPE. A range
 * outside `bytes` panics, as `dst.set` does, with `slice out of range:
 * [off, off+len) of length n`, and exits 1. The shape is `netWrite`'s with the
 * descriptor fixed at 1. A `wasm32` build has no stdout to reach and refuses
 * it. Capability: none.
 *
 * @param bytes the buffer to send.
 * @param off the first byte sent; `0 <= off`.
 * @param len how many bytes; `0 <= len` and `off + len <= bytes.length`.
 * @returns `len`, or a negative errno if the stream refuses them (`-9` EBADF
 *   on a closed descriptor), never a panic.
 */
declare function writeBytes(bytes: readonly u8[], off: i32, len: i32): i32;
/**
 * `message` and a newline to stderr, then exit 1: it ends the program, with
 * the same ending an out-of-range index has. Statement position, and it
 * terminates control flow, so it is `never`: that is what lets `tsc` agree
 * that a function ending in a `panic` returns, and that `x` is not null after
 * `if (x === null) { panic(...); }` — the guard-then-panic shape `src/` uses
 * everywhere in place of an assert. Capability: none.
 *
 * @param message what stderr says before the exit.
 */
declare function panic(message: string): never;
/**
 * The whole file as a string; a path that cannot be read as one — missing, a
 * directory, a parent that cannot be searched — prints `nish: cannot read
 * <path>` and exits 1. Capability: fs.read.
 *
 * @param path the file to read.
 * @returns its contents.
 */
declare function readFileSync(path: string): string;
/**
 * The same read, answering `null` for every path the other exits over.
 * Capability: fs.read.
 *
 * @param path the file to read.
 * @returns its contents, or `null`.
 */
declare function readFileSyncOrNull(path: string): string | null;
/**
 * The file's bytes as they are on disk — no UTF-8 assumed, so a zero byte and
 * a byte of 0x80 or above survive — or `null` for every path
 * `readFileSyncOrNull` answers `null` for. Capability: fs.read.
 *
 * @param path the file to read.
 * @returns its bytes, or `null`.
 */
declare function readFileBytesSync(path: string): u8[] | null;
/**
 * The file's contents replaced by `data`, created at 0644 when missing. A
 * symbolic link as the last component of the path is refused rather than
 * followed, natively and under Node alike, and a path that cannot be written
 * prints `nish: cannot write <path>` and exits 1. Capability: fs.write.
 *
 * @param path the file to write.
 * @param data its new contents.
 */
declare function writeFileSync(path: string, data: string): void;
/**
 * `data` added at the end of the file, with the same refusal of a symbolic
 * link. Capability: fs.write.
 *
 * @param path the file to extend.
 * @param data the text appended.
 */
declare function appendFileSync(path: string, data: string): void;
/**
 * The file's contents replaced by `bytes`, created at 0644 when missing, with
 * the same refusal of a symbolic link. Never an exit. Capability: fs.write.
 *
 * @param path the file to write.
 * @param bytes its new contents.
 * @returns the byte count, or a negative errno.
 */
declare function writeFileBytesSync(path: string, bytes: readonly u8[]): i32;
/**
 * `from` moved to `to`, replacing a file there in one step on one file system.
 * Capability: fs.write.
 *
 * @param from the name moved.
 * @param to the name it takes.
 * @returns 0, or a negative errno (-18 across file systems, -2 for a missing
 *   `from`).
 */
declare function renameSync(from: string, to: string): i32;
/**
 * The name `path` removed. A directory is refused, not removed.
 * Capability: fs.write.
 *
 * @param path the name to remove.
 * @returns 0, or a negative errno.
 */
declare function unlinkSync(path: string): i32;
/**
 * `writeFileSync` with an explicit `mode`: the file is exactly `mode`
 * (`0o600` for a secret) before a byte of `data` is in it, whatever the umask
 * or a file already there had, and a symbolic link at the path is refused
 * (-40). The file is truncated and written in place, so a crash or a failed
 * write leaves it empty or partial, and a file this process may write but does
 * not own is emptied before the mode change answers -1 (`EPERM`). For a file
 * that must be the old one or the new one, write a temporary name with this
 * and move it with `renameSync`. Never an exit. Capability: fs.write.
 *
 * @param path the file to write.
 * @param data its new contents.
 * @param mode the file's mode, 0..0o777.
 * @returns the byte count, or a negative errno: -22 for a mode outside
 *   0..0o777, the setuid, setgid and sticky bits included.
 */
declare function writeFileSyncMode(path: string, data: string, mode: i32): i32;
/**
 * `data` in a new file of exactly `mode`, created only if nothing is at `path`:
 * -17 when something is, a dangling symbolic link included. Of several
 * processes racing for one path exactly one succeeds, so it takes a lock. A
 * write that fails after the create removes the file, so the lock is not left
 * taken. Never an exit. Capability: fs.write.
 *
 * @param path the file to create.
 * @param data its contents.
 * @param mode the file's mode.
 * @returns the byte count, or a negative errno.
 */
declare function createFileExclusiveSync(path: string, data: string, mode: i32): i32;
/**
 * One directory made with `mode` less the umask (`0o700` is exact under any
 * umask that leaves the owner's bits). A path already there is -17 and its
 * mode is not changed. Capability: fs.write.
 *
 * @param path the directory to make.
 * @param mode its mode before the umask, 0..0o777.
 * @returns 0, or a negative errno; -22 for a mode outside 0..0o777.
 */
declare function mkdirSyncMode(path: string, mode: i32): i32;
/**
 * One directory, not recursive. Capability: fs.write.
 *
 * @param path the directory to make.
 * @returns whether a directory is there afterwards.
 */
declare function mkdirSync(path: string): boolean;
/**
 * Whether a directory is at `path` right now. One `stat`, and never an exit.
 * Capability: fs.read.
 *
 * @param path the path to ask about.
 * @returns whether it names a directory.
 */
declare function isDirectorySync(path: string): boolean;
/**
 * The directory's entries, sorted ascending by bytes and without `.` or `..`,
 * or `null` when it cannot be read. An empty directory is an empty array, so
 * the null check is about the directory and not about its contents.
 * Capability: fs.read.
 *
 * @param path the directory to list.
 * @returns the entry names, or `null`.
 */
declare function readdirSync(path: string): string[] | null;
/**
 * `path` with every symbolic link resolved, as an absolute normalised path —
 * or `null` when it does not resolve, a path that does not exist included.
 * Capability: fs.read.
 *
 * @param path the path to resolve.
 * @returns the resolved path, or `null`.
 */
declare function realpathSync(path: string): string | null;
/**
 * Run `argv[0]` through `PATH` and wait. Capability: process.spawn.
 *
 * @param argv the program and its arguments.
 * @returns the exit status, `128 + n` for a signal, `-1` for a failure.
 */
declare function spawnSync(argv: string[]): number;
/**
 * The same run with each non-empty path receiving that stream, created or
 * truncated; an empty string leaves that stream inherited. A symbolic link at
 * either path is refused, as `writeFileSync` refuses one, and the answer is -1.
 * Capability: process.spawn.
 *
 * @param argv the program and its arguments.
 * @param stdoutPath the file the child's stdout goes to, or `""`.
 * @param stderrPath the file the child's stderr goes to, or `""`.
 * @returns the status as `spawnSync` answers it.
 */
declare function spawnSyncTo(argv: string[], stdoutPath: string, stderrPath: string): number;
/**
 * The same run with all three streams on pipes: `stdin` is written to the
 * child and closed, and what it prints is appended to `stdout` and `stderr`.
 * When a stream passes 16 MiB the child is killed and each array keeps at
 * most the first 16 MiB. Capability: process.spawn.
 *
 * @param argv the program and its arguments.
 * @param stdin the bytes the child reads.
 * @param stdout receives what the child prints on stdout.
 * @param stderr receives what the child prints on stderr.
 * @returns the status as `spawnSync` answers it, or -2 when a stream passed
 *   16 MiB.
 */
declare function spawnPiped(argv: string[], stdin: readonly u8[], stdout: u8[], stderr: u8[]): i32;
/**
 * `spawn` with the child holding `fds[i]` as descriptor `3 + i`, inherited
 * across the exec; every other descriptor stays close-on-exec. No reading
 * under Node, which throws. Capability: process.spawn.
 *
 * @param argv the program and its arguments.
 * @param fds the descriptors handed down, at most 64.
 * @returns the child's pid, or a negative errno: -22 more than 64 descriptors
 *   or a negative one, -9 one that is not open, -24 (or -22 above the
 *   descriptor limit) a scratch descriptor the system cannot give.
 */
declare function spawnWithFds(argv: string[], fds: readonly i32[]): i32;
/**
 * Start `argv[0]` through `PATH` without waiting. The child is the program's
 * until `waitPid` reaps it. No reading under Node, which throws.
 * Capability: process.spawn.
 *
 * @param argv the program and its arguments.
 * @returns the child's pid, or a negative errno.
 */
declare function spawn(argv: string[]): i32;
/**
 * Send `sig` to `pid`. Capability: process.spawn.
 *
 * @param pid the process signalled; 0 or below is -22.
 * @param sig 0, 2, 9 or 15; anything else is -22.
 * @returns 0, or a negative errno (-3 when no such process).
 */
declare function kill(pid: i32, sig: i32): i32;
/**
 * Wait for the child `pid`, or any child for -1. No reading under Node, which
 * throws. Capability: process.spawn.
 *
 * @param pid the child to wait for, or -1.
 * @param flags 0, or 1 for WNOHANG.
 * @returns `[pid, status]`, the status as `spawnSync` answers it; under
 *   WNOHANG `[0, 0]` means a child remains and none has exited; a failure is
 *   `[-errno, 0]`, `[-10, 0]` with no child to wait for.
 */
declare function waitPid(pid: i32, flags: i32): i32[];
/**
 * How many CPUs the program may use, with or without `--threads`.
 * Capability: none.
 *
 * @returns at least 1.
 */
declare function availableParallelism(): i32;
/**
 * Bytes of physical memory. Capability: none.
 *
 * @returns the byte count, or -1 when the host does not say.
 */
declare function totalMemory(): i64;
/**
 * Set this process's nice value to `n`. Lower-only, even as root. Children
 * started afterwards inherit it. Throws under Node.
 * Capability: process.spawn.
 *
 * @param n the nice value, 0..19.
 * @returns 0, or a negative errno: `n` outside 0..19 is -22 (EINVAL), and `n`
 *   below the current value is -13 (EACCES), both with no system call.
 */
declare function setNice(n: i32): i32;
/**
 * Move this process to `SCHED_IDLE`, which runs it only when nothing else wants
 * the CPU. An unprivileged process can never leave `SCHED_IDLE` again, and an
 * idle process can starve on a saturated machine, so a caller keeps a
 * normal-priority fallback for work that must finish. Throws under Node.
 * Capability: process.spawn.
 *
 * @returns 0, or a negative errno, and -95 where the host has no such policy
 *   (Darwin).
 */
declare function setIdlePriority(): i32;
/**
 * Pin this process to CPU `cpu` alone (`sched_setaffinity`). Narrow-only.
 * Capability: process.spawn.
 *
 * @param cpu the CPU index.
 * @returns 0, or a negative errno: a CPU outside the mask the process already
 *   has (an operator's `taskset` or cpuset), a negative one, or one past the
 *   kernel's set size is -22 with no system call; -95 where the host has no
 *   affinity call (Darwin, and under Node).
 */
declare function setCpuAffinity(cpu: i32): i32;
/**
 * One environment variable. Capability: env.
 *
 * @param name the variable's name.
 * @returns its value, or `null` when it is unset (an empty value is a set
 *   variable).
 */
declare function getenv(name: string): string | null;
/**
 * A monotonic clock in nanoseconds, for timing a region of a program. The
 * origin is arbitrary, so only the difference between two reads is meaningful.
 * Capability: clock.
 *
 * @returns nanoseconds since an arbitrary origin.
 */
declare function monotonicNanos(): i64;
/**
 * The wall clock in nanoseconds since the Unix epoch, for dating an event. It
 * steps when the system time is set, so a duration is `monotonicNanos`'s.
 * Capability: clock.
 *
 * @returns nanoseconds since the epoch.
 */
declare function wallClockNanos(): i64;
/**
 * The modification time of `path`, with the sub-millisecond fraction the file
 * system keeps (Node's `mtimeMs`). Follows a symbolic link; a directory has
 * one too. Capability: clock.
 *
 * @param path the file to stat.
 * @returns milliseconds since the epoch, or NaN when it cannot be stat'd.
 */
declare function statMtimeSync(path: string): f64;
/**
 * A descriptor that becomes readable when SIGTERM or SIGINT arrives, whichever
 * thread the signal lands on, made once (every call answers the same one).
 * Capability: signal.
 *
 * @returns the descriptor, or -1.
 */
declare function signalFd(): i32;
/**
 * Block until SIGTERM or SIGINT arrives. No reading under Node, which throws.
 * Capability: signal.
 *
 * @param fd `signalFd()`'s descriptor.
 * @returns the signal's number, 15 or 2; -1 for any `fd` that is not
 *   `signalFd()`'s.
 */
declare function readSignal(fd: i32): i32;

// ---- `nish:net` (WP34 N5) --------------------------------------------------------
//
// Every call answers an `i32`: `>= 0` on success, a negative errno otherwise, in
// Linux's numbering on every platform for -11 (would block), -95, -32, -104,
// -98, -111 (refused), -110 (timed out) and -22. An address is 18 bytes of a
// `u8[]`: 16 of IPv6 address (IPv4 as `::ffff:a.b.c.d`), then the port,
// big-endian. Every socket is non-blocking and close-on-exec. No reading under
// Node, where each throws. Every function needs the `net` capability; the
// `NET_*` constants are numbers and need none.

/**
 * Write the address form of a numeric `host` and `port` into `out`.
 * Capability: net.
 *
 * @param out at least 18 bytes, receiving the address.
 * @param host a numeric IPv4 or IPv6 address.
 * @param port the port.
 * @returns 0, or -22.
 */
declare function netAddress(out: u8[], host: string, port: i32): i32;
/**
 * The port the socket `fd` is bound to. Capability: net.
 *
 * @param fd a bound socket.
 * @returns the port, or a negative errno.
 */
declare function netLocalPort(fd: i32): i32;
/**
 * A listening TCP socket with `SO_REUSEADDR`; `"::"` hears IPv4 and IPv6.
 * Capability: net.
 *
 * @param host the numeric address to bind.
 * @param port the port, 0 for any.
 * @param backlog the kernel's queue of unaccepted connections.
 * @returns the listener's descriptor, or a negative errno.
 */
declare function tcpListen(host: string, port: i32, backlog: i32): i32;
/**
 * `tcpListen`'s socket, with `SO_REUSEPORT` for flag 1 and `TCP_NODELAY` on
 * each accepted socket for flag 2. Flag 4, with flag 1, steers by CPU: a new
 * connection goes to the group's listener whose bind order is the index of the
 * CPU that received it (Linux; -95 elsewhere). Capability: net.
 *
 * @param host the numeric address to bind.
 * @param port the port, 0 for any.
 * @param backlog the kernel's queue of unaccepted connections.
 * @param flags 1, 2 and 4 as above; any other bit, or 4 without 1, is -22.
 * @returns the listener's descriptor, or a negative errno.
 */
declare function tcpListenFlags(host: string, port: i32, backlog: i32, flags: i32): i32;
/**
 * The next connection on a listener. Capability: net.
 *
 * @param fd the listener.
 * @param peer at least 18 bytes, receiving the peer's address.
 * @returns the connection's descriptor; -11 when none waits.
 */
declare function tcpAccept(fd: i32, peer: u8[]): i32;
/**
 * Up to `len` bytes into `buf` from `off`. Capability: net.
 *
 * @param fd the socket to read.
 * @param buf the buffer filled.
 * @param off the first byte of `buf` written.
 * @param len the most bytes read.
 * @returns the count, 0 at end of stream, or -11.
 */
declare function netRead(fd: i32, buf: u8[], off: i32, len: i32): i32;
/**
 * Up to `len` bytes of `buf` from `off`. A gone peer is -32, never SIGPIPE.
 * Capability: net.
 *
 * @param fd the socket to write.
 * @param buf the bytes sent.
 * @param off the first byte sent.
 * @param len the most bytes sent.
 * @returns the count, or a negative errno.
 */
declare function netWrite(fd: i32, buf: readonly u8[], off: i32, len: i32): i32;
/**
 * `netWrite` of `a`'s range then `b`'s, in one system call. Capability: net.
 *
 * @param fd the socket to write.
 * @param a the first buffer.
 * @param aOff the first byte of `a` sent.
 * @param aLen how many bytes of `a`.
 * @param b the second buffer.
 * @param bOff the first byte of `b` sent.
 * @param bLen how many bytes of `b`.
 * @returns the count of both, at most `aLen + bLen`, or a negative errno.
 */
declare function netWrite2(
  fd: i32,
  a: readonly u8[],
  aOff: i32,
  aLen: i32,
  b: readonly u8[],
  bOff: i32,
  bLen: i32
): i32;
/**
 * Shut one or both directions of a connection. Capability: net.
 *
 * @param fd the socket.
 * @param how the read side (0), the write side (1) or both (2).
 * @returns 0, or a negative errno.
 */
declare function netShutdown(fd: i32, how: i32): i32;
/**
 * Close the descriptor. Capability: net.
 *
 * @param fd the descriptor closed.
 * @returns 0, or a negative errno.
 */
declare function netClose(fd: i32): i32;
/**
 * A TCP socket connecting to `addr`, answered while it connects: writable once
 * it has, or has failed. It holds `TCP_NODELAY`, so a small write is sent at
 * once. Capability: net.
 *
 * @param addr the 18-byte address to connect to.
 * @returns the socket's descriptor, or a negative errno.
 */
declare function tcpConnect(addr: readonly u8[]): i32;
/**
 * The outcome of a `tcpConnect`, once `fd` is writable. Capability: net.
 *
 * @param fd the connecting socket.
 * @returns 0 when the connection is made, else its failure (-111 refused).
 */
declare function connectResult(fd: i32): i32;
/**
 * A UDP socket; ECN is always read. Capability: net.
 *
 * @param host the numeric address to bind.
 * @param port the port, 0 for any.
 * @param flags flag 1 `SO_REUSEPORT`, flag 2 `UDP_GRO` (-95 on Darwin).
 * @returns the socket's descriptor, or a negative errno.
 */
declare function udpBind(host: string, port: i32, flags: i32): i32;
/**
 * `buf[off, off + len)` to `to`, cut into `segment`-byte datagrams when
 * `segment > 0`, with ECN bits `ecn`. Capability: net.
 *
 * @param fd the UDP socket.
 * @param buf the bytes sent.
 * @param off the first byte sent.
 * @param len how many bytes.
 * @param to the 18-byte destination address.
 * @param segment the datagram size, or 0 for one datagram.
 * @param ecn the ECN bits.
 * @returns the count, or a negative errno.
 */
declare function udpSendTo(
  fd: i32,
  buf: readonly u8[],
  off: i32,
  len: i32,
  to: readonly u8[],
  segment: i32,
  ecn: i32
): i32;
/**
 * One datagram, or several GRO coalesced, into `buf[off, off + len)`.
 * Capability: net.
 *
 * @param fd the UDP socket.
 * @param buf the buffer filled.
 * @param off the first byte of `buf` written.
 * @param len the most bytes read.
 * @param from at least 18 bytes, receiving the sender.
 * @param meta receives [segment size, ECN].
 * @returns the count, or a negative errno.
 */
declare function udpRecvFrom(fd: i32, buf: u8[], off: i32, len: i32, from: u8[], meta: i32[]): i32;
/**
 * A readiness loop, level-triggered: epoll on Linux, kqueue on Darwin.
 * Capability: net.
 *
 * @returns the loop's descriptor, or a negative errno.
 */
declare function pollCreate(): i32;
/**
 * Watch `fd` for `events` under `token`. Capability: net.
 *
 * @param loop the loop from `pollCreate`.
 * @param fd the descriptor watched.
 * @param events 1 readable, 2 writable.
 * @param token the number `pollWait` reports it under.
 * @returns 0, or a negative errno.
 */
declare function pollAdd(loop: i32, fd: i32, events: i32, token: i32): i32;
/**
 * New events or a new token for a watched `fd`. Capability: net.
 *
 * @param loop the loop from `pollCreate`.
 * @param fd the descriptor watched.
 * @param events 1 readable, 2 writable.
 * @param token the number `pollWait` reports it under.
 * @returns 0, or a negative errno.
 */
declare function pollModify(loop: i32, fd: i32, events: i32, token: i32): i32;
/**
 * Stop watching `fd`. Capability: net.
 *
 * @param loop the loop from `pollCreate`.
 * @param fd the descriptor no longer watched.
 * @returns 0, or a negative errno.
 */
declare function pollRemove(loop: i32, fd: i32): i32;
/**
 * Wait for readiness, filling pairs: `ready[2k]` token, `ready[2k + 1]`
 * events (4: hang-up or error). Capability: net.
 *
 * @param loop the loop from `pollCreate`.
 * @param ready receives the pairs.
 * @param timeoutMs the most milliseconds to wait; negative: forever.
 * @returns how many pairs, or a negative errno.
 */
declare function pollWait(loop: i32, ready: i32[], timeoutMs: i32): i32;
/**
 * Set one socket option from a whitelist: there is no raw level and option
 * number. Capability: net.
 *
 * @param fd the socket.
 * @param option one of the `NET_*` ids below; any other is -22.
 * @param value the option's value.
 * @returns 0, or a negative errno (-9 a closed descriptor, -88 not a socket).
 */
declare function netSetOption(fd: i32, option: i32, value: i32): i32;
/**
 * A connected TCP socket's send MSS, the payload bytes one segment carries.
 * Capability: net.
 *
 * @param fd the socket.
 * @returns the MSS; -1, never an errno, for anything else, and always on
 *   wasm.
 */
declare function netMss(fd: i32): i32;
/** `TCP_NODELAY`: `value` 1 sends a small write at once, 0 lets Nagle batch it. Capability: none. */
declare const NET_TCP_NODELAY: i32;
/**
 * `TCP_QUICKACK` (Linux; -95 elsewhere): `value` 1 acknowledges at once, 0
 * delays. Linux does not keep quick-ACK mode: the kernel leaves it on its own,
 * so a server that wants a mode sets it again after every response.
 * Capability: none.
 */
declare const NET_TCP_QUICKACK: i32;
/** `SO_KEEPALIVE`: `value` 1 probes an idle connection, 0 does not. Capability: none. */
declare const NET_SO_KEEPALIVE: i32;
/** `SO_SNDBUF`: the send buffer, `value` in bytes; Linux doubles the value it stores. Capability: none. */
declare const NET_SO_SNDBUF: i32;
/** `SO_RCVBUF`: the receive buffer, `value` in bytes; Linux doubles the value it stores. Capability: none. */
declare const NET_SO_RCVBUF: i32;
/**
 * A listening Unix stream socket at `path` (`@name`: Linux's abstract
 * namespace), its file mode 0600. Capability: net.
 *
 * @param path the socket file, or `@name`.
 * @param backlog the kernel's queue of unaccepted connections.
 * @param flags 0, or `NET_UNIX_UNLINK_STALE`.
 * @returns the listener's descriptor, or a negative errno: a path that exists
 *   is -98, unless `flags` holds `NET_UNIX_UNLINK_STALE`; -36 a path too long,
 *   -22 an empty one.
 */
declare function unixListen(path: string, backlog: i32, flags: i32): i32;
/**
 * `unixListen` with the socket file's mode chosen. Capability: net.
 *
 * @param path the socket file.
 * @param backlog the kernel's queue of unaccepted connections.
 * @param flags 0, or `NET_UNIX_UNLINK_STALE`.
 * @param mode the file's mode, 0 to 0o777.
 * @returns the listener's descriptor, or a negative errno; -22 for an
 *   `@name`.
 */
declare function unixListenMode(path: string, backlog: i32, flags: i32, mode: i32): i32;
/**
 * A non-blocking socket connected to the listener at `path`. Capability: net.
 *
 * @param path the socket file, or `@name`.
 * @returns the socket's descriptor, or a negative errno: -11 a full backlog on
 *   Linux (-111 on Darwin), -111 nothing listening.
 */
declare function unixConnect(path: string): i32;
/**
 * The next connection on a Unix listener, non-blocking. Capability: net.
 *
 * @param fd the listener.
 * @returns the connection's descriptor; -11 when none is waiting.
 */
declare function unixAccept(fd: i32): i32;
/**
 * Two connected sockets into `fds[0]` and `fds[1]`. Capability: net.
 *
 * @param kind `NET_UNIX_STREAM` or `NET_UNIX_SEQPACKET` (-95 on Darwin).
 * @param fds at least 2 slots, receiving the pair.
 * @returns 0; -22 another kind or an `fds` shorter than 2.
 */
declare function unixSocketPair(kind: i32, fds: i32[]): i32;
/**
 * Send `buf[off..off+len)` over the Unix socket `sock` with a copy of the
 * descriptor `fd` (`SCM_RIGHTS`). A stream socket can send short: the
 * descriptor travels with the first bytes, so send the rest with `netWrite`.
 * Capability: net.
 *
 * @param sock the Unix socket.
 * @param fd the descriptor sent.
 * @param buf the bytes sent with it.
 * @param off the first byte sent.
 * @param len how many bytes, at least 1.
 * @returns the bytes sent, or a negative errno; -22 a zero `len` or a
 *   negative `fd`, -9 a closed `sock` or `fd`, -88 a `sock` that is not a
 *   socket, -95 one that is not Unix.
 */
declare function sendFd(sock: i32, fd: i32, buf: readonly u8[], off: i32, len: i32): i32;
/**
 * Read at most `len` bytes into `buf[off..]` from the Unix socket `sock`, and
 * the first descriptor that came with them into `fd[0]`, or -1. Every other
 * descriptor in the message is closed; the one kept is close-on-exec and keeps
 * the sender's blocking mode. Capability: net.
 *
 * @param sock the Unix socket.
 * @param buf the buffer filled.
 * @param off the first byte of `buf` written.
 * @param len the most bytes read, at least 1.
 * @param fd receives the descriptor, or -1.
 * @returns the bytes read, or a negative errno; -22 a zero `len` or an empty
 *   `fd`, -9 a closed `sock`, -88 not a socket, -95 not Unix.
 */
declare function recvFd(sock: i32, buf: u8[], off: i32, len: i32, fd: i32[]): i32;
/**
 * The peer of the Unix socket `fd` as of its connect: `out` gets its pid, uid
 * and gid; the pid is -1 where Darwin has no `LOCAL_PEERPID`. A uid or gid of
 * 2^31 or above wraps (-2 is uid 4294967294). Capability: net.
 *
 * @param fd the connected Unix socket.
 * @param out at least 3 slots, receiving pid, uid and gid.
 * @returns 0; -22 an `out` shorter than 3, -9 a closed `fd`, -88 not a
 *   socket, -95 not Unix, -107 a socket with no peer (a listener, or one never
 *   connected).
 */
declare function peerCredentials(fd: i32, out: i32[]): i32;
/** `unixListen` flag: unlink a socket file nothing listens on, then bind. Capability: none. */
declare const NET_UNIX_UNLINK_STALE: i32;
/** `unixSocketPair` kind: a byte stream. Capability: none. */
declare const NET_UNIX_STREAM: i32;
/** `unixSocketPair` kind: each write one message (`SOCK_SEQPACKET`). Capability: none. */
declare const NET_UNIX_SEQPACKET: i32;

// ---- `nish:term` ------------------------------------------------------------------
//
// stdin without blocking and the terminal it may be: the frame clock and the
// keys of a terminal UI, with no `net` capability. -11 is "nothing is
// waiting" and -25 "not a terminal" on every platform; any other failure is
// the host's `-errno`. Under WASI the reading works, `readStdin` waiting for
// its bytes (ask `waitStdin` first), and the terminal answers -25. Under Node `isTerminal` and `terminalSize` answer and the other four
// throw.

/**
 * Up to `len` bytes of stdin into `buf` from `off`, never blocking.
 * Capability: tty.
 *
 * @param buf the buffer filled.
 * @param off the first byte of `buf` written.
 * @param len the most bytes read.
 * @returns the count, 0 at end of stream, or -11 when nothing is waiting.
 */
declare function readStdin(buf: u8[], off: i32, len: i32): i32;
/**
 * Wait for stdin to be readable (its end and an error count). Capability: tty.
 *
 * @param timeoutMs the most milliseconds to wait; negative: forever.
 * @returns `true` when it is readable, `false` when the time passed.
 */
declare function waitStdin(timeoutMs: i32): boolean;
/**
 * Whether descriptor `fd` is a terminal (`isatty`). Capability: tty.
 *
 * @param fd the descriptor asked about.
 * @returns whether it is a terminal.
 */
declare function isTerminal(fd: i32): boolean;
/**
 * The size of the terminal on stdout, else stderr. Capability: tty.
 *
 * @returns `[columns, rows]`; `[-25, 0]` when neither is one, `[0, 0]` when it
 *   has no size set.
 */
declare function terminalSize(): i32[];
/**
 * Raw mode on stdin's terminal, or the mode it had back. No echo, no line
 * editing; Ctrl-C stays SIGINT and "\n" still starts a line. The terminal is
 * put back at exit, on a panic and on every signal that ends the program,
 * SIGKILL aside. Capability: tty.
 *
 * @param on `true` for raw mode, `false` for the mode before.
 * @returns 0, -25 when stdin is not a terminal.
 */
declare function setRawMode(on: boolean): i32;
/**
 * Bytes the runtime writes to the terminal on stdout at exit, on a panic and
 * on every signal that ends the program (SIGKILL aside), before termios is
 * restored. Replaces the previous string; "" clears it. The cap is 4096
 * bytes. Capability: tty.
 *
 * @param bytes the bytes written at the end.
 * @returns 0, -25 when stdout is not a terminal, -7 (E2BIG) past
 *   NISH_TERM_RESTORE_MAX bytes.
 */
declare function setTerminalRestore(bytes: string): i32;

// ---- `Date` and `crypto` (WP34 N3) -----------------------------------------------
//
// `lib.es2022` already declares `Date`, whose `now()` is Nish's one member of it,
// so nothing is added: `tsc` accepting `new Date()` is `tsc` not being Nish's
// checker. `crypto` is a Web API that `lib.es2022` leaves out, so it is
// declared with its one member, typed as Nish types it.

/** The system's random source, with its one member. */
declare var crypto: {
  /**
   * Every byte of `bytes` from the system's CSPRNG; at most 65,536 bytes a
   * call. Capability: entropy.
   *
   * @param bytes the buffer filled.
   */
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

// Every negative errno a file call answers is the platform's own, untranslated:
// the numbers shown here are Linux's (-2 ENOENT, -17 EEXIST, -18 EXDEV, -22
// EINVAL, -40 ELOOP), and Darwin's differ (ELOOP is -62 there).
declare module "nish:fs" {
  export function readFileSync(path: string): string;
  export function readFileSyncOrNull(path: string): string | null;
  export function readFileBytesSync(path: string): u8[] | null;
  /** Refuses a symbolic link as the last component of the path, as the global does. */
  export function writeFileSync(path: string, data: string): void;
  /** Refuses a symbolic link as the last component of the path, as the global does. */
  export function appendFileSync(path: string, data: string): void;
  /** The byte count, or a negative errno; refuses a symbolic link as `writeFileSync` does. */
  export function writeFileBytesSync(path: string, bytes: readonly u8[]): i32;
  /** 0, or a negative errno: -18 across file systems. */
  export function renameSync(from: string, to: string): i32;
  /** 0, or a negative errno: a directory is refused, not removed. */
  export function unlinkSync(path: string): i32;
  /** The byte count, or a negative errno; the file is exactly `mode` (0..0o777) before it holds a byte, a link refused, written in place. */
  export function writeFileSyncMode(path: string, data: string, mode: i32): i32;
  /** As `writeFileSyncMode`, but -17 when anything is at `path`: one racer wins; a failed write removes the file. */
  export function createFileExclusiveSync(path: string, data: string, mode: i32): i32;
  /** 0, or a negative errno: -17 for a path already there, whose mode is left alone. */
  export function mkdirSyncMode(path: string, mode: i32): i32;
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
   * The same run with `stdin` written to the child and its stdout and stderr
   * appended to the two arrays: the status, or -2 past 16 MiB on a stream.
   */
  export function spawnPiped(argv: string[], stdin: readonly u8[], stdout: u8[], stderr: u8[]): i32;
  /** Start a child without waiting: its pid, or a negative errno. */
  export function spawn(argv: string[]): i32;
  /**
   * `spawn` with the child holding `fds[i]` as descriptor `3 + i`: its pid, or
   * a negative errno; -22 more than 64 descriptors or a negative one, -9 one
   * that is not open, -24 (or -22 above the descriptor limit) a scratch
   * descriptor the system cannot give.
   */
  export function spawnWithFds(argv: string[], fds: readonly i32[]): i32;
  /** Send 0, 2, 9 or 15 to `pid`: 0, or a negative errno; any other signal is -22. */
  export function kill(pid: i32, sig: i32): i32;
  /** `[pid, status]` for a child that exited, `[0, 0]` under WNOHANG (flag 1) with none, or `[-errno, 0]`. */
  export function waitPid(pid: i32, flags: i32): i32[];
  /** How many CPUs the program may use, at least 1. */
  export function availableParallelism(): i32;
  /** Bytes of physical memory, or -1. */
  export function totalMemory(): i64;
  /** Set this process's nice value, 0..19 only: 0, -22 outside it, or -13 below the current value (lower-only, even as root). */
  export function setNice(n: i32): i32;
  /**
   * Move this process to `SCHED_IDLE`: 0, a negative errno, or -95 off Linux.
   * An unprivileged process can never leave it, and an idle process can starve
   * on a saturated machine, so a caller keeps a normal-priority fallback.
   */
  export function setIdlePriority(): i32;
  /** Pin this process to CPU `cpu` alone: 0, -22 for a CPU outside the current mask (narrow-only), or -95 off Linux. */
  export function setCpuAffinity(cpu: i32): i32;
  /**
   * A monotonic clock in nanoseconds. The origin is arbitrary, so only the
   * difference between two reads is meaningful.
   */
  export function monotonicNanos(): i64;
  /** The wall clock in nanoseconds since the Unix epoch; it steps when the system time is set. */
  export function wallClockNanos(): i64;
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
  /**
   * `tcpListen`'s socket, with `SO_REUSEPORT` for flag 1 and `TCP_NODELAY` on
   * each accepted socket for flag 2. Flag 4, with flag 1, steers by CPU: a new
   * connection goes to the group's listener whose bind order is the index of the
   * CPU that received it (Linux; -95 elsewhere). Any other bit, or 4 without 1,
   * is -22.
   */
  export function tcpListenFlags(host: string, port: i32, backlog: i32, flags: i32): i32;
  /** The next connection's descriptor, its address in `peer`; -11 when none waits. */
  export function tcpAccept(fd: i32, peer: u8[]): i32;
  /** Up to `len` bytes into `buf` from `off`: the count, 0 at end of stream, or -11. */
  export function netRead(fd: i32, buf: u8[], off: i32, len: i32): i32;
  /** Up to `len` bytes of `buf` from `off`: the count; a gone peer is -32, never SIGPIPE. */
  export function netWrite(fd: i32, buf: readonly u8[], off: i32, len: i32): i32;
  /** `netWrite` of `a`'s range then `b`'s, in one system call: the count of both, at most `aLen + bLen`. */
  export function netWrite2(
    fd: i32,
    a: readonly u8[],
    aOff: i32,
    aLen: i32,
    b: readonly u8[],
    bOff: i32,
    bLen: i32
  ): i32;
  /** Shut the read side (0), the write side (1) or both (2). */
  export function netShutdown(fd: i32, how: i32): i32;
  export function netClose(fd: i32): i32;
  /** A TCP socket connecting to `addr`, answered while it connects: writable once it has, or has failed. It holds `TCP_NODELAY`, so a small write is sent at once. */
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
  /**
   * Set one socket option from a whitelist: `option` is one of the `NET_*` ids
   * below, and any other is -22; there is no raw level and option number. 0, or
   * a negative errno (-9 a closed descriptor, -88 not a socket).
   */
  export function netSetOption(fd: i32, option: i32, value: i32): i32;
  /**
   * A connected TCP socket's send MSS, the payload bytes one segment carries;
   * -1, never an errno, for anything else, and always on wasm.
   */
  export function netMss(fd: i32): i32;
  /** `TCP_NODELAY`: `value` 1 sends a small write at once, 0 lets Nagle batch it. */
  export const NET_TCP_NODELAY: i32;
  /**
   * `TCP_QUICKACK` (Linux; -95 elsewhere): `value` 1 acknowledges at once, 0
   * delays. Linux does not keep quick-ACK mode: the kernel leaves it on its own,
   * so a server that wants a mode sets it again after every response.
   */
  export const NET_TCP_QUICKACK: i32;
  /** `SO_KEEPALIVE`: `value` 1 probes an idle connection, 0 does not. */
  export const NET_SO_KEEPALIVE: i32;
  /** `SO_SNDBUF`: the send buffer, `value` in bytes; Linux doubles the value it stores. */
  export const NET_SO_SNDBUF: i32;
  /** `SO_RCVBUF`: the receive buffer, `value` in bytes; Linux doubles the value it stores. */
  export const NET_SO_RCVBUF: i32;
  /**
   * A listening Unix stream socket at `path` (`@name`: Linux's abstract
   * namespace), its file mode 0600. A path that exists is -98, unless `flags`
   * holds `NET_UNIX_UNLINK_STALE`; -36 a path too long, -22 an empty one.
   */
  export function unixListen(path: string, backlog: i32, flags: i32): i32;
  /** `unixListen` with the socket file's mode chosen (0 to 0o777); -22 for an `@name`. */
  export function unixListenMode(path: string, backlog: i32, flags: i32, mode: i32): i32;
  /** A non-blocking socket connected to the listener at `path`; -11 a full backlog on Linux (-111 on Darwin), -111 nothing listening. */
  export function unixConnect(path: string): i32;
  /** The next connection on a Unix listener, non-blocking; -11 when none is waiting. */
  export function unixAccept(fd: i32): i32;
  /**
   * Two connected sockets into `fds[0]` and `fds[1]`, and 0: `kind` is
   * `NET_UNIX_STREAM` or `NET_UNIX_SEQPACKET` (-95 on Darwin); -22 another kind
   * or an `fds` shorter than 2.
   */
  export function unixSocketPair(kind: i32, fds: i32[]): i32;
  /**
   * Send `buf[off..off+len)` over the Unix socket `sock` with a copy of the
   * descriptor `fd` (`SCM_RIGHTS`): the bytes sent, or a negative errno; -22 a
   * zero `len` or a negative `fd`, -9 a closed `sock` or `fd`, -88 a `sock`
   * that is not a socket, -95 one that is not Unix. A stream socket can send
   * short: the descriptor travels with the first bytes, so send the rest with
   * `netWrite`.
   */
  export function sendFd(sock: i32, fd: i32, buf: readonly u8[], off: i32, len: i32): i32;
  /**
   * Read at most `len` bytes into `buf[off..]` from the Unix socket `sock`, and
   * the first descriptor that came with them into `fd[0]`, or -1: the bytes read,
   * or a negative errno. Every other descriptor in the message is closed; the
   * one kept is close-on-exec and keeps the sender's blocking mode. -22 a zero
   * `len` or an empty `fd`, -9 a closed `sock`, -88 not a socket, -95 not
   * Unix.
   */
  export function recvFd(sock: i32, buf: u8[], off: i32, len: i32, fd: i32[]): i32;
  /**
   * The peer of the Unix socket `fd` as of its connect: `out` gets its pid, uid
   * and gid, and the answer is 0; the pid is -1 where Darwin has no
   * `LOCAL_PEERPID`. A uid or gid of 2^31 or above wraps (-2 is uid
   * 4294967294). -22 an `out` shorter than 3, -9 a closed `fd`, -88 not a
   * socket, -95 not Unix, -107 a socket with no peer (a listener, or one never
   * connected).
   */
  export function peerCredentials(fd: i32, out: i32[]): i32;
  /** `unixListen` flag: unlink a socket file nothing listens on, then bind. */
  export const NET_UNIX_UNLINK_STALE: i32;
  /** `unixSocketPair` kind: a byte stream. */
  export const NET_UNIX_STREAM: i32;
  /** `unixSocketPair` kind: each write one message (`SOCK_SEQPACKET`). */
  export const NET_UNIX_SEQPACKET: i32;
}

declare module "nish:unsafe" {
  /** `xs[i]` with no bounds check: undefined behaviour when `i` is out of range. */
  export function uncheckedGet<T extends number>(xs: readonly T[], i: i32): T;
  /** `xs[i] = v` with no bounds check: undefined behaviour when `i` is out of range. */
  export function uncheckedSet<T extends number>(xs: T[], i: i32, v: T): void;
  /** `a + b` wrapped to the operands' width, `i32` or `i64`. */
  export function wrappingAdd<T extends i32 | i64>(a: T, b: T): T;
  /** `a - b` wrapped to the operands' width. */
  export function wrappingSub<T extends i32 | i64>(a: T, b: T): T;
  /** `a * b` wrapped to the operands' width. */
  export function wrappingMul<T extends i32 | i64>(a: T, b: T): T;
  /** The `NUL`-terminated bytes at `p`, copied into a string: undefined behaviour unless `p` is a live C string. */
  export function readCString(p: CPtr): string;
}

// `nish:simd` (docs/LANGUAGE.md -> Vectors): the six sixteen-byte vector
// types and the calls that make, load, store and take one apart. Under Node,
// `runtime/nish.mjs` answers the import with `runtime/core.mjs`'s names.
declare module "nish:simd" {
  /**
   * A sixteen-byte vector of lanes. Opaque: TypeScript refuses `+` on one, as
   * `nish` does, but lets `===` and `<` through, which `nish` refuses. Under
   * Node it is a typed array made once and never written after.
   */
  export interface u8x16 { readonly __nishSimd: "u8x16"; readonly __lane: u8; readonly __mask: mask8x16 }
  export interface u16x8 { readonly __nishSimd: "u16x8"; readonly __lane: u16; readonly __mask: mask16x8 }
  export interface i32x4 { readonly __nishSimd: "i32x4"; readonly __lane: i32; readonly __mask: mask32x4 }
  export interface u32x4 { readonly __nishSimd: "u32x4"; readonly __lane: u32; readonly __mask: mask32x4 }
  export interface f32x4 { readonly __nishSimd: "f32x4"; readonly __lane: f32; readonly __mask: mask32x4 }
  export interface f64x2 { readonly __nishSimd: "f64x2"; readonly __lane: f64; readonly __mask: mask64x2 }
  /** Any of the six. */
  export type SimdVector = u8x16 | u16x8 | i32x4 | u32x4 | f32x4 | f64x2;
  /** The four with integer lanes. */
  export type IntegerVector = u8x16 | u16x8 | i32x4 | u32x4;
  /** The two with float lanes. */
  export type FloatVector = f32x4 | f64x2;
  /**
   * One boolean per lane, which a lane-wise compare answers. Under Node an
   * array of booleans. `nish` keeps a mask in a local, a parameter or a
   * return of a function the module keeps, and nowhere else; it has no
   * constructor.
   */
  export interface mask8x16 { readonly __nishMask: "mask8x16" }
  export interface mask16x8 { readonly __nishMask: "mask16x8" }
  export interface mask32x4 { readonly __nishMask: "mask32x4" }
  export interface mask64x2 { readonly __nishMask: "mask64x2" }
  /** Any of the four. */
  export type SimdMask = mask8x16 | mask16x8 | mask32x4 | mask64x2;
  /** One value per lane, lane 0 first. */
  export function u8x16(
    a0: u8, a1: u8, a2: u8, a3: u8, a4: u8, a5: u8, a6: u8, a7: u8,
    a8: u8, a9: u8, a10: u8, a11: u8, a12: u8, a13: u8, a14: u8, a15: u8
  ): u8x16;
  export function u16x8(a0: u16, a1: u16, a2: u16, a3: u16, a4: u16, a5: u16, a6: u16, a7: u16): u16x8;
  export function i32x4(a0: i32, a1: i32, a2: i32, a3: i32): i32x4;
  export function u32x4(a0: u32, a1: u32, a2: u32, a3: u32): u32x4;
  export function f32x4(a0: f32, a1: f32, a2: f32, a3: f32): f32x4;
  export function f64x2(a0: f64, a1: f64): f64x2;
  /** `x` in every lane. */
  export function splatU8x16(x: u8): u8x16;
  export function splatU16x8(x: u16): u16x8;
  export function splatI32x4(x: i32): i32x4;
  export function splatU32x4(x: u32): u32x4;
  export function splatF32x4(x: f32): f32x4;
  export function splatF64x2(x: f64): f64x2;
  /** `xs[i]` to `xs[i + N - 1]`, bounds-checked once for the whole vector. */
  export function loadU8x16(xs: readonly u8[], i: i32): u8x16;
  export function loadU16x8(xs: readonly u16[], i: i32): u16x8;
  export function loadI32x4(xs: readonly i32[], i: i32): i32x4;
  export function loadU32x4(xs: readonly u32[], i: i32): u32x4;
  export function loadF32x4(xs: readonly f32[], i: i32): f32x4;
  export function loadF64x2(xs: readonly f64[], i: i32): f64x2;
  /** The lanes of `v` into `xs[i]` to `xs[i + N - 1]`, checked once. */
  export function store<V extends SimdVector>(v: V, xs: V["__lane"][], i: i32): void;
  /** Lane `k`, an integer literal in range. */
  export function extract<V extends SimdVector>(v: V, k: i32): V["__lane"];
  /** A new vector: `v` with lane `k` set to `x`. */
  export function replace<V extends SimdVector>(v: V, k: i32, x: V["__lane"]): V;
  /** Float lane arithmetic, lane by lane. An integer lane's form wraps. */
  export function add<V extends FloatVector>(a: V, b: V): V;
  export function sub<V extends FloatVector>(a: V, b: V): V;
  export function mul<V extends FloatVector>(a: V, b: V): V;
  export function div<V extends FloatVector>(a: V, b: V): V;
  export function sqrt<V extends FloatVector>(a: V): V;
  /** Integer lane arithmetic, wrapping at the lane width. */
  export function addWrapping<V extends IntegerVector>(a: V, b: V): V;
  export function subWrapping<V extends IntegerVector>(a: V, b: V): V;
  export function mulWrapping<V extends IntegerVector>(a: V, b: V): V;
  /** Negation and absolute value of float lanes: the sign bit. */
  export function neg<V extends FloatVector>(a: V): V;
  export function abs<V extends FloatVector>(a: V): V;
  /** The lesser and the greater lane: a float NaN lane answers NaN. */
  export function min<V extends SimdVector>(a: V, b: V): V;
  export function max<V extends SimdVector>(a: V, b: V): V;
  /** Bitwise, on integer lanes or lane by lane on two masks. */
  export function and<V extends IntegerVector | SimdMask>(a: V, b: V): V;
  export function or<V extends IntegerVector | SimdMask>(a: V, b: V): V;
  export function xor<V extends IntegerVector | SimdMask>(a: V, b: V): V;
  export function not<V extends IntegerVector | SimdMask>(a: V): V;
  /** Lane-wise compares, answering the vector's mask. A float compare is ordered (`ne` unordered). */
  export function eq<V extends SimdVector>(a: V, b: V): V["__mask"];
  export function ne<V extends SimdVector>(a: V, b: V): V["__mask"];
  export function lt<V extends SimdVector>(a: V, b: V): V["__mask"];
  export function le<V extends SimdVector>(a: V, b: V): V["__mask"];
  export function gt<V extends SimdVector>(a: V, b: V): V["__mask"];
  export function ge<V extends SimdVector>(a: V, b: V): V["__mask"];
  /** Lane `k` of `a` where lane `k` of `m` is set, else of `b`. */
  export function select<V extends SimdVector>(m: V["__mask"], a: V, b: V): V;
  /** Whether any lane, or every lane, is set. */
  export function any(m: SimdMask): boolean;
  export function all(m: SimdMask): boolean;
  /** Lane `k`'s flag in bit `k`. */
  export function bitmask(m: SimdMask): i32;
  /**
   * The lanes added: a `u8x16` or `u16x8` in an `i32`, a float vector in lane
   * order. An `i32x4` or `u32x4` total is `sumWrapping`.
   */
  export function sum(v: u8x16 | u16x8): i32;
  export function sum(v: f32x4): f32;
  export function sum(v: f64x2): f64;
  export function sumWrapping(v: i32x4): i32;
  export function sumWrapping(v: u32x4): u32;
  /** Lanes picked from `a` then `b` by integer-literal indices, one per lane. */
  export function shuffle<V extends SimdVector>(a: V, b: V, ...lanes: i32[]): V;
  /**
   * Shifts and rotates by an integer-literal count below the lane width:
   * `shr` is logical on an unsigned lane and arithmetic on an `i32` lane.
   */
  export function shl<V extends IntegerVector>(v: V, count: i32): V;
  export function shr<V extends IntegerVector>(v: V, count: i32): V;
  export function rotl<V extends IntegerVector>(v: V, count: i32): V;
  export function rotr<V extends IntegerVector>(v: V, count: i32): V;
  /** The same sixteen bytes read as another vector type. */
  export function asU8x16(v: SimdVector): u8x16;
  export function asU16x8(v: SimdVector): u16x8;
  export function asI32x4(v: SimdVector): i32x4;
  export function asU32x4(v: SimdVector): u32x4;
  export function asF32x4(v: SimdVector): f32x4;
  export function asF64x2(v: SimdVector): f64x2;
}

declare module "nish:io" {
  /** `s` to stdout with no trailing newline and no conversion. */
  export function write(s: string): void;
  /** The same, on stderr. */
  export function writeError(s: string): void;
  /**
   * `bytes[off .. off + len)` to stdout, every byte as it is: the count, or a
   * negative errno. A range outside `bytes` panics, as `dst.set` does.
   */
  export function writeBytes(bytes: readonly u8[], off: i32, len: i32): i32;
  /** `message` to stderr, then exit 1. A terminator, as `process.exit` is. */
  export function panic(message: string): never;
}

declare module "nish:term" {
  /** Up to `len` bytes of stdin into `buf` from `off`, never blocking: the count, 0 at end of stream, or -11 when nothing is waiting. */
  export function readStdin(buf: u8[], off: i32, len: i32): i32;
  /** Wait up to `timeoutMs` (negative: forever) for stdin to be readable (its end and an error count): `true` when it is, `false` when the time passed. */
  export function waitStdin(timeoutMs: i32): boolean;
  /** Whether descriptor `fd` is a terminal (`isatty`). */
  export function isTerminal(fd: i32): boolean;
  /** `[columns, rows]` of the terminal on stdout, else stderr; `[-25, 0]` when neither is one, `[0, 0]` when it has no size set. */
  export function terminalSize(): i32[];
  /** Raw mode on stdin's terminal (0), or the mode it had back; -25 when stdin is not a terminal. Restored at exit, on a panic and on every signal that ends the program, SIGKILL aside. */
  export function setRawMode(on: boolean): i32;
  /** Bytes the runtime writes to the terminal on stdout at exit, on a panic and on every signal that ends the program (SIGKILL aside), before termios is restored. Replaces the previous string; "" clears it. 0, -25 when stdout is not a terminal, -7 (E2BIG) past NISH_TERM_RESTORE_MAX bytes. */
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

// `nish:region` has source behind it, `std/region.ts`, but a program imports it
// by this name. The class has a private constructor, so `tsc` refuses
// `new Region()` as `nish` does (NL2618). What `nish` refuses about the
// functions a region runs — keeping its memory outside it, growing outer
// storage, reaching threads — is flow, which `tsc` cannot see
// (docs/LANGUAGE.md -> Regions).
declare module "nish:region" {
  /** A handle to a region whose root is a `T`: 64 bits, not a pointer. */
  export class Region<T> {
    private constructor();
    private readonly root: T;
  }
  /** A new region whose root is what `f` answers; everything `f` allocates is in it. */
  export function region<T>(f: () => T): Region<T>;
  /** `region` with one outside argument for `f`, which `f` may read but not keep. */
  export function regionWith<A, T>(arg: A, f: (arg: A) => T): Region<T>;
  /** `f(root)`, allocating in the region. What `f` answers is a scalar or a handle. */
  export function enter<T, R>(r: Region<T>, f: (root: T) => R): R;
  /** `f(root, arg)`, under `enter`'s rules; `f` may not keep or grow `arg`. */
  export function enterWith<T, A, R>(r: Region<T>, arg: A, f: (root: T, arg: A) => R): R;
  /** Give the region's memory back. A freed handle used again stops the program. */
  export function free<T>(r: Region<T>): void;
}

// `nish:async` (WP49, docs/LANGUAGE.md -> Async functions). `tsc` sees ordinary
// promises; what `nish` adds is that each argument is a direct call to an
// `async` function, written where it is made, which the checker holds it to
// (`src/async-check.ts`), and that `awaitAll` takes two to eight of them.
declare module "nish:async" {
  /** Start `task` and go on without its answer; it runs until it first waits. */
  export function spawn(task: Promise<void>): void;
  /** Await every call at once; the answers come in the order the calls are written. */
  export function awaitAll<A, B>(a: Promise<A>, b: Promise<B>): Promise<[A, B]>;
  export function awaitAll<A, B, C>(a: Promise<A>, b: Promise<B>, c: Promise<C>): Promise<[A, B, C]>;
  export function awaitAll<A, B, C, D>(
    a: Promise<A>,
    b: Promise<B>,
    c: Promise<C>,
    d: Promise<D>,
  ): Promise<[A, B, C, D]>;
  export function awaitAll<A, B, C, D, E>(
    a: Promise<A>,
    b: Promise<B>,
    c: Promise<C>,
    d: Promise<D>,
    e: Promise<E>,
  ): Promise<[A, B, C, D, E]>;
  export function awaitAll<A, B, C, D, E, F>(
    a: Promise<A>,
    b: Promise<B>,
    c: Promise<C>,
    d: Promise<D>,
    e: Promise<E>,
    f: Promise<F>,
  ): Promise<[A, B, C, D, E, F]>;
  export function awaitAll<A, B, C, D, E, F, G>(
    a: Promise<A>,
    b: Promise<B>,
    c: Promise<C>,
    d: Promise<D>,
    e: Promise<E>,
    f: Promise<F>,
    g: Promise<G>,
  ): Promise<[A, B, C, D, E, F, G]>;
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

/**
 * The arena the runtime allocates from, read. Both members are available in
 * both number modes; `Arena.release` and `Arena.reset` were removed, and a call
 * to either is an unknown builtin (NL2244).
 */
declare const Arena: {
  /**
   * The current bump address. It only reads the arena, but is recorded as a
   * write, so a caller is never hoisted across an allocation.
   * Capability: none.
   *
   * @returns the address, `0` while the arena is empty.
   */
  mark(): i64;
  /**
   * Bytes bumped in the current chunk: the number the memory tests watch.
   * Recorded as a write, as `mark` is. Capability: none.
   *
   * @returns the byte count.
   */
  used(): i64;
};

/**
 * `using a = arena()` (docs/LANGUAGE.md -> Arena): everything the block
 * allocates after this declaration is released when the block ends, on every
 * exit, and the compiler refuses the block if anything allocated in it could
 * outlive it. Only a `using` initialiser, and the binding is never read; under
 * Node there is no arena and the disposal does nothing. Capability: none.
 *
 * @returns the scope the `using` declaration disposes.
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

// ---- `lib.es2022`'s receivers, documented ---------------------------------------
//
// The interfaces below merge into `lib.es2022`'s. Each member is lib's own
// signature, repeated so that an editor shows Nish's documentation at the call
// site; where Nish admits less than the signature says (a required comparator,
// exactly two operands, an f64 argument), the documentation says so and `nish`
// refuses the rest. `set` on an array is the one member added: `dst.set(src,
// offset)` copies all of `src` into `dst` from `offset` on, with
// `TypedArray.prototype.set`'s meaning (WP34 N2). A `u8[]` is an `Array` to
// `tsc`, and `lib.es5.d.ts` gives `Array` a `fill` of the same meaning but no
// `set`; `runtime/nish.mjs` installs it under Node. No member needs a
// capability.

/**
 * `Math`. The f64-only functions (`sqrt`, `floor`, `ceil`, `trunc`, `sin`,
 * `cos`, `tan`, `exp`, `log`, `pow`, `round`, `atan2`, `hypot`) refuse `i32`
 * and `i64` arguments; `number` in i32 mode is an `i32`, so write
 * `Math.sqrt(toF64(n))` or use f64 mode. A numeric literal argument is typed
 * `f64` by context (`Math.sqrt(2)` works in both modes).
 */
interface Math {
  /**
   * The square root. Capability: none.
   *
   * @param x an `f64`.
   * @returns an `f64`.
   */
  sqrt(x: number): number;
  /**
   * The largest integer not above `x`. Capability: none.
   *
   * @param x an `f64`.
   * @returns an `f64`.
   */
  floor(x: number): number;
  /**
   * The smallest integer not below `x`. Capability: none.
   *
   * @param x an `f64`.
   * @returns an `f64`.
   */
  ceil(x: number): number;
  /**
   * `x` with its fraction dropped. Capability: none.
   *
   * @param x an `f64`.
   * @returns an `f64`.
   */
  trunc(x: number): number;
  /**
   * The sine. Capability: none.
   *
   * @param x an `f64`, in radians.
   * @returns an `f64`.
   */
  sin(x: number): number;
  /**
   * The cosine. Capability: none.
   *
   * @param x an `f64`, in radians.
   * @returns an `f64`.
   */
  cos(x: number): number;
  /**
   * The tangent, fdlibm's: exact near every multiple of π/2 and within one ulp.
   * Capability: none.
   *
   * @param x an `f64`, in radians.
   * @returns an `f64`.
   */
  tan(x: number): number;
  /**
   * e to the power `x`. Capability: none.
   *
   * @param x an `f64`.
   * @returns an `f64`.
   */
  exp(x: number): number;
  /**
   * The natural logarithm. Capability: none.
   *
   * @param x an `f64`.
   * @returns an `f64`.
   */
  log(x: number): number;
  /**
   * The angle of the point `(x, y)`, with ECMAScript's special cases
   * (`atan2(0, -0)` is π, `atan2(-0, -0)` is −π). Capability: none.
   *
   * @param y an `f64`.
   * @param x an `f64`.
   * @returns an `f64`.
   */
  atan2(y: number, x: number): number;
  /**
   * The length of `(x, y)`, with ECMAScript's special cases
   * (`hypot(Infinity, NaN)` is `Infinity`). Exactly two arguments, not
   * JavaScript's any number. Capability: none.
   *
   * @returns an `f64`.
   */
  hypot(...values: number[]): number;
  /**
   * `x` to the power `y`, ECMAScript's answer where it and C99 differ:
   * `pow(x, NaN)` and `pow(±1, ±Infinity)` are `NaN`; `pow(x, ±0)` is `1`,
   * `pow(NaN, 0)` is `1`. Capability: none.
   *
   * @param x an `f64`.
   * @param y an `f64`.
   * @returns an `f64`.
   */
  pow(x: number, y: number): number;
  /**
   * JavaScript's round-half-up, with `x`'s sign kept: `2.5` -> `3`, `-2.5` ->
   * `-2`, `0.49999999999999994` -> `0`, and a value in `[-0.5, 0)` or `-0`
   * itself -> `-0`; `NaN` -> `NaN`. Capability: none.
   *
   * @param x an `f64`.
   * @returns an `f64`.
   */
  round(x: number): number;
  /**
   * The magnitude of `x`, for any numeric type, in that type: wrapping for
   * `INT_MIN`, and on an unsigned type the value itself. Capability: none.
   *
   * @param x any number.
   * @returns `x`'s magnitude, of `x`'s type.
   */
  abs(x: number): number;
  /**
   * The smaller of exactly two operands of one numeric type, in that type. On
   * floats, JavaScript's answer: a NaN operand gives NaN and `-0` is below
   * `+0` (`Math.min(0, -0)` is `-0`). Capability: none.
   *
   * @returns the smaller operand.
   */
  min(...values: number[]): number;
  /**
   * The larger of exactly two operands of one numeric type, in that type. On
   * floats, JavaScript's answer: a NaN operand gives NaN and `-0` is below
   * `+0`. Capability: none.
   *
   * @returns the larger operand.
   */
  max(...values: number[]): number;
  /**
   * The leading zero bits of `x`'s 32 bits, JavaScript's answer (an `i32` and
   * a `u32` are the bits ToUint32 gives), so `0` answers `32`. Any other
   * operand type is refused rather than converted. Capability: none.
   *
   * @param x an `i32` or a `u32`.
   * @returns an `integer<0, 32>`.
   */
  clz32(x: number): number;
  /**
   * `-1`, `0` or `1` in `x`'s own type (a ranged `x` answers its base type);
   * a float's `-0` and `NaN` come back as JavaScript gives them.
   * Capability: none.
   *
   * @param x any number.
   * @returns the sign, of `x`'s type.
   */
  sign(x: number): number;
  /**
   * The low 32 bits of the product, read signed, with no overflow check
   * (`Math.imul(0x7fffffff, 2)` is `-2`). Any other operand type is refused
   * rather than converted. Capability: none.
   *
   * @param x an `i32` or a `u32`.
   * @param y an `i32` or a `u32`.
   * @returns an `i32`.
   */
  imul(x: number, y: number): number;
  /**
   * xorshift64* in the runtime, seeded from time and pid. Capability: entropy.
   *
   * @returns an `f64` of 53 random bits in `[0, 1)`.
   */
  random(): number;
  /** π, an `f64`, also in i32 mode. */
  readonly PI: number;
  /** e, an `f64`, also in i32 mode. */
  readonly E: number;
}

/**
 * An array. `Int32Array`, `Float32Array`, `Float64Array` and `BigInt64Array`
 * name `i32[]`, `f32[]`, `f64[]` and `i64[]`, but a receiver spelled with one
 * of the four refuses `push` and `pop` (NL2415). A numeric literal argument to
 * `push`, `indexOf` or `fill` takes the element type.
 */
interface Array<T> {
  /** The element count, read-only. */
  length: number;
  /**
   * Append one element, growing the capacity by doubling. An array never grows
   * past 2^31 − 1 elements: the push that would fails as an allocation does,
   * `nish: out of memory` and exit 1. Capability: none.
   *
   * @returns the new length.
   */
  push(...items: T[]): number;
  /**
   * Remove the last element. An empty array panics and exits 1
   * (`index out of range: 0 >= 0`): there is no `undefined` to return, so the
   * answer is `T` in Nish. The capacity is untouched. Capability: none.
   *
   * @returns the element removed.
   */
  pop(): T | undefined;
  /**
   * The first index whose element is `=== searchElement`: strings by content,
   * classes, interfaces and arrays by identity, and a `NaN` element is never
   * found. One argument. Capability: none.
   *
   * @param searchElement the element looked for.
   * @returns its index, or `-1`.
   */
  indexOf(searchElement: T, fromIndex?: number): number;
  /**
   * The elements joined by `separator`. `string[]` only. Like a
   * concatenation, the result is held to 2^31 − 1 bytes: a longer one fails as
   * an allocation does, `nish: out of memory` and exit 1. Capability: none.
   *
   * @param separator between each two elements, `","` by default.
   * @returns the joined string.
   */
  join(separator?: string): string;
  /**
   * Store `value` into every slot of `[start, end)`, each end relative (a
   * negative one counts back from the length) and clamped, as
   * `TypedArray.prototype.fill`'s are; it never panics. Arrays of numbers
   * only, and a statement. Capability: none.
   *
   * @param value the value stored.
   * @param start the first slot, `0` by default.
   * @param end the slot after the last, `a.length` by default.
   * @returns the array itself, which Nish never reads: the call is a
   *   statement.
   */
  fill(value: T, start?: number, end?: number): this;
  /**
   * Sort in place, stably, as `Array.prototype.sort` does: element for element
   * Node's order for any consistent comparator. The comparator is required
   * (NL2620) and is the one argument (NL2619); only "positive or not" is read
   * of its answer, so `-0` and `NaN` count as zero. A `readonly T[]` and
   * `process.argv` are refused. Capability: none.
   *
   * @param compareFn answers a negative number, zero or a positive number:
   *   a top-level function, or an arrow reading only `const`
   *   locals and parameters.
   * @returns the array itself.
   */
  sort(compareFn?: (a: T, b: T) => number): this;
  /**
   * Copy every element of `source` into this array from `offset` on, with
   * `TypedArray.prototype.set`'s meaning. Arrays of numbers only, of any width
   * and ranged integers included, and `source` has this array's element type;
   * a statement. The range written is checked: anything outside the array
   * panics with `slice out of range: [offset, offset + src.length) of length
   * a.length`. An overlapping `source` is copied as if it were read first.
   * Capability: none.
   *
   * @param source the elements copied.
   * @param offset the first slot written, `0` by default.
   */
  set(source: readonly T[], offset?: number): void;
}

/**
 * `readonly T[]`: the same array, which may not be written through. Everything
 * that reads works (`length`, `a[i]`, `for...of`, `indexOf`, `join`); every
 * write is refused, an element store, `push`, `pop`, `set`, `fill` and `sort`
 * included.
 */
interface ReadonlyArray<T> {
  /** The element count. */
  readonly length: number;
  /**
   * The first index whose element is `=== searchElement`, as on `T[]`.
   * Capability: none.
   *
   * @param searchElement the element looked for.
   * @returns its index, or `-1`.
   */
  indexOf(searchElement: T, fromIndex?: number): number;
  /**
   * The elements joined by `separator`, as on `string[]`. Capability: none.
   *
   * @param separator between each two elements, `","` by default.
   * @returns the joined string.
   */
  join(separator?: string): string;
}

/**
 * A string: UTF-8 bytes. Every offset is a byte offset, like `length`, so
 * cutting a multi-byte character in half is possible and produces bytes that
 * are not a valid string.
 */
interface String {
  /** The UTF-8 byte length. */
  readonly length: number;
  /**
   * The byte at `index`, bounds-checked as `a[i]` is: out of range panics and
   * exits 1, where JavaScript answers `NaN`. Capability: none.
   *
   * @param index the byte offset.
   * @returns the byte.
   */
  charCodeAt(index: number): number;
  /**
   * The bytes of `[start, end)`. Both ends are clamped into `[0, s.length]`
   * and then swapped into order, as in JavaScript. Capability: none.
   *
   * @param start the first byte.
   * @param end the byte after the last, `s.length` by default.
   * @returns the new string.
   */
  substring(start: number, end?: number): string;
  /**
   * The same bytes, without the clamp: anything outside
   * `0 <= start <= end <= s.length` panics with
   * `slice out of range: [start, end) of length len` and exits 1, where
   * JavaScript counts a negative offset from the end. Capability: none.
   *
   * @param start the first byte.
   * @param end the byte after the last, `s.length` by default.
   * @returns the new string; an empty range is `""`.
   */
  slice(start?: number, end?: number): string;
  /**
   * The first byte offset at or after `position` at which `searchString`
   * occurs. `position` is clamped into `[0, s.length]` first, as in
   * JavaScript, and the empty needle answers the clamped start.
   * Capability: none.
   *
   * @param searchString the bytes looked for.
   * @param position where the search starts, `0` by default.
   * @returns the offset, or `-1`.
   */
  indexOf(searchString: string, position?: number): number;
  /**
   * Whether `searchString`'s bytes are a prefix. One argument.
   * Capability: none.
   *
   * @param searchString the prefix.
   * @returns whether it is one.
   */
  startsWith(searchString: string, position?: number): boolean;
  /**
   * Whether `searchString`'s bytes are a suffix; one longer than the string is
   * `false`. One argument. Capability: none.
   *
   * @param searchString the suffix.
   * @returns whether it is one.
   */
  endsWith(searchString: string, endPosition?: number): boolean;
}

interface StringConstructor {
  /**
   * The one-byte string of `c & 0xFF`, the inverse of `charCodeAt`. One
   * argument. A value above 127 makes a byte that is not valid UTF-8 on its
   * own; nothing validates it. Capability: none.
   *
   * @returns the one-byte string.
   */
  fromCharCode(...codes: number[]): string;
}

/**
 * An insertion-ordered map with SameValueZero keys, a builtin with no import.
 * A key is a `string`, a number, a `boolean`, an `enum` or a class instance
 * (by identity); not an interface, an array, a nullable or a `Result`. A value
 * is anything but `void` and an interface. `new Map<K, V>()` takes no
 * arguments. `keys()` and `values()` are admitted only as a `for...of`
 * iterable. At most 2^24 − 1 entries; one more panics with
 * `Map maximum size exceeded`. String keys are hashed with SipHash-1-3 under a
 * per-process random key.
 */
interface Map<K, V> {
  /** The entry count. */
  readonly size: number;
  /**
   * The value under `key`. The `V | undefined` is admitted only as a `const`
   * initialiser, the left of `??`, or an operand of `=== undefined`.
   * Capability: none.
   *
   * @param key the key looked up.
   * @returns the value, or `undefined`.
   */
  get(key: K): V | undefined;
  /**
   * Put `value` under `key`, replacing any value there. Capability: none.
   *
   * @param key the key.
   * @param value the value.
   * @returns the map itself.
   */
  set(key: K, value: V): this;
  /**
   * Whether `key` is present. Capability: none.
   *
   * @param key the key looked up.
   * @returns whether it is.
   */
  has(key: K): boolean;
  /**
   * Remove `key`'s entry. Capability: none.
   *
   * @param key the key removed.
   * @returns whether the key was there.
   */
  delete(key: K): boolean;
  /** Remove every entry. Capability: none. */
  clear(): void;
}

/**
 * An insertion-ordered set with SameValueZero members, a builtin with no
 * import. A member is what a `Map` key may be. `new Set<T>()` takes no
 * arguments. `keys()` and `values()` are admitted only as a `for...of`
 * iterable. At most 2^24 − 1 members; one more panics with
 * `Set maximum size exceeded`.
 */
interface Set<T> {
  /** The member count. */
  readonly size: number;
  /**
   * Add `value`. Capability: none.
   *
   * @param value the member added.
   * @returns the set itself.
   */
  add(value: T): this;
  /**
   * Whether `value` is a member. Capability: none.
   *
   * @param value the member looked up.
   * @returns whether it is.
   */
  has(value: T): boolean;
  /**
   * Remove `value`. Capability: none.
   *
   * @param value the member removed.
   * @returns whether it was there.
   */
  delete(value: T): boolean;
  /** Remove every member. Capability: none. */
  clear(): void;
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
