/**
 * Run an AmritScript program under Node, unmodified.
 *
 * ```
 * node --experimental-strip-types --import ./runtime/amritscript.mjs prog.ts
 * ```
 *
 * This is a *different* claim from the one WP13 tests, and a much smaller one.
 * The differential harness rewrites a program from the checker's own type table
 * before Node sees it (docs/wp13-differential.md), which is what lets it
 * reproduce wrapping arithmetic, byte-length strings and bounds checks exactly.
 * Nothing is rewritten here: the source runs as the TypeScript it is, with the
 * type annotations stripped. All this module can do is supply the globals
 * AmritScript has and Node does not, and fix `console.log`'s formatting.
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
 *     functions and do get AmritScript's semantics.
 *   - **`Arena.*` reports zero.** There is no arena, and a program that prints
 *     `Arena.used()` is measuring the native allocator by definition.
 *
 * Everything here delegates to `runtime/shim.mjs`, the module the differential
 * harness already uses, so the two cannot drift apart: a semantic fixed there
 * is fixed here in the same commit.
 */
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

// Streams and files. These are globals in AmritScript rather than imports from
// `node:fs`, which is why they have to be installed at all.
provide("write", shim.write);
provide("writeError", shim.writeError);
provide("panic", shim.panic);
provide("readFileSync", shim.readFileSync);
provide("readFileSyncOrNull", shim.readFileSyncOrNull);
provide("writeFileSync", shim.writeFileSync);
provide("appendFileSync", shim.appendFileSync);
provide("mkdirSync", shim.mkdirSync);
provide("isDirectorySync", shim.isDirectorySync);
provide("spawnSync", shim.spawnSync);

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
provide("Arena", {
  mark: () => 0n,
  release: () => {},
  reset: () => {},
  used: () => 0n,
});
