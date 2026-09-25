// Who can call a function, or see a class's layout, besides this program.
//
// `export` means two things, and which one depends on what the build hands to
// something else. In every build it means "importable by another module of
// this program". In a build whose output something other than this compiler
// links — a `.ll` a C host is linked with, a header, an N-API shim, a wasm
// module — it also means "callable by that host, with any arguments", and a
// fact about the program's own call sites says nothing about those calls.
//
// **A closed-world build is the one where the first meaning is the only one.**
// The compiler writes the final executable in this invocation, from every
// module of the program, and nothing else is in the link that could call back
// into it. Then every call to an exported function is one the compiler saw,
// which is the standard LTO view of an executable, and an exported function or
// a method of an exported class may take facts from its call sites like any
// other. It is closed only when all of these hold:
//
//   - `--link` was given: the compiler runs the link, so the executable is the
//     output and there is no object or IR-only product for another link to
//     take (`-o` alone writes IR, which a host may link, and stays open);
//   - the link is a native one: not `--profile wasi`, and not a wasm
//     `--target`, whose module a host instantiates and whose exports it calls;
//   - no sidecar was asked for: `--emit-header`, `--emit-dts` (and the wasm
//     loader it writes), `--emit-napi` and `--emit-napi-async` each describe
//     the exports to a host, which is the only reason to write one;
//   - no module declares a C function (`declare function`). `--link` hands
//     `scripts/build.sh` the emitted modules and the runtime and nothing else,
//     so a declared function comes from a C library this compiler did not
//     build, and the rule does not try to prove what that library calls.
//
// The runtime is in every link, and it calls into the program in two places:
// `nish_main`, the entry point, which is host-visible whatever the build is,
// and a `nish/threads` region's chunk function, which is an instantiation and
// takes no entry facts anyway.
//
// **Host-visible is the default.** Anything this file does not know about keeps
// the open-world answer: a new output mode is open until it is added here with
// the reason it is closed.

import { Options } from "./options";
import { CheckedProgram } from "./program";

/**
 * The part of a build `hostVisible` reads, worked out once per compilation from
 * its options and its modules. The driver's flags reach it through `Options`,
 * so nothing here reads a global.
 */
export class BuildMode {
  /** Every call into the program is one the compiler sees (the module header's list). */
  closedWorld: boolean;
  /**
   * `--no-strict-exports` gives every function external linkage, so in an open
   * build a host can call a function nobody exported.
   */
  everySymbolPublic: boolean;
  /**
   * Some code this compiler did not write is handed the program's class
   * layouts, whatever `export` says: a header lists every class's C struct, a
   * wasm module or an N-API shim is driven by a host through the declarations
   * written for it, and a declared C function may be handed an object. A
   * layout decision that is only this program's to make (`self/inline_arrays.ts`)
   * keeps the declared layout in such a build, for every class.
   */
  layoutsShared: boolean;

  constructor(closedWorld: boolean, everySymbolPublic: boolean, layoutsShared: boolean) {
    this.closedWorld = closedWorld;
    this.everySymbolPublic = everySymbolPublic;
    this.layoutsShared = layoutsShared;
  }
}

/** A wasm triple: the module is instantiated by a host, which calls its exports. */
const wasmTarget = (target: string): boolean => target.startsWith("wasm");

/** Whether any module of the program declares a C function. */
const declaresForeign = (programs: CheckedProgram[]): boolean => {
  for (const program of programs) {
    for (const sig of program.functions) {
      if (sig.foreign()) {
        return true;
      }
    }
  }
  return false;
};

/** The build `opts` describes, for a program made of `programs`. */
export const buildModeOf = (opts: Options, programs: CheckedProgram[]): BuildMode => {
  const sidecar =
    opts.emitHeader.length > 0 ||
    opts.emitDts.length > 0 ||
    opts.emitNapi.length > 0 ||
    opts.emitNapiAsync.length > 0;
  const foreign = declaresForeign(programs);
  const wasm = opts.profile === "wasi" || wasmTarget(opts.target);
  const closed = opts.link.length > 0 && !wasm && !sidecar && !foreign;
  return new BuildMode(closed, !opts.strictExports, sidecar || foreign || wasm);
};

/**
 * Whether code this compiler did not see may call a declaration, or see its
 * layout: a function, a method (pass its class's `exported`, which a method
 * inherits), or a class. `isEntry` is the program's entry point, which the
 * runtime calls. The one place that decides it, so that every analysis that
 * trusts its call sites — the call-site ranges of `self/ranges.ts` today —
 * asks the same question.
 */
export const hostVisible = (mode: BuildMode, exported: boolean, isEntry: boolean): boolean =>
  isEntry || (!mode.closedWorld && (exported || mode.everySymbolPublic));
