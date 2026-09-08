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
  /** Give non-exported functions `internal` linkage so LLVM may inline or drop them. */
  strictExports: boolean;
  /** Drop the bounds check on `a[i]`. Unsafe; for benchmarks only. */
  uncheckedIndexing: boolean;
  /** A triple for `--target`, or the empty string to keep the IR target-neutral. */
  target: string;
  /** Emit `nsw` / `nuw` on user-level integer `add`/`sub`/`mul` (WP9). */
  nsw: boolean;
  /**
   * Emit DWARF debug metadata (`-g`, WP10): a compile unit, a `DISubprogram`
   * per function, a `!dbg` location per instruction and the local variables
   * (`self/debug.ts`). Off leaves the IR byte for byte what it was.
   */
  debugInfo: boolean;
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

  constructor() {
    this.numberMode = NUMBER_MODE_I32;
    this.optimizeAttributes = true;
    this.runtimeDecls = false;
    this.stackAlloc = true;
    this.strictExports = false;
    this.uncheckedIndexing = false;
    this.target = "";
    this.nsw = false;
    this.debugInfo = false;
    this.emitHeader = "";
    this.emitDts = "";
    this.emitNapi = "";
  }
}
