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
 * the reference for each builtin, and the doc of each callable builtin ends
 * with the capability a call needs (docs/LANGUAGE.md -> Capabilities), `none`
 * for a call that needs none.
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
 *
 *  `nish/map`'s `reserve` and `getOrInsert` are not declared here: they are
 *  ordinary source, `std/map.ts`, which `tsconfig.json` maps `nish/*` to.
 */

// ---- Numeric widths (docs/LANGUAGE.md -> Types) ------------------------------
//
// Nish treats these as distinct types that never mix implicitly. There is
// no way to say that in TypeScript without branding them, and a brand would
// break the literal syntax the language relies on (`let x: i32 = 5`), so they
// are aliases and the width check is left to `nish`.

/**
 * A 32-bit signed integer: `number` in i32 mode, and the type of an array index.
 * Signed overflow panics (`wrappingAdd`, `wrappingSub` and `wrappingMul` from
 * `nish:unsafe` wrap), and it never mixes implicitly with another width.
 */
type i32 = number;
/**
 * A 64-bit signed integer; it never mixes with an `i32` without `toI64` or `toI32`.
 * It is never the lowering of `number`, a literal takes it only from context, signed
 * overflow panics, and it crosses to JavaScript as a `bigint`.
 */
type i64 = number;
/**
 * An 8-bit unsigned integer, the element of a byte buffer (`u8[]`). Unsigned
 * arithmetic wraps, in both number modes; `toU8` converts to it.
 */
type u8 = number;
/** A 16-bit unsigned integer. Its arithmetic wraps; `toU16` converts to it. */
type u16 = number;
/**
 * A 32-bit unsigned integer: same width as `i32`, the other signedness, so
 * `u32 + i32` is a type error. Its arithmetic wraps; `toU32` converts to it.
 */
type u32 = number;
/**
 * A 64-bit unsigned integer: same width as `i64`, the other signedness. Its
 * arithmetic wraps, `toU64` converts to it, and it crosses to JavaScript as a `bigint`.
 */
type u64 = number;
/**
 * A 32-bit IEEE-754 float. It is never the lowering of `number`, and `f32 + f64` is
 * a type error; `toF32` converts to it.
 */
type f32 = number;
/**
 * A 64-bit IEEE-754 float: `number` in f64 mode, and JavaScript's `number`. It is
 * available in both number modes.
 */
type f64 = number;

// ---- Ranged integers (docs/wp31-ranged-integers.md) --------------------------

/**
 * An `i32` the compiler knows lies in `[Lo, Hi]`. The bounds are numeric
 * literal types, and `tsc` checks only that; the range itself is `nish`'s.
 * A ranged value is its base type wherever one is expected, and arithmetic on
 * it that provably stays inside 32 bits needs no overflow check: `Math.clz32`
 * answers an `integer<0, 32>`, so `31 - Math.clz32(w)` is checked by nothing
 * (docs/LANGUAGE.md -> Types).
 *
 * The bounds are two integer literals, a sign allowed, with `Lo <= Hi` and both
 * in `i32`; `integer<0, 0xFF>` and `integer<0, 255>` are one type. Any other
 * spelling is refused, as is a numeric literal type anywhere but a bound, a
 * `declare function` signature that names a range, and `new Array<integer<1, 9>>(n)`,
 * whose zero fill lies outside the range. `integer` is reserved: no alias, enum,
 * class, interface or function may take the name.
 *
 * Entering a range is checked: an annotated initialiser, an assignment, an
 * argument, a `return`, a field, an array element, an element store and `push`.
 * The source must be an `i32` or another ranged type (a `u8` is not an
 * `integer<0, 255>`; under `--number-mode f64` a value enters through `toI32`). A
 * literal outside the range is a compile error, ``Literal `12` is outside the range
 * of integer<0, 9>``; any other source is compared once and the program panics
 * outside the range, printing `value out of range: expected integer<0, 255>` and
 * exiting 1. The compiler writes no compare where it proves the entry, such as a
 * loop counter below the bound. Under Node nothing is checked.
 *
 * Leaving a range is free: every operator reads a ranged value as `i32`, so `r + 1`
 * is an `i32`. A `const` without an annotation keeps the range and a `let` widens
 * to `i32`. The type is an `i32` in the IR, in memory and at the C ABI, in both
 * number modes.
 */
type integer<Lo extends number, Hi extends number> = number;

// ---- Result (docs/LANGUAGE.md -> Result and error handling) ------------------
//
// Modelled as the tagged union TypeScript would use anyway, intersected with
// the method surface. That is what lets `if (r.ok)` and `if (r.isOk())` narrow
// `r` in `tsc` for the same reason and in the same places they narrow in
// `nish`.

/** The success arm of a `Result`, as the discriminant proves it. */
type ResultOk<T> = {
  /** `true` on this arm: the discriminant `if (r.ok)` tests. */
  readonly ok: true;
  /** The success payload, readable only where `r.ok` or `r.isOk()` holds. */
  readonly value: T;
};
/** The failure arm. */
type ResultErr<E> = {
  /** `false` on this arm: where `if (r.ok)` fails, `r` is this arm. */
  readonly ok: false;
  /** The failure payload, readable only where `!r.ok` or `r.isErr()` holds. */
  readonly error: E;
};

/**
 * The methods every `Result` carries. `r.ok` is the same bit as a plain
 * `boolean`, `r.value` reads only where the checker proved `isOk()` and `r.error`
 * only where it proved `isErr()`. A narrowing applies to a variable, not a property
 * path, ends at any assignment to that variable, and holds in `if`, `&&`, `||`,
 * `!` and the ternary. There is no `unwrap()` (`expect` insists on a reason) and no
 * `map` or `andThen`. Capability: none.
 */
interface ResultMethods<T, E> {
  /**
   * True when this is the success arm; narrows `r` where it is a condition.
   * Capability: none.
   *
   * @returns whether `r` holds a value.
   */
  isOk(): this is ResultOk<T> & ResultMethods<T, E>;
  /**
   * True when this is the failure arm; narrows `r` the other way.
   * Capability: none.
   *
   * @returns whether `r` holds an error.
   */
  isErr(): this is ResultErr<E> & ResultMethods<T, E>;
  /**
   * The success payload, or an early `return Err(error)` from the enclosing
   * function — Rust's `?`. `nish` additionally requires that function to
   * return a `Result` whose error arm accepts `E`, with no implicit error
   * conversion (a mismatch is refused; convert by hand with
   * `if (r.isErr()) { return Err(...); }`); `tsc` cannot check that. It is
   * refused in a function that returns anything else, `main` returning `i32`
   * included. Capability: none.
   *
   * @returns the success payload; the failure arm never returns here.
   */
  orReturn(): T;
  /**
   * The success payload, or `fallback` when this is the failure arm. In f64
   * mode a numeric literal fallback takes no type from the `Result`, so write
   * `toI32(...)` or the like. Capability: none.
   *
   * @param fallback the value answered for the failure arm.
   * @returns the payload or `fallback`.
   */
  unwrapOr(fallback: T): T;
  /**
   * The success payload, or `message` on stderr and exit 1: the failure arm
   * ends the program, the same ending `panic` has. Capability: none.
   *
   * @param message what stderr says before the exit.
   * @returns the success payload.
   */
  expect(message: string): T;
}

/**
 * The outcome of an operation that can fail. `T` may be `void` for an
 * operation with nothing to hand back, and then the `Result` carries no
 * `value`; `E` may not be `void`, since a failure that says nothing is what
 * `panic` is for. A `Result` is immutable once built, and `Result<T, E> | null`
 * is refused. A `Result` may not be dropped: a call that answers one may not
 * stand as an expression statement, and a local that holds one must be read.
 */
type Result<T, E> = (ResultOk<T> | ResultErr<E>) & ResultMethods<T, E>;

/**
 * The success value. Its `Result` type comes from the context, as `null`'s
 * does; `Ok()` with no argument is a `Result<void, E>`. In f64 mode a numeric
 * literal payload takes no type from the context, so `Ok(3)` for a
 * `Result<i32, string>` needs `toI32(3)`. Capability: none.
 *
 * @param value the payload.
 * @returns a `Result` on its success arm.
 */
declare function Ok<T, E>(value: T): Result<T, E>;
/**
 * The success of a `Result<void, E>`, with no payload. Capability: none.
 *
 * @returns a `Result<void, E>` on its success arm.
 */
declare function Ok<E>(): Result<void, E>;
/**
 * The failure value, likewise: its `Result` type comes from the context.
 * Capability: none.
 *
 * @param error the error payload.
 * @returns a `Result` on its failure arm.
 */
declare function Err<T, E>(error: E): Result<T, E>;

// ---- Disposable (docs/LANGUAGE.md -> `using a = arena()`) --------------------

/**
 * The disposable protocol `using` reads: declared here so that a program using
 * `nish/threads`'s scope, a `Mutex`'s lock, `arena()` or a handle class needs
 * no `"ESNext.Disposable"` in its `lib`. `nish` takes `using` only for a
 * `scope()`, a `lock()`, an `arena()` or a `new` of a handle class, and any
 * other `using` initialiser is refused.
 *
 * A handle class is a class with exactly one `readonly` `CPtr` or `CPtr | null`
 * field: it owns the C resource the pointer names, and its `[Symbol.dispose]():
 * void` is `close(this.file);` or `const p = this.file; if (p !== null) {
 * close(p); }` for a `declare function` `close` of one parameter. `using` of a
 * handle class closes it at every exit of its block, once, in the reverse of
 * the order the declarators opened; a panic and `process.exit` do not close.
 * `--deny ffi` refuses that `using`. Any other class that declares
 * `[Symbol.dispose]` is refused.
 *
 * The compiler emits the join, the release, the unlock or the close itself, and
 * `[Symbol.dispose]` is never called by name.
 */
interface SymbolConstructor {
  /** The key of the method `using` calls when its block ends. */
  readonly dispose: unique symbol;
}
/** A value `using` may bind: one whose `[Symbol.dispose]()` ends its scope. */
interface Disposable {
  /**
   * Ends the value's scope. The compiler runs it on every exit from the `using`
   * block; a call by name is refused.
   */
  [Symbol.dispose](): void;
}

// ---- String.fromBytes (docs/LANGUAGE.md -> Strings) --------------------------
/**
 * `String.fromBytes` is Nish's, not JavaScript's, so it merges into the
 * `StringConstructor` `lib.es2022` declares. Under `runtime/nish.mjs` each byte
 * becomes one UTF-16 unit, as `String.fromCharCode`'s does, so ASCII agrees with a
 * native build and a byte above 127 does not; under `--emit-ts` the bytes decode
 * as UTF-8, and a sequence that is not UTF-8 becomes U+FFFD.
 */
interface StringConstructor {
  /**
   * The bytes of `bytes[start..end)` as one string, with one range check, one
   * allocation and one copy. The range is `s.slice`'s, `0 <= start <= end <=
   * bytes.length`, checked once after all three arguments are evaluated;
   * anything else panics with `slice out of range: [start, end) of length len`
   * and exits 1. `bytes` is a `u8[]` reached any way an array is, `readonly` or
   * not; a wider element or a `u8[] | null` is refused (NL2268). Both ends are
   * required (NL2060) and are numbers (NL2058).
   *
   * Nothing validates the bytes as UTF-8: a multi-byte character copied whole
   * is that character, and a range that cuts one is bytes that are not a valid
   * string. Natively the string's bytes are the array's, so `write` or
   * `writeFileSync` sends any bytes back out unchanged; bytes that are not text
   * go out through `writeBytes` and `writeFileBytesSync`, which agree on every
   * host. Capability: none.
   *
   * @param bytes the buffer to read.
   * @param start the first byte taken.
   * @param end one past the last byte taken.
   * @returns a new string of `end - start` bytes.
   */
  fromBytes(bytes: readonly u8[], start: number, end: number): string;
}

// ---- console and process -----------------------------------------------------
//
// Declared here with *Nish's* signatures — one argument, no format string,
// statement position — rather than borrowed from `lib.dom` or `@types/node`,
// which describe something much wider. `Console` is an interface so that a
// project which does pull `lib.dom` in merges with it instead of colliding;
// `Process` is not that lucky, so a project that needs `@types/node` for other
// reasons should drop this file's `process` rather than fight it.
/**
 * The two output streams, with Nish's one-argument signatures. Numbers print
 * as JavaScript's `String(x)`: exact decimal for `i32`/`i64`, shortest
 * round-trip digits for `f64` (`0.1`, `1e+21`, `1e-7`, `NaN`, `Infinity`,
 * `-0` as `0`); booleans print `true`/`false`.
 */
interface Console {
  /**
   * Writes `x` and a newline to stdout with one `write(2)`; statement position
   * only (as a value it is refused); exactly one argument. Arrays and objects are
   * rejected: it accepts a string, a number or a boolean. In a parallel body it is
   * refused, as output is a write the caller can see. Capability: none.
   *
   * @param x the string, number or boolean to print.
   */
  log(x: string | number | boolean): void;
  /**
   * The same, on stderr — the stream a compiler's diagnostics belong on.
   * Identical rules and identical messages under its own name. Capability: none.
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
   * it does in `nish`, and code after it is `Unreachable code after process.exit`.
   * A numeric literal `code` is an `i32` in either number mode. In a parallel body
   * it is refused, as output is. Capability: exit.
   *
   * @param code the exit status.
   */
  exit(code: i32): never;
  /**
   * The command line; `argv[0]` is the program path, as in C — one index
   * earlier than Node's, which puts `node` first. Each argument is the bytes
   * the operating system passed, as a UTF-8 string. Read-only: an assignment to
   * it or an element, `op=`, `++`, `--` and `push` are refused. It is an ordinary
   * `string[]` (`length`, `a[i]`, `for...of`, passing it on) built once before the
   * program runs and living outside the arena, and it needs a `main` entry point:
   * a program without one, such as a wasm or N-API library, refuses every use
   * with `` `process.argv` requires a `main` entry point ``. Under the `wasi`
   * profile the WASI host supplies the arguments. Capability: none.
   */
  readonly argv: string[];
  /**
   * The operating system the program runs on, spelled as Node spells it:
   * `"linux"`, `"darwin"`, or `"unknown"` for anything the compiler has no target
   * triple for (every WASI build). It is settled when the runtime is compiled, so a
   * cross build reports the target, and it cannot be assigned to. It carries no
   * entry-point rule, so a wasm or N-API library may read it. Capability: none.
   */
  readonly platform: string;
  /**
   * The architecture: `"x64"`, `"arm64"`, or `"unknown"`. Like `platform`, it
   * names the target of the build, cannot be assigned to and is not callable.
   * Capability: none.
   */
  readonly arch: string;
}
/** The running process. */
declare var process: Process;

// ---- Numeric conversions (there is no cast in Nish) ----------------------
// Nothing converts implicitly: a mixed operation, an initializer of another
// numeric type and a call with the wrong numeric type are each refused until
// one of the functions below is written. `Number`, `parseInt` and
// `parseFloat` are `lib.es2022`'s too. `Number`'s call repeats lib's signature;
// `parseInt` and `parseFloat` add Nish's own as an overload beside lib's, as
// `runtime/core/numbers.d.ts` declares them. An `i32` and an `f64` are both
// `number` to `tsc`, so what it accepts does not change; `nish` refuses lib's
// radix.

/**
 * `Number(value)`: `value` as an `f64`, in both number modes. Nish has no
 * `new Number` and no member of `Number`; the call is the conversion, merged
 * into the `NumberConstructor` `lib.es2022` declares.
 *
 * A string is parsed with JavaScript's `Number(s)` rules: ASCII whitespace
 * (` \t\n\v\f\r`, not the Unicode spaces JavaScript also trims) is trimmed
 * on both sides, then the whole string must be one literal, so `Number("")`
 * and `Number("   ")` are `0`, `Number("  7.5  ")` is `7.5`, and
 * `Number("12px")`, `Number("1e")` and `Number("nan")` are `NaN`.
 * `Number("0x1A")` is `26`, as in JavaScript, and a hex float such as `0x1p3`
 * is also accepted, which JavaScript rejects; the `0b` and `0o` prefixes are
 * `NaN`, which JavaScript reads. Under `--deterministic` a `0x` string reads
 * as `--emit-ts` reads it on every target: a hex float is `NaN`, and a hex
 * integer is correctly rounded whatever the C library.
 *
 * An `i32` or an `i64` converts as `toF64` does, a `boolean` is `1` or `0`,
 * and an `f64` is itself. A numeric literal argument is typed `f64`
 * (`Number(2.5)` works in i32 mode). Exactly one argument; anything other than
 * a string, a number or a boolean is refused: "`Number` expects a string,
 * number, or boolean, got i32[]". Capability: none.
 */
interface NumberConstructor {
  /**
   * `value` as an `f64`, by the rules on `NumberConstructor` above.
   * Capability: none.
   *
   * @param value a string, an `i32`, an `i64`, an `f64` or a `boolean`;
   *   `nish` requires it, though `lib`'s signature marks it optional.
   * @returns an `f64`, in both number modes.
   */
  (value?: any): number;
}

/**
 * The base-10 integer at the start of `s`, as an `i32`: ASCII whitespace,
 * an optional sign, then digits, stopping at the first other character
 * (`parseInt("42px")` is `42`). Three deviations from JavaScript: there is no
 * `NaN` in an `i32`, so no digits give `0` (`parseInt("abc")`,
 * `parseInt("")`); a value beyond the `i32` range saturates as `toI32` does
 * (`parseInt("99999999999")` is `2147483647`); and a `0x` prefix is not
 * hexadecimal (`parseInt("0x10")` is `0`). Always an `i32`, under
 * `--number-mode f64` too, where `Number` reads a wider value. Exactly one
 * argument: there is no radix, since base 10 is the only one. A non-string is
 * refused: "`parseInt` expects a string, got i32". Capability: none.
 *
 * @param s the text read.
 * @returns the integer, or `0` when there are no digits.
 */
declare function parseInt(s: string): i32;
/**
 * The decimal number at the start of `s`, as an `f64`: ASCII whitespace,
 * then the longest decimal literal (`[sign] digits [. digits] [e [sign]
 * digits]`, `. digits`, or `[sign] Infinity`), correctly rounded.
 * `parseFloat("3.14xyz")` is `3.14` and `parseFloat("1e")` is `1`. One
 * deviation from JavaScript: a `0x` prefix is read as hexadecimal
 * (`parseFloat("0x1A")` is `26`, where JavaScript stops at the `x` and gives
 * `0`). Under `--deterministic` a `0x` string reads as `--emit-ts` reads it
 * on every target: the hex integer, correctly rounded, stopping at a hex
 * float's `.` or `p` (`0x1p3` is `1`). Exactly one argument. Capability: none.
 *
 * @param s the text read.
 * @returns the number, or `NaN` when there is none (`parseFloat("abc")`,
 *   `parseFloat("")`, `parseFloat(".")`).
 */
declare function parseFloat(s: string): f64;

/**
 * `x` as an `i32`. An integer of 32 bits or more wraps to its low 32 bits, a
 * narrower one is sign- or zero-extended by its own signedness, and a float
 * saturates (NaN is 0, out of range clamps). An `i32` is unchanged, and an
 * integer of the same width and another signedness keeps its bits. The float
 * rule is Rust's `as` cast, not JavaScript's modulo-2^32 `ToInt32`:
 * `toI32(5e10)` is `2147483647`, while the integer rule gives
 * `toI32(5000000000)` as `705032704`.
 *
 * The result of a `u8`, a `u16` or a ranged integer lies in the declared range
 * of `x`, so `const r: integer<0, 255> = toI32(b)` costs no check for a `u8`
 * `b`; under `--number-mode f64` this is how a `number` enters an `integer<Lo,
 * Hi>`. An argument that is not a number is refused, as `` `toI32` expects a
 * number (i32, i64, or f64), got string ``. Capability: none.
 *
 * @param x the value to convert.
 * @returns `x` in 32 signed bits.
 */
declare function toI32(x: number | boolean): i32;
/**
 * `x` as an `i64`: a signed source is sign-extended, an unsigned one
 * zero-extended, and a float saturates (NaN is 0, out of range clamps). An
 * `i64` is unchanged, and a `u64` keeps its bits. Capability: none.
 *
 * @param x the value to convert.
 * @returns `x` in 64 signed bits.
 */
declare function toI64(x: number | boolean): i64;
/**
 * `x` as a `u8`: a wider integer is truncated, and a float saturates into
 * `0 .. 255`, so a negative value is 0. An integer source of the same width
 * and another signedness keeps its bits, and a narrower one is zero-extended
 * from an unsigned source and sign-extended from a signed one. The conversion
 * also types a literal, which is how `255` is written for a `u8` where
 * no context gives it that type: `toU8(255)`. Capability: none.
 *
 * @param x the value to convert.
 * @returns `x` in 8 unsigned bits.
 */
declare function toU8(x: number | boolean): u8;
/**
 * `x` as a `u16`, by `toU8`'s rules at 16 bits: a float saturates into
 * `0 .. 65535`. Capability: none.
 *
 * @param x the value to convert.
 * @returns `x` in 16 unsigned bits.
 */
declare function toU16(x: number | boolean): u16;
/**
 * `x` as a `u32`, by `toU8`'s rules at 32 bits: a float saturates into
 * `0 .. 2^32 - 1`. From an `i32` the bits do not move, so no instruction is
 * emitted. Capability: none.
 *
 * @param x the value to convert.
 * @returns `x` in 32 unsigned bits.
 */
