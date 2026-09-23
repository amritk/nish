// The companion of `--emit-dts` (`src/interop/wasm.ts`, WP8): a small ES
// module, `<stem>.mjs` next to the `.d.ts`, whose `load(bytes)` instantiates
// the wasm build and wraps every export that takes or returns an array.
//
// A raw wasm export sees an array as an `i32` pointer to the arena header
// `{ i64 len, i64 cap, i8* data }` (24 bytes on wasm32 too: the 4-byte data
// pointer sits at offset 16). Per call the wrapper:
//   1. `nish_arena_mark()`, so everything below can be released afterwards;
//   2. for each typed-array argument: `nish_alloc_array(elemSize, len)` in the
//      module (runtime/runtime_wasm.c), a typed-array view on `memory.buffer`
//      at the header's data pointer, `.set(argument)`;
//   3. the call;
//   4. an array result: read `len` and `data` from the header, `.slice()` a
//      copy out (a view would be detached by the next `memory.grow`);
//      an argument the callee writes through (`fill(xs)`): copy the arena
//      bytes back into the caller's typed array, so the wasm and N-API builds
//      agree (N-API borrows the buffer, so writes land directly);
//   5. `nish_arena_release(mark)`, in a `finally`, so a trap leaks nothing.
// `memory.buffer` is re-read after every module call because `memory.grow`
// detaches the previous ArrayBuffer. String functions are omitted (no WASI
// runtime).
//
// A scalar-only export is passed through untouched unless one of its types is
// narrower or wider than the wasm value type carrying it. The wasm ABI has
// only i32 / i64 / f32 / f64, so `u8`, `u16`, `u32` and `u64` all share a
// value type with a signed one and the loader is the only place their range
// can be restored: it masks a narrow unsigned argument on the way in and every
// unsigned result on the way out (`wasmUnsignedIn` / `wasmUnsignedOut` say why
// each). `f32` needs neither — the JS-to-wasm call rounds an argument to f32
// exactly as an `f32` parameter means, and every f32 is exactly representable
// in the double a result comes back as.

import { LANGUAGE } from "./branding";
import { Compilation } from "./compilation";
import {
  banner,
  endsWithFold,
  ExternalFunction,
  jsExportName,
  POS_PARAM,
  POS_RETURN,
  pushAll,
  tsKeyword,
  tsSignature,
  TypedView,
  typedView,
} from "./interop_abi";
import { basename } from "./paths";
import { FunctionSig } from "./program";
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

/** `x.d.ts` -> `x.mjs`. */
export const wasmLoaderPath = (dtsFile: string): string => {
  const stem = endsWithFold(dtsFile, ".d.ts") ? dtsFile.substring(0, dtsFile.length - 5) : dtsFile;
  return `${stem}.mjs`;
};

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

/**
 * JS-visible type of a wasm export value; `""` when the value cannot cross.
 * This one table decides *both* what `--emit-dts` declares and what the loader
 * implements: `wasmCrosses` is `wasmType(...).length > 0` and `generateDts`
 * asks `wasmSkipReason`, which asks the same function. They lived apart once
 * and drifted — the declarations grew the unsigned widths while the loader did
 * not, so a `.d.ts` promised a `port(p: number)` the `.mjs` had no entry for —
 * and one table is what makes that unrepresentable.
 *
 * The wasm ABI has four value types, so several source types share one:
 *   i32 / u8 / u16 / u32 / f32 / f64  -> number
 *   i64 / u64                         -> bigint
 *   i1                                -> `WasmBool` (0 | 1) out, `boolean` in
 * The narrowing that share implies is the loader's job, not the declaration's
 * (see `wasmUnsignedIn` / `wasmUnsignedOut`).
 */
export const wasmType = (table: TypeTable, t: i32, position: i32): string => {
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
    // Only a result can be `void`; a parameter of that type does not exist,
    // and spelling one `void` would be a declaration the loader cannot honour.
    case T_VOID:
      return position === POS_RETURN ? "void" : "";
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
};

const wasmCrosses = (table: TypeTable, t: i32, position: i32): boolean => wasmType(table, t, position).length > 0;

/**
 * Why this function is not on the bridge, or `""` when it is. Naming the
 * position and the type is the whole point: a reader of the `.d.ts` sees which
 * argument stopped it rather than the blanket sentence this used to be (and
 * that the N-API shim still writes for its own skips). `--emit-dts` writes it
 * as a comment and the loader omits exactly the same functions, because both
 * ask this.
 */
