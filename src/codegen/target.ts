/**
 * Target triples and their LLVM data layouts (WP9).
 *
 * The emitted IR is target-neutral by default: no `target datalayout`, no
 * `target triple`. That is fine for clang, which fills both in from its own
 * `--target`, but `opt` and `llc` then run with a generic layout (pointer
 * size, natural alignments and vector width unknown), so the loop vectoriser
 * never fires and `opt -O3 -S` output is not what the final binary gets.
 * With `--target` the module carries the layout string clang 18 itself emits
 * for that triple, so `opt -O2 -S module.ll` needs no `-mtriple`.
 *
 * The strings below are copied verbatim from `clang --target=<triple> -S
 * -emit-llvm`. A layout that disagrees with the one clang later applies is
 * a hard error at build time, never silent miscompilation.
 */

export interface Target {
  /** The triple written to `target triple`; aliases are normalised to this. */
  triple: string;
  datalayout: string;
}

const x86_64Layout = (mangling: string) =>
  `e-m:${mangling}-p270:32:32-p271:32:32-p272:64:64-i64:64-i128:128-f80:128-n8:16:32:64-S128`;
const WASM32_LAYOUT = "e-m:e-p:32:32-p10:8:8-p20:8:8-i64:64-n32:64-S128-ni:1:10:20";

/** Supported triples, keyed by their canonical spelling. */
const TARGETS: Record<string, Target> = {
  "x86_64-unknown-linux-gnu": { triple: "x86_64-unknown-linux-gnu", datalayout: x86_64Layout("e") },
  "aarch64-unknown-linux-gnu": {
    triple: "aarch64-unknown-linux-gnu",
    datalayout: "e-m:e-i8:8:32-i16:16:32-i64:64-i128:128-n32:64-S128",
  },
  "x86_64-apple-darwin": { triple: "x86_64-apple-darwin", datalayout: x86_64Layout("o") },
  "aarch64-apple-darwin": { triple: "aarch64-apple-darwin", datalayout: "e-m:o-i64:64-i128:128-n32:64-S128" },
  "wasm32-unknown-unknown": { triple: "wasm32-unknown-unknown", datalayout: WASM32_LAYOUT },
  "wasm32-wasi": { triple: "wasm32-wasi", datalayout: WASM32_LAYOUT },
};

/** Other spellings people type; each maps to a key of `TARGETS`. */
const ALIASES: Record<string, string> = {
  "x86_64-linux-gnu": "x86_64-unknown-linux-gnu",
  "x86_64-linux": "x86_64-unknown-linux-gnu",
  "aarch64-linux-gnu": "aarch64-unknown-linux-gnu",
  "aarch64-linux": "aarch64-unknown-linux-gnu",
  "arm64-apple-darwin": "aarch64-apple-darwin",
  "arm64-apple-macosx": "aarch64-apple-darwin",
  "aarch64-apple-macosx": "aarch64-apple-darwin",
  "x86_64-apple-macosx": "x86_64-apple-darwin",
  wasm32: "wasm32-unknown-unknown",
  "wasm32-unknown-wasi": "wasm32-wasi",
};

export const SUPPORTED_TARGETS: readonly string[] = Object.keys(TARGETS);

/** The triple of the machine the compiler runs on, from Node's view of it; undefined when unsupported. */
export function hostTriple(platform: string = process.platform, arch: string = process.arch): string | undefined {
  const cpu = arch === "x64" ? "x86_64" : arch === "arm64" ? "aarch64" : undefined;
  if (!cpu) return undefined;
  if (platform === "linux") return `${cpu}-unknown-linux-gnu`;
  if (platform === "darwin") return `${cpu}-apple-darwin`;
  return undefined;
}

/**
 * Resolve a `--target` argument: a supported triple, one of its aliases, or
 * `host`. Undefined for anything else, so the driver can list what it accepts.
 */
export function resolveTarget(spec: string): Target | undefined {
  const name = spec === "host" ? hostTriple() : spec;
  if (name === undefined) return undefined;
  return TARGETS[name] ?? TARGETS[ALIASES[name] ?? ""];
}

/** The module-header lines that pin a module to `target`. */
export function targetHeader(target: Target): string[] {
  return [`target datalayout = "${target.datalayout}"`, `target triple = "${target.triple}"`];
}
