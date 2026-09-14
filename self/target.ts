// Target triples and their LLVM data layouts for stage1 (`src/codegen/target.ts`,
// docs/wp14-selfhost.md milestone S4).
//
// The emitted IR is target-neutral by default. With `--target` the module
// carries the layout string clang 18 itself emits for that triple, so
// `opt -O2 -S module.ll` needs no `-mtriple`. The strings below are copied
// verbatim from `src/codegen/target.ts`, which copied them from
// `clang --target=<triple> -S -emit-llvm`; a layout that disagrees with the
// one clang later applies is a hard error at build time, never a silent
// miscompilation.
//
// `src/` keeps two `Record<string, Target>` tables. Here they are two `if`
// chains: `switch` is integer-only in the language, deliberately, because a string
// switch would be a chain of `nish_str_eq` calls wearing a `switch`'s clothes
// (docs/wp14-selfhost.md §5). There are six triples and ten aliases and the
// lookup happens once per compilation, so the chain is the honest shape.
//
// `--target host` is here too (docs/wp14-selfhost.md §7a). It was the one
// spelling stage1 refused, because answering it means asking the machine what
// it is and nothing in the language did; `process.platform` and `process.arch`
// are two builtins and eight bytes of runtime `.text`, and `hostTriple` below
// composes the triple from them exactly as `hostTriple` in
// `src/codegen/target.ts` composes it from Node's two strings of the same
// names. A machine neither of them has a triple for is still refused, with the
// list — the answer is "this compiler has no triple for you", not a guess.

export class Target {
  /** The triple written to `target triple`; aliases are normalised to this. */
  triple: string;
  datalayout: string;

  constructor(triple: string, datalayout: string) {
    this.triple = triple;
    this.datalayout = datalayout;
  }
}

const X86_64_LINUX_LAYOUT: string =
  "e-m:e-p270:32:32-p271:32:32-p272:64:64-i64:64-i128:128-f80:128-n8:16:32:64-S128";
const X86_64_DARWIN_LAYOUT: string =
  "e-m:o-p270:32:32-p271:32:32-p272:64:64-i64:64-i128:128-f80:128-n8:16:32:64-S128";
const WASM32_LAYOUT: string = "e-m:e-p:32:32-p10:8:8-p20:8:8-i64:64-n32:64-S128-ni:1:10:20";

/** The canonical triples, in the order `--target` lists them when it refuses one. */
export const supportedTargets = (): string[] => {
  return [
    "x86_64-unknown-linux-gnu",
    "aarch64-unknown-linux-gnu",
    "x86_64-apple-darwin",
    "aarch64-apple-darwin",
    "wasm32-unknown-unknown",
    "wasm32-wasi",
  ];
};

/** The layout of a canonical triple, or the empty string when it is not one. */
const layoutOf = (triple: string): string => {
  if (triple === "x86_64-unknown-linux-gnu") {
    return X86_64_LINUX_LAYOUT;
  }
  if (triple === "aarch64-unknown-linux-gnu") {
    return "e-m:e-i8:8:32-i16:16:32-i64:64-i128:128-n32:64-S128";
  }
  if (triple === "x86_64-apple-darwin") {
    return X86_64_DARWIN_LAYOUT;
  }
  if (triple === "aarch64-apple-darwin") {
    return "e-m:o-i64:64-i128:128-n32:64-S128";
  }
  if (triple === "wasm32-unknown-unknown" || triple === "wasm32-wasi") {
    return WASM32_LAYOUT;
  }
  return "";
};

/** Other spellings people type, each mapped to a canonical triple. */
const aliasOf = (spec: string): string => {
  if (spec === "x86_64-linux-gnu" || spec === "x86_64-linux") {
    return "x86_64-unknown-linux-gnu";
  }
  if (spec === "aarch64-linux-gnu" || spec === "aarch64-linux") {
    return "aarch64-unknown-linux-gnu";
  }
  if (spec === "arm64-apple-darwin" || spec === "arm64-apple-macosx" || spec === "aarch64-apple-macosx") {
    return "aarch64-apple-darwin";
  }
  if (spec === "x86_64-apple-macosx") {
    return "x86_64-apple-darwin";
  }
  if (spec === "wasm32") {
    return "wasm32-unknown-unknown";
  }
  if (spec === "wasm32-unknown-wasi") {
    return "wasm32-wasi";
  }
  return "";
};

/**
 * The triple of the machine the compiler is running on, from what the runtime
 * says the platform and the architecture are (WP14 §7a). The empty string when
 * this is not a machine the compiler has a triple for — a 32-bit host, a BSD,
 * a WASI build of the compiler itself — which `resolveTarget` turns into the
 * same refusal an unknown triple gets.
 *
 * The two spellings are Node's, which is what `runtime.c` answers with, so
 * this is the same mapping `hostTriple` makes in `src/codegen/target.ts` and
 * the two compilers resolve `--target host` to the same triple on the same
 * machine (`tests/run.js`, the WP14 block).
 */
export const hostTriple = (): string => {
  const arch = process.arch;
  let cpu = "";
  if (arch === "x64") {
    cpu = "x86_64";
  } else if (arch === "arm64") {
    cpu = "aarch64";
  }
  if (cpu.length === 0) {
    return "";
  }
  const platform = process.platform;
  if (platform === "linux") {
    return `${cpu}-unknown-linux-gnu`;
  }
  if (platform === "darwin") {
    return `${cpu}-apple-darwin`;
  }
  return "";
};

/**
 * Resolve a `--target` argument: a supported triple, one of its aliases, or
 * `host`. Null for anything else, so the driver can list what it accepts.
 */
export const resolveTarget = (spec: string): Target | null => {
  if (spec === "host") {
    const triple = hostTriple();
    return triple.length === 0 ? null : new Target(triple, layoutOf(triple));
  }
  const direct = layoutOf(spec);
  if (direct.length > 0) {
    return new Target(spec, direct);
  }
  const alias = aliasOf(spec);
  if (alias.length > 0) {
    return new Target(alias, layoutOf(alias));
  }
  return null;
};

/** The module-header lines that pin a module to `target`. */
export const targetHeader = (target: Target): string[] => {
  const lines: string[] = [];
  lines.push(`target datalayout = "${target.datalayout}"`);
  lines.push(`target triple = "${target.triple}"`);
  return lines;
};