declare function toU32(x: number | boolean): u32;
/**
 * `x` as a `u64`. Widening sign-extends a signed source, so `toU64(-1: i32)`
 * is 2^64 - 1, as `-1i32 as u64` is in Rust; a float saturates into
 * `0 .. 2^64 - 1`, so a negative value is 0. From an `i64` the bits do not
 * move. The largest `u64` values cannot be written as literals (past 2^53), so
 * they are built this way: `toU64(0) - toU64(1)` is 2^64 - 1. Capability: none.
 *
 * @param x the value to convert.
 * @returns `x` in 64 unsigned bits.
 */
declare function toU64(x: number | boolean): u64;
/**
 * `x` as an `f32`; from an `f64` it rounds to nearest, and an integer is
 * converted as signed or unsigned by its own signedness. An `f32` is
 * unchanged. A bare literal argument is typed `f32`: `toF32(2.75)`.
 * Capability: none.
 *
 * @param x the value to convert.
 * @returns the nearest `f32`.
 */
declare function toF32(x: number | boolean): f32;
/**
 * `x` as an `f64`; from an `f32` it is exact, and an integer is converted as
 * signed or unsigned by its own signedness. An `f64` is unchanged. A bare
 * literal argument is typed `f64`: `toF64(3)`. Capability: none.
 *
 * @param x the value to convert.
 * @returns `x` as an `f64`.
 */
declare function toF64(x: number | boolean): f64;
/**
 * Reinterpret the 64 bits of an `f64`, never convert the value: `toI64(1.5)`
 * is `1`, `f64ToBits(1.5)` is `0x3FF8000000000000`. A function that only
 * reinterprets bits has no side effect. An argument that is not an `f64` is
 * refused, as is a call with other than one argument. Capability: none.
 *
 * @param x the float whose bits are read.
 * @returns the same 64 bits as an `i64`.
 */
declare function f64ToBits(x: f64): i64;
/**
 * The inverse of `f64ToBits`: `bitsToF64(f64ToBits(x)) === x` for every `x`
 * except `NaN`, which is not `===` to itself. An argument that is not an `i64`
 * is refused. Capability: none.
 *
 * @param bits the 64 bits to read as a float.
 * @returns the `f64` those bits are.
 */
declare function bitsToF64(bits: i64): f64;
/**
 * Reinterpret the 32 bits of an `f32`, never convert the value, signed as an
 * `i32`: `f32ToBits(1.5)` is `0x3FC00000`, and `f32ToBits(-0)` is
 * `-2147483648`. An `f64` argument is refused, as `` `f32ToBits` expects an
 * argument of type f32, got f64 ``. Under Node the runtime shim supplies it
 * from a `DataView`. Capability: none.
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
 * declaration stands for the two. Any other type is refused, as `` `ctEq` takes
 * u32 or u64 operands (convert with toU32 or toU64), got i64 `` (NL2399):
 * `i32`, `i64`, `u8`, `u16`, a ranged integer, `f32`, `f64` and `boolean`
 * included, and a boolean mask in particular.
 *
 * Operands of two types are `` `ctSelect` needs every operand of one type, got
 * u32 and u64 `` (NL2400). A bare numeric literal takes its type from the first
 * operand that is not one, wherever it stands. The call takes exactly three
 * arguments, and like every function it is not a value. The all-ones-or-zero
 * convention for the mask is not checked, because the check would be a branch;
 * any other mask is a defined bitwise blend, so `ctSelect(0xf0f0f0f0, a, b)`
 * takes the high nibble of each byte from `a`.
 *
 * The promise is no branch and no secret-indexed load in the primitive itself
 * and nothing about the caller's own code, which branches on a secret if it
 * writes `if (ctEq(a, b) !== 0)`. On `wasm32` the same barrier is emitted, but
 * the engine compiles the module again, so nothing is promised there. Under
 * Node the runtime shim computes the same answer as a pure function (over
 * `u32`, put back in range with `>>> 0`; over `u64`, on BigInts), and only the
 * timing is not claimed. Capability: none.
 *
 * @param mask all ones to choose `a`, zero to choose `b`.
 * @param a the value an all-ones mask selects.
 * @param b the value a zero mask selects.
 * @returns `a` or `b`, chosen without a branch.
 */
declare function ctSelect<T extends u32 | u64>(mask: T, a: T, b: T): T;
/**
 * All-ones of the operands' type when `a === b`, zero otherwise, without a
 * branch; the answer is only ever one of the two, and is the mask `ctSelect`
 * takes, so `ctSelect(ctEq(a, b), x, y)` never shows the optimiser a boolean.
 * Both operands are one type, `u32` or `u64`; any other type, a boolean and a
 * ranged integer included, is refused with NL2399, and operands of two types
 * with NL2400, as for `ctSelect`.
 *
 * A bare numeric literal takes its type from the other operand, so `ctEq(0, x)`
 * works, while `ctEq(1, 2)`, with no width to take, is an `i32` and refused.
 * The call takes exactly two arguments, and like every function it is not a
 * value. The no-branch promise and its limits are `ctSelect`'s, and so are the
 * `wasm32` and Node readings. Capability: none.
 *
 * @param a one operand.
 * @param b the other, of the same type.
 * @returns a mask for `ctSelect`.
 */
declare function ctEq<T extends u32 | u64>(a: T, b: T): T;
/**
 * Every byte of `bytes` set to zero, in stores neither `-O2` nor `-flto` may
 * drop as dead (#385): how a key, a secret scalar or another secret is cleared
 * once it is used. A statement: used as a value it is `` `secureZero` returns
 * void and can only be used as a statement `` (NL2105), and it takes exactly
 * one argument (NL2061). It fills a `u8[]` only; anything else is ``
 * `secureZero` fills a `u8[]`, got i32[] `` (NL2402), a string included, which
 * is immutable.
 *
 * The call writes its argument, so a `readonly u8[]` is `` Cannot `secureZero`
 * through readonly u8[] (declare it u8[] to write through it) `` (NL2264), and
 * a function that wipes a parameter does not get `readonly` on it; in a scope's
 * region it is refused where `fill` is (NL2394). An empty array is a call that
 * clears nothing.
 *
 * It clears the bytes of the array it is handed and nothing else: a copy taken
 * before (`slice`, a `push` into another array, an element read into a local, a
 * register spilled to the stack) is the program's to clear, and nothing clears
 * what the operating system swapped out. It works under the wasi profile; a
 * freestanding wasm module has no wipe. Under Node it is a loop that sets every
 * element to zero, and a collector that moved the array may have left the old
 * bytes behind. Capability: none.
 *
 * @param bytes the buffer to clear.
 */
declare function secureZero(bytes: u8[]): void;
/**
 * One `lstat` of `path`, so a symbolic link answers for itself and not for what
 * it names: the owner's uid in the high 32 bits and `st_mode` (the file type
 * and the permission bits) in the low 32, or -1 when the path does not resolve
 * or holds a NUL (#386). Both come out of one `lstat`, so they describe the
 * same file however the path changes in between.
 *
 * Take them apart with `(om >> 32) & 0xffffffff` (the owner) and `om & 0xfff`
 * (the permission bits) or `om & 0xf000` (the type: `0x8000` a regular file,
 * `0x4000` a directory, `0xa000` a symbolic link). The mask on the owner is not
 * optional: a uid of 2^31 or more fills bit 63, which `>>` on an `i64` copies
 * down, so `om >> 32` alone answers a negative owner that never equals
 * `geteuid()`.
 *
 * The answer is an `i64` in both number modes, and an `i32` variable is refused
 * rather than truncated (`` Cannot initialize i32 variable `om` with i64 ``).
 * It takes a `string` path and exactly one argument. A wasm32 build is refused,
 * with `` `lstatOwnerModeSync` reaches the operating system, and a wasm32 build
 * has none to reach ``. Under Node the runtime shim packs `fs.lstatSync`'s
 * `uid` and `mode` the same way as a BigInt. It is a global, not a `nish:`
 * export. Capability: fs.read.
 *
 * @param path the path to stat, not followed through a final link.
 * @returns `(uid << 32) | st_mode`, or -1.
 */
declare function lstatOwnerModeSync(path: string): i64;
/**
 * The effective user id, the one to compare an owner from `lstatOwnerModeSync`
 * with; compare it with `(om >> 32) & 0xffffffff`. The answer is an `i64` in
 * both number modes. It takes no argument, and a wasm32 build is refused, as
 * there is no user there. Under Node the runtime shim supplies
 * `process.geteuid()`. It is a global, not a `nish:` export. Capability: env.
 *
 * @returns the process's effective uid.
 */
declare function geteuid(): i64;
/**
 * Whether the real user may run `path`: `access(path, X_OK)`, the shell's
 * question. It is `false` for a path that does not resolve or holds a NUL, for
 * a file with no execute bit (root included), and a merely readable file is not
 * executable. It takes a `string` path and exactly one argument, and a wasm32
 * build is refused, as there is no file system there. Under Node the runtime
 * shim supplies `fs.accessSync` with `X_OK`. It is a global, not a `nish:`
 * export. Capability: fs.read.
 *
 * @param path the file to ask about.
 * @returns whether it is executable by the real user.
 */
declare function isExecutableSync(path: string): boolean;

// ---- Unsafe (`nish:unsafe`) --------------------------------------------------
//
// Declared as globals so `tsc` reads a program that imports them, as every
// `nish:` export is, but `nish` refuses a call to any of the six that is not
// imported from `nish:unsafe`: the import is the module's visible opt-in. The
// refusal reads `` `uncheckedGet` is a `nish:unsafe` function and is called only
// through an import of it `` (NL2456). An import may rename (`as`) and cannot be
// shadowed; a user function of the same name, with no import, is the user's.
// Every import and call is a recorded fact in `--emit-checked`. Under
// `--deny-panics` or `"nish".noPanic` the import is the opt-in the scope takes.

/**
 * `xs[i]` with no bounds check: undefined behaviour when `i` is out of range,
 * which is the whole of the trade. The array holds numbers (`i32`, `i64`, `u8`,
 * `u16`, `u32`, `u64`, `f32` or `f64`) and nothing else, or it is ``
 * `uncheckedGet` takes an array of numbers (i32, i64, u8, u16, u32, u64, f32 or
 * f64), got string[] `` (NL2455). The index is an `i32`, so an `f64` one is ``
 * `uncheckedGet` expects an argument of type i32, got f64 ``. A `readonly`
 * array may be read.
 *
 * To the bounds proof it is the load `xs[i]` is, less the check: it moves no
 * length, and it records no passed check, so a checked `xs[i]` after it keeps
 * its check. Under `--deny-panics` it is an allowed `unchecked` site. Under
 * Node the runtime shim reads `xs[i]`. Capability: unsafe.
 *
 * @param xs the array of numbers to read.
 * @param i the index, trusted to be in range.
 * @returns the element at `i`.
 */
declare function uncheckedGet<T extends number>(xs: readonly T[], i: i32): T;
/**
 * `xs[i] = v` with no bounds check: undefined behaviour when `i` is out of
 * range. A statement. The array holds numbers, as for `uncheckedGet` (NL2455),
 * the index is an `i32`, and the value stored is the element type. A `readonly`
 * array may not be written (`` Cannot `uncheckedSet` through readonly u8[] ``).
 * A number is copied in and held by nothing, so the store needs none of the
 * escape and inline-array reasoning `xs[i] = v` carries; an array field handed
 * to it is a value and is not stored inline.
 *
 * The store is a write of the array for every rule that asks, the rule for a
 * parallel body included. To the bounds proof it is the store `xs[i] = v` is,
 * less the check, and a resize in the value stored still takes the length away.
 * Under `--deny-panics` it is an allowed `unchecked` site. Under Node the
 * runtime shim stores `xs[i] = v`. Capability: unsafe.
 *
 * @param xs the array of numbers to write.
 * @param i the index, trusted to be in range.
 * @param v the value stored.
 */
declare function uncheckedSet<T extends number>(xs: T[], i: i32, v: T): void;
/**
 * `a + b` wrapped to the operands' width, `i32` or `i64`: defined for every
 * pair, where the operator `+` panics on signed overflow. The two operands are
 * one type, which is also the answer: `` `wrappingMul` takes i32 or i64
 * operands (convert with toI32 or toI64), got u32 `` is NL2454 (the unsigned
 * words already wrap), and two widths are `` `wrappingAdd` needs every operand
 * of one type, got i32 and i64 `` (NL2400). A bare literal takes the other
 * operand's type, wherever it stands. `wrappingAdd(2147483647, 1)` is
 * `-2147483648`.
 *
 * In a module constant's initialiser the call folds, wrapping, where
 * `2147483647 + 1` is refused; it is the one call such an initialiser may make.
 * It is not a site under `--deny-panics`, as it cannot panic. Under Node the
 * runtime shim computes `(a + b) | 0` on an `i32` and `BigInt.asIntN(64, ...)`
 * on the BigInt an `i64` is there. Capability: unsafe.
 *
 * @param a one operand.
 * @param b the other, of the same type.
 * @returns the low bits of the sum.
 */
declare function wrappingAdd<T extends i32 | i64>(a: T, b: T): T;
/**
 * `a - b` wrapped to the operands' width, by `wrappingAdd`'s rules, so
 * `wrappingSub(0, x)` is a negation that wraps. Under Node the runtime shim
 * computes `(a - b) | 0` on an `i32`. Capability: unsafe.
 *
 * @param a the minuend.
 * @param b the subtrahend, of the same type.
 * @returns the low bits of the difference.
 */
declare function wrappingSub<T extends i32 | i64>(a: T, b: T): T;
/**
 * `a * b` wrapped to the operands' width, by `wrappingAdd`'s rules:
 * `wrappingMul(INT64_MAX, 2)` is `-2`. Under Node the runtime shim computes
 * `Math.imul` on an `i32`. Capability: unsafe.
 *
 * @param a one operand.
 * @param b the other, of the same type.
 * @returns the low bits of the product.
 */
declare function wrappingMul<T extends i32 | i64>(a: T, b: T): T;
/**
 * The `NUL`-terminated bytes at `p`, copied into a new string of the program's
 * own: undefined behaviour unless `p` is a live C string, since nothing proves
 * the bytes end (a dangling or freed pointer, or a buffer with no `NUL`). It is
 * the copy a `string` result of a `declare function` makes, for the pointers C
 * allocated for the caller to free, and C's buffer is never held past the call,
 * so `free(p)` straight after it is safe.
 *
 * The parameter is `CPtr`, so an unnarrowed `CPtr | null` is refused (``
 * `readCString` expects an argument of type CPtr, got CPtr | null ``) and `if
 * (p !== null)` comes first; a `declare function` whose result is declared
 * `CPtr` gets no check, so declare a result that may be `NULL` as `CPtr |
 * null`.
 *
 * The copy is new on every call and is the calling function's allocation, and
 * it is refused inside a `using a = arena()` block that would release one held
 * outside it (`` `readCString(p)` may be allocated inside the `using arena()`
 * block ``). Under `--deny-panics` it is an allowed `unchecked` site, with the
 * copy's `oom` beside it, and the pointer it reads is `ffi`. It lowers the same
 * on wasm32, where whether the program links is the `declare function`'s
 * question. It has no Node form, as a `CPtr` comes only from a `declare
 * function`, which Node cannot call. Capability: unsafe.
 *
 * @param p the address a `declare function` handed back.
 * @returns a copy of the bytes before the first `NUL`.
 */
declare function readCString(p: CPtr): string;

// ---- Streams and files (globals: Nish has no package resolution) ---------

/**
 * `s` to stdout with no trailing newline and no conversion (a `string` only);
 * statement position. A native string is `{len, bytes}`, never validated as
 * UTF-8, and its `len` bytes leave as they are, so a string built by
 * `String.fromBytes` from any bytes, all 256 values included, leaves exactly as
 * it came in. That route is native-only: under the prelude `String.fromBytes`
 * makes each byte one UTF-16 unit, which leaves as UTF-8, so a byte above 127
 * becomes two, and under `--emit-ts` the bytes decode as UTF-8 and a byte that
 * is not UTF-8 becomes U+FFFD. `writeBytes` is the route for bytes that are not
 * text. Also exported by `nish:io`. Capability: none.
 *
 * @param s the text written.
 */
declare function write(s: string): void;
/**
 * `s` to stderr, likewise: no trailing newline, no conversion, statement
 * position, the same byte-for-byte rule for a string. Also exported by
 * `nish:io`. Capability: none.
 *
 * @param s the text written.
 */
declare function writeError(s: string): void;
/**
 * `bytes[off .. off + len)` to stdout, every byte as it is, with no conversion
 * — the one way to send bytes that are not text, a byte of 0x80 or above or a
 * zero byte included. A loop of `write(2)` sends them all, retried on an
 * interrupted call. A pipe whose reader has gone raises SIGPIPE natively, as it
 * does for `write`, where Node answers `-32` EPIPE.
 *
 * `off` and `len` are `netWrite`'s buffer range, checked once after the
 * arguments are evaluated: `0 <= off`, `0 <= len` and `off + len <=
 * bytes.length`, and anything else panics, as `dst.set` does, with `slice out
 * of range: [off, off+len) of length n` and exits 1. The shape is `netWrite`'s
 * with the descriptor fixed at 1. Under Node the range is the same check and
 * the bytes go to `fs.writeSync(1, ...)`. A `wasm32` build has no stdout to
 * reach and refuses it. Also exported by `nish:io`. Capability: none.
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
 * the same ending an out-of-range index has. It is how a program ends on an
 * unmet invariant. Statement position, and it terminates control flow like
 * `process.exit`, so it is `never`: that is what lets `tsc` agree that a
 * function ending in a `panic` returns, a non-`void` one included, and that `x`
 * is not null after `if (x === null) { panic(...); }` — the guard-then-panic
 * shape `src/` uses everywhere in place of an assert. Also exported by
 * `nish:io`. Capability: none.
 *
 * @param message what stderr says before the exit.
 */
declare function panic(message: string): never;
/**
 * The whole file as one string; a path that cannot be read as one — missing, a
 * directory, a parent that cannot be searched — prints `nish: cannot read
 * <path>` to stderr and exits 1. A file longer than 2^31 - 1 bytes is one it
 * cannot read, in both number modes, as in Node. Paths are relative to the
 * working directory, and a NUL byte in `path` is refused as a missing path is.
 * A `wasm32` build has no file I/O and so no `readFileSync`.
 * Capability: fs.read.
 *
 * @param path the file to read.
 * @returns its contents.
 */
declare function readFileSync(path: string): string;
/**
 * The same read, answering `null` for every path the other exits over: a
 * missing path, a directory, a parent that cannot be searched, a pipe with no
 * length to ask for. A program can therefore report the missing file itself and
 * carry on; the call subsumes an `existsSync` and has no time-of-check race.
 * The result is narrowed with `if (text !== null)` like any other nullable.
 * The 2^31 - 1 byte limit and the NUL rule of `readFileSync` apply.
 * Capability: fs.read.
 *
 * @param path the file to read.
 * @returns its contents, or `null`.
 */
declare function readFileSyncOrNull(path: string): string | null;
/**
 * The file's bytes as they are on disk — nothing assumes UTF-8, so a zero byte,
 * a byte of 0x80 or above and an invalid sequence all come back unchanged, and
 * `length` is the file's size — or `null` for exactly the paths
 * `readFileSyncOrNull` answers `null` for: missing, a directory, a parent that
 * cannot be searched. There is no exiting twin. The array is an ordinary arena
 * `u8[]` with `length === capacity`, narrowed with `if (b !== null)`. A file
 * longer than 2^31 - 1 bytes is one it cannot read. A `wasm32` build has no file
 * I/O and so no `readFileBytesSync`. Under Node the answer is
 * `Array.from(fs.readFileSync(path))` or `null`. Capability: fs.read.
 *
 * @param path the file to read.
 * @returns its bytes, or `null`.
 */
declare function readFileBytesSync(path: string): u8[] | null;
/**
 * Open a regular file to read a window at a time (WP44): read-only,
 * close-on-exec and non-blocking, so a FIFO or a device never waits. A
 * directory is refused with `-21` and any other kind that is not a regular
 * file with `-22`, the descriptor closed again first. Pair it with `fileClose`
 * in a `try`/`finally`. A freestanding `wasm32` build refuses the call (NL2718);
 * `--profile wasi` reads through WASI. Capability: fs.read.
 *
 * @param path the file to open; a NUL in it is refused as a missing path is.
 * @returns a descriptor (`>= 0`), or the negated Linux errno: `-2` ENOENT,
 *   `-13` EACCES, `-20` ENOTDIR, `-21` EISDIR, `-22` EINVAL for a FIFO or
 *   device, `-6` ENXIO for a socket, `-23` ENFILE, `-24` EMFILE, `-36`
 *   ENAMETOOLONG, `-40` ELOOP; anything else is `-5` EIO.
 */
