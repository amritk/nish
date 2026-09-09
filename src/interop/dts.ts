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
 *   u8 u16 u32     -> number, and u64 -> bigint: an unsigned width shares a
 *                     wasm value type with the signed one of its size, so the
 *                     loader is what puts each value back in range — see
 *                     `unsignedIn` / `unsignedOut` in wasm.ts.
 *   i32[] f64[] i64[] (Int32Array / Float64Array / BigInt64Array) -> that typed
 *                     array. The raw export takes a pointer to an arena header;
 *                     the loader copies the typed array into the arena, passes
 *                     the pointer, copies a result back out, and releases the
 *                     arena to where it was, so the declared signature is the
 *                     one a host actually calls.
 *   string         -> not available: strings need a WASI runtime, and the wasm
 *                     profile is freestanding. Those functions are listed as
 *                     comments so the reader knows what is missing.
 *   Result<T, E>   -> `{ ok: true, value: T } | { ok: false, error: E }`, when
 *                     it is one the ABI packs into a register (WP17), taken or
 *                     returned. The raw export speaks the packed `i64` as a
 *                     bigint; the loader packs and unpacks it, so `ok` is a
 *                     real boolean here and a payload `boolean` is a real
 *                     boolean too, unlike a bare `bool` return. A `Result`
 *                     held by pointer does not cross, for the same reason a
 *                     string does not.
 */
import { Compilation } from "../compilation.js";
import { banner, externalFunctions, tsKeyword, tsSignature } from "./abi.js";
import { wasmBridged, wasmSkipReason, wasmType } from "./wasm.js";

export function generateDts(compilation: Compilation): string {
  const fns = externalFunctions(compilation);
  const bridged = wasmBridged(fns);
  const lines: string[] = [
    banner(compilation, "--emit-dts", (t) => `// ${t}`),
    "// Typings for the wasm build (scripts/build.sh --profile wasm), implemented by",
    "// the companion loader written next to this file. Values cross with the wasm",
    "// C ABI: `number` is i32 or f64 exactly as compiled, `boolean` comes back as",
    "// 0 | 1, `i64` is a bigint. An unsigned width shares a wasm value type with",
    "// the signed one of its size, so the loader masks a u8 / u16 argument into",
    "// range on the way in and every u8 / u16 / u32 / u64 result on the way out,",
    "// the way a typed-array store would. Int32Array / Float64Array / BigInt64Array",
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
      "  amrit_reset_arena(): void;",
      "  /** runtime_wasm.c: same as amrit_reset_arena; wasm memory is never returned to the host. */",
      "  amrit_free_arena(): void;"
    );
  }

  // One question decides both files: a function is declared here exactly when
  // `wasmSkipReason` lets it onto the bridge, which is what wasm.ts filters the
  // loader's entries by. Deciding it twice is what let the declarations get
  // ahead of the loader once already.
  let count = 0;
  for (const fn of fns) {
    const source = tsSignature(fn.sig, tsKeyword);
    const skip = wasmSkipReason(fn.sig);
    if (skip !== undefined) {
      lines.push(`  // ${source}  -- not exported to JS: ${skip}`);
      continue;
    }
    const params = fn.sig.params.map((p) => `${p.name}: ${wasmType(p.type, "param")}`);
    count++;
    lines.push(
      `  /** ${fn.unit.fileName}: ${source} */`,
      `  ${fn.sig.name}(${params.join(", ")}): ${wasmType(fn.sig.returnType, "return")};`
    );
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
