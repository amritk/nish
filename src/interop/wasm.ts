/**
 * The companion of `--emit-dts`: a small ES module, `<stem>.mjs` next to the
 * `.d.ts`, whose `load(bytes)` instantiates the wasm build and wraps every
 * export that takes or returns an array (WP4/WP8).
 *
 * A raw wasm export sees an array as an `i32` pointer to the arena header
 * `{ i64 len, i64 cap, i8* data }` (24 bytes on wasm32 too: the 4-byte data
 * pointer sits at offset 16). Per call the wrapper:
 *   1. `sts_arena_mark()`, so everything below can be released afterwards;
 *   2. for each typed-array argument: `sts_alloc_array(elemSize, len)` in the
 *      module (runtime/runtime_wasm.c), a typed-array view on `memory.buffer`
 *      at the header's data pointer, `.set(argument)`;
 *   3. the call;
 *   4. an array result: read `len` and `data` from the header, `.slice()` a
 *      copy out (a view would be detached by the next `memory.grow`);
 *      an argument the callee writes through (`fill(xs)`): copy the arena
 *      bytes back into the caller's typed array, so the wasm and N-API builds
 *      agree (N-API borrows the buffer, so writes land directly);
 *   5. `sts_arena_release(mark)`, in a `finally`, so a trap leaks nothing.
 * `memory.buffer` is re-read after every module call because `memory.grow`
 * detaches the previous ArrayBuffer. Scalar-only exports are passed through
 * untouched; string functions are omitted (no WASI runtime).
 */
import path from "node:path";
import { Compilation } from "../compilation";
import { StaticType } from "../types";
import { banner, ExternalFunction, externalFunctions, kindOf, tsKeyword, tsSignature, typedView } from "./abi";

/** `x.d.ts` -> `x.mjs`. */
export function wasmLoaderPath(dtsFile: string): string {
  return `${dtsFile.replace(/\.d\.ts$/i, "")}.mjs`;
}

export interface WasmBridge {
  /** Functions JS can call: every type is a scalar or a typed view. */
  bridged: ExternalFunction[];
  /** True when some bridged function passes an array, so the module must link runtime_wasm.c. */
  needsRuntime: boolean;
}

function crossesWasm(t: StaticType, position: "param" | "return"): boolean {
  const k = kindOf(t);
  if (k === "i32" || k === "f32" || k === "f64" || k === "i64" || k === "bool") return true;
  if (k === "void") return position === "return";
  return typedView(t) !== undefined;
}

export function wasmBridged(fns: ExternalFunction[]): WasmBridge {
  const bridged = fns.filter(
    (fn) => fn.sig.name !== "main" && crossesWasm(fn.sig.returnType, "return") && fn.sig.params.every((p) => crossesWasm(p.type, "param"))
  );
  const needsRuntime = bridged.some((fn) => typedView(fn.sig.returnType) || fn.sig.params.some((p) => typedView(p.type)));
  return { bridged, needsRuntime };
}

/** Names the loader's own locals use; a parameter spelled the same gets an underscore. */
const LOADER_LOCALS = new Set(["raw", "memory", "header", "arrayIn", "arrayOut", "copyBack", "scoped", "result", "instance", "bytes"]);
const jsParam = (name: string): string => (LOADER_LOCALS.has(name) ? `${name}_` : name);

function wrapper(fn: ExternalFunction): string[] {
  const { sig } = fn;
  const ret = typedView(sig.returnType);
  const views = sig.params.map((p) => typedView(p.type));
  if (!ret && views.every((v) => v === undefined)) return [`${sig.name}: raw.${sig.name},`];

  const body: string[] = [];
  const args = sig.params.map((p, i) => {
    const v = views[i];
    if (!v) return jsParam(p.name);
    body.push(`const ${p.name}$ = arrayIn(${jsParam(p.name)}, ${v.ctor}, ${v.elemSize}, "${sig.sourceName}: argument ${i + 1} (${p.name})");`);
    return `${p.name}$`;
  });
  const call = `raw.${sig.name}(${args.join(", ")})`;
  const isVoid = kindOf(sig.returnType) === "void";
  const value = ret ? `arrayOut(${call}, ${ret.ctor})` : call;
  const copyBacks = sig.params.filter((p, i) => views[i] && fn.writtenParams.has(p.name)).map((p) => `copyBack(${p.name}$, ${jsParam(p.name)});`);
  if (copyBacks.length === 0) body.push(isVoid ? `${value};` : `return ${value};`);
  else body.push(isVoid ? `${value};` : `const result = ${value};`, ...copyBacks, ...(isVoid ? [] : ["return result;"]));
  return [`${sig.name}: (${sig.params.map((p) => jsParam(p.name)).join(", ")}) => scoped(() => {`, ...body.map((l) => `  ${l}`), "}),"];
}