declare function fileOpen(path: string): i32;
/**
 * Read up to `len` bytes from byte `pos` of the file into `buf[off .. off +
 * len)`, without moving any shared offset (`pread`). The window is checked as
 * `buf.slice` checks it and panics the same way when it falls outside `buf`.
 * The array is never grown: memory follows the window. Capability: fs.read.
 *
 * @param fd a descriptor from `fileOpen`.
 * @param buf the array the bytes land in; its length is unchanged.
 * @param off where in `buf` the first byte lands.
 * @param len the most bytes to read.
 * @param pos the file offset to read from, an `i64`.
 * @returns the bytes read, `0` at end of file (and for a `len` of `0`, even on
 *   a closed or negative descriptor), or a negative errno: `-22`
 *   EINVAL for a negative `pos` or one where `pos + len` overflows, `-9` EBADF
 *   for a closed or negative descriptor, `-21` EISDIR, `-29` ESPIPE; anything
 *   else is `-5` EIO.
 */
declare function fileReadAt(fd: i32, buf: u8[], off: i32, len: i32, pos: i64): i32;
/**
 * The file's size in bytes now, from `fstat`: a file may grow or shrink between
 * this and a read, which then answers what is there. Capability: fs.read.
 *
 * @param fd a descriptor from `fileOpen`.
 * @returns the size, an `i64` past 2^31 when the file is, or a negative errno
 *   (`-9` EBADF for a closed descriptor).
 */
declare function fileSize(fd: i32): i64;
/**
 * Close a descriptor `fileOpen` gave. A second close answers `-9`, unless the
 * number has been handed out again since, so close once. Capability: fs.read.
 *
 * @param fd a descriptor from `fileOpen`.
 * @returns `0`, or a negative errno (`-9` EBADF).
 */
declare function fileClose(fd: i32): i32;
/**
 * The file's contents replaced by `data`, created at 0644 when missing;
 * statement position. A symbolic link as the last component of the path is
 * refused rather than followed, natively and under Node alike (a Node
 * `writeFileSync` would follow it), and a path that cannot be written prints
 * `nish: cannot write <path>` and exits 1. The string's bytes are written as
 * they are. Capability: fs.write.
 *
 * @param path the file to write.
 * @param data its new contents.
 */
declare function writeFileSync(path: string, data: string): void;
/**
 * `data` added at the end of the file, created at 0644 when missing; statement
 * position. A symbolic link as the last component is refused, as for
 * `writeFileSync`. Capability: fs.write.
 *
 * @param path the file to extend.
 * @param data the text appended.
 */
declare function appendFileSync(path: string, data: string): void;
/**
 * The file's contents replaced by `bytes`, created at 0644 when missing, the
 * array's bytes written as they are: `readFileBytesSync`'s other half. A
 * symbolic link as the last component is refused, as for `writeFileSync`. Where
 * `writeFileSync` exits, this answers, so a program can report the failure and
 * carry on. Never an exit and never a panic. A `wasm32` build refuses it.
 * Capability: fs.write.
 *
 * @param path the file to write.
 * @param bytes its new contents.
 * @returns the byte count (`bytes.length`), or a negative errno: `-2` ENOENT
 *   for a missing directory, `-13` EACCES, `-21` EISDIR, `-40` ELOOP for the
 *   refused link, `-22` EINVAL for a NUL in `path`.
 */
declare function writeFileBytesSync(path: string, bytes: readonly u8[]): i32;
/**
 * `rename(2)`: `from` takes the name `to`, replacing a file already there in
 * one step on one file system, so a reader sees the old file or the new one and
 * never neither — write a temporary next to the target, then rename it over.
 * Never a panic. A `wasm32` build refuses it. Capability: fs.write.
 *
 * @param from the name moved.
 * @param to the name it takes.
 * @returns 0, or a negative errno: `-2` ENOENT for a missing `from`, `-18`
 *   EXDEV when the two are on different file systems (nothing is copied: write
 *   the temporary in the target's directory), `-21` EISDIR or `-20` ENOTDIR for
 *   a file against a directory, `-22` EINVAL for a NUL in either path.
 */
declare function renameSync(from: string, to: string): i32;
/**
 * `unlink(2)`: the name `path` removed, and a symbolic link itself rather than
 * what it names. A directory is refused, not removed, with no fallback to
 * `rmdir`. Never a panic. A `wasm32` build refuses it. Capability: fs.write.
 *
 * @param path the name to remove.
 * @returns 0, or a negative errno: `-2` ENOENT for a missing path, `-21` EISDIR
 *   on Linux or `-1` EPERM where the kernel answers so, for a directory, `-22`
 *   EINVAL for a NUL in `path`.
 */
declare function unlinkSync(path: string): i32;
/**
 * `writeFileSync` with an explicit `mode`: the file is exactly `mode` (`0o600`
 * for a secret) before a byte of `data` is in it, whatever the umask or a file
 * already there had. The open passes `mode` and an `fchmod(2)` sets it before
 * the first byte is written, so the umask cannot widen it, a file that already
 * existed at 0644 is narrowed before it holds the new contents, and no reader
 * that opens it afterwards finds the secret under the old mode.
 *
 * A descriptor opened before, while the file was wider, is not revoked and
 * still reads what is written. A symbolic link at the path is refused (-40),
 * its target untouched. The file is truncated and written in place, so a crash
 * or a failed write leaves it empty or partial, and a file this process may
 * write but does not own is emptied before the mode change answers -1
 * (`EPERM`).
 *
 * For a file that must be the old one or the new one, write a temporary name
 * beside the target with this and move it over with `renameSync`. Never an exit
 * and never a panic. A `wasm32` build refuses it, and a WASI build answers
 * `-ENOSYS`, as WASI has no file modes to set. Capability: fs.write.
 *
 * @param path the file to write.
 * @param data its new contents.
 * @param mode the file's mode, 0..0o777.
 * @returns the byte count, or a negative errno: -22 for a mode outside
 *   0..0o777, the setuid, setgid and sticky bits included (they are refused, not
 *   applied), or a NUL in `path`; `-2` ENOENT for a missing directory; `-13`
 *   EACCES; -40 for the refused link.
 */
declare function writeFileSyncMode(path: string, data: string, mode: i32): i32;
/**
 * `data` in a new file of exactly `mode` (set as for `writeFileSyncMode`),
 * created only if nothing is at `path` (`O_CREAT | O_EXCL`): -17 EEXIST when any
 * name is, a dangling symbolic link included, which is never followed. Of
 * several processes racing for one path exactly one succeeds, so it takes a
 * lock: create it, and `unlinkSync` it to release. A write that fails after the
 * create removes the file, so a failed create never leaves a half-written lock
 * behind. Never an exit and never a panic. A `wasm32` build refuses it, and a
 * WASI build answers `-ENOSYS`. Capability: fs.write.
 *
 * @param path the file to create.
 * @param data its contents.
 * @param mode the file's mode, 0..0o777.
 * @returns the byte count, or a negative errno as for `writeFileSyncMode`, `-17`
 *   when something is already at `path`.
 */
declare function createFileExclusiveSync(path: string, data: string, mode: i32): i32;
/**
 * `mkdir(2)` of one level, made with `mode` less the umask (`0o700` is exact
 * under any umask that leaves the owner's bits, as every usual one does; a
 * wider mode may come out narrower). A path already there is -17 EEXIST and its
 * mode is left as it was, never changed. Never a panic. A `wasm32` build refuses
 * it, and a WASI build answers `-ENOSYS`. Capability: fs.write.
 *
 * @param path the directory to make.
 * @param mode its mode before the umask, 0..0o777.
 * @returns 0, or a negative errno: `-2` ENOENT for a missing parent; -22 for a
 *   mode outside 0..0o777 (the sticky, setuid and setgid bits included) or a NUL
 *   in `path`.
 */
declare function mkdirSyncMode(path: string, mode: i32): i32;
/**
 * One directory, not recursive, mode `0777 & ~umask`, exactly like Node's
 * `fs.mkdirSync(p)` with no options, so a missing parent is a failure and not a
 * reason to create it. Answers a value where it could have exited, so a program
 * can turn the failure into its own diagnostic. `isDirectorySync` is the `stat`
 * half of it. Capability: fs.write.
 *
 * @param path the directory to make.
 * @returns `true` when a directory exists at `path` once the call returns,
 *   whether this call created it or it was already there; `false` for every
 *   other outcome, a plain file at `path` included.
 */
declare function mkdirSync(path: string): boolean;
/**
 * Whether a directory is at `path` right now. One `stat`, and never an exit.
 * The answer is a fact about the file system as the call runs and can be stale
 * by the time the caller acts on it: `mkdirSync` is still the call that decides
 * whether a directory was made, and `readFileSyncOrNull` is still the way to
 * read a file without racing a check against it. Capability: fs.read.
 *
 * @param path the path to ask about.
 * @returns `true` for a directory; `false` for everything else — a missing
 *   path, a plain file, a device node, a parent that cannot be searched.
 */
declare function isDirectorySync(path: string): boolean;
/**
 * The directory's entries, sorted ascending by bytes (not by the file system's
 * order, which neither `readdir(3)` nor Node's `fs.readdirSync` sorts) and
 * without `.` or `..`; every other dotfile is an entry. The sort is by bytes
 * like every string comparison here, so it agrees with Node's `.sort()` for
 * ASCII names and can differ for names that are not. `null` when the directory
 * cannot be read at all — a missing path, a plain file, a parent that cannot be
 * searched.
 *
 * An empty directory is an empty array, so the null check is about the
 * directory and not about its contents. A WASI build always answers `null`:
 * `fd_readdir` lists a preopened directory rather than a path, which is a
 * different contract. Capability: fs.read.
 *
 * @param path the directory to list.
 * @returns the entry names, or `null`.
 */
declare function readdirSync(path: string): string[] | null;
/**
 * `path` with every symbolic link resolved and every `.`, `..` and repeated
 * separator removed, as an absolute path — or `null` when it does not resolve,
 * a path that does not exist included. Every component but the last must exist
 * for POSIX `realpath` to answer at all, so "does not resolve" is one answer
 * rather than several. The bytes are copied into the arena, so the result is an
 * ordinary string, narrowed with `if (p !== null)` like any other nullable.
 * Capability: fs.read.
 *
 * @param path the path to resolve.
 * @returns the resolved path, or `null`.
 */
declare function realpathSync(path: string): string | null;
/**
 * Run `argv[0]`, searched on `PATH`, with `argv` as its argument vector, and
 * wait for it. The child inherits this process's environment, streams and
 * working directory. The argument is checked down to its element type: an
 * `i32[]` is an array but not a command line. Arguments are passed as bytes, so
 * an embedded NUL truncates one. A `wasm32` build and a WASI build have no
 * processes, and a WASI build always answers `-1`. Capability: process.spawn.
 *
 * @param argv the program and its arguments.
 * @returns the exit status, or `128 + n` when signal `n` killed it (the shell's
 *   convention), or `-1` when the vector is empty — there is no `argv[0]` to
 *   run — and whenever the child cannot be started or cannot be waited for.
 */
declare function spawnSync(argv: string[]): number;
/**
 * The same run with each stream sent to a file rather than inherited: each
 * non-empty path is created or truncated at 0644, as `writeFileSync` does, and
 * a symbolic link as its last component is refused, which answers -1. An empty
 * string leaves that stream inherited, so one call can capture stdout and let
 * stderr through. The two paths must not name one file: each is opened
 * separately, with its own offset, so the streams would overwrite rather than
 * interleave; capture them apart and concatenate. Capability: process.spawn.
 *
 * @param argv the program and its arguments.
 * @param stdoutPath the file the child's stdout goes to, or `""`.
 * @param stderrPath the file the child's stderr goes to, or `""`.
 * @returns every answer `spawnSync` gives — the status, `128 + n`, and `-1` for
 *   an empty vector, a child that cannot be started, a refused link and a WASI
 *   build.
 */
declare function spawnSyncTo(argv: string[], stdoutPath: string, stderrPath: string): number;
/**
 * The same run with all three streams on pipes, all in memory: the child reads
 * `stdin`'s bytes and then end of file, and whatever it prints is appended to
 * `stdout` and `stderr`, which keep what they held. The runtime writes `stdin`
 * and drains both outputs in one `poll` loop, so a child that fills one pipe
 * while the parent waits on another cannot deadlock it. When a stream passes 16
 * MiB (`NISH_PIPED_CAP`) the child is killed with `SIGKILL` and that array
 * keeps the first 16 MiB.
 *
 * A child that exits without reading its stdin is not a failure. The child
 * inherits the environment and working directory, and no descriptor of the
 * program but its three streams; it starts with SIGPIPE as the program had it,
 * and the program's own SIGPIPE from writing to a child that stopped reading is
 * absorbed. The two output arrays are grown by the runtime, so `readonly` is
 * refused for them, as is a typed-array spelling (`Int32Array`, ...), whose
 * length is fixed. A `wasm32` build refuses it (NL2404). Capability:
 * process.spawn.
 *
 * @param argv the program and its arguments.
 * @param stdin the bytes the child reads.
 * @param stdout receives what the child prints on stdout.
 * @param stderr receives what the child prints on stderr.
 * @returns the status as `spawnSync` answers it (the exit code, `128 + n`, and
 *   `-1` for an empty vector, a child that cannot be started, a pipe or `poll`
 *   that fails, and a WASI build), or `-2` when a stream passed 16 MiB.
 */
declare function spawnPiped(argv: string[], stdin: readonly u8[], stdout: u8[], stderr: u8[]): i32;
/**
 * `spawnPiped` with a deadline: the same captured run, killed once `timeoutMs`
 * milliseconds have passed since it started. A negative `timeoutMs` is no
 * deadline, as `pollWait`'s is, so `spawnPipedWithin(argv, stdin, stdout,
 * stderr, -1)` is `spawnPiped(argv, stdin, stdout, stderr)`. When the deadline
 * passes the child is killed with `SIGKILL` and reaped, the answer is `-3`, and
 * `stdout` and `stderr` keep every byte read before the kill.
 *
 * The deadline covers the whole run, the wait for the child's exit included,
 * and is measured on the monotonic clock. Only the child's own pid is killed:
 * a grandchild it started is not, and one that keeps an output pipe open makes
 * the run wait for it, so a child that exited 0 can still answer `-3`. The
 * rest is `spawnPiped`'s: the same environment, descriptors, SIGPIPE handling
 * and 16 MiB cap, `readonly` and typed-array spellings refused for the two
 * output arrays, refused by a `wasm32` build (NL2404). Capability:
 * process.spawn.
 *
 * @param argv the program and its arguments.
 * @param stdin the bytes the child reads.
 * @param stdout receives what the child prints on stdout.
 * @param stderr receives what the child prints on stderr.
 * @param timeoutMs the milliseconds the run may take, or a negative number for
 *   no deadline.
 * @returns the status as `spawnPiped` answers it (the exit code, `128 + n`,
 *   `-1` for a child that cannot be started or a WASI build, `-2` when a stream
 *   passed 16 MiB), or `-3` when the deadline passed and the child was killed.
 */
declare function spawnPipedWithin(
  argv: string[],
  stdin: readonly u8[],
  stdout: u8[],
  stderr: u8[],
  timeoutMs: i32
): i32;
/**
 * `spawn` with the child holding `fds[i]` as descriptor `3 + i`, close-on-exec
 * cleared there. Its streams 0 to 2 are this process's, and no other descriptor
 * of this process reaches it but one opened without close-on-exec, which nothing
 * the runtime opens is. Any order works: `fds` may list a descriptor that is
 * already its own target (`[3]`), another entry's target (`[4, 3]`), or the same
 * one twice. An empty `fds` is `spawn` exactly. The child shares each
 * descriptor's open file, its offset and its status flags, `O_NONBLOCK` among
 * them, and this process keeps its own. Reap the pid with `waitPid`. No reading
 * under Node, which throws. A `wasm32` build refuses it (NL2404).
 * Capability: process.spawn.
 *
 * @param argv the program and its arguments.
 * @param fds the descriptors handed down, at most 64.
 * @returns the child's pid, or a negative errno: -22 more than 64 descriptors
 *   or a negative one (before anything is opened or started), -9 one that is
 *   not open, -24 (or -22 above the descriptor limit) a scratch descriptor the
 *   system cannot give.
 */
declare function spawnWithFds(argv: string[], fds: readonly i32[]): i32;
/**
 * Start `argv[0]` through `PATH` exactly as `spawnSync` does — the same vector,
 * environment, streams and working directory — and answer at once, without
 * waiting. The child is the program's until `waitPid` reaps it; one never
 * reaped stays a zombie until the program exits, as it would in C. Test
 * `pid > 0` before handing the answer on: a failure such as -1 (EPERM) passed
 * to `waitPid` reads as "any child". No reading under Node, which throws. A
 * `wasm32` build refuses it (NL2404), and a scope's task or a parallel body
 * that calls it is refused as any shared write is. Also exported by
 * `nish:process`.
 * Capability: process.spawn.
 *
 * @param argv the program and its arguments.
 * @returns the child's pid, or a negative errno: -22 (EINVAL) for an empty
 *   vector or an argument holding a NUL, and `posix_spawnp`'s own error
 *   otherwise, so a program that is not there is -2 (ENOENT).
 */
declare function spawn(argv: string[]): i32;
/**
 * Send `sig` to `pid`. Only 0, 2 (SIGINT), 9 (SIGKILL) and 15 (SIGTERM) are
 * accepted, whose numbers are the same on Linux and Darwin, so a number means
 * the same signal on every host. A positive `pid` may be any process of this
 * user, not only a child. A `wasm32` build refuses it (NL2404), and a scope's
 * task or a parallel body that calls it is refused as any shared write is.
 * Under Node it checks the signal and the pid as the native one does and turns
 * Node's error code back into its errno. Also exported by `nish:process`.
 * Capability: process.spawn.
 *
 * @param pid the process signalled; 0 or below is -22, because `kill(2)` reads
 *   those as a process group or every process.
 * @param sig 0, 2, 9 or 15; anything else is -22.
 * @returns 0, or a negative errno: -3 (ESRCH) when no process has the pid, a
 *   child already reaped included, -1 (EPERM) when it is another user's, -22
 *   for a refused `sig` or `pid`.
 */
declare function kill(pid: i32, sig: i32): i32;
/**
 * Reap a child and answer a fresh two-element array (the language has no
 * tuple). `pid` is a child's, or -1 for any child. After `signalFd()` a
 * blocking wait never sees EINTR, because that handler is installed with
 * `SA_RESTART` and the wait restarts, and it cannot be woken by SIGTERM either:
 * a supervisor that must answer a signal while its children run reaps with flag
 * 1 (WNOHANG) on each tick of a `pollWait` loop that also watches the signal
 * descriptor, and stops its children with `kill` when `readSignal` answers.
 *
 * No reading under Node, which throws, naming itself. A `wasm32` build refuses
 * it (NL2404), and a scope's task or a parallel body that calls it is refused
 * as any shared write is. Also exported by `nish:process`. Capability:
 * process.spawn.
 *
 * @param pid the child to wait for, or -1.
 * @param flags 0, or 1 for WNOHANG; any other bit is `[-22, 0]`, as is a pid
 *   that is neither -1 nor positive.
 * @returns `[pid, status]`, the status as `spawnSync` answers it (the exit
 *   code, or `128 + n` when signal `n` ended it); under WNOHANG `[0, 0]` means
 *   a child remains and none has exited; a failure is `[-errno, 0]`: `[-10, 0]`
 *   (ECHILD) with no child to wait for, `[-4, 0]` (EINTR) when a signal
 *   interrupted the wait.
 */
declare function waitPid(pid: i32, flags: i32): i32[];
/**
 * How many CPUs the program may use, with or without `--threads`: the smallest
 * of the CPUs online, the ones its thread may run on (an affinity mask, a
 * container's cpuset), a cgroup v2 CPU quota rounded up, and `NISH_NUM_THREADS`
 * when that is a positive number — which can lower the count and never raise
 * it. A program asks it to decide how many workers to start; it reads the count
 * again on each call. Under Node it is `os.availableParallelism()` lowered by
 * `NISH_NUM_THREADS`, and since Node reads no cgroup quota, inside a container
 * with one the two can differ. A `wasm32` build refuses it (NL2404). It writes
 * nothing and may be called in a task. Also exported by `nish:process`.
 * Capability: none.
 *
 * @returns at least 1.
 */
declare function availableParallelism(): i32;
/**
 * Bytes of physical memory — `_SC_PHYS_PAGES` times the page size on Linux,
 * `hw.memsize` on Darwin. It is the machine's, not a cgroup's limit. Under Node
 * it is `os.totalmem()`, a `bigint` as every `i64` is there. A `wasm32` build
 * refuses it (NL2404). It writes nothing and may be called in a task. Also
 * exported by `nish:process`. Capability: none.
 *
 * @returns the byte count, or -1 when the host does not say.
 */
declare function totalMemory(): i64;
/**
 * Set this process's nice value to `n` with `setpriority(PRIO_PROCESS, 0, n)`.
 * Lower-only, even as root, so the priority never rises. Children started
 * afterwards inherit it. Linux keeps the nice value per thread: a call sets the
 * calling thread's and every thread started after it, so it belongs at the top
 * of `main`, before a `scope()` or a parallel loop starts the pool, and a task
 * or a parallel body that calls it is refused as any shared write is. It never
 * crashes the program: a failure is only the answer.
 *
 * A `wasm32` build refuses it (NL2404). Throws under Node. Also exported by
 * `nish:process`. The label is `kill`'s: neither reaches another process, but
 * the priority is the one the program's children inherit, and a step down
 * cannot always be taken back. Capability: process.spawn.
 *
 * @param n the nice value, 0..19.
 * @returns 0, or a negative errno: `n` outside 0..19 is -22 (EINVAL), and `n`
 *   below the current value is -13 (EACCES), both with no system call.
 */
