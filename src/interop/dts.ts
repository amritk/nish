/**
 * `--emit-dts <file.d.ts>`: TypeScript declarations for the wasm build, plus
 * the companion loader `<file>.mjs` (see wasm.ts) that implements them.
 *
 * `scripts/build.sh --profile wasm` exports every external function with the
 * wasm C ABI, which JS sees as:
 *   i32 / f64      -> number
 *   i1             -> a number 0 or 1 on the way out (`WasmBool`); `true`/`false`
 *                     are accepted on the way in because ToInt32 maps them to 1/0
 *   i64            -> bigint (wasm i64 <-> JS BigInt)
 *   i32[] f64[] i64[] (Int32Array / Float64Array / BigInt64Array) -> that typed
 *                     array. The raw export takes a pointer to an arena header;
 *                     the loader copies the typed array into the arena, passes
 *                     the pointer, copies a result back out, and releases the
 *                     arena to where it was, so the declared signature is the
 *                     one a host actually calls.
 *   string         -> not available: strings need a WASI runtime, and the wasm
 *                     profile is freestanding. Those functions are listed as
 *                     comments so the reader knows what is missing.
 */
import { Compilation } from "../compilation";
import { StaticType } from "../types";
import { banner, externalFunctions, kindOf, tsKeyword, tsSignature, typedView } from "./abi";
import { wasmBridged } from "./wasm";

/** JS-visible type of a wasm export value; `undefined` when the value cannot cross. */
export function wasmType(t: StaticType, position: "param" | "return"): string | undefined {
  switch (kindOf(t)) {
    // WP15: an unsigned width crosses as the wasm value type of its LLVM type,
    // so u8/u16/u32 are a `number` like i32 and u64 is a `bigint` like i64.
    case "i32":
    case "u8":
    case "u16":
    case "u32":
    case "f64":
      return "number";
    case "i64":
    case "u64":
      return "bigint";
    case "bool":
      return position === "param" ? "boolean" : "WasmBool";
    case "void":
      return "void";
    case "array":
      return typedView(t)?.ctor;
    default:
      return undefined;
  }
}

export function generateDts(compilation: Compilation): string {
  const fns = externalFunctions(compilation);
  const bridged = wasmBridged(fns);
  const lines: string[] = [
    banner(compilation, "--emit-dts", (t) => `// ${t}`),
    "// Typings for the wasm build (scripts/build.sh --profile wasm), implemented by",
    "// the companion loader written next to this file. Values cross with the wasm",
    "// C ABI: `number` is i32 or f64 exactly as compiled, `boolean` comes back as",
    "// 0 | 1, `i64` is a bigint. Int32Array / Float64Array / BigInt64Array",
    "// arguments are copied into the module's arena for the call (link",
    "// runtime/runtime_wasm.c), written-through arguments are copied back, and",
    "// an array result is copied out, so the typed arrays you see are your own.",
    "// String functions are not callable from the freestanding wasm profile and",
    "// are listed below as comments.",
    "",
    "/** A wasm i1 result: JS receives 0 or 1, never `true` / `false`. */",
    "export type WasmBool = 0 | 1;",
    "",
    "export interface Exports {",
    "  /** Linear memory of the instance (the arena and string constants live here). */",
    "  readonly memory: WebAssembly.Memory;",
  ];
  if (bridged.needsRuntime) {
    lines.push(
      "  /** runtime_wasm.c: recycle everything the module allocated (arrays passed and returned are already copies). */",
      "  sts_reset_arena(): void;",
      "  /** runtime_wasm.c: same as sts_reset_arena; wasm memory is never returned to the host. */",
      "  sts_free_arena(): void;"
    );
  }

  let count = 0;
  for (const fn of fns) {
    const source = tsSignature(fn.sig, tsKeyword);
    const ret = wasmType(fn.sig.returnType, "return");
    const params: string[] = [];
    let ok = ret !== undefined;
    for (const p of fn.sig.params) {
      const t = wasmType(p.type, "param");
      if (t === undefined) ok = false;
      params.push(`${p.name}: ${t ?? "never"}`);
    }
    if (!ok) {
      lines.push(`  // ${source}  -- not exported to JS: string values need the StaticTS runtime, which the freestanding wasm profile does not include`);
      continue;
    }
    count++;
    lines.push(`  /** ${fn.unit.fileName}: ${source} */`, `  ${fn.sig.name}(${params.join(", ")}): ${ret};`);
  }
  if (count === 0) lines.push("  // No scalar functions are exported.");
  lines.push("}", "");

  lines.push(
    "/**",
    " * Instantiate the module and return its typed exports. `bytes` is the",
    " * `.wasm` file: `readFileSync(path)` in Node, a `fetch` response",
    " * `arrayBuffer()` in browsers. The companion `.mjs` next to this file",
    " * implements it (examples/node-host.mjs shows the plain, scalar-only form).",
    " */",
    "export function load(bytes: BufferSource): Promise<Exports>;",
    ""
  );
  return lines.join("\n");
}
