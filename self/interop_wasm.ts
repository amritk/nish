// The companion of `--emit-dts` (`src/interop/wasm.ts`, WP8): a small ES
// module, `<stem>.mjs` next to the `.d.ts`, whose `load(bytes)` instantiates
// the wasm build and wraps every export that takes or returns an array.
//
// A raw wasm export sees an array as an `i32` pointer to the arena header
// `{ i64 len, i64 cap, i8* data }` (24 bytes on wasm32 too: the 4-byte data
// pointer sits at offset 16). Per call the wrapper:
//   1. `amrit_arena_mark()`, so everything below can be released afterwards;
//   2. for each typed-array argument: `amrit_alloc_array(elemSize, len)` in the
//      module (runtime/runtime_wasm.c), a typed-array view on `memory.buffer`
//      at the header's data pointer, `.set(argument)`;
//   3. the call;
//   4. an array result: read `len` and `data` from the header, `.slice()` a
//      copy out (a view would be detached by the next `memory.grow`);
//      an argument the callee writes through (`fill(xs)`): copy the arena
//      bytes back into the caller's typed array, so the wasm and N-API builds
//      agree (N-API borrows the buffer, so writes land directly);
//   5. `amrit_arena_release(mark)`, in a `finally`, so a trap leaks nothing.
// `memory.buffer` is re-read after every module call because `memory.grow`
// detaches the previous ArrayBuffer. Scalar-only exports are passed through
// untouched; string functions are omitted (no WASI runtime).

import { Compilation } from "./compilation";
import {
  banner,
  endsWithFold,
  ExternalFunction,
  POS_PARAM,
  POS_RETURN,
  pushAll,
  tsSignature,
  TypedView,
  typedView,
} from "./interop_abi";
import { basename } from "./paths";
import { FunctionSig } from "./program";
import { K_RESULT, T_BOOL, T_F32, T_F64, T_I32, T_I64, T_U16, T_U32, T_U8, T_VOID, TypeTable } from "./types";

/** `x.d.ts` -> `x.mjs`. */
export function wasmLoaderPath(dtsFile: string): string {
  const stem = endsWithFold(dtsFile, ".d.ts") ? dtsFile.substring(0, dtsFile.length - 5) : dtsFile;
  return `${stem}.mjs`;
}

export class WasmBridge {
  /** Functions JS can call: every type is a scalar or a typed view. */
  bridged: ExternalFunction[];
  /** True when some bridged function passes an array, so the module must link runtime_wasm.c. */
  needsRuntime: boolean;

  constructor(bridged: ExternalFunction[], needsRuntime: boolean) {
    this.bridged = bridged;
    this.needsRuntime = needsRuntime;
  }
}

function wasmCrosses(table: TypeTable, t: i32, position: i32): boolean {
  const kind = table.kindOf(t);
  if (kind === T_I32 || kind === T_F32 || kind === T_F64 || kind === T_I64 || kind === T_BOOL) {
    return true;
  }
  if (kind === T_VOID) {
    return position === POS_RETURN;
  }
  // WP17: a packed `Result` crosses as one i64 in either direction — the
  // loader unpacks a returned one and packs an argument.
  if (kind === K_RESULT) {
    return table.resultByValue(t) && wasmResultType(table, t).length > 0;
  }
  return typedView(table, t) !== null;
}

/** The JS type of one packed `Result` payload, or `""` when it cannot cross. */
export function wasmPayloadType(table: TypeTable, t: i32): string {
  switch (table.kindOf(t)) {
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
    // The loader builds the object, so it converts; a payload boolean is a
    // real boolean rather than the `WasmBool` a bare `i1` return comes back as.
    case T_BOOL:
      return "boolean";
    default:
      return "";
  }
}