declare function setNice(n: i32): i32;
/**
 * Move this process to `SCHED_IDLE` with `sched_setscheduler(0, SCHED_IDLE,
 * ...)`, which runs it only when nothing else wants the CPU. Linux only. An
 * unprivileged process can never leave `SCHED_IDLE` again, and an idle process
 * can starve on a saturated machine, so a caller keeps a normal-priority
 * fallback (`setNice(19)`, or a deadline) for work that must finish. The policy
 * is per thread as `setNice`'s value is: call it at the top of `main`, and a
 * task or a parallel body that calls it is refused as any shared write is. A
 * `wasm32` build refuses it. Throws under Node. Also exported by
 * `nish:process`. Capability: process.spawn.
 *
 * @returns 0, or a negative errno, and -95 where the host has no such policy
 *   (Darwin; Linux's EOPNOTSUPP, as `nish:net` spells it).
 */
declare function setIdlePriority(): i32;
/**
 * Pin this process to CPU `cpu` alone (`sched_setaffinity`). Narrow-only: it
 * never moves a process onto a CPU it was kept off. `availableParallelism()`
 * answers 1 afterwards, and children started afterwards inherit the mask. A
 * task or a parallel body that calls it is refused as any shared write is. A
 * `wasm32` build refuses it (NL2404). Also exported by `nish:process`.
 * Capability: process.spawn.
 *
 * @param cpu the CPU index.
 * @returns 0, or a negative errno: a CPU outside the mask the process already
 *   has (an operator's `taskset` or cpuset), a negative one, or one at or past
 *   the kernel's `CPU_SETSIZE` is -22 with no change; -95 where the host has no
 *   affinity call (Darwin, and under Node).
 */
declare function setCpuAffinity(cpu: i32): i32;
/**
 * One environment variable, as the call runs. The value is what `getenv(3)`
 * answers, so it is bytes: a variable holding something that is not valid UTF-8
 * comes back as those bytes, as `readFileSync` does, and every offset into it
 * is a byte offset. The bytes are copied into the arena, so the result is an
 * ordinary string that outlives any later change to the environment, and it is
 * narrowed with `if (cc !== null)` like any other nullable.
 *
 * It is a call and not `process.env.CC`, because a member access on a key
 * chosen at runtime is forbidden. Two reads of one variable are two calls: a
 * `setenv` from linked C may change the answer between them. Also exported by
 * `nish:process`. Capability: env.
 *
 * @param name the variable's name.
 * @returns its value, or `null` when it is unset (an empty value, as `CC=`, is a
 *   set variable and answers a zero-length string).
 */
declare function getenv(name: string): string | null;
/**
 * `CLOCK_MONOTONIC` in nanoseconds, for timing a region of a program. The
 * origin is arbitrary, so only the difference between two reads means anything:
 * it is not comparable between two processes or two machines, and it is not a
 * date. It is an `i64` in both number modes. Two reads with work between them do
 * not fold into one. Not refused on `wasm32`. Also exported by `nish:process`.
 * Capability: clock.
 *
 * @returns nanoseconds since an arbitrary origin.
 */
declare function monotonicNanos(): i64;
/**
 * `CLOCK_REALTIME` in nanoseconds since 1970-01-01 UTC, for dating an event:
 * `Date.now`'s clock at a nanosecond's grain and as an `i64`. It can go
 * backwards when the system time is set, so a duration is `monotonicNanos`'s
 * job, not this one's. Not refused on `wasm32`. Also exported by `nish:process`.
 * Capability: clock.
 *
 * @returns nanoseconds since the epoch.
 */
declare function wallClockNanos(): i64;
/**
 * The modification time of `path` in milliseconds since the epoch, with the
 * sub-millisecond fraction the file system keeps, computed as Node's `mtimeMs`
 * is (seconds times 1e3 plus nanoseconds over 1e6, in doubles), so the two print
 * the same digits. `stat` follows a symbolic link, and a directory has a time of
 * its own. An `f64` has no `null`, so a path that cannot be stat'd answers NaN,
 * JavaScript's own answer for a time that is not one; test it with `m !== m`. A
 * `wasm32` build and the `wasi` profile have no host to reach and refuse it
 * (NL2404). Under Node it is `fs.statSync(path, { throwIfNoEntry: false
 * })?.mtimeMs`, or NaN. Also exported by `nish:fs`. Capability: clock.
 *
 * @param path the file to stat.
 * @returns milliseconds since the epoch, or NaN when it cannot be stat'd —
 *   missing, or a parent that cannot be searched.
 */
declare function statMtimeSync(path: string): f64;
/**
 * A descriptor that becomes readable when SIGTERM or SIGINT arrives. It is the
 * read end of a pipe that a `sigaction` handler in the runtime's C writes one
 * byte to per signal, so the signals' default action (ending the process) never
 * runs. The handler runs in whichever thread the signal lands on, so a
 * `scope()` task or a parallel worker running when it is called cannot take the
 * signal and end the process, and nothing is blocked for a spawned child to
 * inherit.
 *
 * Installing the handler overrides a disposition the process started with, so a
 * signal its parent ignored is heard, as `process.on("SIGTERM")` hears it under
 * Node. Made once: every later call answers the same descriptor. A child that
 * `spawnSync` or `spawnSyncTo` starts afterwards can still be stopped by either
 * signal, because `exec` resets a caught signal to its default. Signals other
 * than SIGTERM and SIGINT are not in the language. A descriptor rather than a
 * handler, so a server's loop can wait on it beside its sockets with
 * `pollWait`.
 *
 * A `wasm32` build and the `wasi` profile refuse it (NL2404). No reading under
 * Node, which delivers a signal only to its event loop: it throws. Also
 * exported by `nish:process`. Capability: signal.
 *
 * @returns the descriptor, or -1 when it cannot be made.
 */
declare function signalFd(): i32;
/**
 * Block until SIGTERM or SIGINT arrives. The argument is an `i32` in both number
 * modes, as a descriptor is, and an `f64`, an `i64` or a string is refused
 * rather than converted. It can wait forever. A `wasm32` build and the `wasi`
 * profile refuse it (NL2404). No reading under Node, which throws. Also
 * exported by `nish:process`. Capability: signal.
 *
 * @param fd `signalFd()`'s descriptor.
 * @returns the signal's number, 15 or 2; -1 for any `fd` that is not
 *   `signalFd()`'s, and for a read that fails.
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
// `NET_*` constants are numbers and need none. No function is callable in a
// `scope()` task or a parallel body, and a call that writes an array is
// refused in a scope's region on an array a task may read, as `fill` is.
// Every function is refused at compile time on wasm32 and the WASI profile
// (NL2404), except `netMss`, which compiles to the constant -1 there.

/**
 * Write the address form of a numeric `host` and `port` into `out`. No `nish:net` call looks a name
 * up; `nish/net/dns` resolves one first. An address is 18 bytes: the 16 bytes of an IPv6 address
 * (IPv4 as the mapped `::ffff:a.b.c.d`), then the port, big-endian, so `127.0.0.1:8080` is ten
 * zeros, `255 255`, `127 0 0 1`, `31 144`. An array longer than 18 bytes is fine; the rest is not
 * touched. Not callable in a `scope()` task or a parallel body. Refused at compile time on wasm32
 * and the WASI profile (NL2404); under Node it throws. A call that writes `out` is refused in a
 * scope's region on an array a task may read, as `fill` is. Capability: net.
 *
 * @param out at least 18 bytes, receiving the address; it must not be `readonly`, and is left as
 *   it was when the answer is -22.
 * @param host a numeric IPv4 dotted quad or IPv6 literal.
 * @param port the port, 0 to 65535.
 * @returns 0, or -22 for a name, a string with a NUL inside it, a port outside 0..65535 or an
 *   `out` shorter than 18 bytes.
 */
declare function netAddress(out: u8[], host: string, port: i32): i32;
/**
 * The port the socket `fd` is bound to, which is how a program that listened on port 0 learns the
 * one the kernel chose. Not callable in a `scope()` task or a parallel body. Refused at compile
 * time on wasm32 and the WASI profile (NL2404). Capability: net.
 *
 * @param fd a bound socket.
 * @returns the port, or a negative errno.
 */
declare function netLocalPort(fd: i32): i32;
/**
 * A listening TCP socket with `SO_REUSEADDR`, so a restarted server rebinds a port its old
 * connections still hold in `TIME_WAIT`. An IPv4 host is an IPv4 socket; any other is IPv6 with
 * `IPV6_V6ONLY` off, so `"::"` hears IPv4 and IPv6, and on a kernel without IPv6 `"::"` is IPv4's
 * `0.0.0.0`. Not callable in a `scope()` task or a parallel body. Refused at compile time on wasm32
 * and the WASI profile (NL2404). Capability: net.
 *
 * @param host the numeric address to bind.
 * @param port the port, 0 for any.
 * @param backlog the kernel's queue of unaccepted connections.
 * @returns the listener's descriptor, or a negative errno: -98 when the port is in use, -22 for
 *   a host that is not a literal.
 */
declare function tcpListen(host: string, port: i32, backlog: i32): i32;
/**
 * `tcpListen`'s socket, with `SO_REUSEPORT` for flag 1 and `TCP_NODELAY` on
 * each accepted socket for flag 2. Flag 1 lets several listeners that all ask
 * for it share one port, each with its own accept queue, whether one process
 * holds them all or each of several processes holds one.
 *
 * On Linux the connections are spread by a hash of the connection's 4-tuple and
 * only listeners of the same user may share; on Darwin the listeners share the
 * port but one of them takes the connections, so the flag buys a restart
 * without a gap rather than a spread. Flag 2 sets `TCP_NODELAY` on every
 * connection `tcpAccept` takes from the listener, on every platform: the
 * runtime sets it on each accepted socket, and a connection on which it cannot
 * be set is closed and its failure answered.
 *
 * Flag 4, with flag 1, steers by CPU: a new connection goes to the group's
 * listener whose bind order is the index of the CPU that received it (Linux;
 * -95 elsewhere); a CPU past the group's size falls back to the hash. Flags
 * add: 3 is both, 5 and 7 steer. Flag 0 is `tcpListen` exactly. A port held by
 * a listener without flag 1 is -98 to a listener that asks for it, and the
 * other way round. Refused at compile time on wasm32 and the WASI profile
 * (NL2404). Not callable in a `scope()` task or a parallel body. Capability:
 * net.
 *
 * @param host the numeric address to bind.
 * @param port the port, 0 for any.
 * @param backlog the kernel's queue of unaccepted connections.
 * @param flags 1, 2 and 4 as above.
 * @returns the listener's descriptor, or a negative errno: -22 for any other bit (a negative
 *   `flags` included) or 4 without 1, before a socket is made; -95 for flag 4 off Linux; -98
 *   for a port in use.
 */
declare function tcpListenFlags(host: string, port: i32, backlog: i32, flags: i32): i32;
/**
 * The next waiting connection, as a descriptor of its own, non-blocking and close-on-exec, with the
 * peer's address written into `peer`. Not `willreturn`: on a blocking socket the program inherited
 * it waits. Not callable in a `scope()` task or a parallel body. A call that writes `peer` is
 * refused in a scope's region on an array a task may read, as `fill` is. Refused at compile time on
 * wasm32 and the WASI profile (NL2404). Capability: net.
 *
 * @param fd the listener.
 * @param peer at least 18 bytes, receiving the peer's address in the 18-byte form; it must not
 *   be `readonly`. A shorter `peer` is -22 before anything is accepted, so no connection is
 *   taken and lost.
 * @returns the connection's descriptor; -11 when none waits; -95 for a datagram socket.
 */
declare function tcpAccept(fd: i32, peer: u8[]): i32;
/**
 * Up to `len` bytes into `buf[off, off + len)`. The range is checked in the compiled code before
 * the call: one outside `0 <= off <= off + len <= buf.length`, or a negative `off` or `len`, panics
 * with `slice out of range: [4, 9) of length 8` (the numbers are the range and length), exit 1. A
 * `buf` that is not a writable `u8[]` is refused at compile time (NL2402). Not callable in a
 * `scope()` task or a parallel body. A call that writes `buf` is refused in a scope's region on an
 * array a task may read, as `fill` is. Refused at compile time on wasm32 and the WASI profile
 * (NL2404). Capability: net.
 *
 * @param fd the socket to read.
 * @param buf the buffer filled.
 * @param off the first byte of `buf` written.
 * @param len the most bytes read; a `len` of 0 answers 0 too, so ask for at least one byte.
 * @returns the count, 0 at end of stream, or -11 when nothing is waiting.
 */
declare function netRead(fd: i32, buf: u8[], off: i32, len: i32): i32;
/**
 * Up to `len` bytes of `buf[off, off + len)`. A gone peer is -32, never SIGPIPE, so a closed
 * connection cannot end the process. The range is checked as `netRead`'s is, with the same panic.
 * `buf` may be `readonly`; anything but a `u8[]` is refused at compile time (NL2405). Not callable
 * in a `scope()` task or a parallel body. Refused at compile time on wasm32 and the WASI profile
 * (NL2404). Capability: net.
 *
 * @param fd the socket to write.
 * @param buf the bytes sent.
 * @param off the first byte sent.
 * @param len the most bytes sent.
 * @returns the count, which may be fewer than `len`, or a negative errno: -11 when the send
 *   buffer is full, -32 for a gone peer.
 */
declare function netWrite(fd: i32, buf: readonly u8[], off: i32, len: i32): i32;
/**
 * `netWrite` of `a`'s range then `b`'s, in one system call (`sendmsg` with two buffers), so a
 * header and a body leave together with no copy into one buffer. The count may be fewer than
 * `aLen + bLen` and may end inside `a`; the program sends the rest, as after a short `netWrite`. A gone
 * peer is -32, never SIGPIPE. Both ranges are checked as `netRead`'s is, `a`'s first, and either
 * may be empty. Not callable in a `scope()` task or a parallel body. Refused at compile time on
 * wasm32 and the WASI profile (NL2404). Capability: net.
 *
 * @param fd the socket to write.
 * @param a the first buffer.
 * @param aOff the first byte of `a` sent.
 * @param aLen how many bytes of `a`.
 * @param b the second buffer.
 * @param bOff the first byte of `b` sent.
 * @param bLen how many bytes of `b`.
 * @returns the count of both, at most `aLen + bLen`, or a negative errno: -11 when the send
 *   buffer is full, -32 for a gone peer.
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
 * Shut one or both directions of a connection. Not callable in a `scope()` task or a parallel body.
 * Refused at compile time on wasm32 and the WASI profile (NL2404). Capability: net.
 *
 * @param fd the socket.
 * @param how the read side (0), the write side (1) or both (2).
 * @returns 0, or a negative errno; -22 for any other `how`.
 */
declare function netShutdown(fd: i32, how: i32): i32;
/**
 * Close the descriptor. The descriptor is gone whatever the answer, as `close(2)` promises on
 * Linux. Not `willreturn`, because a socket the program inherited with a linger time can wait. Not
 * callable in a `scope()` task or a parallel body. Refused at compile time on wasm32 and the WASI
 * profile (NL2404). Capability: net.
 *
 * @param fd the descriptor closed.
 * @returns 0, or the failure.
 */
declare function netClose(fd: i32): i32;
/**
 * A new TCP socket, non-blocking and close-on-exec, that starts connecting to `addr`: an IPv4
 * address from an IPv4 socket, any other from an IPv6 one. It answers its descriptor at once, while
 * the connection is still being made: the `EINPROGRESS` (-115) of a non-blocking `connect` is not a
 * failure, and the loop says when it has finished by reporting the descriptor writable (ask
 * `pollAdd` for events 2, then `connectResult`). It holds `TCP_NODELAY`, so a small write is sent
 * at once. Neither this nor `connectResult` waits or allocates. Not callable in a `scope()` task or
 * a parallel body. Refused at compile time on wasm32 and the WASI profile (NL2404). Capability:
 * net.
 *
 * ```ts
 * const addr: u8[] = new Array<u8>(18);
 * netAddress(addr, "127.0.0.1", 8080);
 * const fd = tcpConnect(addr);          // the descriptor, still connecting
 * pollAdd(loop, fd, 2, 1);              // writable once it has finished
 * // ... pollWait until token 1 comes back ...
 * if (connectResult(fd) === 0) {
 *   pollModify(loop, fd, 1, 1);         // connected: now wait to read
 * }
 * ```
 *
 * @param addr the 18-byte address to connect to; a shorter one is -22 before any socket exists.
 * @returns the socket's descriptor, or a negative errno; any failure but -115 closes the socket
 *   and is answered instead of it.
 */
declare function tcpConnect(addr: readonly u8[]): i32;
/**
 * How the connection of a `tcpConnect` went, asked once `fd` is writable. The kernel clears the
 * failure as it is read, so a second call answers 0; the descriptor is closed with `netClose`
 * either way. Not callable in a `scope()` task or a parallel body. Refused at compile time on
 * wasm32 and the WASI profile (NL2404). Capability: net.
 *
 * @param fd the connecting socket.
 * @returns 0 when the connection is made, else its failure from `SO_ERROR`: -111 for a port
 *   nobody listens on, -110 for one that never answered.
 */
declare function connectResult(fd: i32): i32;
/**
 * A datagram socket, non-blocking and close-on-exec, bound to a numeric host and port the way
 * `tcpListen`'s is, `"::"` and its IPv4 fallback included. The ECN bits of every datagram are
 * always read. Without flag 1 a port in use is -98. Refused at compile time on wasm32 and the WASI
 * profile (NL2404), and not callable in a `scope()` task or a parallel body. Capability: net.
 *
 * @param host the numeric address to bind.
 * @param port the port, 0 for any.
 * @param flags flag 1 `SO_REUSEPORT`, so several sockets that all ask for it share a port and
 *   the kernel spreads the datagrams across them; flag 2 `UDP_GRO` (-95 on Darwin); flag 4, with
 *   flag 1 and a group size N from 1 to 255 in bits 8 to 15, steers QUIC: the port's group hands
 *   each datagram to its socket number (byte 0 of the Destination Connection ID) mod N, in the
 *   order the sockets were bound, and a refused attach closes the socket and answers the errno
 *   (-95 on Darwin). Flag 4 without 1, with 2 or with N 0, N without 4, or any other bit is -22.
 * @returns the socket's descriptor, or a negative errno.
 */
declare function udpBind(host: string, port: i32, flags: i32): i32;
/**
 * `buf[off, off + len)` to the address `to`, in one `sendmsg`. Not `willreturn`: on a blocking
 * socket the program inherited it waits. The range is checked as `netRead`'s is, with the same
 * panic. On Linux a `segment` above 0 is GSO: one send of 4,800 bytes with `segment = 1200` leaves
 * as four datagrams of 1,200. A socket that is IPv4, bound to an IPv4 host or to `"::"` on a kernel
 * without IPv6, sends to an `::ffff:a.b.c.d` address as IPv4. On Darwin a `segment` or an `ecn`
 * above 0 is -95. Not callable in a `scope()` task or a parallel body. Refused at compile time on
 * wasm32 and the WASI profile (NL2404). Capability: net.
 *
 * @param fd the UDP socket.
 * @param buf the bytes sent; may be `readonly`.
 * @param off the first byte sent.
 * @param len how many bytes.
 * @param to the 18-byte destination address; a shorter one is -22.
 * @param segment the datagram size when above 0: the kernel cuts the payload into datagrams of
 *   `segment` bytes, the last one shorter, so one call sends many; 0 for one datagram. Outside
 *   0..65535 is -22.
 * @param ecn the two ECN bits of the IP header: 0 not ECN-capable, 1 ECT(1), 2 ECT(0), 3 CE.
 *   Outside 0..3 is -22.
 * @returns the bytes sent, or a negative errno: -11 when the send buffer is full; -22 also for
 *   a payload the kernel will not cut (more segments than it takes in one call, or a segment
 *   the route cannot carry).
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
 * The next datagram, or several GRO coalesced, into `buf[off, off + len)` in
 * one `recvmsg`, cut to `len` if it is longer. An empty datagram is a datagram:
 * the answer is 0 for it. Not `willreturn`, as `udpSendTo`. The range is
 * checked as `netRead`'s is, with the same panic. `meta` must be an `i32[]`
 * (NL2406), and none of the written arrays may be `readonly`.
 *
 * On a socket bound with `udpBind` flag 2, one GSO send arrives as one datagram
 * of up to 64 KB with `meta[0]` its segment size, so walk the buffer in steps
 * of that size, the last datagram possibly shorter; without it the datagrams
 * arrive apart with `meta[0]` 0. The kernel coalesces only datagrams of one
 * flow that arrive after the option is set. On Darwin `meta` is always `0, 0`,
 * and a `meta[1]` of 0 is also what a datagram that is not ECN-capable reads
 * as.
 *
 * Not callable in a `scope()` task or a parallel body. A call that writes
 * `buf`, `from` or `meta` is refused in a scope's region on an array a task may
 * read, as `fill` is. Refused at compile time on wasm32 and the WASI profile
 * (NL2404). Capability: net.
 *
 * @param fd the UDP socket.
 * @param buf the buffer filled.
 * @param off the first byte of `buf` written.
 * @param len the most bytes read.
 * @param from at least 18 bytes, receiving the sender in the 18-byte form; a shorter one is -22
 *   before anything is taken.
 * @param meta at least 2 slots, receiving [GRO segment size, ECN]: `meta[0]` the size of each
 *   datagram the kernel coalesced into this one (0 when it coalesced none), `meta[1]` the ECN
 *   bits the datagram arrived with. A shorter one is -22 before anything is taken.
 * @returns the datagram's length, or a negative errno: -11 when none is waiting.
 */
