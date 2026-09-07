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
import { ResultType, StaticType, resultByValue } from "../types";
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
  // WP17: the packed `Result` arrives as one i64, which the loader unpacks.
  if (k === "result")
    return position === "return" && resultByValue(t) && wasmResultType(t as ResultType) !== undefined;
  return typedView(t) !== undefined;
}

/** The JS type of one packed `Result` payload, or undefined when it cannot cross. */
export function wasmPayloadType(t: StaticType): string | undefined {
  switch (kindOf(t)) {
    case "i32":
    case "u8":
    case "u16":
    case "u32":
    case "f32":
      return "number";
    // The loader builds the object, so it converts; a payload boolean is a
    // real boolean rather than the `WasmBool` a bare `i1` return comes back as.
    case "bool":
      return "boolean";
    default:
      return undefined;
  }
}

/** `{ ok: true; value: number } | { ok: false; error: number }`. */
export function wasmResultType(t: ResultType): string | undefined {
  const error = wasmPayloadType(t.err);
  if (error === undefined) return undefined;
  if (t.ok.kind === "void") return `{ ok: true } | { ok: false; error: ${error} }`;
  const value = wasmPayloadType(t.ok);
  if (value === undefined) return undefined;
  return `{ ok: true; value: ${value} } | { ok: false; error: ${error} }`;
}

/**
 * How the loader reads one packed payload out of the high half of the word.
 * `p` is already `BigInt.asUintN(32, word >> 32n)`, so each reader only has to
 * give the bits their type back: a signed width sign-extends, `f32` is a
 * reinterpretation rather than a conversion, and `boolean` is the low bit.
 */
function payloadReader(t: StaticType): string | undefined {
  switch (kindOf(t)) {
    case "i32":
      return "(p) => Number(BigInt.asIntN(32, p))";
    case "u8":
      return "(p) => Number(BigInt.asUintN(8, p))";
    case "u16":
      return "(p) => Number(BigInt.asUintN(16, p))";
    case "u32":
      return "(p) => Number(p)";
    case "f32":
      return "f32Bits";
    case "bool":
      return "(p) => (p & 1n) === 1n";
    default:
      return undefined;
  }
}

/** `resultOut(<call>, <ok reader or null>, <err reader>)` for a by-value `Result` return. */
function resultUnpack(call: string, t: ResultType): string {
  const ok = t.ok.kind === "void" ? "null" : payloadReader(t.ok)!;
  return `resultOut(${call}, ${ok}, ${payloadReader(t.err)!})`;
}

/** True when some bridged function unpacks an f32 payload, so the loader needs the bit view. */
function needsF32(fns: readonly ExternalFunction[]): boolean {
  return fns.some((fn) => {
    const t = fn.sig.returnType;
    return t.kind === "result" && (kindOf(t.ok) === "f32" || kindOf(t.err) === "f32");
  });
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
  if (!ret && views.every((v) => v === undefined)) {
    // WP17: a packed `Result` needs unpacking but no arena scope — nothing was
    // copied into the module for the call, so there is nothing to release.
    if (resultByValue(sig.returnType)) {
      const params = sig.params.map((p) => jsParam(p.name));
      const call = `raw.${sig.name}(${params.join(", ")})`;
      return [`${sig.name}: (${params.join(", ")}) => ${resultUnpack(call, sig.returnType as ResultType)},`];
    }
    return [`${sig.name}: raw.${sig.name},`];
  }

  const body: string[] = [];
  const args = sig.params.map((p, i) => {
    const v = views[i];
    if (!v) return jsParam(p.name);
    body.push(`const ${p.name}$ = arrayIn(${jsParam(p.name)}, ${v.ctor}, ${v.elemSize}, "${sig.sourceName}: argument ${i + 1} (${p.name})");`);
    return `${p.name}$`;
  });
  const call = `raw.${sig.name}(${args.join(", ")})`;
  const isVoid = kindOf(sig.returnType) === "void";
  const value = ret
    ? `arrayOut(${call}, ${ret.ctor})`
    : resultByValue(sig.returnType)
      ? resultUnpack(call, sig.returnType as ResultType)
      : call;
  const copyBacks = sig.params.filter((p, i) => views[i] && fn.writtenParams.has(p.name)).map((p) => `copyBack(${p.name}$, ${jsParam(p.name)});`);
  if (copyBacks.length === 0) body.push(isVoid ? `${value};` : `return ${value};`);
  else body.push(isVoid ? `${value};` : `const result = ${value};`, ...copyBacks, ...(isVoid ? [] : ["return result;"]));
  return [`${sig.name}: (${sig.params.map((p) => jsParam(p.name)).join(", ")}) => scoped(() => {`, ...body.map((l) => `  ${l}`), "}),"];
}

/**
 * The loader's half of WP17. A packed `Result` reaches JS as the wasm export's
 * `i64`, i.e. a bigint: bit 0 is the discriminant and bits 32..63 are the arm
 * it selects. `resultOut` turns that into the object `--emit-dts` declares, so
 * a caller never sees the encoding.
 */
function resultHelpers(bridged: readonly ExternalFunction[]): string[] {
  if (!bridged.some((fn) => resultByValue(fn.sig.returnType))) return [];
  const lines = [
    "  /** A Result returned in one i64 (WP17): bit 0 is the tag, bits 32..63 the payload. */",
    "  const resultOut = (word, readValue, readError) => {",
    "    const payload = BigInt.asUintN(32, word >> 32n);",
    "    if ((word & 1n) === 0n) return { ok: false, error: readError(payload) };",
    "    return readValue === null ? { ok: true } : { ok: true, value: readValue(payload) };",
    "  };",
  ];
  if (needsF32(bridged)) {
    lines.push(
      "  /** An f32 payload is the same 32 bits, not a converted number. */",
      "  const f32View = new Float32Array(1);",
      "  const f32Words = new Uint32Array(f32View.buffer);",
      "  const f32Bits = (p) => {",
      "    f32Words[0] = Number(p);",
      "    return f32View[0];",
      "  };"
    );
  }
  return lines;
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
      ...resultHelpers(bridged),
      "  return {",
      "    memory,",
      "    sts_reset_arena: raw.sts_reset_arena,",
      "    sts_free_arena: raw.sts_free_arena,"
    );
  } else {
    lines.push(...resultHelpers(bridged), "  return {", "    memory: raw.memory,");
  }
  for (const fn of bridged) {
    lines.push(`    /** ${fn.unit.fileName}: ${tsSignature(fn.sig, tsKeyword)} */`, ...wrapper(fn).map((l) => `    ${l}`));
  }
  lines.push("  };", "}", "");
  return lines.join("\n");
}
