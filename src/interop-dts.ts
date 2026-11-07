// `--emit-dts <file.d.ts>`: TypeScript declarations for the wasm build, plus
// the companion loader `<file>.mjs` (see `src/interop-wasm.ts`) that
// implements them (stage0's `src/interop/dts.ts`, WP8).
//
// `scripts/build.sh --profile wasm` exports every external function with the
// wasm C ABI, which JS sees as:
//   i32 / f64      -> number
//   i1             -> a number 0 or 1 on the way out (`WasmBool`); `true`/`false`
//                     are accepted on the way in because ToInt32 maps them to 1/0
//   i64            -> bigint (wasm i64 <-> JS BigInt)
//   u8 u16 u32     -> number, and u64 -> bigint: an unsigned width shares a
//                     wasm value type with the signed one of its size, so the
//                     loader is what puts each value back in range — see
//                     `wasmUnsignedIn` / `wasmUnsignedOut` in interop-wasm.ts.
//   i32[] f64[] i64[] (Int32Array / Float64Array / BigInt64Array) -> that typed
//                     array. The raw export takes a pointer to an arena header;
//                     the loader copies the typed array into the arena, passes
//                     the pointer, copies a result back out, and releases the
//                     arena to where it was, so the declared signature is the
//                     one a host actually calls.
//   integer<Lo, Hi> -> number, as an i32 is (WP31 §9). The comment above the
//                     declaration gives the range, and the loader throws a
//                     RangeError for an argument outside it, before the call.
//   string         -> not available: strings need a WASI runtime, and the wasm
//                     profile is freestanding. Those functions are listed as
//                     comments so the reader knows what is missing.
//   Result<T, E>   -> `{ ok: true, value: T } | { ok: false, error: E }`, when
//                     it is one the ABI packs into a register (WP17), taken or
//                     returned. The raw export speaks the packed `i64` as a
//                     bigint; the loader packs and unpacks it, so `ok` is a
//                     real boolean here and a payload `boolean` is a real
//                     boolean too, unlike a bare `bool` return. A `Result`
//                     held by pointer does not cross, for the same reason a
//                     string does not.

import { Compilation } from "./compilation"
import {
  banner,
  ExternalFunction,
  jsExportName,
  POS_PARAM,
  POS_RETURN,
  pushAll,
  structsHoldingVectors,
  tsSignatureLine,
} from "./interop-abi"
import {
  hostFunctions,
  hostSpecifiers,
  layoutTypes,
  loaderGuarded,
  storageLayouts,
  wasmBridged,
  wasmSkipReason,
  wasmType,
} from "./interop-wasm"
import { FunctionSig } from "./program"
import { T_I64, T_U64, TypeTable } from "./types"

/**
 * ` Throws a RangeError unless day is an integer in [1, 7].`: the ranges the
 * loader checks before the call (WP31 §9), since `number` cannot say them.
 */
const rangeNote = (table: TypeTable, fn: ExternalFunction): string => {
  const ranges: string[] = []
  let i = 0
  while (i < fn.sig.paramTypes.length) {
    const t = fn.sig.paramTypes[i]
    if (table.isRanged(t)) {
      ranges.push(`${fn.sig.paramNames[i]} is an integer in [${table.rangeLo(t)}, ${table.rangeHi(t)}]`)
    }
    i = i + 1
  }
  return ranges.length > 0 ? `. Throws a RangeError unless ${ranges.join(" and ")}.` : ""
}

/** The doc comment above an export's declaration: its module, its signature and its range note, built as one line. */
const docComment = (table: TypeTable, fn: ExternalFunction): string =>
  tsSignatureLine(table, fn.sig, `  /** ${fn.unit.name}: `, `${rangeNote(table, fn)} */`)