/** `{ ok: true; value: number } | { ok: false; error: number }`. */
export function wasmResultType(table: TypeTable, t: i32): string {
  const error = wasmPayloadType(table, table.errOf(t));
  if (error.length === 0) {
    return "";
  }
  const ok = table.okOf(t);
  if (table.kindOf(ok) === T_VOID) {
    return `{ ok: true } | { ok: false; error: ${error} }`;
  }
  const value = wasmPayloadType(table, ok);
  if (value.length === 0) {
    return "";
  }
  return `{ ok: true; value: ${value} } | { ok: false; error: ${error} }`;
}

/**
 * How the loader reads one packed payload out of the high half of the word.
 * `p` is already `BigInt.asUintN(32, word >> 32n)`, so each reader only has to
 * give the bits their type back: a signed width sign-extends, `f32` is a
 * reinterpretation rather than a conversion, and `boolean` is the low bit.
 */
function wasmPayloadReader(table: TypeTable, t: i32): string {
  switch (table.kindOf(t)) {
    case T_I32:
      return "(p) => Number(BigInt.asIntN(32, p))";
    case T_U8:
      return "(p) => Number(BigInt.asUintN(8, p))";
    case T_U16:
      return "(p) => Number(BigInt.asUintN(16, p))";
    case T_U32:
      return "(p) => Number(p)";
    case T_F32:
      return "f32Bits";
    case T_BOOL:
      return "(p) => (p & 1n) === 1n";
    default:
      return "";
  }
}

/** `resultOut(<call>, <ok reader or null>, <err reader>)` for a by-value `Result` return. */
function wasmResultUnpack(table: TypeTable, call: string, t: i32): string {
  const ok = table.kindOf(table.okOf(t)) === T_VOID ? "null" : wasmPayloadReader(table, table.okOf(t));
  return `resultOut(${call}, ${ok}, ${wasmPayloadReader(table, table.errOf(t))})`;
}

/**
 * The inverse of `wasmPayloadReader`: how the loader puts one payload into the
 * high half of the word. A signed width is masked to 32 bits, `f32` goes
 * through the same bit view as on the way out, and `boolean` is one bit.
 */
function wasmPayloadWriter(table: TypeTable, t: i32): string {
  switch (table.kindOf(t)) {
    case T_I32:
      return "(v) => BigInt.asUintN(32, BigInt(v))";
    case T_U8:
      return "(v) => BigInt.asUintN(32, BigInt(v))";
    case T_U16:
      return "(v) => BigInt.asUintN(32, BigInt(v))";
    case T_U32:
      return "(v) => BigInt.asUintN(32, BigInt(v))";
    case T_F32:
      return "f32Word";
    case T_BOOL:
      return "(v) => (v ? 1n : 0n)";
    default:
      return "";
  }
}

/** `resultIn(<arg>, <ok writer or null>, <err writer>)` for a by-value `Result` argument. */
function wasmResultPack(table: TypeTable, arg: string, t: i32): string {
  const ok = table.kindOf(table.okOf(t)) === T_VOID ? "null" : wasmPayloadWriter(table, table.okOf(t));
  return `resultIn(${arg}, ${ok}, ${wasmPayloadWriter(table, table.errOf(t))})`;
}

/** True when some bridged signature carries an f32 payload, so the loader needs the bit view. */
function wasmNeedsF32(table: TypeTable, fns: ExternalFunction[]): boolean {
  for (const fn of fns) {
    if (wasmCarriesF32(table, fn.sig.returnType)) {
      return true;
    }
    let i = 0;
    while (i < fn.sig.paramTypes.length) {
      if (wasmCarriesF32(table, fn.sig.paramTypes[i])) {
        return true;
      }
      i = i + 1;
    }
  }
  return false;
}

function wasmCarriesF32(table: TypeTable, t: i32): boolean {
  if (table.kindOf(t) !== K_RESULT) {
    return false;
  }
  return table.kindOf(table.okOf(t)) === T_F32 || table.kindOf(table.errOf(t)) === T_F32;
}

/** True when some bridged signature takes or returns a packed `Result`. */
function wasmHasPackedResult(table: TypeTable, fns: ExternalFunction[]): boolean {
  for (const fn of fns) {
    if (wasmTakesPacked(table, fn.sig)) {
      return true;
    }
  }
  return false;
}

