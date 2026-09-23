// `--emit-dts <file.d.ts>`: TypeScript declarations for the wasm build, plus
// the companion loader `<file>.mjs` (see `self/interop_wasm.ts`) that
// implements them (`src/interop/dts.ts`, WP8).
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
//                     `wasmUnsignedIn` / `wasmUnsignedOut` in interop_wasm.ts.
//   i32[] f64[] i64[] (Int32Array / Float64Array / BigInt64Array) -> that typed
//                     array. The raw export takes a pointer to an arena header;
//                     the loader copies the typed array into the arena, passes
//                     the pointer, copies a result back out, and releases the
//                     arena to where it was, so the declared signature is the
//                     one a host actually calls.
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

import { Compilation } from "./compilation";
import { banner, ExternalFunction, jsExportName, POS_PARAM, POS_RETURN, tsSignature } from "./interop_abi";
import { wasmBridged, wasmSkipReason, wasmType } from "./interop_wasm";

export const generateDts = (compilation: Compilation, fns: ExternalFunction[]): string => {
  const table = compilation.table;
  const bridge = wasmBridged(table, fns);
  const lines: string[] = [];
  lines.push(banner(compilation, "--emit-dts", "// "));
  lines.push("// Typings for the wasm build (scripts/build.sh --profile wasm), implemented by");
  lines.push("// the companion loader written next to this file. Values cross with the wasm");
  lines.push("// C ABI: `number` is i32 or f64 exactly as compiled, `boolean` comes back as");
  lines.push("// 0 | 1, `i64` is a bigint. An unsigned width shares a wasm value type with");
  lines.push("// the signed one of its size, so the loader masks a u8 / u16 argument into");
  lines.push("// range on the way in and every u8 / u16 / u32 / u64 result on the way out,");
  lines.push("// the way a typed-array store would. Int32Array / Float64Array / BigInt64Array");
  lines.push("// arguments are copied into the module's arena for the call (link");
  lines.push("// runtime/runtime_wasm.c), written-through arguments are copied back, and");
  lines.push("// an array result is copied out, so the typed arrays you see are your own.");
  lines.push("// String functions are not callable from the freestanding wasm profile and");
  lines.push("// are listed below as comments.");
  lines.push("");
  lines.push("/** A wasm i1 result: JS receives 0 or 1, never `true` / `false`. */");
  lines.push("export type WasmBool = 0 | 1;");
  lines.push("");
  lines.push("export interface Exports {");
  lines.push("  /** Linear memory of the instance (the arena and string constants live here). */");
  lines.push("  readonly memory: WebAssembly.Memory;");
  if (bridge.needsRuntime) {
    lines.push(
      "  /** runtime_wasm.c: recycle everything the module allocated (arrays passed and returned are already copies). */"
    );
    lines.push("  nish_reset_arena(): void;");
    lines.push(
      "  /** runtime_wasm.c: same as nish_reset_arena; wasm memory is never returned to the host. */"
    );
    lines.push("  nish_free_arena(): void;");
  }

  // One question decides both files: a function is declared here exactly when
  // `wasmSkipReason` lets it onto the bridge, which is what interop_wasm.ts
  // filters the loader's entries by. Deciding it twice is what let the
  // declarations get ahead of the loader once already.
  let count = 0;
  for (const fn of fns) {
    const source = tsSignature(table, fn.sig);
    const skip = wasmSkipReason(table, fn.sig);
    if (skip.length > 0) {
      lines.push(`  // ${source}  -- not exported to JS: ${skip}`);
      continue;
    }
    const params: string[] = [];
    let i = 0;
    while (i < fn.sig.paramNames.length) {
      params.push(`${fn.sig.paramNames[i]}: ${wasmType(table, fn.sig.paramTypes[i], POS_PARAM)}`);
      i = i + 1;
    }
    count = count + 1;
    lines.push(`  /** ${fn.unit.name}: ${source} */`);
    lines.push(
      `  ${jsExportName(fn.sig)}(${params.join(", ")}): ${wasmType(table, fn.sig.returnType, POS_RETURN)};`
    );
  }
  if (count === 0) {
    lines.push("  // No scalar functions are exported.");
  }
  lines.push("}");
  lines.push("");

  lines.push("/**");
  lines.push(" * Instantiate the module and return its typed exports. `bytes` is the");
  lines.push(" * `.wasm` file: `readFileSync(path)` in Node, a `fetch` response");
  lines.push(" * `arrayBuffer()` in browsers. The companion `.mjs` next to this file");
  lines.push(" * implements it (examples/node-host.mjs shows the plain, scalar-only form).");
  lines.push(" */");
  lines.push("export function load(bytes: BufferSource): Promise<Exports>;");
  lines.push("");
  return lines.join("\n");
};