export const wasmSkipReason = (table: TypeTable, sig: FunctionSig): string => {
  if (sig.name === "main") {
    return "`main` is reserved for a process entry";
  }
  const tail = ` runtime the freestanding wasm profile does not include`;
  let i = 0;
  while (i < sig.paramTypes.length) {
    if (!wasmCrosses(table, sig.paramTypes[i], POS_PARAM)) {
      const t = tsKeyword(table, sig.paramTypes[i]);
      return `argument ${i + 1} (${sig.paramNames[i]}) is \`${t}\`, which needs the ${LANGUAGE}${tail}`;
    }
    i = i + 1;
  }
  if (!wasmCrosses(table, sig.returnType, POS_RETURN)) {
    const t = tsKeyword(table, sig.returnType);
    return `the result is \`${t}\`, which needs the ${LANGUAGE}${tail}`;
  }
  return "";
};

/**
 * The mask a narrow unsigned *argument* needs on the way in, or `""` when the
 * value crosses as it stands.
 *
 * The emitter gives a `u8` parameter the bare LLVM type `i8` with no `zeroext`
 * (`define noundef i8 @idU8(i8 noundef %x)`), so the wasm C ABI's rule — a
 * narrow unsigned argument arrives in an i32 already zero-extended — is the
 * *caller's* obligation, and JavaScript is the caller here. Today's backend
 * happens to insert the `i32.and` itself wherever the narrow value is
 * observable inside the callee (before an `icmp ugt i8`, a `udiv i8`, a
 * `zext`), so an unmasked argument survives by luck; it is luck that the day
 * the emitter adds the `zeroext` the ABI asks for would take away, silently.
 * Masking here also makes the boundary behave the way JavaScript already
 * behaves for these widths — `f(300)` on a `u8` sees 44, exactly as
 * `new Uint8Array([300])[0]` is 44, and `-1` sees 255 — which is the rule
 * `runtime/shim.mjs` follows for the same four types.
 *
 * `u32` and `u64` need nothing: ToInt32 and ToBigInt64 hand the wasm call the
 * bits an unsigned value of that width has, wrapping exactly as the language
 * wraps.
 */
const wasmUnsignedIn = (table: TypeTable, t: i32): string => {
  const kind = table.kindOf(t);
  if (kind === T_U8) {
    return "0xff";
  }
  if (kind === T_U16) {
    return "0xffff";
  }
  return "";
};

/**
 * How an unsigned *result* is read back; `value` unchanged when the raw value
 * is already the number JS should see.
 *
 * All four widths need it, for two different reasons. `u8` and `u16` come back
 * in an i32 the callee never narrowed — `add i16` is congruent modulo 2^16, so
 * the wasm backend adds in 32 bits and returns the sum, and `addU16(65535, 2)`
 * answers 65537 where the language says 1. `u32` and `u64` are the full width
 * but *signed* on the way out, so anything at or above 2^31 (2^63 for `u64`)
 * reaches JavaScript negative: a `u32` of 4294967295 arrives as -1.
 *
 * The spellings are the ones `runtime/shim.mjs` uses to hold an unsigned value
 * in a JavaScript one, so the wasm build, the differential rewrite and the
 * language agree on what a `u32` above 2^31 is.
 */
const wasmUnsignedOut = (table: TypeTable, t: i32, value: string): string => {
  const kind = table.kindOf(t);
  if (kind === T_U8) {
    return `${value} & 0xff`;
  }
  if (kind === T_U16) {
    return `${value} & 0xffff`;
  }
  if (kind === T_U32) {
    return `${value} >>> 0`;
  }
  if (kind === T_U64) {
    return `BigInt.asUintN(64, ${value})`;
  }
  return value;
};

/** Whether `wasmUnsignedOut` has anything to do, which decides if the export needs a wrapper at all. */
const wasmUnsignedResult = (table: TypeTable, t: i32): boolean => {
  const kind = table.kindOf(t);
  return kind === T_U8 || kind === T_U16 || kind === T_U32 || kind === T_U64;
};

/** The JS type of one packed `Result` payload, or `""` when it cannot cross. */
export const wasmPayloadType = (table: TypeTable, t: i32): string => {
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
};

/** `{ ok: true; value: number } | { ok: false; error: number }`. */
export const wasmResultType = (table: TypeTable, t: i32): string => {
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
};