declare function udpRecvFrom(fd: i32, buf: u8[], off: i32, len: i32, from: u8[], meta: i32[]): i32;
/**
 * A readiness loop, level-triggered: epoll on Linux, kqueue on Darwin. The descriptor is
 * close-on-exec. A descriptor still ready when the program waits again is reported again, so a loop
 * that handles one pair of several, or leaves a datagram unread, loses nothing. Nothing here
 * allocates. Refused at compile time on wasm32 and the WASI profile (NL2404), and not callable in a
 * `scope()` task or a parallel body. Capability: net.
 *
 * ```ts
 * const loop = pollCreate();
 * pollAdd(loop, server, 1, 1);
 * pollAdd(loop, signalFd(), 1, 2);
 * const ready: i32[] = new Array<i32>(32);
 * let running = true;
 * while (running) {
 *   const n = pollWait(loop, ready, -1);
 *   for (let k = 0; k < n; k++) {
 *     if (ready[2 * k] === 2) {
 *       running = false;             // SIGTERM or SIGINT
 *     } else {
 *       serve(server);               // until it answers -11
 *     }
 *   }
 * }
 * ```
 *
 * @returns the loop's descriptor, or a negative errno.
 */
declare function pollCreate(): i32;
/**
 * Watch `fd` for `events` under `token`. On Darwin a descriptor added watching nothing is known to
 * the loop but never reported (a disabled read filter), and an add that answers -17 leaves the
 * descriptor under the token it gave rather than the old one. Not callable in a `scope()` task or a
 * parallel body. Refused at compile time on wasm32 and the WASI profile (NL2404). Capability: net.
 *
 * @param loop the loop from `pollCreate`.
 * @param fd the descriptor watched.
 * @param events 1 readable, 2 writable, 3 both, 0 neither.
 * @param token an `i32` of the program's choosing, which `pollWait` reports it under as it went
 *   in.
 * @returns 0, or a negative errno: -17 for a descriptor the loop already watches, -22 for an
 *   event bit past 2.
 */
declare function pollAdd(loop: i32, fd: i32, events: i32, token: i32): i32;
/**
 * New events or a new token for a watched `fd`. Not callable in a `scope()` task or a parallel
 * body. Refused at compile time on wasm32 and the WASI profile (NL2404). Capability: net.
 *
 * @param loop the loop from `pollCreate`.
 * @param fd the descriptor watched.
 * @param events 1 readable, 2 writable, 3 both, 0 neither.
 * @param token the number `pollWait` reports it under.
 * @returns 0, or a negative errno: -2 for a descriptor the loop does not watch.
 */
declare function pollModify(loop: i32, fd: i32, events: i32, token: i32): i32;
/**
 * Stop watching `fd`. Closing a descriptor stops the watching too. Not callable in a `scope()` task
 * or a parallel body. Refused at compile time on wasm32 and the WASI profile (NL2404). Capability:
 * net.
 *
 * @param loop the loop from `pollCreate`.
 * @param fd the descriptor no longer watched.
 * @returns 0, or a negative errno: -2 for a descriptor the loop does not watch.
 */
declare function pollRemove(loop: i32, fd: i32): i32;
/**
 * Wait for readiness, filling pairs: `ready[2k]` token, `ready[2k + 1]` events
 * (1 readable, 2 writable, with 4 added for a hang-up or an error). Not
 * `willreturn`, because it can wait forever. It never writes past
 * `ready.length`. `ready` must be an `i32[]` (the tokens are the program's own
 * `i32`s) and not `readonly`. A signal that interrupts the wait makes it answer
 * 0, as a timeout does, rather than wait past the deadline; the descriptor
 * `signalFd()` answers can be added to the loop, and is readable when SIGTERM
 * or SIGINT arrives.
 *
 * A UDP socket is always writable, and on Linux one whose both sides are shut
 * is readable, writable and hung up, 7. On Darwin a descriptor both readable
 * and writable is one pair, 3; a descriptor watching nothing is never reported
 * (epoll still reports its hang-up or error as 4); and a peer's half-close is 5
 * (`1|4`) where Linux reports 1. Not callable in a `scope()` task or a parallel
 * body. A call that writes `ready` is refused in a scope's region on an array a
 * task may read, as `fill` is. Refused at compile time on wasm32 and the WASI
 * profile (NL2404). Capability: net.
 *
 * @param loop the loop from `pollCreate`.
 * @param ready receives the pairs; shorter than 2 is -22.
 * @param timeoutMs the most milliseconds to wait; negative: forever (-1).
 * @returns how many pairs, at most `ready.length / 2` and at most 64 (the rest stay ready for
 *   the next wait), 0 on a timeout, or a negative errno.
 */
declare function pollWait(loop: i32, ready: i32[], timeoutMs: i32): i32;
/**
 * Set one socket option from a whitelist: there is no raw level and option number, so a program
 * cannot pass a level, a name and a length through to the kernel. The ids are the runtime's own
 * numbers, the same on Linux and Darwin. Refused at compile time on wasm32 and the WASI profile
 * (NL2404); under Node it throws rather than set one. Not callable in a `scope()` task or a
 * parallel body. Capability: net.
 *
 * ```ts
 * import { NET_TCP_QUICKACK, netSetOption } from "nish:net";
 *
 * // After each response: Linux may have left quick-ACK mode.
 * export const answered = (conn: i32): i32 => netSetOption(conn, NET_TCP_QUICKACK, 1);
 * ```
 *
 * @param fd the socket.
 * @param option one of the `NET_*` ids below; any other is -22.
 * @param value the option's value: 0 or 1 for the switches, a byte count for the buffer sizes.
 * @returns 0, or a negative errno (-9 a closed descriptor, -88 not a socket, -95 for
 *   `NET_TCP_QUICKACK` off Linux).
 */
declare function netSetOption(fd: i32, option: i32, value: i32): i32;
/**
 * A connected TCP socket's send MSS, the payload bytes one segment carries: Linux's `TCP_INFO`
 * `tcpi_snd_mss`, or `TCP_MAXSEG` where that is not above 0 and on Darwin. The answer moves
 * as the path does, so read it when it is needed rather than once. It never panics. Not
 * callable in a `scope()` task or a parallel body. It compiles on wasm32 and the WASI
 * profile, where it is the constant -1 with its descriptor still evaluated; under Node it
 * throws rather than answer -1.
 * Capability: net.
 *
 * ```ts
 * import { netMss } from "nish:net";
 *
 * // A batch of whole segments, or the caller's own size where there is no MSS.
 * export const batch = (conn: i32, fallback: i32): i32 => {
 *   const mss = netMss(conn);
 *   return mss > 0 ? mss * 8 : fallback;
 * };
 * ```
 *
 * @param fd the socket.
 * @returns the MSS; -1, never an errno, for anything else (a descriptor that is not open, a
 *   socket with no peer such as a listener or one never connected, though the kernel answers
 *   its default `536` for those, a socket that is not TCP), and always on wasm.
 */
declare function netMss(fd: i32): i32;
/**
 * `netSetOption` id 1, `TCP_NODELAY`: `value` 1 sends a small write at once, 0 lets Nagle's
 * algorithm batch it. Folds to its number in the IR; cannot be assigned and is not a module
 * constant, so a module constant cannot be initialised from it. A local of the same name
 * shadows the global spelling. Capability: none.
 */
declare const NET_TCP_NODELAY: i32;
/**
 * `netSetOption` id 2, `TCP_QUICKACK` (Linux; -95 elsewhere): `value` 1 acknowledges at once,
 * 0 lets the kernel delay the ACK. Linux does not keep quick-ACK mode: the kernel leaves it on
 * its own, so a server that wants a mode sets it again after every response.
 * Capability: none.
 */
declare const NET_TCP_QUICKACK: i32;
/**
 * `netSetOption` id 3, `SO_KEEPALIVE`: `value` 1 probes an idle connection, 0 does not.
 * Capability: none.
 */
declare const NET_SO_KEEPALIVE: i32;
/**
 * `netSetOption` id 4, `SO_SNDBUF`: the send buffer, `value` in bytes; Linux doubles the value
 * it stores. Capability: none.
 */
declare const NET_SO_SNDBUF: i32;
/**
 * `netSetOption` id 5, `SO_RCVBUF`: the receive buffer, `value` in bytes; Linux doubles the
 * value it stores. Capability: none.
 */
declare const NET_SO_RCVBUF: i32;
/**
 * A listening Unix stream socket at `path` (`@name`: Linux's abstract
 * namespace), its file mode 0600, so only its owner may connect. A Unix socket
 * is a descriptor like any other: `netRead`, `netWrite`, `netShutdown`,
 * `netClose` and the readiness loop take it, and a gone peer is -32. The path
 * is bytes up to the first NUL, so a NUL inside it is -22, as an empty path is.
 *
 * It must fit `sun_path` with its NUL: 107 bytes on Linux, 103 on Darwin,
 * measured on the string as written; a longer one is -36 before a socket
 * exists. An abstract name leaves no file; its name is at most 107 bytes, a
 * bare `@` is -22, and on Darwin every `@` path is -95. A file whose name
 * starts with `@` is spelled `./@name`. A bind never replaces a file. Closing a
 * listener does not unlink its file: `unlinkSync` it when the server stops, or
 * let the next start's `NET_UNIX_UNLINK_STALE` clear it.
 *
 * A failure after the bind closes the socket and unlinks the file it made. A
 * connect needs write permission on the file and search permission on every
 * directory above it, which is the real boundary: put the socket in a directory
 * only the users who may connect can reach. With `NET_UNIX_UNLINK_STALE`, the
 * runtime connects to an existing socket file and unlinks it only on a refusal;
 * between the probe and the unlink another process can bind the path, so the
 * directory must be the program's own. Refused at compile time on wasm32 and
 * the WASI profile (NL2404). Not callable in a `scope()` task or a parallel
 * body. Capability: net.
 *
 * @param path the socket file, or `@name`; it must be a `string`.
 * @param backlog the kernel's queue of unaccepted connections.
 * @param flags 0, or `NET_UNIX_UNLINK_STALE`.
 * @returns the listener's descriptor, or a negative errno: a path that exists is -98, unless
 *   `flags` holds `NET_UNIX_UNLINK_STALE` and the file is a socket nothing listens on (a live
 *   listener, even with a full backlog, stays -98); -17 when that flag finds something that is
 *   not a socket, which is left alone; -95 on Darwin when that flag meets a socket file, which
 *   is left alone, since the probe cannot tell a dead file from a full backlog; -36 a path too
 *   long, -22 an empty path, a bare `@`, a NUL inside or any other flag bit.
 */
declare function unixListen(path: string, backlog: i32, flags: i32): i32;
/**
 * `unixListen` with the socket file's mode chosen, set between the bind and the listen so no
 * connect gets in under a wider one. Not callable in a `scope()` task or a parallel body. Refused
 * at compile time on wasm32 and the WASI profile (NL2404). Capability: net.
 *
 * @param path the socket file.
 * @param backlog the kernel's queue of unaccepted connections.
 * @param flags 0, or `NET_UNIX_UNLINK_STALE`.
 * @param mode the file's mode, 0 to 0o777 and no other bits.
 * @returns the listener's descriptor, or a negative errno; -22 for a mode outside that range
 *   or an `@name`, which has no file to give a mode to, and the refusals of `unixListen`.
 */
declare function unixListenMode(path: string, backlog: i32, flags: i32, mode: i32): i32;
/**
 * A new socket, non-blocking and close-on-exec, connected to the listener at `path`. A relative
 * path is the working directory's. Not callable in a `scope()` task or a parallel body. Refused at
 * compile time on wasm32 and the WASI profile (NL2404). Capability: net.
 *
 * @param path the socket file, or `@name`; it must be a `string`.
 * @returns the socket's descriptor, or a negative errno: -111 when nothing listens there, -2
 *   when there is no such file, -11 a full backlog on Linux (-111 on Darwin; the socket is
 *   closed, try again later), and the path refusals `unixListen` has.
 */
declare function unixConnect(path: string): i32;
/**
 * The next connection on a Unix listener, non-blocking and close-on-exec. No peer address is
 * written: a Unix client is seldom bound. Not callable in a `scope()` task or a parallel body.
 * Refused at compile time on wasm32 and the WASI profile (NL2404). Capability: net.
 *
 * @param fd the listener.
 * @returns the connection's descriptor; -11 when none is waiting.
 */
declare function unixAccept(fd: i32): i32;
/**
 * Two connected sockets into `fds[0]` and `fds[1]`, non-blocking and close-on-exec: a channel
 * without a name for a child process or one side of a program. `fds` must be an `i32[]` and not
 * `readonly`. Not callable in a `scope()` task or a parallel body. A call that writes `fds` is
 * refused in a scope's region on an array a task may read, as `fill` is. Refused at compile time on
 * wasm32 and the WASI profile (NL2404). Capability: net.
 *
 * @param kind `NET_UNIX_STREAM` or `NET_UNIX_SEQPACKET` (-95 on Darwin), which keeps each write
 *   one message so a read returns one message, never two run together.
 * @param fds at least 2 slots, receiving the pair.
 * @returns 0; -22 another kind or an `fds` shorter than 2, before a socket exists.
 */
declare function unixSocketPair(kind: i32, fds: i32[]): i32;
/**
 * Send `buf[off..off+len)` over the Unix socket `sock` with a copy of the
 * descriptor `fd` (`SCM_RIGHTS`). The receiver's `recvFd` gets a new descriptor
 * for the same open file, with its offset and status flags shared, as `dup`
 * gives; `fd` stays open here. The descriptor rides on at least one byte of
 * data, so the receiver's read is what tells it a descriptor came. A stream
 * socket can send short: the descriptor travels with the first bytes, so send
 * the rest with `netWrite`, not `sendFd`, or the receiver gets a second copy.
 *
 * The range is checked as `netRead`'s is, with the same panic; `buf` may be
 * `readonly`. Not callable in a `scope()` task or a parallel body. Refused at
 * compile time on wasm32 and the WASI profile (NL2404). Capability: net.
 *
 * @param sock the Unix socket.
 * @param fd the descriptor sent.
 * @param buf the bytes sent with it.
 * @param off the first byte sent.
 * @param len how many bytes, at least 1.
 * @returns the bytes sent, or a negative errno; -22 a zero `len` or a
 *   negative `fd`, -9 a closed `sock` or an `fd` that is not open, -88 a `sock` that is not a
 *   socket, -95 one that is not Unix (checked before anything is sent), -32 a gone peer.
 */
declare function sendFd(sock: i32, fd: i32, buf: readonly u8[], off: i32, len: i32): i32;
/**
 * Read at most `len` bytes into `buf[off..]` from the Unix socket `sock`, and
 * the first descriptor that came with them into `fd[0]`, or -1 when the message
 * carried none. Every other descriptor in the message is closed before the
 * answer, so a peer cannot leave this process holding descriptors it never
 * asked for; room is made for 8, so the kernel drops the rest of a message that
 * carries more and the bytes are still answered.
 *
 * The one kept is close-on-exec, so a later `spawn` does not hand it on, and
 * keeps the sender's blocking mode (it is not made non-blocking, so `netRead`
 * on a blocking one waits: set what the program needs on it before it joins a
 * loop). The range is checked as `netRead`'s is, with the same panic. `buf` and
 * `fd` must not be `readonly`, and `fd` must be an `i32[]`. On Darwin the
 * descriptor is made close-on-exec by a later `fcntl`, so a child another
 * thread spawns between the two inherits it.
 *
 * Not callable in a `scope()` task or a parallel body. A call that writes `buf`
 * or `fd` is refused in a scope's region on an array a task may read, as `fill`
 * is. Refused at compile time on wasm32 and the WASI profile (NL2404).
 * Capability: net.
 *
 * @param sock the Unix socket.
 * @param buf the buffer filled.
 * @param off the first byte of `buf` written.
 * @param len the most bytes read, at least 1.
 * @param fd receives the descriptor, or -1.
 * @returns the bytes read, 0 at the end of the stream, -11 when nothing is waiting, or a
 *   negative errno; -22 a zero `len` or an empty `fd`, -9 a closed `sock`, -88 not a socket,
 *   -95 not Unix (all before anything is read).
 */
declare function recvFd(sock: i32, buf: u8[], off: i32, len: i32, fd: i32[]): i32;
/**
 * The peer of the Unix socket `fd` as the kernel recorded it when the
 * connection was made (the `connect`, or the `socketpair`): `out` gets its pid,
 * uid and gid. A peer that has since changed its uid, passed the socket on or
 * closed still reads as it was then. The pid is -1 where Darwin has no
 * `LOCAL_PEERPID` or the kernel refuses it. A uid or gid of 2^31 or above wraps
 * (-2 is uid 4294967294). `out` must be an `i32[]` and not `readonly`. Not
 * callable in a `scope()` task or a parallel body.
 *
 * A call that writes `out` is refused in a scope's region on an array a task
 * may read, as `fill` is. Refused at compile time on wasm32 and the WASI
 * profile (NL2404). Capability: net.
 *
 * @param fd the connected Unix socket.
 * @param out at least 3 slots, receiving pid, uid and gid.
 * @returns 0; -22 an `out` shorter than 3, -9 a closed `fd`, -88 not a
 *   socket, -95 not Unix (all before anything is asked), -107 a socket with no peer (a
 *   listener, or one never connected), on every platform.
 */
declare function peerCredentials(fd: i32, out: i32[]): i32;
/**
 * `unixListen` flag 1: unlink a socket file nothing listens on, then bind. It clears only the
 * file a server that died left. On Darwin it never unlinks one. It has the same value as
 * `NET_UNIX_STREAM`, so the checker cannot tell one passed where another belongs: name the one
 * the call takes. Capability: none.
 */
declare const NET_UNIX_UNLINK_STALE: i32;
/**
 * `unixSocketPair` kind 1: a byte stream, as a connection is. Capability: none.
 */
declare const NET_UNIX_STREAM: i32;
/**
 * `unixSocketPair` kind 2: each write one message (`SOCK_SEQPACKET`); -95 on Darwin.
 * Capability: none.
 */
declare const NET_UNIX_SEQPACKET: i32;

// ---- `nish:term` ------------------------------------------------------------------
//
// stdin without blocking and the terminal it may be: the frame clock and the
// keys of a terminal UI, with no `net` capability. -11 is "nothing is
// waiting" and -25 "not a terminal" on every platform; any other failure is
// the host's `-errno`. Under WASI the reading works, `readStdin` waiting for
// its bytes (ask `waitStdin` first), and the terminal answers -25. Under Node
// `isTerminal` and `terminalSize` answer and the other four throw.

/**
 * Up to `len` bytes of stdin into `buf[off, off + len)`, never blocking. stdin is never made
 * non-blocking, since that flag belongs to the open file description a shell shares with every
 * program it starts: the call asks `select` with a timeout of 0 before it reads. The range is
 * checked as `netRead`'s is, with the same panic, and `buf` must be a writable `u8[]`. Under
 * `--profile wasi` it waits for its bytes (call `waitStdin` first); under Node and in a browser
 * it throws; refused at compile time on a freestanding wasm32 target. Capability: tty.
 *
 * ```ts
 * import { readStdin, setRawMode, waitStdin } from "nish:term";
 *
 * export const main = (): number => {
 *   setRawMode(true);
 *   const keys: u8[] = new Array<u8>(16);
 *   let running = true;
 *   while (running) {
 *     if (waitStdin(16)) {
 *       const n = readStdin(keys, 0, keys.length);
 *       if (n === 0 || (n < 0 && n !== -11)) {
 *         running = false; // stdin ended, or reading it failed
 *       }
 *       for (let i = 0; i < n && i < keys.length; i++) {
 *         if (keys[i] === 113) {
 *           running = false; // q
 *         }
 *       }
 *     }
 *     // advance and draw one frame
 *   }
 *   setRawMode(false);
 *   return 0;
 * };
 * ```
 *
 * @param buf the buffer filled.
 * @param off the first byte of `buf` written.
 * @param len the most bytes read; a `len` of 0 answers 0 too, so ask for at least one byte.
 * @returns the count, 0 at end of stream, or -11 when nothing is waiting.
 */
declare function readStdin(buf: u8[], off: i32, len: i32): i32;
/**
 * Wait for stdin to be readable, or `timeoutMs` milliseconds to pass: the frame
 * clock of a terminal program, which costs nothing when a key arrives early.
 * Its end and an error count as readable, so the read after it answers at once,
 * with 0 or a negative errno that is not -11, which a loop treats as the end.
 *
 * A signal that ends the wait early gives `false`, except a Ctrl-Z and `fg`
 * once `setRawMode(true)` has caught SIGTSTP, after which the wait goes on for
 * what is left of the timeout; before raw mode the system's default stop
 * decides (Linux goes on with what is left, Darwin ends the wait). Not
 * `willreturn`. Under `--profile wasi` it waits at least 10 ms; under Node it
 * throws; refused at compile time on a freestanding wasm32 target. Capability:
 * tty.
 *
 * @param timeoutMs the most milliseconds to wait; negative: forever.
 * @returns `true` when it is readable, `false` when the time passed or a signal ended the wait.
 */