export const generateDts = (compilation: Compilation, fns: ExternalFunction[], dtsFile: string): string => {
  const table = compilation.table
  const vectored = structsHoldingVectors(compilation)
  const bridge = wasmBridged(table, fns, vectored)
  const lines: string[] = []
  lines.push(banner(compilation, "--emit-dts", "// "))
  lines.push("// Typings for the wasm build (scripts/build.sh --profile wasm), implemented by")
  lines.push("// the companion loader written next to this file. Values cross with the wasm")
  lines.push("// C ABI: `number` is i32 or f64 exactly as compiled, `boolean` comes back as")
  lines.push("// 0 | 1, `i64` is a bigint. An unsigned width shares a wasm value type with")
  lines.push("// the signed one of its size, so the loader masks a u8 / u16 argument into")
  lines.push("// range on the way in and every u8 / u16 / u32 / u64 result on the way out,")
  lines.push("// the way a typed-array store would. Int32Array / Float64Array / BigInt64Array")
  lines.push("// arguments are copied into the module's arena for the call (link")
  lines.push("// runtime/runtime-wasm.c), written-through arguments are copied back, and")
  lines.push("// an array result is copied out, so the typed arrays you see are your own.")
  lines.push("// String functions are not callable from the freestanding wasm profile and")
  lines.push("// are listed below as comments.")
  lines.push("")
  // WP50 S2: an export that takes or answers a host handle spells it as the
  // page's `tsc` reads one, so the type comes from the package's root types.
  if (bridgesHandle(table, bridge.bridged)) {
    lines.push('import type { HostHandle } from "nish";')
    lines.push("")
  }
  lines.push("/** A wasm i1 result: JS receives 0 or 1, never `true` / `false`. */")
  lines.push("export type WasmBool = 0 | 1;")
  lines.push("")
  const guard = loaderGuarded(compilation)
  if (guard) {
    pushAll(lines, panicTypes())
  }
  // WP50 S3: with module storage the page builds its views from `layout`.
  const layouts = storageLayouts(compilation)
  if (layouts.length > 0) {
    pushAll(lines, layoutTypes(layouts))
  }
  lines.push("export interface Exports {")
  lines.push("  /** Linear memory of the instance (the arena and string constants live here). */")
  lines.push("  readonly memory: WebAssembly.Memory;")
  if (layouts.length > 0) {
    lines.push("  /** Where each module storage lives in `memory`. */")
    lines.push("  readonly layout: Layout;")
    lines.push("  /** Typed arrays over `memory.buffer`, rebuilt only after memory grew. */")
    lines.push("  views(): Views;")
  }
  if (bridge.needsRuntime) {
    lines.push(
      "  /** runtime-wasm.c: recycle everything the module allocated (arrays passed and returned are already copies). */"
    )
    lines.push("  nish_reset_arena(): void;")
    lines.push(
      "  /** runtime-wasm.c: same as nish_reset_arena; wasm memory is never returned to the host. */"
    )
    lines.push("  nish_free_arena(): void;")
  }

  // One question decides both files: a function is declared here exactly when
  // `wasmSkipReason` lets it onto the bridge, which is what interop-wasm.ts
  // filters the loader's entries by. Deciding it twice is what let the
  // declarations get ahead of the loader once already.
  let count = 0
  for (const fn of fns) {
    const skip = wasmSkipReason(table, fn.sig, vectored)
    if (skip.length > 0) {
      lines.push(tsSignatureLine(table, fn.sig, "  // ", `  -- not exported to JS: ${skip}`))
      continue
    }
    const params: string[] = []
    let i = 0
    while (i < fn.sig.paramNames.length) {
      params.push(`${fn.sig.paramNames[i]}: ${wasmType(table, fn.sig.paramTypes[i], POS_PARAM)}`)
      i = i + 1
    }
    count = count + 1
    lines.push(docComment(table, fn))
    lines.push(
      `  ${jsExportName(fn.sig)}(${params.join(", ")}): ${wasmType(table, fn.sig.returnType, POS_RETURN)};`
    )
  }
  if (count === 0) {
    lines.push("  // No scalar functions are exported.")
  }
  lines.push("}")
  lines.push("")
  const specifiers = hostSpecifiers(compilation, dtsFile)
  if (specifiers.length > 0) {
    pushAll(lines, importsType(compilation, specifiers))
  }

  lines.push("/**")
  lines.push(" * Instantiate the module and return its typed exports. `bytes` is the")
  lines.push(" * `.wasm` file: `readFileSync(path)` in Node, a `fetch` response")
  lines.push(" * `arrayBuffer()` in browsers. The companion `.mjs` next to this file")
  lines.push(" * implements it (examples/node-host.mjs shows the plain, scalar-only form).")
  lines.push(" */")
  if (specifiers.length > 0) {
    lines.push("export function load(bytes: BufferSource, imports: Imports): Promise<Exports>;")
  } else if (guard) {
    lines.push("export function load(bytes: BufferSource, options?: LoadOptions): Promise<Exports>;")
  } else {
    lines.push("export function load(bytes: BufferSource): Promise<Exports>;")
  }
  if (guard) {
    lines.push("/** `load` without the wait, for bytes already in hand: a worker, a test, a small module. */")
    lines.push(
      specifiers.length > 0
        ? "export function loadSync(bytes: BufferSource, imports: Imports): Exports;"
        : "export function loadSync(bytes: BufferSource, options?: LoadOptions): Exports;"
    )
  }
  if (layouts.length > 0) {
    lines.push("/** The instance `load` answers: its memory, its storage layout and its exports. */")
    lines.push("export type Module = Exports;")
  }
  lines.push("")
  return lines.join("\n")
}