/**
 * How the loader reads one packed payload out of the high half of the word.
 * `p` is already `BigInt.asUintN(32, word >> 32n)`, so each reader only has to
 * give the bits their type back: a signed width sign-extends, `f32` is a
 * reinterpretation rather than a conversion, and `boolean` is the low bit.
 */
const wasmPayloadReader = (table: TypeTable, t: i32): string => {
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
};

/** `resultOut(<call>, <ok reader or null>, <err reader>)` for a by-value `Result` return. */
const wasmResultUnpack = (table: TypeTable, call: string, t: i32): string => {
  const ok = table.kindOf(table.okOf(t)) === T_VOID ? "null" : wasmPayloadReader(table, table.okOf(t));
  return `resultOut(${call}, ${ok}, ${wasmPayloadReader(table, table.errOf(t))})`;
};

/**
 * The inverse of `wasmPayloadReader`: how the loader puts one payload into the
 * high half of the word. A signed width is masked to 32 bits, `f32` goes
 * through the same bit view as on the way out, and `boolean` is one bit.
 */
const wasmPayloadWriter = (table: TypeTable, t: i32): string => {
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
};

/** `resultIn(<arg>, <ok writer or null>, <err writer>)` for a by-value `Result` argument. */
const wasmResultPack = (table: TypeTable, arg: string, t: i32): string => {
  const ok = table.kindOf(table.okOf(t)) === T_VOID ? "null" : wasmPayloadWriter(table, table.okOf(t));
  return `resultIn(${arg}, ${ok}, ${wasmPayloadWriter(table, table.errOf(t))})`;
};

/** True when some bridged signature carries an f32 payload, so the loader needs the bit view. */
const wasmNeedsF32 = (table: TypeTable, fns: ExternalFunction[]): boolean => {
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
};

const wasmCarriesF32 = (table: TypeTable, t: i32): boolean => {
  if (table.kindOf(t) !== K_RESULT) {
    return false;
  }
  return table.kindOf(table.okOf(t)) === T_F32 || table.kindOf(table.errOf(t)) === T_F32;
};

/** True when some bridged signature takes or returns a packed `Result`. */
const wasmHasPackedResult = (table: TypeTable, fns: ExternalFunction[]): boolean => {
  for (const fn of fns) {
    if (wasmTakesPacked(table, fn.sig)) {
      return true;
    }
  }
  return false;
};

const wasmTakesPacked = (table: TypeTable, sig: FunctionSig): boolean => {
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
};