declare function waitStdin(timeoutMs: i32): boolean;
/**
 * Whether descriptor `fd` is a terminal (`isatty`). `false` for a pipe or a file and under
 * `--profile wasi`; under Node it is `tty.isatty`, in a browser `false`; refused at compile
 * time on a freestanding wasm32 target. Capability: tty.
 *
 * @param fd the descriptor asked about.
 * @returns whether it is a terminal.
 */
declare function isTerminal(fd: i32): boolean;
/**
 * The size of the terminal on stdout, else stderr, as a fresh array: read it again on each
 * frame to follow a resize. Under Node it is Node's `columns` and `rows`; in a browser
 * `[-25, 0]`; refused at compile time on a freestanding wasm32 target. Capability: tty.
 *
 * @returns `[columns, rows]`; `[-errno, 0]` when neither is a terminal, `[-25, 0]` for "not a
 *   terminal" (a pipe, a file, `--profile wasi`), and `[0, 0]` for a terminal no one set a size
 *   for.
 */
declare function terminalSize(): i32[];
/**
 * Raw mode on stdin's terminal, or the mode it had back. No echo, no line
 * editing, no CR-to-NL translation, no flow control (Ctrl-S, Ctrl-Q) and no
 * parity stripping; bytes are 8 bits wide, and a read answers as soon as one
 * byte is there, so a key arrives as its bytes (an arrow as the three of `ESC [
 * A`).
 *
 * `ISIG` stays on: Ctrl-C is still SIGINT and ends the program, Ctrl-\ is still
 * SIGQUIT and Ctrl-Z still stops it, so none of them arrives as a byte (3, 28,
 * 26); a program that wants Ctrl-C as a key asks for SIGINT through `signalFd`
 * and handles it in its loop. `OPOST` stays on, so "\n" still moves to the
 * start of the next line and output needs no "\r\n".
 *
 * Each `setRawMode(true)` that enters raw mode saves the termios that was
 * there; it comes back on `setRawMode(false)`, when `main` returns or
 * `process.exit` is called, on every panic, and on every signal whose default
 * action ends the program, SIGKILL aside (SIGINT, SIGTERM, SIGQUIT, SIGHUP,
 * SIGPIPE, SIGALRM, SIGUSR1, SIGUSR2, SIGPROF, SIGVTALRM, SIGXCPU, SIGXFSZ,
 * SIGSYS, and the faults SIGILL, SIGTRAP, SIGABRT, SIGFPE, SIGBUS and SIGSEGV).
 *
 * For each, a handler is installed only when the program left it at its default
 * action: it restores the terminal, puts the default back and raises the signal
 * again, so the program still dies of it and its parent sees that (exit status
 * 143 for SIGTERM). A program that took SIGTERM or SIGINT through `signalFd`
 * keeps it and puts the terminal back itself, or by returning.
 *
 * SIGKILL leaves raw mode behind, and so does a stack overflow on a thread
 * other than the one that called `setRawMode(true)`; `stty sane` undoes either,
 * as it does a stop by SIGSTOP. Ctrl-Z (SIGTSTP) restores the terminal, stops
 * the program, and once `fg` or `bg` continues it enters raw mode again; a
 * program continued in the background stops again, by SIGTTOU, until `fg`. A
 * program started in the background (`app &`) that calls `setRawMode(true)` is
 * stopped by SIGTTOU, as any program that sets the terminal is, and enters raw
 * mode on `fg`.
 *
 * Two threads that call it at once take turns, so the termios saved is the one
 * from before either. Asking for the mode it is already in changes nothing and
 * answers 0, so `setRawMode(false)` is always safe. Under `--profile wasi`, on
 * a pipe or a file, `true` is -25 and `false` is 0; under Node and in a browser
 * it throws; refused at compile time on a freestanding wasm32 target.
 * Capability: tty.
 *
 * @param on `true` for raw mode, `false` for the mode before.
 * @returns 0, -25 when stdin is not a terminal, or the host's `-errno` when the terminal
 *   refuses.
 */
declare function setRawMode(on: boolean): i32;
/**
 * Bytes the runtime writes to the terminal on stdout at exit, on a panic and on
 * every signal that ends the program (SIGKILL aside), before termios is
 * restored; raw mode or not, and setting them installs the same handlers.
 * Typical bytes are the escapes that leave an alternate screen, show the cursor
 * or turn mouse reporting off. Replaces the previous string; "" clears it. The
 * cap is 4096 bytes.
 *
 * They are written to stdout once, with `write` alone, at most once however
 * many of those paths race, and after all the program printed (output is not
 * buffered). Ctrl-Z and `setRawMode(false)` do not end the program, so they
 * write nothing. A signal that lands while the string is replaced writes the
 * old one or the new one, whole. A program sets them once it has switched the
 * terminal and again with each change, last the set that undoes them all. Under
 * `--profile wasi` it keeps nothing; under Node and in a browser it throws;
 * refused at compile time on a freestanding wasm32 target. Capability: tty.
 *
 * @param bytes the bytes written at the end.
 * @returns 0, -25 when stdout is not a terminal (`""` is still 0 there), -7 (E2BIG) past
 *   NISH_TERM_RESTORE_MAX bytes (4096); both failures keep what was there.
 */
declare function setTerminalRestore(bytes: string): i32;

// ---- `Date` and `crypto` (WP34 N3) -----------------------------------------------
//
// `lib.es2022` already declares `Date`, whose `now()` is Nish's one member of it;
// `DateConstructor` below repeats lib's signature of it to document it, and adds
// nothing: `tsc` accepting `new Date()` is `tsc` not being Nish's checker.
// `crypto` is a Web API that `lib.es2022` leaves out, so it is declared with its
// one member, typed as Nish types it.

/**
 * `Date`, merged into the `DateConstructor` `lib.es2022` declares. Nish has no
 * `Date` object: `Date.now()` is its one member, and `new Date()`, `Date()`,
 * `Date.parse`, `Date.UTC`, any other member, and `Date` or `Date.now` used as
 * a value are each refused: "`new Date()` is refused: Nish has no `Date`
 * object; the one `Date` member is `Date.now()`, the wall clock in
 * milliseconds" (NL2401).
 */
interface DateConstructor {
  /**
   * The wall clock, `CLOCK_REALTIME`, in whole milliseconds since 1970-01-01
   * UTC, as JavaScript answers it: the milliseconds are counted as integers and
   * then converted, so the value is exact and a time before 1970 floors. An
   * `f64` in both number modes, because an `i32` of milliseconds overflowed in
   * January 1970. It can go backwards when the clock is corrected, so an
   * interval is `monotonicNanos`'s job, not this one's. A wasm32 build has no
   * operating system to ask, and refuses it. Capability: clock.
   *
   * @returns the milliseconds, an `f64`.
   */
  now(): number;
}

/** The system's random source, with its one member. */
declare var crypto: {
  /**
   * Every byte of `bytes` from the kernel's CSPRNG (`getrandom(2)` on Linux,
   * looping over `EINTR` and short reads; `getentropy(3)` in 256-byte chunks on
   * macOS); at most 65,536 bytes a call. A `u8[]` only, where the Web API takes
   * any integer typed array: the byte is the unit a key or a nonce is written
   * in, and anything else is refused at compile time (NL2402). A statement,
   * where the Web API also answers its argument, which the caller already
   * holds. An empty array is filled with nothing.
   *
   * The array is written, so a `readonly u8[]` is refused (and, inside a
   * `scope()` region, an array a task may read). More than 65,536 bytes is a
   * panic, `crypto.getRandomValues: <n> bytes asked for, and one call fills at
   * most 65536`, exit 1. A source that fails is a panic too; nothing weaker is
   * ever substituted. It is the source for a key. `crypto` has no other member
   * (NL2403, for example `crypto.randomUUID`). Refused at compile time on
   * wasm32 and the WASI profile (NL2404). Under Node the prelude fills a plain
   * `u8[]` too and panics past 65,536 with the same words; without the prelude
   * it takes only a typed array. Capability: entropy.
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
   * Open a regular file to read a window at a time: read-only, close-on-exec
   * and non-blocking. A directory is `-21`, any other kind that is not a
   * regular file `-22`. Close it with `fileClose` in a `finally`.
   *
   * @param path The file to open.
   * @returns A descriptor (`>= 0`), or the negated Linux errno: `-2` ENOENT,
   *   `-13` EACCES, `-20` ENOTDIR, `-21` EISDIR, `-22` for a FIFO or device,
   *   `-6` ENXIO for a socket, `-23` ENFILE, `-24` EMFILE, `-36` ENAMETOOLONG,
   *   `-40` ELOOP; anything else is `-5` EIO.
   */
  export function fileOpen(path: string): i32;
  /**
   * Read up to `len` bytes from file offset `pos` into `buf[off .. off + len)`
   * (`pread`). The window panics as `buf.slice` does when it falls outside
   * `buf`; the array is never grown.
   *
   * @param fd A descriptor from `fileOpen`.
   * @param buf The array the bytes land in.
   * @param off Where in `buf` the first byte lands.
   * @param len The most bytes to read.
   * @param pos The file offset, an `i64`.
   * @returns The bytes read, `0` at end of file (and for a `len` of `0`, even
   *   on a closed or negative descriptor), or a negative errno: `-22`
   *   for a negative or overflowing `pos`, `-9` for a closed or negative
   *   descriptor, `-21` EISDIR, `-29` ESPIPE; anything else is `-5` EIO.
   */
  export function fileReadAt(fd: i32, buf: u8[], off: i32, len: i32, pos: i64): i32;
  /**
   * The file's size in bytes now, from `fstat`.
   *
   * @param fd A descriptor from `fileOpen`.
   * @returns The size, or a negative errno.
   */
  export function fileSize(fd: i32): i64;
  /**
   * Close a descriptor `fileOpen` gave; close it once.
   *
   * @param fd A descriptor from `fileOpen`.
   * @returns `0`, or a negative errno (`-9` EBADF).
   */
  export function fileClose(fd: i32): i32;
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
   * and stderr is appended to `stdout` and `stderr`, which keep what they held.
   * It is the run for a child that takes a secret on stdin, which `ps` and
   * `/proc` do not show. A child that exits without reading its stdin is not a
   * failure.
   *
   * The child inherits the environment and working directory, and no descriptor
   * of the program but its three streams; it starts with SIGPIPE as the program
   * had it, and the program's own SIGPIPE from writing to a child that stopped
   * reading is absorbed. One `poll` loop writes and drains, so a child that
   * fills one pipe cannot deadlock the parent.
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
   * `spawnPiped` with a deadline: the same captured run, killed with `SIGKILL`
   * and reaped once `timeoutMs` milliseconds have passed since it started, and
   * a negative `timeoutMs` is no deadline, so `-1` makes it `spawnPiped`. The
   * deadline covers the whole run, the wait for the child's exit included, on
   * the monotonic clock. Only the child's pid is killed, never a grandchild,
   * and a grandchild that keeps an output pipe open makes the run wait for it
   * until the deadline.
   *
   * @param argv The program and its arguments.
   * @param stdin The bytes the child reads.
   * @param stdout Grows by the child's stdout, the bytes read before a kill
   *   included; neither `readonly` nor a typed array.
   * @param stderr Grows by the child's stderr, under the same rule.
   * @param timeoutMs The milliseconds the run may take; negative for none.
   * @returns `spawnPiped`'s answer (the status or `128 + n`, `-1`, or `-2` for
   *   a stream past 16 MiB), or `-3` when the deadline passed and the child was
   *   killed.
   */
  export function spawnPipedWithin(
    argv: string[],
    stdin: readonly u8[],
    stdout: u8[],
    stderr: u8[],
    timeoutMs: i32
  ): i32;
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
   *   0 or below (which `kill(2)` reads as a process group or every
   *   process), `-3` ESRCH when no process has the pid (a child already reaped
   *   included), `-1` EPERM when it is another user's.
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
 * arithmetic: an integer lane wraps through its array type (`Uint8Array` for
 * a `u8` lane), and an `f32` lane rounds through `Float32Array`. A mask is an
 * array of booleans, and a rotate is two shifts and an `or`. `tests/run.js`'s `simd` section holds the native, WASI and Node
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
   * @param a0 Lane 0, a `u8`.
   * @param a1 Lane 1, a `u8`.
   * @param a2 Lane 2, a `u8`.
   * @param a3 Lane 3, a `u8`.
   * @param a4 Lane 4, a `u8`.
   * @param a5 Lane 5, a `u8`.
   * @param a6 Lane 6, a `u8`.
   * @param a7 Lane 7, a `u8`.
   * @param a8 Lane 8, a `u8`.
   * @param a9 Lane 9, a `u8`.
   * @param a10 Lane 10, a `u8`.
   * @param a11 Lane 11, a `u8`.
   * @param a12 Lane 12, a `u8`.
   * @param a13 Lane 13, a `u8`.
   * @param a14 Lane 14, a `u8`.
   * @param a15 Lane 15, a `u8`.
   * @returns The vector.
   */
  export function u8x16(
    a0: u8, a1: u8, a2: u8, a3: u8, a4: u8, a5: u8, a6: u8, a7: u8,
    a8: u8, a9: u8, a10: u8, a11: u8, a12: u8, a13: u8, a14: u8, a15: u8
  ): u8x16;
  /**
   * A `u16x8` of 8 lanes, one argument per lane, lane 0 first.
   *
   * @param a0 Lane 0, a `u16`.
   * @param a1 Lane 1, a `u16`.
   * @param a2 Lane 2, a `u16`.
   * @param a3 Lane 3, a `u16`.
   * @param a4 Lane 4, a `u16`.
   * @param a5 Lane 5, a `u16`.
   * @param a6 Lane 6, a `u16`.
   * @param a7 Lane 7, a `u16`.
   * @returns The vector.
   */
  export function u16x8(a0: u16, a1: u16, a2: u16, a3: u16, a4: u16, a5: u16, a6: u16, a7: u16): u16x8;
  /**
   * An `i32x4` of 4 lanes, one argument per lane, lane 0 first.
   *
   * @param a0 Lane 0, an `i32`.
   * @param a1 Lane 1, an `i32`.
   * @param a2 Lane 2, an `i32`.
   * @param a3 Lane 3, an `i32`.
   * @returns The vector.
   */
  export function i32x4(a0: i32, a1: i32, a2: i32, a3: i32): i32x4;
  /**
   * A `u32x4` of 4 lanes, one argument per lane, lane 0 first.
   *
   * @param a0 Lane 0, a `u32`.
   * @param a1 Lane 1, a `u32`.
   * @param a2 Lane 2, a `u32`.
   * @param a3 Lane 3, a `u32`.
   * @returns The vector.
   */
  export function u32x4(a0: u32, a1: u32, a2: u32, a3: u32): u32x4;
  /**
   * An `f32x4` of 4 lanes, one argument per lane, lane 0 first.
   *
   * @param a0 Lane 0, an `f32`.
   * @param a1 Lane 1, an `f32`.
   * @param a2 Lane 2, an `f32`.
   * @param a3 Lane 3, an `f32`.
   * @returns The vector.
   */
  export function f32x4(a0: f32, a1: f32, a2: f32, a3: f32): f32x4;
  /**
   * An `f64x2` of 2 lanes, one argument per lane, lane 0 first.
   *
   * @param a0 Lane 0, an `f64`.
   * @param a1 Lane 1, an `f64`.
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
   * Whether each lane of `a` is equal to the lane of `b`: `icmp`, unsigned on a
   * `u*` lane, or on float lanes `fcmp oeq`.
   *
   * @param a Any vector (NL2638 for a scalar).
   * @param b A vector of `a`'s type.
   * @returns The mask of the lane width: `mask8x16`, `mask16x8`, `mask32x4`
   *   or `mask64x2`.
   */
  export function eq<V extends SimdVector>(a: V, b: V): V["__mask"];
  /**
   * Whether each lane of `a` is not equal to the lane of `b`: `icmp`, unsigned
   * on a `u*` lane, or on float lanes `fcmp une`, unordered, so a NaN lane is
   * not equal.
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
   * Signed and unsigned lanes rotate alike.
   *
   * @param v A `u8x16`, `u16x8`, `i32x4` or `u32x4`.
   * @param count An integer literal below the lane width: 0 to 7, 15 or 31
   *   (NL2630 for a variable, NL2631 for the width or more).
   * @returns The vector of rotated lanes.
   */
  export function rotl<V extends IntegerVector>(v: V, count: i32): V;
  /**
   * Each lane rotated right by `count`, `llvm.fshr` with `v` as both halves.
   * Signed and unsigned lanes rotate alike.
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
   * errno that is not `-11`, which a loop treats as the end. A Ctrl-Z and
   * `fg` after `setRawMode(true)` does not end the wait early: it goes on for
   * what is left of the timeout. Before raw mode Linux goes on and Darwin ends
   * the wait. Not `willreturn`.
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
   * @returns The `Secret`, holding `value` itself and not a copy, so its
   *   storage is the storage `wipe` later zeroes. It needs an owner: a
   *   `const` or `let`, a `return`, or `wipe` (NL2439 otherwise).
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
   * @param s The `Secret` to read, borrowed: it can be exposed again, and is
   *   still to be wiped.
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
 *     import { Region, enter, enterWith, free, region, regionWith } from "nish:region";
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
 * (NL2617). None of the five (`region`, `regionWith`, `enter`, `enterWith`,
 * `free`) runs in a parallel body or a spawned function (NL2351), and `using`
 * does not take a region (NL2387).
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
   * A new region whose parent is the region entered now: `f()` runs with every
   * allocation landing in it, and what it answers is the root. The child may
   * keep memory the parent's root reaches, and `free` of the parent frees it
   * too. Called outside an `enter` or `enterWith` `f` it is NL2702, and it
   * stops the program when no region is entered.
   *
   * @param f Makes the root. It answers memory it allocated, never the
   *   parent's (NL2614).
   * @returns The handle.
   */
  export function child<T>(f: () => T): Region<T>;
  /**
   * `child`, with one outside argument handed to `f`.
   *
   * @param arg Memory the parent's root reaches, which `f` may keep in the
   *   child, or outer memory it may only read (NL2610).
   * @param f Makes the root from `arg`. It answers memory it allocated, never
   *   `arg` itself (NL2614).
   * @returns The handle.
   */
  export function childWith<A, T>(arg: A, f: (arg: A) => T): Region<T>;
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
 * All five are reached only through the import. Each argument to `awaitAll`
 * or `spawn` is a direct call to an `async` function, written where it is
 * made, which the checker holds it to (`src/async-check.ts`); `tsc` sees ordinary promises. A spawned
 * call's arguments are numbers, `boolean`s, enums or `string`s (NL2673): the
 * task outlives the function that spawned it.
 *
 * `sleep(ms)`, `readable(fd)` and `writable(fd)` are the waits a task makes
 * on the executor, an epoll (kqueue on Darwin) loop that resumes ready tasks
 * in the kernel's order and then expired timers by deadline:
 *
 *     import { readable, sleep } from "nish:async";
 *
 *     async function tick(): Promise<void> {
 *       await sleep(10);
 *       console.log("tick");
 *     }
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
  /**
   * Suspend the task for `ms` milliseconds while the executor runs the
   * others. Written only as `await sleep(ms)` inside an `async` function
   * (NL2671).
   *
   * @param ms The milliseconds to wait, an `i32`.
   * @returns `true` once the time has passed; `false` at once for a negative
   *   `ms`, which makes no wait.
   */
  export function sleep(ms: i32): Promise<boolean>;
  /**
   * Suspend the task until `fd` has bytes to read, or its peer has hung up,
   * while the executor runs the others. Written only as
   * `await readable(fd)` inside an `async` function (NL2671). Refused under
   * `--emit-ts` (NL4017).
   *
   * @param fd An open descriptor: a socket, a pipe or a terminal.
   * @returns `true` once `fd` is ready; `false` when the wait could not be
   *   made (an `fd` that is not open). A regular file is always ready.
   */
  export function readable(fd: i32): Promise<boolean>;
  /**
   * Suspend the task until `fd` takes bytes without blocking, while the
   * executor runs the others. Written only as `await writable(fd)` inside an
   * `async` function (NL2671). Refused under `--emit-ts` (NL4017).
   *
   * @param fd An open descriptor: a socket, a pipe or a terminal.
   * @returns `true` once `fd` is ready; `false` when the wait could not be
   *   made (an `fd` that is not open). A regular file is always ready.
   */
  export function writable(fd: i32): Promise<boolean>;
  /**
   * Suspend the task until `fd` has bytes to read, or its peer has hung up,
   * or `ms` milliseconds pass, whichever comes first. Written only as
   * `await readableWithin(fd, ms)` inside an `async` function (NL2671).
   * Refused under `--emit-ts` (NL4018).
   *
   * @param fd An open descriptor: a socket, a pipe or a terminal.
   * @param ms The most milliseconds to wait; a negative `ms` waits without a
   *   limit, as `readable` does.
   * @returns `true` once `fd` is ready; `false` when `ms` passed first, when
   *   the wait could not be made, or when the task is cancelled.
   */
  export function readableWithin(fd: i32, ms: i32): Promise<boolean>;
  /**
   * Suspend the task until `fd` takes bytes without blocking, or `ms`
   * milliseconds pass, whichever comes first. Written only as
   * `await writableWithin(fd, ms)` inside an `async` function (NL2671).
   * Refused under `--emit-ts` (NL4018).
   *
   * @param fd An open descriptor: a socket, a pipe or a terminal.
   * @param ms The most milliseconds to wait; a negative `ms` waits without a
   *   limit, as `writable` does.
   * @returns `true` once `fd` is ready; `false` when `ms` passed first, when
   *   the wait could not be made, or when the task is cancelled.
   */
  export function writableWithin(fd: i32, ms: i32): Promise<boolean>;
  /**
   * The running task's handle, to hand to `cancel` or `cancelAfter`. `main`'s
   * handle is 0, which no call cancels. Refused under `--emit-ts` (NL4018).
   *
   * @returns The handle, an `i64` that names this task and no later one.
   */
  export function taskId(): i64;
  /**
   * Cancel a task: every `sleep`, `readable` or `writable` it is waiting on
   * answers `false` at once, and so does every one it makes later, so it runs
   * on to its end, its `using` bindings dispose and its region is freed. A
   * task is never stopped in the middle of its code. Refused under
   * `--emit-ts` (NL4018).
   *
   * @param task A handle `taskId()` answered.
   * @returns `true` while the task is still running, so it is now cancelled
   *   (a second `cancel` of it answers `true` too); `false` for a task that
   *   has finished, or for `main`.
   */
  export function cancel(task: i64): boolean;
  /**
   * Whether the running task has been cancelled. Refused under `--emit-ts`
   * (NL4018).
   *
   * @returns `true` once `cancel` was called on it, or its `cancelAfter`
   *   deadline passed.
   */
  export function cancelled(): boolean;
  /**
   * Cancel a task `ms` milliseconds from now, unless it finishes first. A
   * later call replaces the deadline; a negative `ms` removes it. Refused
   * under `--emit-ts` (NL4018).
   *
   * @param task A handle `taskId()` answered.
   * @param ms The milliseconds until the task is cancelled.
   * @returns `true` when the task is still running and the deadline is set
   *   (or removed); `false` for a task that has finished or is `main`.
   */
  export function cancelAfter(task: i64, ms: i32): boolean;
}