function wasmTakesPacked(table: TypeTable, sig: FunctionSig): boolean {
  if (table.resultByValue(sig.returnType)) {
    return true;
  }
  let i = 0;
  while (i < sig.paramTypes.length) {
    if (table.resultByValue(sig.paramTypes[i])) {
      return true;
    }
    i = i + 1;
  }
  return false;
}

export function wasmBridged(table: TypeTable, fns: ExternalFunction[]): WasmBridge {
  const bridged: ExternalFunction[] = [];
  for (const fn of fns) {
    if (fn.sig.name === "main" || !wasmCrosses(table, fn.sig.returnType, POS_RETURN)) {
      continue;
    }
    let every = true;
    let i = 0;
    while (i < fn.sig.paramTypes.length) {
      if (!wasmCrosses(table, fn.sig.paramTypes[i], POS_PARAM)) {
        every = false;
      }
      i = i + 1;
    }
    if (every) {
      bridged.push(fn);
    }
  }
  let needsRuntime = false;
  for (const fn of bridged) {
    if (typedView(table, fn.sig.returnType) !== null) {
      needsRuntime = true;
    }
    let i = 0;
    while (i < fn.sig.paramTypes.length) {
      if (typedView(table, fn.sig.paramTypes[i]) !== null) {
        needsRuntime = true;
      }
      i = i + 1;
    }
  }
  return new WasmBridge(bridged, needsRuntime);
}

/** Names the loader's own locals use; a parameter spelled the same gets an underscore. */
function wasmIsLoaderLocal(name: string): boolean {
  return (
    name === "raw" ||
    name === "memory" ||
    name === "header" ||
    name === "arrayIn" ||
    name === "arrayOut" ||
    name === "copyBack" ||
    name === "scoped" ||
    name === "result" ||
    name === "instance" ||
    name === "bytes"
  );
}

function wasmJsParam(name: string): string {
  return wasmIsLoaderLocal(name) ? `${name}_` : name;
}

function wasmWrapper(table: TypeTable, fn: ExternalFunction): string[] {
  const sig = fn.sig;
  const ret = typedView(table, sig.returnType);
  const views: (TypedView | null)[] = [];
  let i = 0;
  while (i < sig.paramTypes.length) {
    views.push(typedView(table, sig.paramTypes[i]));
    i = i + 1;
  }
  const packed = wasmTakesPacked(table, sig);
  const lines: string[] = [];
  const params: string[] = [];
  i = 0;
  while (i < sig.paramNames.length) {
    params.push(wasmJsParam(sig.paramNames[i]));
    i = i + 1;
  }

  let anyView = ret !== null;
  for (const view of views) {
    if (view !== null) {
      anyView = true;
    }
  }
  if (!anyView) {
    // WP17: a packed `Result` needs packing or unpacking but no arena scope —
    // nothing was copied into the module for the call, so nothing to release.
    if (packed) {
      const operands: string[] = [];
      i = 0;
      while (i < sig.paramTypes.length) {
        operands.push(
          table.resultByValue(sig.paramTypes[i])
            ? wasmResultPack(table, params[i], sig.paramTypes[i])
            : params[i]
        );
        i = i + 1;
      }
      const call = `raw.${sig.name}(${operands.join(", ")})`;
      const body = table.resultByValue(sig.returnType) ? wasmResultUnpack(table, call, sig.returnType) : call;
      lines.push(`${sig.name}: (${params.join(", ")}) => ${body},`);
      return lines;
    }
    lines.push(`${sig.name}: raw.${sig.name},`);
    return lines;
  }

  const body: string[] = [];
  const args: string[] = [];
  i = 0;
  while (i < sig.paramTypes.length) {
    const view = views[i];
    if (view === null) {
      args.push(
        table.resultByValue(sig.paramTypes[i])
          ? wasmResultPack(table, params[i], sig.paramTypes[i])
          : params[i]
      );
    } else {
      const name = sig.paramNames[i];
      body.push(
        `const ${name}$ = arrayIn(${params[i]}, ${view.ctor}, ${view.elemSize}, "${sig.sourceName}: argument ${i + 1} (${name})");`
      );
      args.push(`${name}$`);
    }
    i = i + 1;
  }
  const call = `raw.${sig.name}(${args.join(", ")})`;
  const isVoid = table.kindOf(sig.returnType) === T_VOID;
  let value = call;
  if (ret !== null) {
    value = `arrayOut(${call}, ${ret.ctor})`;
  } else if (table.resultByValue(sig.returnType)) {
    value = wasmResultUnpack(table, call, sig.returnType);
  }
  const copyBacks: string[] = [];
  i = 0;
  while (i < sig.paramNames.length) {
    if (views[i] !== null && fn.writtenParams.has(sig.paramNames[i])) {
      copyBacks.push(`copyBack(${sig.paramNames[i]}$, ${params[i]});`);
    }
    i = i + 1;
  }
  if (copyBacks.length === 0) {
    body.push(isVoid ? `${value};` : `return ${value};`);
  } else {
    body.push(isVoid ? `${value};` : `const result = ${value};`);
    pushAll(body, copyBacks);
    if (!isVoid) {
      body.push("return result;");
    }
  }
  lines.push(`${sig.name}: (${params.join(", ")}) => scoped(() => {`);
  for (const line of body) {
    lines.push(`  ${line}`);
  }
  lines.push("}),");
  return lines;
}

