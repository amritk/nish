/**
 * `--emit-dts <file.d.ts>`: TypeScript declarations for the wasm build.
 *
 * `scripts/build.sh --profile wasm` exports every external function with the
 * wasm C ABI, which JS sees as:
 *   i32 / f64  -> number
 *   i1         -> a number 0 or 1 on the way out (`WasmBool`); `true`/`false`
 *                 are accepted on the way in because ToInt32 maps them to 1/0
 *   string     -> not available: strings need runtime.c and the arena, and the
 *                 wasm profile is freestanding (no libc). Those functions are
 *                 listed as comments so the reader knows what is missing.
 *   i64        -> bigint (wasm i64 <-> JS BigInt), if the type exists
 */
import { Compilation } from "../compilation";
import { StaticType } from "../types";
import { banner, externalFunctions, kindOf, tsKeyword, tsSignature } from "./abi";

/** JS-visible type of a wasm export value; `undefined` when the value cannot cross. */
function wasmType(t: StaticType, position: "param" | "return"): string | undefined {
  switch (kindOf(t)) {
    case "i32":
    case "f64":
      return "number";
    case "i64":
      return "bigint";
    case "bool":
      return position === "param" ? "boolean" : "WasmBool";
    case "void":
      return "void";
    default:
      return undefined;
  }
}

export function generateDts(compilation: Compilation): string {
  const lines: string[] = [
    banner(compilation, "--emit-dts", (t) => `// ${t}`),
    "// Typings for the wasm build (scripts/build.sh --profile wasm). Values cross",
    "// with the wasm C ABI: `number` is i32 or f64 exactly as compiled, `boolean`",
    "// comes back as 0 | 1. String functions are not callable from the",
    "// freestanding wasm profile and are listed below as comments.",
    "",
    "/** A wasm i1 result: JS receives 0 or 1, never `true` / `false`. */",
    "export type WasmBool = 0 | 1;",
    "",
    "export interface Exports {",
    "  /** Linear memory of the instance (the arena and string constants live here). */",
    "  readonly memory: WebAssembly.Memory;",
  ];

  let count = 0;
  for (const fn of externalFunctions(compilation)) {
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
    " * `arrayBuffer()` in browsers. examples/node-host.mjs implements it.",
    " */",
    "export function load(bytes: BufferSource): Promise<Exports>;",
    ""
  );
  return lines.join("\n");
}