export const wasmBridged = (table: TypeTable, fns: ExternalFunction[]): WasmBridge => {
  const bridged: ExternalFunction[] = [];
  for (const fn of fns) {
    if (wasmSkipReason(table, fn.sig).length === 0) {
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
};

/** Names the loader's own locals use; a parameter spelled the same gets an underscore. */
const wasmIsLoaderLocal = (name: string): boolean => (
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

const wasmJsParam = (name: string): string => wasmIsLoaderLocal(name) ? `${name}_` : name;

/** One non-array argument: packed, masked to its unsigned width, or as it came. */
const wasmOperand = (table: TypeTable, sig: FunctionSig, params: string[], i: i32): string => {
  const t = sig.paramTypes[i];
  if (table.resultByValue(t)) {
    return wasmResultPack(table, params[i], t);
  }
  const mask = wasmUnsignedIn(table, t);
  return mask.length > 0 ? `${params[i]} & ${mask}` : params[i];
};

/** The call's value as JS should see it. The three cases are mutually exclusive. */
const wasmReturned = (table: TypeTable, sig: FunctionSig, ret: TypedView | null, call: string): string => {
  if (ret !== null) {
    return `arrayOut(${call}, ${ret.ctor})`;
  }
  if (table.resultByValue(sig.returnType)) {
    return wasmResultUnpack(table, call, sig.returnType);
  }
  return wasmUnsignedOut(table, sig.returnType, call);
};

/**
 * The raw export an entry calls. The wasm export is the LLVM symbol itself, and
 * an instantiation's can hold the mangling's `.` (`sum$arr.i32`, WP18 G8),
 * which a property access cannot spell, so that one is indexed by its string.
 */
const wasmRaw = (sig: FunctionSig): string => sig.name.indexOf(".") >= 0 ? `raw["${sig.name}"]` : `raw.${sig.name}`;

const wasmWrapper = (table: TypeTable, fn: ExternalFunction): string[] => {
  const sig = fn.sig;
  const name = jsExportName(sig);
  const raw = wasmRaw(sig);
  const ret = typedView(table, sig.returnType);
  const views: (TypedView | null)[] = [];
  let anyMask = false;
  let i = 0;
  while (i < sig.paramTypes.length) {
    views.push(typedView(table, sig.paramTypes[i]));
    if (wasmUnsignedIn(table, sig.paramTypes[i]).length > 0) {
      anyMask = true;
    }
    i = i + 1;
  }
  const packed = wasmTakesPacked(table, sig);
  const out = wasmUnsignedResult(table, sig.returnType);
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
    // WP17/WP15: a packed `Result` and an unsigned width both need converting
    // but no arena scope — nothing was copied into the module for the call, so
    // there is nothing to release.
    if (packed || out || anyMask) {
      const operands: string[] = [];
      i = 0;
      while (i < sig.paramTypes.length) {
        operands.push(wasmOperand(table, sig, params, i));
        i = i + 1;
      }
      const call = `${raw}(${operands.join(", ")})`;
      lines.push(`${name}: (${params.join(", ")}) => ${wasmReturned(table, sig, ret, call)},`);
      return lines;
    }
    lines.push(`${name}: ${raw},`);
    return lines;
  }

  const body: string[] = [];
  const args: string[] = [];
  i = 0;
  while (i < sig.paramTypes.length) {
    const view = views[i];
    if (view === null) {
      args.push(wasmOperand(table, sig, params, i));
    } else {
      const param = sig.paramNames[i];
      body.push(
        `const ${param}$ = arrayIn(${params[i]}, ${view.ctor}, ${view.elemSize}, "${name}: argument ${i + 1} (${param})");`
      );
      args.push(`${param}$`);
    }
    i = i + 1;
  }
  const call = `${raw}(${args.join(", ")})`;
  const isVoid = table.kindOf(sig.returnType) === T_VOID;
  const value = wasmReturned(table, sig, ret, call);
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
  lines.push(`${name}: (${params.join(", ")}) => scoped(() => {`);
  for (const line of body) {
    lines.push(`  ${line}`);
  }
  lines.push("}),");
  return lines;
};

/**
 * The loader's half of WP17. A packed `Result` reaches JS as the wasm export's
 * `i64`, i.e. a bigint: bit 0 is the discriminant and bits 32..63 are the arm
 * it selects. `resultOut` turns that into the object `--emit-dts` declares, so
 * a caller never sees the encoding.
 */
const wasmResultHelpers = (table: TypeTable, bridged: ExternalFunction[]): string[] => {
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
};

export const generateWasmLoader = (
  compilation: Compilation,
  fns: ExternalFunction[],
  dtsFile: string
): string => {
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
    // `u` is left out of the vowel set on purpose; `withArticle` in
    // interop_napi.ts carries the reason. `Uint8Array` takes `a`, the way
    // "a user" does.
    lines.push(
      '    if (!(value instanceof Ctor)) throw new TypeError(what + " must be " + (/^[AEIO]/.test(Ctor.name) ? "an " : "a ") + Ctor.name);'
    );
    lines.push("    const hdr = raw.nish_alloc_array(BigInt(elemSize), BigInt(value.length));");
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
    lines.push("    const mark = raw.nish_arena_mark();");
    lines.push("    try {");
    lines.push("      return fn();");
    lines.push("    } finally {");
    lines.push("      raw.nish_arena_release(mark);");
    lines.push("    }");
    lines.push("  };");
    pushAll(lines, wasmResultHelpers(table, bridge.bridged));
    lines.push("  return {");
    lines.push("    memory,");
    lines.push("    nish_reset_arena: raw.nish_reset_arena,");
    lines.push("    nish_free_arena: raw.nish_free_arena,");
  } else {
    pushAll(lines, wasmResultHelpers(table, bridge.bridged));
    lines.push("  return {");
    lines.push("    memory: raw.memory,");
  }
  for (const fn of bridge.bridged) {
    lines.push(`    /** ${fn.unit.name}: ${tsSignature(table, fn.sig)} */`);
    for (const line of wasmWrapper(table, fn)) {
      lines.push(`    ${line}`);
    }
  }
  lines.push("  };");
  lines.push("}");
  lines.push("");
  return lines.join("\n");
};
