// The compiler options stage1 reads (`CompilerOptions` in `src/types.ts`),
// for docs/wp14-selfhost.md milestone S4.
//
// A class rather than the object literal `src/` uses, because the language has no
// optional fields and no spread: every flag has a value at all times and the
// constructor sets the defaults, so a caller changes only what it means to.
// `target` is the empty string rather than `undefined` when the module is
// target-neutral, which is the same distinction with one fewer type.
//
// `numberMode` is the `NUMBER_MODE_*` of `self/context.ts`, so one value
// serves the checker and the emitter.

import { NUMBER_MODE_I32 } from "./context";

export class Options {
  /** How the `number` keyword is lowered: `NUMBER_MODE_I32` or `NUMBER_MODE_F64`. */
  numberMode: i32;
  /**
   * Emit the LLVM performance attributes (nounwind, readnone, noalias, ...)
   * and explicit alignment on memory operations. Off is `--plain`, the bare
   * Phase 1 output.
   */
  optimizeAttributes: boolean;
  /** Always emit the runtime ABI prelude, even when nothing in the module uses it. */
  runtimeDecls: boolean;
  /** Lower allocations that provably do not outlive their function to allocas (WP6). */
  stackAlloc: boolean;
  /**
   * Give non-exported functions `internal` linkage so LLVM may inline or drop
   * them. Off is `--no-strict-exports`, which keeps every function a C-ABI
   * symbol. Default: on (WP15 §3).
   */
  strictExports: boolean;
  /** Drop the bounds check on `a[i]`. Unsafe; for benchmarks only. */
  uncheckedIndexing: boolean;
  /** A triple for `--target`, or the empty string to keep the IR target-neutral. */
  target: string;
  /**
   * Emit `nsw` on signed user-level integer `add`/`sub`/`mul` (WP9). Off is
   * `--wrapping`, which restores two's-complement wrapping. Unsigned
   * arithmetic is defined as wrapping and never carries a flag either way.
   * Default: on (WP15 §3).
   */
  nsw: boolean;
  /**
   * Emit DWARF debug metadata (`-g`, WP10): a compile unit, a `DISubprogram`
   * per function, a `!dbg` location per instruction and the local variables
   * (`self/debug.ts`). Off leaves the IR byte for byte what it was.
   */
  debugInfo: boolean;
  /**
   * Give every thread its own arena (`--threads`, WP20 T0). The one thing it
   * changes in the IR is the storage class of `@nish_arena`, which the inlined
   * bump allocator reaches through the thread pointer instead of the data
   * segment; the runtime has to be built with `-DNISH_THREADS` to match, which
   * `--link` and `scripts/build.sh --threads` do. No language surface: nothing
   * in the language makes a second thread, so no program can tell. Off leaves
   * the IR byte for byte what it was.
   */
  threads: boolean;
  /**
   * The WP8 interop sidecars, each the path `--emit-header` / `--emit-dts` /
   * `--emit-napi` was given, or the empty string when it was not passed.
   * `--emit-dts` writes two files: the declarations, and the loader that
   * implements them beside it (`wasmLoaderPath`).
   *
   * They change no byte of the IR — they are derived from the same checked
   * program after it — so they live here only because this is where a flag
   * that reaches the driver's second half is kept.
   */
  emitHeader: string;
  emitDts: string;
  emitNapi: string;
  /**
   * WP24 A1: the same shim with the asynchronous exports added. A separate
   * output rather than a modifier on `emitNapi`, so that one build can write
   * both and a host can diff them -- and so the flag has nothing to say when
   * it is absent, which is what keeps an existing shim byte-identical.
   */
  emitNapiAsync: string;
  /**
   * The directory holding `scripts/`, `runtime/` and `std/`, as the driver
   * worked it out from `argv[0]`. It is here rather than derived where it is
   * needed because `process.argv` is legal only in a program that has an entry
   * `main`: a library module reading it would not compile on its own, and
   * `tests/run.js` compiles every `self/` module on its own. Empty when the
   * driver could not find one, which makes `nish/x` resolve to nothing and
   * report itself as a module the library does not have.
   */
  packageRoot: string;
  /**
   * `--json`: every diagnostic is one object on stdout. Kept here, beside the
   * flags that change the IR, for one reader rather than for the IR: a broken
   * invariant is reported where it is found (`internalErrorFor` in
   * `self/ice.ts`), deep in the emitter, and under `--json` that report has to
   * be an object too -- the language has no exceptions to carry it back to
   * the driver that parsed the flag.
   */
  json: boolean;

  constructor() {
    this.numberMode = NUMBER_MODE_I32;
    this.optimizeAttributes = true;
    this.runtimeDecls = false;
    this.stackAlloc = true;
    this.strictExports = true;
    this.uncheckedIndexing = false;
    this.target = "";
    this.nsw = true;
    this.debugInfo = false;
    this.threads = false;
    this.emitHeader = "";
    this.emitDts = "";
    this.emitNapi = "";
    this.emitNapiAsync = "";
    this.packageRoot = "";
    this.json = false;
  }
}
