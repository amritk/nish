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

// ---- Streams and files (globals: Nish has no package resolution) ---------

/** `s` to stdout with no trailing newline and no conversion. */
declare function write(s: string): void;
/** `s` to stderr, likewise. */
declare function writeError(s: string): void;
/**
 * `message` and a newline to stderr, then exit 1. Terminates control flow, so
 * it is `never`: that is what lets `tsc` agree that a function ending in a
 * `panic` returns, and that `x` is not null after `if (x === null) { panic(...); }`
 * — the guard-then-panic shape `self/` uses everywhere in place of an assert.
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
declare function writeFileSync(path: string, data: string): void;
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
 * truncated; an empty string leaves that stream inherited.
 */
declare function spawnSyncTo(argv: string[], stdoutPath: string, stderrPath: string): number;
/** One environment variable, or `null` when it is unset (an empty value is a set variable). */
declare function getenv(name: string): string | null;
/**
 * A monotonic clock in nanoseconds, for timing a region of a program. The
 * origin is arbitrary, so only the difference between two reads is meaningful.
 */
declare function monotonicNanos(): i64;

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
  export function writeFileSync(path: string, data: string): void;
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
}

declare module "nish:process" {
  /** The global `process.exit`: a terminator, which `never` is how `tsc` spells it. */
  export function exit(code: i32): never;
  export function getenv(name: string): string | null;
  export function spawnSync(argv: string[]): number;
  /**
   * The same run with each non-empty path receiving that stream, created or
   * truncated; an empty string leaves that stream inherited.
   */
  export function spawnSyncTo(argv: string[], stdoutPath: string, stderrPath: string): number;
  /**
   * A monotonic clock in nanoseconds. The origin is arbitrary, so only the
   * difference between two reads is meaningful.
   */
  export function monotonicNanos(): i64;
  /** The command line; `argv[0]` is the program path, as in C. Read-only. */
  export const argv: readonly string[];
  /** The operating system the program runs on: `"linux"`, `"darwin"`, or `"unknown"`. */
  export const platform: string;
  /** The architecture: `"x64"`, `"arm64"`, or `"unknown"`. */
  export const arch: string;
}

declare module "nish:io" {
  /** `s` to stdout with no trailing newline and no conversion. */
  export function write(s: string): void;
  /** The same, on stderr. */
  export function writeError(s: string): void;
  /** `message` to stderr, then exit 1. A terminator, as `process.exit` is. */
  export function panic(message: string): never;
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
