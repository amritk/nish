/**
 * Run an Nish program under Node, unmodified.
 *
 * ```
 * node --experimental-strip-types --import ./runtime/nish.mjs prog.ts
 * ```
 *
 * This is a *different* claim from the one WP13 tests, and a much smaller one.
 * The differential harness rewrites a program from the checker's own type table
 * before Node sees it (docs/wp13-differential.md), which is what lets it
 * reproduce wrapping arithmetic, byte-length strings and bounds checks exactly.
 * Nothing is rewritten here: the source runs as the TypeScript it is, with the
 * type annotations stripped. All this module can do is supply the globals
 * Nish has and Node does not, and fix `console.log`'s formatting.
 *
 * That is enough for a real and useful subset — **f64 mode**, where JavaScript's
 * `+ - * / %` on doubles *are* `fadd/fsub/fmul/fdiv/frem` and `Math.*` are the
 * same IEEE operations, so the arithmetic needs no help. It is not enough for
 * i32 mode, and it never will be: `number` is a wrapping 32-bit integer there
 * and every operator would have to change.
 *
 * `docs/RUN_UNDER_NODE.md` states the overlap and the whole list of what stays
 * divergent. The short version, because it belongs next to the code too:
 *
 *   - **i32 mode is out.** Wrapping, truncating `/`, and the divide-by-zero
 *     panic are all operator-level and cannot be reached from here.
 *   - **`s.length` is UTF-16 units under Node** and UTF-8 bytes natively, and
 *     so is every string offset. ASCII agrees; nothing else does.
 *   - **`a[i]` is unchecked**: out of range is `undefined` here and an exit-1
 *     panic natively. Only a program that indexes out of range can tell.
 *   - **Method dispatch is virtual under Node** and static natively, so an
 *     override reached through a base-typed value differs (LANGUAGE.md,
 *     "Method dispatch is static").
 *   - **`orReturn()` does not propagate.** It throws a marker the rewriter's
 *     `try`/`catch` turns into an early `return`; unmodified there is no
 *     `catch`, so it escapes. `Ok`/`Err`/`isOk`/`isErr`/`value`/`error`/
 *     `unwrapOr`/`expect` all work.
 *   - **`Number(s)` keeps JavaScript's parsing.** `Number` is a constructor
 *     carrying statics (`Number.isNaN` among them) that this module and Node
 *     both need, so it is left alone; `parseInt` and `parseFloat` are plain
 *     functions and do get Nish's semantics.
 *   - **`Arena.*` reports zero.** There is no arena, and a program that prints
 *     `Arena.used()` is measuring the native allocator by definition.
 *   - **`i64` and `u64` are out**, for the same reason i32 mode is. The shim
 *     represents them as BigInt, because that is the only JavaScript type that
 *     holds 64 bits and wraps where the native ones wrap. Unrewritten source
 *     says `n + 1`, and JavaScript refuses to mix a BigInt with a number, so
 *     `toI64`/`toU64`/`f64ToBits` throw at the first arithmetic instead of
 *     answering something that is quietly wrong. That is the intended failure:
 *     a `TypeError` naming the line beats a number that silently stopped
 *     wrapping at 2^53.
 *
 * Everything here delegates to `runtime/shim.mjs`, the module the differential
 * harness already uses, so the two cannot drift apart: a semantic fixed there
 * is fixed here in the same commit.
 */
import { registerHooks } from "node:module";
import * as shim from "./shim.mjs";

/** Install `value` as a global unless the program declared its own. */
const provide = (name, value) => {
  if (!(name in globalThis)) {
    globalThis[name] = value;
  }
};

// `console.log(x)` is `String(x)` plus a newline on a synchronous write, which
// is not what Node's console does: it inspects, so `-0` prints `-0` where
// `String(-0)` is `0`, and a BigInt prints with an `n`. Overwritten rather than
// `provide`d, because Node always has one.
globalThis.console = {
  ...globalThis.console,
  log: shim.log,
  error: shim.error,
};