/**
 * The loader's half of WP17. A packed `Result` reaches JS as the wasm export's
 * `i64`, i.e. a bigint: bit 0 is the discriminant and bits 32..63 are the arm
 * it selects. `resultOut` turns that into the object `--emit-dts` declares, so
 * a caller never sees the encoding.
 */
function wasmResultHelpers(table: TypeTable, bridged: ExternalFunction[]): string[] {
  const lines: string[] = [];
  if (!wasmHasPackedResult(table, bridged)) {
    return lines;
  }
  lines.push("  /** A Result in one i64 (WP17): bit 0 is the tag, bits 32..63 the payload. */");
  lines.push("  const resultOut = (word, readValue, readError) => {");
  lines.push("    const payload = BigInt.asUintN(32, word >> 32n);");
  lines.push("    if ((word & 1n) === 0n) return { ok: false, error: readError(payload) };");
  lines.push("    return readValue === null ? { ok: true } : { ok: true, value: readValue(payload) };");
  lines.push("  };");
  lines.push("  const resultIn = (r, writeValue, writeError) => {");
  lines.push('    if (r === null || typeof r !== "object" || typeof r.ok !== "boolean")');
  lines.push('      throw new TypeError("expected { ok: true, value } or { ok: false, error }");');
  lines.push(
    "    const payload = r.ok ? (writeValue === null ? 0n : writeValue(r.value)) : writeError(r.error);"
  );
  lines.push("    return (payload << 32n) | (r.ok ? 1n : 0n);");
  lines.push("  };");
  if (wasmNeedsF32(table, bridged)) {
    lines.push("  /** An f32 payload is the same 32 bits, not a converted number. */");
    lines.push("  const f32View = new Float32Array(1);");
    lines.push("  const f32Words = new Uint32Array(f32View.buffer);");
    lines.push("  const f32Bits = (p) => {");
    lines.push("    f32Words[0] = Number(p);");
    lines.push("    return f32View[0];");
    lines.push("  };");
    lines.push("  const f32Word = (v) => {");
    lines.push("    f32View[0] = v;");
    lines.push("    return BigInt(f32Words[0]);");
    lines.push("  };");
  }
  return lines;
}