export function generateWasmLoader(compilation: Compilation, dtsFile: string): string {
  const { bridged, needsRuntime } = wasmBridged(externalFunctions(compilation));
  const lines: string[] = [
    banner(compilation, "--emit-dts", (t) => `// ${t}`),
    `// Loader for the wasm build; ${path.basename(dtsFile)} declares it. Build the module with`,
    needsRuntime
      ? "//   scripts/build.sh <module.ll> runtime/runtime_wasm.c -o <module>.wasm --profile wasm"
      : "//   scripts/build.sh <module.ll> -o <module>.wasm --profile wasm",
    "// Typed-array arguments are copied into the module's arena for the duration",
    "// of the call and results are copied out, so the arrays you hold stay yours.",
    "",
    "/** Instantiate the module and return its exports, arrays marshalled. */",
    "export async function load(bytes) {",
    "  const { instance } = await WebAssembly.instantiate(bytes, {});",
    "  const raw = instance.exports;",
  ];
  if (needsRuntime) {
    lines.push(
      "  const memory = raw.memory;",
      "  // Header field offsets on wasm32: len at 0 (i64), cap at 8 (i64), data at 16 (i32 pointer).",
      "  const header = (hdr) => {",
      "    const view = new DataView(memory.buffer);",
      "    return { len: Number(view.getBigUint64(hdr, true)), data: view.getUint32(hdr + 16, true) };",
      "  };",
      "  /** Copy a typed array into a fresh arena array; returns the header pointer. */",
      "  const arrayIn = (value, Ctor, elemSize, what) => {",
      '    if (!(value instanceof Ctor)) throw new TypeError(what + " must be " + (/^[AEIOU]/.test(Ctor.name) ? "an " : "a ") + Ctor.name);',
      "    const hdr = raw.sts_alloc_array(BigInt(elemSize), BigInt(value.length));",
      "    new Ctor(memory.buffer, header(hdr).data, value.length).set(value);",
      "    return hdr;",
      "  };",
      "  /** Copy an arena array out as a fresh typed array. */",
      "  const arrayOut = (hdr, Ctor) => {",
      "    const { len, data } = header(hdr);",
      "    return new Ctor(memory.buffer, data, len).slice();",
      "  };",
      "  /** After a call that writes through an array parameter: bring the arena bytes back. */",
      "  const copyBack = (hdr, value) => {",
      "    const { len, data } = header(hdr);",
      "    value.set(new value.constructor(memory.buffer, data, Math.min(len, value.length)));",
      "  };",
      "  /** Run `fn`, then release everything it allocated in the arena, even when it traps. */",
      "  const scoped = (fn) => {",
      "    const mark = raw.sts_arena_mark();",
      "    try {",
      "      return fn();",
      "    } finally {",
      "      raw.sts_arena_release(mark);",
      "    }",
      "  };",
      "  return {",
      "    memory,",
      "    sts_reset_arena: raw.sts_reset_arena,",
      "    sts_free_arena: raw.sts_free_arena,"
    );
  } else {
    lines.push("  return {", "    memory: raw.memory,");
  }
  for (const fn of bridged) {
    lines.push(`    /** ${fn.unit.fileName}: ${tsSignature(fn.sig, tsKeyword)} */`, ...wrapper(fn).map((l) => `    ${l}`));
  }
  lines.push("  };", "}", "");
  return lines.join("\n");
}