// Streams and files. These are globals in Nish rather than imports from
// `node:fs`, which is why they have to be installed at all. `readdirSync` is
// the one whose answer is not simply Node's: the language sorts the listing by
// UTF-8 bytes, so the shim sorts on the encoded bytes rather than leaving
// `Array#sort`'s UTF-16 order — the two agree on ASCII names only.
provide("write", shim.write);
provide("writeError", shim.writeError);
provide("panic", shim.panic);
provide("readFileSync", shim.readFileSync);
provide("readFileSyncOrNull", shim.readFileSyncOrNull);
provide("writeFileSync", shim.writeFileSync);
provide("appendFileSync", shim.appendFileSync);
provide("mkdirSync", shim.mkdirSync);
provide("isDirectorySync", shim.isDirectorySync);
provide("readdirSync", shim.readdirSync);
provide("realpathSync", shim.realpathSync);
provide("spawnSync", shim.spawnSync);
provide("spawnSyncTo", shim.spawnSyncTo);
provide("getenv", shim.getenv);

// The clock. `monotonicNanos()` answers an `i64`, so the value is a BigInt here
// as it is in the rewritten runner — and unusually for the i64 surface that is
// enough on its own: `t1 - t0` on two BigInts is the `sub i64` the native build
// performs, and an elapsed time is nowhere near the width where BigInt's
// arbitrary precision and the native wrap would part. It is only mixing a
// reading with a plain `number` that throws, which is the failure the header
// describes. A printed reading can never match a native run: the two origins are
// both arbitrary, and only the difference between two reads means anything.
provide("monotonicNanos", shim.monotonicNanos);

// Conversions. In f64 mode `toF64` is the identity and `toI32` is the one that
// matters (it saturates, where a JavaScript cast would not).
provide("toI32", shim.toI32);
provide("toI64", shim.toI64);
provide("toF64", shim.toF64);
provide("toF32", (x) => Math.fround(x));
provide("toU8", (x) => shim.convert(x, "f64", "u8"));
provide("toU16", (x) => shim.convert(x, "f64", "u16"));
provide("toU32", (x) => shim.convert(x, "f64", "u32"));
provide("toU64", (x) => shim.convert(x, "f64", "u64"));
provide("f64ToBits", shim.f64ToBits);
provide("bitsToF64", shim.bitsToF64);

// `Result`. Everything works but `orReturn`, which needs the caller's control
// flow and therefore the rewriter; see the header.
provide("Ok", shim.Ok);
provide("Err", shim.Err);

// The string parsers, whose deviations from JavaScript are documented rules
// (base-10 `parseInt` that saturates, `parseFloat` that reads a `0x` prefix).
globalThis.parseInt = shim.parseInt;
globalThis.parseFloat = shim.parseFloat;

// `process.argv[0]` is the program on both sides: the executable natively, this
// script under Node, which is one index later than Node's own `argv`.
process.argv = shim.argv();

// There is no arena. `mark`/`release`/`reset` are no-ops rather than errors so
// that a program which manages memory explicitly still runs; `used()` answers
// zero, which is the honest number for a host that is not bump-allocating.
// Delegated like everything else here rather than written inline, so that the
// answers cannot drift from the ones the rewritten runner gives.
provide("Arena", {
  mark: shim.arenaMark,
  release: shim.arenaRelease,
  reset: shim.arenaReset,
  used: shim.arenaUsed,
});

// The standard library. A program imports it as `nish/<module>`, which the
// compiler resolves to `std/<module>.ts` beside itself; this does the same for
// Node, relative to this file rather than to the program, so the same
// specifier works from any directory. Only the `nish/` package is answered
// here, and every other specifier goes to Node as it was written.
registerHooks({
  resolve: (specifier, context, next) =>
    specifier.startsWith("nish/")
      ? next(new URL(`../std/${specifier.slice("nish/".length)}.ts`, import.meta.url).href, context)
      : next(specifier, context),
});
