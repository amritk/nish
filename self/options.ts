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

  constructor() {
    this.numberMode = NUMBER_MODE_I32;
    this.optimizeAttributes = true;
    this.runtimeDecls = false;
    this.stackAlloc = true;
    this.strictExports = false;
    this.uncheckedIndexing = false;
    this.target = "";
    this.nsw = false;
  }
}