/**
 * WP50 S3 (`docs/wp50-wasm-host.md` §6): what a panic looks like to the page,
 * the options `load` takes beside the host modules, and the two errors the
 * loader throws. A guarded loader (`loaderGuarded`) has them, since every
 * export runs in the guard that throws them; a plain one has none.
 */
const panicTypes = (): string[] => {
  const lines: string[] = []
  lines.push(
    "/** A panic as `onPanic` hears of it: the message runtime.c would print, its kind and its site. */"
  )
  lines.push("export interface Panic {")
  lines.push("  readonly message: string;")
  lines.push("  readonly kind: string;")
  lines.push("  /** The index into `<module>.wasm.sites.json`, or -1 where the module did not say. */")
  lines.push("  readonly site: number;")
  lines.push("}")
  lines.push("")
  lines.push("/** What `load` takes beside the host modules. */")
  lines.push("export interface LoadOptions {")
  lines.push(
    "  /** Told once when the module panics, before the call throws; a trap or a host function's exception kills the module unannounced. Default: nish/page's reporter. */"
  )
  lines.push("  onPanic?: (panic: Panic) => void;")
  lines.push(
    "  /** `<module>.wasm.sites.json`, which build.sh writes, so a message ends `at path:line:col`. */"
  )
  lines.push("  sites?: readonly { readonly kind: string; readonly at: string }[];")
  lines.push("}")
  lines.push("")
  lines.push(
    "/** The module panicked, in this call or an earlier one: it is dead and every later call throws. */"
  )
  lines.push("export declare class NishPanic extends Error {")
  lines.push("  readonly kind: string;")
  lines.push("  readonly site: number;")
  lines.push("}")
  lines.push("")
  lines.push(
    "/** A call into the module while another call into it was running. The inner call never ran; an outer call that lets this escape kills the module. */"
  )
  lines.push("export declare class NishReentry extends Error {}")
  lines.push("")
  return lines
}

/** Whether some export on the bridge takes or answers a `HostHandle`. */
const bridgesHandle = (table: TypeTable, bridged: ExternalFunction[]): boolean => {
  for (const fn of bridged) {
    if (table.isHostHandle(fn.sig.returnType)) {
      return true
    }
    for (const t of fn.sig.paramTypes) {
      if (table.isHostHandle(t)) {
        return true
      }
    }
  }
  return false
}

/**
 * `Imports` (WP50 S2): what the page owes `load`, the host modules this
 * program imports under `host`, typed as the modules themselves, so the
 * page's `tsc` refuses a host module that lost a function the program calls.
 * A function with an `i64` or `u64` in its signature is named, because each
 * call makes a bigint, which is an allocation on the page.
 */
const importsType = (compilation: Compilation, specifiers: string[]): string[] => {
  const table = compilation.table
  const lines: string[] = []
  lines.push("/**")
  lines.push(" * What the page passes `load`: its host modules under `host`, e.g.")
  lines.push(` * \`import * as host from "${specifiers[0]}"\` and \`load(bytes, { host })\`. Each function`)
  lines.push(" * is a wasm import from module `host`; one whose values all cross as they stand")
  lines.push(" * is called directly, any other through one adapter the loader makes at load.")
  for (const sig of hostFunctions(compilation)) {
    if (namesBigint(table, sig)) {
      lines.push(` * \`${sig.name}\` allocates per call: an i64 or u64 crosses as a bigint.`)
    }
  }
  lines.push(" */")
  const modules: string[] = []
  for (const specifier of specifiers) {
    modules.push(`typeof import("${specifier}")`)
  }
  lines.push(`export type Imports = LoadOptions & { host: ${modules.join(" & ")} };`)
  lines.push("")
  return lines
}

/** Whether a parameter or the result of `sig` is an `i64` or a `u64`. */
const namesBigint = (table: TypeTable, sig: FunctionSig): boolean => {
  if (isBigintWidth(table, sig.returnType)) {
    return true
  }
  for (const t of sig.paramTypes) {
    if (isBigintWidth(table, t)) {
      return true
    }
  }
  return false
}

const isBigintWidth = (table: TypeTable, t: i32): boolean => {
  const kind = table.kindOf(t)
  return kind === T_I64 || kind === T_U64
}