export function generateWasmLoader(
  compilation: Compilation,
  fns: ExternalFunction[],
  dtsFile: string
): string {
  const table = compilation.table;
  const bridge = wasmBridged(table, fns);
  const lines: string[] = [];
  lines.push(banner(compilation, "--emit-dts", "// "));
  lines.push(`// Loader for the wasm build; ${basename(dtsFile)} declares it. Build the module with`);
  lines.push(
    bridge.needsRuntime
      ? "//   scripts/build.sh <module.ll> runtime/runtime_wasm.c -o <module>.wasm --profile wasm"
      : "//   scripts/build.sh <module.ll> -o <module>.wasm --profile wasm"
  );
  lines.push("// Typed-array arguments are copied into the module's arena for the duration");
  lines.push("// of the call and results are copied out, so the arrays you hold stay yours.");
  lines.push("");
  lines.push("/** Instantiate the module and return its exports, arrays marshalled. */");
  lines.push("export async function load(bytes) {");
  lines.push("  const { instance } = await WebAssembly.instantiate(bytes, {});");
  lines.push("  const raw = instance.exports;");
  if (bridge.needsRuntime) {
    lines.push("  const memory = raw.memory;");
    lines.push(
      "  // Header field offsets on wasm32: len at 0 (i64), cap at 8 (i64), data at 16 (i32 pointer)."
    );
    lines.push("  const header = (hdr) => {");
    lines.push("    const view = new DataView(memory.buffer);");
    lines.push(
      "    return { len: Number(view.getBigUint64(hdr, true)), data: view.getUint32(hdr + 16, true) };"
    );
    lines.push("  };");
    lines.push("  /** Copy a typed array into a fresh arena array; returns the header pointer. */");
    lines.push("  const arrayIn = (value, Ctor, elemSize, what) => {");
    lines.push(
      '    if (!(value instanceof Ctor)) throw new TypeError(what + " must be " + (/^[AEIOU]/.test(Ctor.name) ? "an " : "a ") + Ctor.name);'
    );
    lines.push("    const hdr = raw.amrit_alloc_array(BigInt(elemSize), BigInt(value.length));");
    lines.push("    new Ctor(memory.buffer, header(hdr).data, value.length).set(value);");
    lines.push("    return hdr;");
    lines.push("  };");
    lines.push("  /** Copy an arena array out as a fresh typed array. */");
    lines.push("  const arrayOut = (hdr, Ctor) => {");
    lines.push("    const { len, data } = header(hdr);");
    lines.push("    return new Ctor(memory.buffer, data, len).slice();");
    lines.push("  };");
    lines.push("  /** After a call that writes through an array parameter: bring the arena bytes back. */");
    lines.push("  const copyBack = (hdr, value) => {");
    lines.push("    const { len, data } = header(hdr);");
    lines.push("    value.set(new value.constructor(memory.buffer, data, Math.min(len, value.length)));");
    lines.push("  };");
    lines.push("  /** Run `fn`, then release everything it allocated in the arena, even when it traps. */");
    lines.push("  const scoped = (fn) => {");
    lines.push("    const mark = raw.amrit_arena_mark();");
    lines.push("    try {");
    lines.push("      return fn();");
    lines.push("    } finally {");
    lines.push("      raw.amrit_arena_release(mark);");
    lines.push("    }");
    lines.push("  };");
    pushAll(lines, wasmResultHelpers(table, bridge.bridged));
    lines.push("  return {");
    lines.push("    memory,");
    lines.push("    amrit_reset_arena: raw.amrit_reset_arena,");
    lines.push("    amrit_free_arena: raw.amrit_free_arena,");
  } else {
    pushAll(lines, wasmResultHelpers(table, bridge.bridged));
    lines.push("  return {");
    lines.push("    memory: raw.memory,");
  }
  for (const fn of bridge.bridged) {
    lines.push(`    /** ${fn.unit.path}: ${tsSignature(table, fn.sig)} */`);
    for (const line of wasmWrapper(table, fn)) {
      lines.push(`    ${line}`);
    }
  }
  lines.push("  };");
  lines.push("}");
  lines.push("");
  return lines.join("\n");
}
