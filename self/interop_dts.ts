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

import { LANGUAGE } from "./branding";
import { Compilation } from "./compilation";
import { banner, ExternalFunction, POS_PARAM, POS_RETURN, tsSignature, typedView } from "./interop_abi";
import { wasmBridged, wasmResultType } from "./interop_wasm";
import {
  K_ARRAY,
  K_RESULT,
  T_BOOL,
  T_F32,
  T_F64,
  T_I32,
  T_I64,
  T_U16,
  T_U32,
  T_U64,
  T_U8,
  T_VOID,
  TypeTable,
} from "./types";

/** JS-visible type of a wasm export value; `""` when the value cannot cross. */
export function wasmType(table: TypeTable, t: i32, position: i32): string {
  switch (table.kindOf(t)) {
    // WP15: an unsigned width crosses as the wasm value type of its LLVM type,
    // so u8/u16/u32 are a `number` like i32 and u64 is a `bigint` like i64.
    case T_I32:
      return "number";
    case T_U8:
      return "number";
    case T_U16:
      return "number";
    case T_U32:
      return "number";
    case T_F32:
      return "number";
    case T_F64:
      return "number";
    case T_I64:
      return "bigint";
    case T_U64:
      return "bigint";
    case T_BOOL:
      return position === POS_PARAM ? "boolean" : "WasmBool";
    case T_VOID:
      return "void";
    case K_ARRAY: {
      const view = typedView(table, t);
      return view === null ? "" : view.ctor;
    }
    // WP17: the packed shape, in either direction. The loader is what turns
    // the bigint the export answers into this object, and an argument back.
    case K_RESULT:
      return table.resultByValue(t) ? wasmResultType(table, t) : "";
    default:
      return "";
  }
}

export function generateDts(compilation: Compilation, fns: ExternalFunction[]): string {
  const table = compilation.table;
  const bridge = wasmBridged(table, fns);
  const lines: string[] = [];
  lines.push(banner(compilation, "--emit-dts", "// "));
  lines.push("// Typings for the wasm build (scripts/build.sh --profile wasm), implemented by");
  lines.push("// the companion loader written next to this file. Values cross with the wasm");
  lines.push("// C ABI: `number` is i32 or f64 exactly as compiled, `boolean` comes back as");
  lines.push("// 0 | 1, `i64` is a bigint. Int32Array / Float64Array / BigInt64Array");
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
    lines.push("  amrit_reset_arena(): void;");
    lines.push(
      "  /** runtime_wasm.c: same as amrit_reset_arena; wasm memory is never returned to the host. */"
    );
    lines.push("  amrit_free_arena(): void;");
  }

  let count = 0;
  for (const fn of fns) {
    const source = tsSignature(table, fn.sig);
    const ret = wasmType(table, fn.sig.returnType, POS_RETURN);
    const params: string[] = [];
    let ok = ret.length > 0;
    let i = 0;
    while (i < fn.sig.paramNames.length) {
      const t = wasmType(table, fn.sig.paramTypes[i], POS_PARAM);
      if (t.length === 0) {
        ok = false;
      }
      params.push(`${fn.sig.paramNames[i]}: ${t.length > 0 ? t : "never"}`);
      i = i + 1;
    }
    if (!ok) {
      lines.push(
        `  // ${source}  -- not exported to JS: string values, and a \`Result\` held by pointer, need the ${LANGUAGE} runtime, which the freestanding wasm profile does not include`
      );
      continue;
    }
    count = count + 1;
    lines.push(`  /** ${fn.unit.path}: ${source} */`);
    lines.push(`  ${fn.sig.name}(${params.join(", ")}): ${ret};`);
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
}