// ---- Arena (docs/LANGUAGE.md -> Arena) ---------------------------------------

/**
 * The arena the runtime allocates from, read. Both members are available in
 * both number modes. `Arena` has no `release` and no `reset`: a call to either
 * is an unknown builtin (NL2244). A parallel body or a task may not call
 * `Arena.mark` or `Arena.used`, as each thread has an arena of its own. A
 * function that calls `Arena.mark` in its own body never gets an automatic arena
 * scope, so the position it reads is never moved under it by a scope it did not
 * write.
 */
declare const Arena: {
  /**
   * The current bump address. It only reads the arena, but is recorded as a
   * write, so a caller is never hoisted across an allocation, and a function
   * that calls it is never the callee of a tail call whose scope release moved
   * ahead of it. Capability: none.
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
 * exit (its end, a `return` after the returned value is computed, a `break` or
 * `continue` that leaves it, and an `orReturn()`), and the compiler refuses the
 * block if anything allocated in it could outlive it. Only a `using`
 * initialiser, and the binding is never read; under Node there is no arena and
 * the disposal does nothing.
 *
 * `arena()` anywhere but the initialiser of a `using` is NL2416, and reading
 * the binding is NL2417. A number, a `boolean` or an `enum` leaves the block
 * freely, as does a value older than it.
 *
 * These routes are refused for anything else allocated inside:
 * - assigning it to a local declared outside the block (NL2418),
 * - storing it into a field (NL2419) or an element (NL2420),
 * - storing it any other way (NL2421),
 * - a `push` onto an array the block does not bind to a fresh array (NL2422),
 * - a `return` or `orReturn()` (NL2423),
 * - a call to a function that stores an allocation (NL2424)
 * - and a `spawn` on a scope declared outside the block (NL2427), on a scope
 *   the same `using` declares ahead of `arena()` (`using s = scope(), a =
 *   arena()`, NL2427, since `s` joins after the release) or on one ahead of the
 *   statement's last `arena()` (`using a = arena(), s = scope(), b = arena()`,
 *   NL2427, since `b` releases before `s` joins).
 *
 * The rule is the escape analysis's, so it is conservative. A parallel body or
 * a task may not open one (NL2351). A map that answers numbers or strings may
 * run inside one, and a task filed on a scope the block declares may read what
 * it allocated. It nests with `scope()` and `lock()` on the same stack,
 * innermost first. A `return g(n)` whose arguments are all numbers is a tail
 * call with the release moved ahead of it, unless `g` reads the arena. A panic
 * ends the process. Capability: none.
 *
 * @returns the scope the `using` declaration disposes.
 */
declare function arena(): Disposable;

/**
 * `CPtr`: the address a `declare function` hands back, opaque and eight bytes
 * wide (`i8*` in the IR). It is C's, not arena memory, and its lifetime is the
 * C library's business. `docs/LANGUAGE.md` has the rules — it may be written in
 * a `declare function` signature and on a local that holds one, compared with
 * `null` or with another `CPtr`, assigned, and passed back to C, and that is
 * all.
 *
 * A field, an array element, a `Result` arm, a type argument, and the
 * parameters or return type of a function the program defines are each refused
 * (`` `CPtr` cannot be ...: a foreign pointer may only appear in a `declare
 * function` signature or on a local bound to one ``). There is no arithmetic
 * (`p + 1`), no index (`` Cannot index a value of type CPtr ``), no dereference
 * and no member. A `CPtr | null` reaches C only as the literal `null` or a
 * pointer narrowed with `!== null` (NL2539). `readCString` from `nish:unsafe`
 * copies the string at one.
 *
 * An empty interface with a private brand rather than `unknown` or a type
 * alias: `tsc` has to refuse the arithmetic and the dereference `nish` refuses,
 * and it has to refuse assigning any other value to one. The brand is what makes
 * it nominal, so a `{}` does not satisfy it; the name is never written, so the
 * declaration costs a reader nothing.
 */
declare interface CPtr {
  /** The private brand that makes `CPtr` nominal. Not a field: nothing reads or writes it. */
  readonly __nishForeignPointer: unique symbol;
}

/**
 * `HostHandle<"kind">`: an object the page holds (a canvas, a GPU buffer, a
 * node), passed to and from a host module's functions as the small integer the
 * page's table keys it by (docs/LANGUAGE.md -> Host modules). It is an `i32` in
 * the wasm module. It may be stored anywhere a scalar goes and compared with
 * `===` or `!==` against a handle of the same kind or the literal `0`; a
 * different kind, arithmetic, and a conversion to or from a number, an `as`
 * included, are refused, and only a host function that returns one makes one.
 *
 * In TypeScript a branded `number` or `0`. `tsc` takes `0` (a handle's start,
 * a field default, `h === 0`) and a handle of the same kind, and refuses any
 * other number, a plain `number` and a handle of another kind, as `nish` does.
 * It cannot refuse arithmetic on a handle or an `as` cast, which `nish` does;
 * a handle stays assignable to `number`.
 */
// The brand is keyed by the string `__nishHostKind`, not a `unique symbol`:
// `--emit-ts` declares the same shape for itself (`HOST_HANDLE_ALIAS` in
// `src/emit-ts-edits.ts`), and so does the `"nish"` module below, and two
// declarations of a `unique symbol` would be two types, so the page's function
// would refuse the reading's handle. With a string key the three declarations
// are one type; keep them spelled alike.
type HostHandle<K extends string> = (number & { readonly __nishHostKind: K }) | 0;

/**
 * `"nish"`: what a host module (the page's TypeScript) imports its widths
 * from, `import type { f64, i32, HostHandle } from "nish"`. The package's
 * root `types` entry is this file, which is how the page's `tsc` finds the
 * module. The widths are the page's reading of them, which is the loader's:
 * an `i64` or `u64` crosses as a `bigint`, every other width as a `number`.
 */
declare module "nish" {
  /** A 32-bit signed integer, a `number` on the page. */
  export type i32 = number;
  /** A 64-bit signed integer, a `bigint` on the page. */
  export type i64 = bigint;
  /** An 8-bit unsigned integer, a `number` on the page. */
  export type u8 = number;
  /** A 16-bit unsigned integer, a `number` on the page. */
  export type u16 = number;
  /** A 32-bit unsigned integer, a `number` on the page. */
  export type u32 = number;
  /** A 64-bit unsigned integer, a `bigint` on the page. */
  export type u64 = bigint;
  /** A 32-bit float, a `number` on the page. */
  export type f32 = number;
  /** A 64-bit float, a `number` on the page. */
  export type f64 = number;
  /** A ranged integer, which the loader checks on the way in. */
  export type integer<Lo extends number, Hi extends number> = number;
  /** A host object's handle, the global `HostHandle`'s twin, spelled alike so the two are one type. */
  export type HostHandle<K extends string> = (number & { readonly __nishHostKind: K }) | 0;
}

// ---- `lib.es2022`'s receivers, documented ---------------------------------------
//
// The interfaces below merge into `lib.es2022`'s. Each member is lib's own
// signature, repeated so that an editor shows Nish's documentation at the call
// site; where Nish admits less than the signature says (a required comparator,
// exactly two operands, an f64 argument), the documentation says so and `nish`
// refuses the rest. `set` on an array is the one member added: `dst.set(src,
// offset)` copies all of `src` into `dst` from `offset` on, with
// `TypedArray.prototype.set`'s meaning. A `u8[]` is an `Array` to
// `tsc`, and `lib.es5.d.ts` gives `Array` a `fill` of the same meaning but no
// `set`; `runtime/nish.mjs` installs it under Node. No member needs a
// capability except `Math.random`, which needs `entropy`.

/**
 * `Math`. The f64-only functions (`sqrt`, `floor`, `ceil`, `trunc`, `sin`,
 * `cos`, `tan`, `exp`, `log`, `pow`, `round`, `atan2`, `hypot`) refuse `i32`
 * and `i64` arguments (and an `f32` one): `Math.sqrt(x)` on an `i32` is
 * "`Math.sqrt` requires an f64 argument, got i32 (use --number-mode f64 or
 * toF64(x))". `number` in i32 mode is an `i32`, so write
 * `Math.sqrt(toF64(n))` or use f64 mode. A numeric literal argument is typed
 * `f64` by context (`Math.sqrt(2)` works in both modes); a literal operand of
 * `Math.min` or `Math.max` takes the other operand's type (`Math.max(x, 0)`).
 * `Math.abs`, `Math.min`, `Math.max` and `Math.sign` also work on an `f32`.
 * `Math.PI` and `Math.E` are available in both number modes.
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
   * The largest integer not above `x`. In an x86-64 module that is not a wasm
   * build, the runtime runs SSE4.1's `roundsd` on a CPU that has it and libm's
   * routine on one that does not, chosen once before `main`; the answers are
   * the same bits on either path, and `NISH_SIMD=scalar` pins libm.
   * Capability: none.
   *
   * @param x an `f64`.
   * @returns an `f64`.
   */
  floor(x: number): number;
  /**
   * The smallest integer not below `x`. Runs on the same two paths as
   * `floor`, with the same bits on either. Capability: none.
   *
   * @param x an `f64`.
   * @returns an `f64`.
   */
  ceil(x: number): number;
  /**
   * `x` with its fraction dropped. Runs on the same two paths as `floor`,
   * with the same bits on either. Capability: none.
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
   * The tangent, fdlibm's, compiled into the module so that no target calls
   * libm: exact near every multiple of π/2 and within one ulp.
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
   * (`atan2(0, -0)` is π, `atan2(-0, -0)` is −π). An `f32` argument is
   * refused: "`Math.atan2` requires an f64 argument, got f32 (use
   * --number-mode f64 or toF64(x))". Capability: none.
   *
   * @param y an `f64`.
   * @param x an `f64`.
   * @returns an `f64`.
   */
  atan2(y: number, x: number): number;
  /**
   * The length of `(x, y)`, with ECMAScript's special cases
   * (`hypot(Infinity, NaN)` is `Infinity`). Exactly two arguments, not
   * JavaScript's any number: a third is refused with "`Math.hypot` expects
   * exactly 2 arguments, got 3". Capability: none.
   *
   * @param values exactly two `f64` operands, `x` and `y`.
   * @returns an `f64`.
   */
  hypot(...values: number[]): number;
  /**
   * `x` to the power `y`, ECMAScript's answer where it and C99 differ:
   * `pow(x, NaN)` and `pow(±1, ±Infinity)` are `NaN` (C gives `1`);
   * `pow(x, ±0)` is `1`, `pow(NaN, 0)` is `1`; every other special case agrees
   * with C. Capability: none.
   *
   * @param x an `f64`.
   * @param y an `f64`.
   * @returns an `f64`.
   */
  pow(x: number, y: number): number;
  /**
   * JavaScript's round-half-up, with `x`'s sign kept: `2.5` -> `3`, `-2.5` ->
   * `-2`, `0.49999999999999994` -> `0`, and a value in `[-0.5, 0)` or `-0`
   * itself -> `-0` (`Math.round(-0.3)` is `-0`, in Node too); `NaN` -> `NaN`.
   * Capability: none.
   *
   * @param x an `f64`.
   * @returns an `f64`.
   */
  round(x: number): number;
  /**
   * The magnitude of `x`, for any numeric type, in that type: wrapping for
   * `INT_MIN` (`Math.abs(-2147483648)` answers itself), and on an unsigned
   * type the value itself. Capability: none.
   *
   * @param x any number.
   * @returns `x`'s magnitude, of `x`'s type.
   */
  abs(x: number): number;
  /**
   * The smaller of exactly two operands of one numeric type, in that type: a
   * signed integer compares signed, an unsigned one unsigned. On floats,
   * JavaScript's answer: a NaN operand gives NaN and `-0` is below `+0`
   * (`Math.min(0, -0)` is `-0`). One operand is refused: "`Math.min` expects
   * exactly 2 arguments, got 1". A numeric literal operand takes the other
   * operand's type. Capability: none.
   *
   * @param values exactly two operands of one numeric type.
   * @returns the smaller operand.
   */
  min(...values: number[]): number;
  /**
   * The larger of exactly two operands of one numeric type, in that type: a
   * signed integer compares signed, an unsigned one unsigned. On floats,
   * JavaScript's answer: a NaN operand gives NaN and `-0` is below `+0`
   * (`Math.max(-0, 0)` is `0`). A count other than two is refused, as for
   * `min`. A numeric literal operand takes the other operand's type.
   * Capability: none.
   *
   * @param values exactly two operands of one numeric type.
   * @returns the larger operand.
   */
  max(...values: number[]): number;
  /**
   * The leading zero bits of `x`'s 32 bits, JavaScript's answer (an `i32` and
   * a `u32` are the bits ToUint32 gives), so `0` answers `32`. The answer is
   * ranged, so `31 - Math.clz32(word & (0 - word))`, the index of a word's
   * lowest set bit, needs no overflow check. Any other operand type is refused
   * rather than converted: "`Math.clz32` expects an i32 or a u32, got f64
   * (convert with toI32 or toU32)". Capability: none.
   *
   * @param x an `i32` or a `u32`.
   * @returns an `integer<0, 32>`.
   */
  clz32(x: number): number;
  /**
   * `-1`, `0` or `1` in `x`'s own type (a ranged `x` answers its base type);
   * a float's `-0` and `NaN` come back as JavaScript gives them, and an
   * unsigned `x` answers `0` or `1`. A non-number is refused: "`Math.sign`
   * expects a number, got string". Capability: none.
   *
   * @param x any number.
   * @returns the sign, of `x`'s type.
   */
  sign(x: number): number;
  /**
   * The low 32 bits of the product, read signed, with no overflow check
   * (`Math.imul(0x7fffffff, 2)` is `-2`), which is JavaScript's answer for any
   * operands an `i32` or a `u32` holds. Any other operand type is refused
   * rather than converted: "`Math.imul` expects an i32 or a u32, got f64
   * (convert with toI32 or toU32)". Capability: none.
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
 * name `i32[]`, `f32[]`, `f64[]` and `i64[]`, the same type with no second
 * layout, but a receiver spelled with one of the four refuses `push` and `pop`
 * (NL2415), because a typed array in TypeScript has a fixed length and a call
 * to either is a `TypeError` there: "`push` is not a method of `Float64Array`,
 * whose length is fixed: declare it `f64[]` to push and pop". Every other array
 * operation is unchanged, and a `Float64Array` is an `f64[]` wherever one is
 * expected.
 *
 * The refusal follows the spelling the program wrote, carried by: `new X(n)`;
 * an identifier annotated with the name (directly, as the one member of `X |
 * null`, or through a `type` alias) or unannotated and initialised with such a
 * receiver; a field declared with the name; a call whose callee declares it as
 * its return type; a call of a generic function whose return type is a type
 * parameter that an argument binds to such a receiver; a value read out of a
 * `Map` whose value type is spelled with a name; an element of an array spelled
 * with a name; and a ternary or `??` either of whose operands carries it.
 *
 * A member of a generic class instantiated at one of the names does not carry
 * it, and a typed array that flows into a binding spelled `T[]` may be pushed
 * there. A numeric literal argument to `push`, `indexOf` or `fill` takes the
 * element type, so `wide.push(3)` on an `i64[]` pushes an `i64` three. An
 * unknown method is refused with the supported list: "Unknown method `shift` on
 * i32[]"; there is no `shift`, `find` or `toString` on an array.
 */
interface Array<T> {
  /** The element count, read-only: assigning to it is refused. */
  length: number;
  /**
   * Append one element, growing the capacity by doubling (4 from an empty
   * array). An array never grows past 2^31 − 1 elements, in either number
   * mode: the push that would fails as an allocation does,
   * `nish: out of memory` and exit 1. An element of the wrong type is
   * refused: "Cannot push string onto i32[]". A `readonly T[]` refuses it
   * under its own name. Capability: none.
   *
   * @param items the element appended; one per call.
   * @returns the new length.
   */
  push(...items: T[]): number;
  /**
   * Remove the last element. An empty array panics and exits 1
   * (`index out of range: 0 >= 0`): there is no `undefined` to return, so the
   * answer is `T` in Nish. Behind a test that the array holds an element, such
   * as `if (a.length > 0)`, the check is proven away. The capacity is
   * untouched, so the next `push` reuses the storage. Takes no argument.
   * Capability: none.
   *
   * @returns the element removed.
   */
  pop(): T | undefined;
  /**
   * The first index whose element is `=== searchElement`: strings by content,
   * classes, interfaces and arrays by identity, floats by `==` on the number
   * (so a `NaN` element is never found, as in JavaScript). One argument; an
   * argument of another type than the element is refused. Capability: none.
   *
   * @param searchElement the element looked for.
   * @param fromIndex declared to match TypeScript's `lib`; `nish` refuses a second argument.
   * @returns its index, or `-1`.
   */
  indexOf(searchElement: T, fromIndex?: number): number;
  /**
   * The elements joined by `separator`. `string[]` only: "`join` requires
   * string[], got i32[]", because converting an element would allocate once
   * per element. One pass sums the lengths, then one allocation holds the
   * result. Like a concatenation, the result is held to 2^31 − 1 bytes: a
   * longer one fails as an allocation does, `nish: out of memory` and exit 1,
   * before anything is allocated. Capability: none.
   *
   * @param separator between each two elements, `","` by default.
   * @returns the joined string.
   */
  join(separator?: string): string;
  /**
   * Store `value` into every slot of `[start, end)`, each end relative (a
   * negative one counts back from the length) and then clamped into `[0,
   * a.length]`, as `TypedArray.prototype.fill`'s are, so no range is out of
   * range, a reversed range fills nothing, and `fill` never panics. Arrays of
   * numbers only, of any width and ranged integers included (a ranged element
   * checks `value` once, before the fill); on any other array it is refused:
   * "`set` copies bytes, so it needs an array whose elements are numbers
   * (`u8[]`, `i32[]`, `f64[]`, ...), got string[]" (NL2395).
   *
   * `value` is the element type ("`fill` expects u8 (the element type of u8[]),
   * got string"), one to three arguments are taken (NL2398), and each end is a
   * number. It is a statement: its answer cannot be used as a value, and
   * JavaScript's answer is the array the program already holds.
   *
   * A float end converts as JavaScript's `ToIntegerOrInfinity` does: `NaN` is
   * `0`, a fraction truncates toward zero (`2.7` is `2`, `-0.5` is `0`), and an
   * infinity or a value past the `i64` range saturates, then clamps, so in f64
   * mode `a.fill(v, 0, 1 / 0)` fills all of it. An unsigned end is never
   * negative, whatever its width: a `u64` of 2^63 or more as a start fills
   * nothing and as an end fills to the length. Natively a `u8[]` fill is one
   * `memset`.
   *
   * Under Node it is `Array.prototype.fill`, which has
   * `TypedArray.prototype.fill`'s meaning for every argument Nish admits,
   * except that an `i64` or `u64` end is a `bigint` there and throws a
   * `TypeError`, as all 64-bit arithmetic does. A `readonly T[]` refuses it:
   * "Cannot `fill` through readonly u8[] (declare it u8[] to write through
   * it)". Capability: none.
   *
   * @param value the value stored.
   * @param start the first slot, `0` by default.
   * @param end the slot after the last, `a.length` by default.
   * @returns the array, to `tsc` only: `nish` refuses the call as a value.
   */
  fill(value: T, start?: number, end?: number): this;
  /**
   * Sort in place, stably, as `Array.prototype.sort` does: element for element
   * Node's order for any consistent comparator. The comparator is required
   * (NL2620: `a.sort()` compares as strings in JavaScript and is refused,
   * "`sort` needs a comparator: write `xs.sort((a, b) => a - b)`") and is the
   * one argument (NL2619: "`sort` takes one comparator"); only "positive or
   * not" is read of its answer, so `-0` and `NaN` count as zero. A `readonly
   * T[]` ("Cannot `sort` through readonly") and `process.argv` ("`process.argv`
   * is read-only") are refused.
   *
   * The comparator is a compile-time function argument: a top-level function,
   * or an arrow reading only the `const` locals and parameters of the function
   * it is written in; an arrow reading a `let` is refused. The sort costs one
   * scratch array of `n` elements, released before it returns. `(a, b) => a -
   * b` is checked arithmetic on `i32` elements: two a full range apart
   * (`[2147483647, -1]`) panic with `attempt to subtract with overflow`, where
   * `(a, b) => (a > b ? 1 : a < b ? -1 : 0)` cannot overflow.
   *
   * Where JavaScript leaves the order to the implementation, so does Nish: an
   * array holding `NaN` under `(a, b) => a - b`, or a comparator that is not a
   * consistent order, comes out a permutation of its elements but not
   * necessarily Node's permutation; give `NaN` a place of its own in the
   * comparator to agree. Under Node and `--emit-ts` the call is the platform's
   * own `Array.prototype.sort`. Capability: none.
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
   * and ranged integers included, and `source` has this array's element type (a
   * `readonly` array may be the source, since it is only read); another element
   * type is refused: "`set` copies from an array of the receiver's element
   * type, so it expects u8[], got i32[]" (NL2396), and a non-number receiver as
   * for `fill` (NL2395). One or two arguments (NL2397). It is a statement:
   * "`set` returns void and can only be used as a statement".
   *
   * The range written is checked: `0 <= offset` and `offset + source.length <=
   * a.length`, or the program panics with `slice out of range: [offset,
   * offset + src.length) of length a.length` and exits 1, the message `s.slice` gives;
   * a range that ends exactly at `a.length`, and an empty `source` at
   * `a.length`, are in range, where JavaScript throws a `RangeError` for
   * exactly these offsets. An overlapping `source` (`a.set(a)`, or two headers
   * over one buffer from a C host) is copied as if it were read first.
   *
   * A float offset converts as for `fill`'s ends (`NaN` is `0`, a fraction
   * truncates, an infinity or a value past the `i64` range saturates), and a
   * saturated offset fails the range check with the saturated value in the
   * message, for example `slice out of range: [9223372036854775807,
   * -9223372036854775808) of length 4` for `1e300`. An unsigned offset is never
   * negative: a `u64` of 2^63 or more panics, printed signed. A `readonly T[]`
   * refuses it: "Cannot `set` through readonly u8[] (declare it u8[] to write
   * through it)".
   *
   * Under Node, `runtime/nish.mjs` adds `set` to `Array.prototype` with the
   * copy-first semantics and the native panic; a TypeScript host without it has
   * no `set` on a plain array, and an `i64` or `u64` offset is a `bigint` there
   * and throws a `TypeError`. Capability: none.
   *
   * @param source the elements copied.
   * @param offset the first slot written, `0` by default.
   */
  set(source: readonly T[], offset?: number): void;
  /**
   * A new array of `callbackfn(element)` for each element, in order, as
   * `Array.prototype.map` gives. The callback takes the element, or the
   * element and its index; a third parameter (JavaScript's array argument) is
   * refused (NL2698), as is a second argument to `map` itself. It is a
   * top-level function or an arrow reading only `const` locals and parameters,
   * and the call compiles to a loop that calls it directly (`std/array`'s
   * `map`). Capability: none.
   *
   * @param callbackfn called once per element, with the element and its index.
   * @returns a new array of the callback's answers, of the receiver's length.
   */
  map<U>(callbackfn: (value: T, index: number) => U): U[];
  /**
   * A new array of the elements for which `predicate` answers `true`, in
   * order, as `Array.prototype.filter` gives. The predicate answers a
   * `boolean` and takes the element, or the element and its index, under the
   * callback rules of `map`. Capability: none.
   *
   * @param predicate called once per element, with the element and its index.
   * @returns a new array of the elements kept.
   */
  filter(predicate: (value: T, index: number) => boolean): T[];
  /**
   * Whether `predicate` answers `true` for some element, stopping at the first
   * that does, as `Array.prototype.some` does; an empty array answers `false`.
   * The callback rules are `map`'s. Capability: none.
   *
   * @param predicate called in order, with the element and its index, until it answers `true`.
   * @returns `true` when some element satisfies `predicate`.
   */
  some(predicate: (value: T, index: number) => boolean): boolean;
  /**
   * Whether `predicate` answers `true` for every element, stopping at the
   * first that does not, as `Array.prototype.every` does; an empty array
   * answers `true`. The callback rules are `map`'s. Capability: none.
   *
   * @param predicate called in order, with the element and its index, until it answers `false`.
   * @returns `true` when no element fails `predicate`.
   */
  every(predicate: (value: T, index: number) => boolean): boolean;
  /**
   * The index of the first element for which `predicate` answers `true`, or
   * `-1`, as `Array.prototype.findIndex` gives. The callback rules are
   * `map`'s. There is no `find`: TypeScript types its answer `T | undefined`
   * and Nish has no `undefined`, so `xs.find(...)` is refused (NL2697) and
   * points here. Capability: none.
   *
   * @param predicate called in order, with the element and its index, until it answers `true`.
   * @returns the first such index, or `-1`.
   */
  findIndex(predicate: (value: T, index: number) => boolean): number;
  /**
   * A copy of the elements from `start` up to `end`, in a new array, with
   * string `slice`'s rule: the range must satisfy `0 <= start <= end <=
   * length`, and anything else panics with `slice out of range: [start, end)
   * of length n` and exits 1, where JavaScript counts a negative index back
   * from the length and clamps the rest. `start` is `0` and `end` the length
   * by default; a third argument is refused (NL2699). Under Node the prelude's
   * `sliceArray` applies the same check. Capability: none.
   *
   * @param start the first index copied, `0` by default.
   * @param end the index after the last copied, the length by default.
   * @returns a new array of `end - start` elements.
   */
  slice(start?: number, end?: number): T[];
}

/**
 * `readonly T[]`, or `ReadonlyArray<T>` under the other spelling: the same
 * array, which may not be written through. It is the same header, the same
 * pointer and the same layout as `T[]`; the annotation is a promise the checker
 * keeps, and a `--emit-header` prototype spells such a parameter `const
 * nish_array *`.
 *
 * Everything that reads works (`length`, `a[i]`, `for...of`, `indexOf`, `join`,
 * `map`, `filter`, `some`, `every`, `findIndex`, `slice`, passing it on to
 * another `readonly T[]`); every write is refused under its own name, an
 * element store ("Cannot assign to an element of readonly i32[]
 * (declare it i32[] to write through it)"), `push`, `pop`, `set`, `fill` and
 * `sort` included. A `T[]` widens into a `readonly T[]`, and never back:
 * "Argument 1 of `fill`: expected i32[], got readonly i32[]". It is shallow, as
 * TypeScript's is: the element of a `readonly T[][]` is a mutable `T[]`.
 *
 * It is a type, not a parameter modifier, so it is legal wherever an array type
 * is (a class field, a return type, a `const`'s annotation). `readonly` goes on
 * an array type and nothing else: "`readonly` is only permitted on an array
 * type, got i32". `process.argv` is read-only under a rule of its own.
 */
interface ReadonlyArray<T> {
  /** The element count. */
  readonly length: number;
  /**
   * The first index whose element is `=== searchElement`, as on `T[]`: one
   * argument, strings by content, classes, interfaces and arrays by identity,
   * and a `NaN` element is never found. Capability: none.
   *
   * @param searchElement the element looked for.
   * @param fromIndex declared to match TypeScript's `lib`; `nish` refuses a second argument.
   * @returns its index, or `-1`.
   */
  indexOf(searchElement: T, fromIndex?: number): number;
  /**
   * The elements joined by `separator`, as on `string[]`: `string[]` only, and
   * the result is held to 2^31 − 1 bytes. Capability: none.
   *
   * @param separator between each two elements, `","` by default.
   * @returns the joined string.
   */
  join(separator?: string): string;
  /**
   * A new array of `callbackfn(element)` for each element, in order, as
   * `Array.prototype.map` gives. The callback takes the element, or the
   * element and its index; a third parameter (JavaScript's array argument) is
   * refused (NL2698), as is a second argument to `map` itself. It is a
   * top-level function or an arrow reading only `const` locals and parameters,
   * and the call compiles to a loop that calls it directly (`std/array`'s
   * `map`). Capability: none.
   *
   * @param callbackfn called once per element, with the element and its index.
   * @returns a new array of the callback's answers, of the receiver's length.
   */
  map<U>(callbackfn: (value: T, index: number) => U): U[];
  /**
   * A new array of the elements for which `predicate` answers `true`, in
   * order, as `Array.prototype.filter` gives. The predicate answers a
   * `boolean` and takes the element, or the element and its index, under the
   * callback rules of `map`. Capability: none.
   *
   * @param predicate called once per element, with the element and its index.
   * @returns a new array of the elements kept.
   */
  filter(predicate: (value: T, index: number) => boolean): T[];
  /**
   * Whether `predicate` answers `true` for some element, stopping at the first
   * that does, as `Array.prototype.some` does; an empty array answers `false`.
   * The callback rules are `map`'s. Capability: none.
   *
   * @param predicate called in order, with the element and its index, until it answers `true`.
   * @returns `true` when some element satisfies `predicate`.
   */
  some(predicate: (value: T, index: number) => boolean): boolean;
  /**
   * Whether `predicate` answers `true` for every element, stopping at the
   * first that does not, as `Array.prototype.every` does; an empty array
   * answers `true`. The callback rules are `map`'s. Capability: none.
   *
   * @param predicate called in order, with the element and its index, until it answers `false`.
   * @returns `true` when no element fails `predicate`.
   */
  every(predicate: (value: T, index: number) => boolean): boolean;
  /**
   * The index of the first element for which `predicate` answers `true`, or
   * `-1`, as `Array.prototype.findIndex` gives. The callback rules are
   * `map`'s. There is no `find`: TypeScript types its answer `T | undefined`
   * and Nish has no `undefined`, so `xs.find(...)` is refused (NL2697) and
   * points here. Capability: none.
   *
   * @param predicate called in order, with the element and its index, until it answers `true`.
   * @returns the first such index, or `-1`.
   */
  findIndex(predicate: (value: T, index: number) => boolean): number;
  /**
   * A copy of the elements from `start` up to `end`, in a new array, with
   * string `slice`'s rule: the range must satisfy `0 <= start <= end <=
   * length`, and anything else panics with `slice out of range: [start, end)
   * of length n` and exits 1, where JavaScript counts a negative index back
   * from the length and clamps the rest. `start` is `0` and `end` the length
   * by default; a third argument is refused (NL2699). Under Node the prelude's
   * `sliceArray` applies the same check. Capability: none.
   *
   * @param start the first index copied, `0` by default.
   * @param end the index after the last copied, the length by default.
   * @returns a new array of `end - start` elements.
   */
  slice(start?: number, end?: number): T[];
}

/**
 * A string: UTF-8 bytes. Every offset is a byte offset, like `length`, so
 * cutting a multi-byte character in half is possible and produces bytes that
 * are not a valid string. Under Node a string is UTF-16, so an offset, a
 * length or a code unit of text that is not ASCII differs there (NL8001
 * warns wherever such a number meets a fact not counted in bytes). An unknown
 * method is refused with the supported list: "Unknown method `codePointAt` on
 * string"; there is no `charAt`, `toUpperCase` or `toString`.
 */
interface String {
  /**
   * The UTF-8 byte length. Under Node, the count of UTF-16 code units, so
   * the number differs wherever the text is not ASCII (NL8001).
   */
  readonly length: number;
  /**
   * The byte at `index`, bounds-checked as `a[i]` is: out of range panics and
   * exits 1, where JavaScript answers `NaN`, which `number` cannot hold. One
   * argument. Under Node it is a UTF-16 code unit, so a byte above 127
   * differs (NL8001). Capability: none.
   *
   * @param index the byte offset.
   * @returns the byte.
   */
  charCodeAt(index: number): number;
  /**
   * The bytes of `[start, end)`. Both ends are clamped into `[0, s.length]`
   * and then swapped into order, as in JavaScript, so `s.substring(5, 0)` is
   * `s.substring(0, 5)` and a negative offset is `0`. In a loop, a bound the
   * compiler cannot place in `[0, s.length]` keeps the clamp and is reported by
   * a performance warning; a test that reaches the call
   * (`if (a >= 0 && a <= s.length)`) removes it, and `slice` has no clamp at
   * all. Capability: none.
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
   * JavaScript counts a negative offset from the end and answers `""` for a
   * reversed pair. An in-range non-negative pair gives exactly what
   * JavaScript's `String.prototype.slice` gives. A bound that is a negative
   * literal, or that no proof places inside `[0, length]`, is reported by
   * NL8002. Capability: none.
   *
   * @param start the first byte; `nish` requires it, though `lib`'s signature
   *   marks it optional.
   * @param end the byte after the last, `s.length` by default.
   * @returns the new string; an empty range is `""`.
   */
  slice(start?: number, end?: number): string;
  /**
   * The first byte offset at or after `position` at which `searchString`
   * occurs. `position` is clamped into `[0, s.length]` first, as in JavaScript:
   * a negative start searches from `0`, a start past the end finds nothing, and
   * the empty needle answers the clamped start, so `s.indexOf("")` is `0`,
   * `s.indexOf("", 3)` is `3` and `s.indexOf("", 99)` is `s.length`. A float
   * start converts as JavaScript's `ToIntegerOrInfinity` does (a fraction
   * truncates and `NaN` is `0`), and an unsigned one is clamped from above
   * only, so a `u64` past 2^63 is past the end.
   *
   * The search allocates nothing, so a loop `at = s.indexOf(sub, at +
   * sub.length)` copies nothing. Under Node it is the same call to
   * `String.prototype.indexOf`, whose answers differ only where every offset
   * does, on text that is not ASCII (NL8001). Capability: none.
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
   * @param position declared to match TypeScript's `lib`; `nish` refuses a second argument.
   * @returns whether it is one.
   */
  startsWith(searchString: string, position?: number): boolean;
  /**
   * Whether `searchString`'s bytes are a suffix; one longer than the string is
   * `false`. One argument. Capability: none.
   *
   * @param searchString the suffix.
   * @param endPosition declared to match TypeScript's `lib`; `nish` refuses a second argument.
   * @returns whether it is one.
   */
  endsWith(searchString: string, endPosition?: number): boolean;
}

/**
 * `String.fromCharCode`, `lib.es2022`'s own member of `StringConstructor`,
 * repeated so that its byte meaning in Nish is documented.
 */
interface StringConstructor {
  /**
   * The one-byte string of `c & 0xFF`, the inverse of `charCodeAt`. One
   * argument. A value above 127 makes a byte that is not valid UTF-8 on its
   * own; nothing validates it. Under Node it is one UTF-16 unit, so ASCII
   * agrees and a byte above 127 does not. Capability: none.
   *
   * @param codes the one byte value.
   * @returns the one-byte string.
   */
  fromCharCode(...codes: number[]): string;
}

/**
 * An insertion-ordered map with SameValueZero keys (`-0` is `+0` and `NaN` is
 * `NaN`), a builtin with no import. A key is a `string`, a number of any width
 * in either mode (`f32` and `f64` included), a `boolean`, an `enum` or a class
 * instance (by identity); not an interface, an array, a nullable or a `Result`:
 * "`Point` cannot be the key type of `Map<Point, i32>`: a key is hashed and
 * compared by value, or by identity for a class instance".
 *
 * A `-0` key is stored as `+0` by every insert path, so a walk over `keys()`
 * yields `+0`. A value is anything but `void` and an interface, whose record
 * would be copied into the table rather than shared: "`Point` cannot be the
 * value type of `Map<string, Point>`".
 *
 * `new Map<K, V>()` takes no arguments ("`new Map<string, i32>` takes no
 * arguments in this version"); the type arguments are written out, except that
 * a `const` or `let` annotated with the type takes them from the annotation,
 * and a bare `new Map()` is refused: "`Map` is generic: it must be written with
 * its type arguments". The members are JavaScript's, less `entries` and
 * `forEach` (there is no destructuring, and a method cannot take a function);
 * anything else is refused as if it did not exist. `set` answers the receiver,
 * so calls chain.
 *
 * `keys()` and `values()` are iterators, admitted only as the iterable of a
 * `for...of`: stored, passed, returned or dropped, they are refused (NL2372,
 * NL2373, NL2374, NL2358), and `for (const e of m)` needs `entries()` (NL2375).
 * The walk visits entries in insertion order, skips a deleted key not yet
 * reached, visits a key set during the walk later in the same walk, and keeps a
 * re-set key in its place, as JavaScript's does.
 *
 * At most 2^24 − 1 entries (one fewer than Node's 2^24); one more panics with
 * `Map maximum size exceeded`, after first compacting away dead entries (not
 * while a loop walks the table). String keys are hashed with SipHash-1-3 under
 * a per-process random key drawn from the system's entropy source before
 * `main`, and an integer, `boolean` or enum key under a per-process random
 * multiply-add-shift; if the entropy source fails the program panics before
 * `main`: "Map: the system's entropy source failed".
 *
 * A float key and a class instance key are not keyed, so a program keying a
 * table by floats a peer chose converts them to a string or a scaled integer
 * first. On wasm32 the key comes from WASI's `random_get`, and a reactor module
 * is keyed only once its host calls `_initialize`. A pair of `i32`s is one
 * `i64` key: `(toI64(hi) << toI64(32)) | toI64(toU32(lo))`. `nish/map` adds
 * `reserve(m, n)` and `getOrInsert(m, k, v)`, which JavaScript's `Map` has no
 * call for. A module that declares or imports its own `Map` gets no implicit
 * import.
 */
interface Map<K, V> {
  /** The entry count, read-only: assigning to it is refused. */
  readonly size: number;
  /**
   * The value under `key`, one probe. The `V | undefined` is a maybe, admitted
   * only as the initialiser of a `const` (unannotated, or annotated with the
   * maybe type), the left of `??`, or an operand of `=== undefined` or `!==
   * undefined`. A `const` so bound reads as `V` in the region a test proves it
   * present (`if (a === undefined) return` included), and nowhere else.
   *
   * Any other place is refused with a message naming it: a `let` (NL2361), an
   * argument (NL2362), a `return` (NL2363), a field (NL2364), an array element
   * (NL2365), a template literal hole (NL2366), an operand of another operator
   * (NL2367), the default of another `??` (NL2371), a `const` annotated `V`
   * (NL2368), or anywhere else (NL2369). When `V` is nullable, `??` replaces a
   * stored `null` as well. `get` is called, never read as a value. Capability:
   * none.
   *
   * @param key the key looked up.
   * @returns the value, or `undefined`.
   */
  get(key: K): V | undefined;
  /**
   * Put `value` under `key`, replacing any value there. A new key is appended
   * past the end of the order; a key already there keeps its place. Calls
   * chain. Capability: none.
   *
   * @param key the key.
   * @param value the value.
   * @returns the map itself.
   */
  set(key: K, value: V): this;
  /**
   * Whether `key` is present. One probe. Capability: none.
   *
   * @param key the key looked up.
   * @returns whether it is.
   */
  has(key: K): boolean;
  /**
   * Remove `key`'s entry. Setting the key again appends a new entry at the
   * end. Capability: none.
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
 * import. A member is what a `Map` key may be (and `-0` is stored as `+0`).
 * `new Set<T>()` takes no arguments ("`new Set<string>` takes no arguments in
 * this version"). `keys()` and `values()` are one walk, as JavaScript's are,
 * admitted only as the iterable of a `for...of`, which also takes the set
 * itself: `for (const x of s)`. At most 2^24 − 1 members; one more panics with
 * `Set maximum size exceeded`. Hashing, the entropy source and the walk's
 * rules are `Map`'s. `add` and `has` are one probe each, and `if (!s.has(x)) {
 * s.add(x); ... }` with the `add` first in the branch asks about the member
 * once.
 */
interface Set<T> {
  /** The member count, read-only: assigning to it is refused. */
  readonly size: number;
  /**
   * Add `value`; a member already there keeps its place. Calls chain.
   * Capability: none.
   *
   * @param value the member added.
   * @returns the set itself.
   */
  add(value: T): this;
  /**
   * Whether `value` is a member. One probe. Capability: none.
   *
   * @param value the member looked up.
   * @returns whether it is.
   */
  has(value: T): boolean;
  /**
   * Remove `value`. Adding it again appends it at the end of the order.
   * Capability: none.
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
