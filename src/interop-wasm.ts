// The companion of `--emit-dts` (stage0's `src/interop/wasm.ts`, WP8): a small ES
// module, `<stem>.mjs` next to the `.d.ts`, whose `load(source, imports)` and
// `loadSync(source, imports)` instantiate the wasm build and wrap every export
// that takes or returns an array.
//
// A raw wasm export sees an array as an `i32` pointer to the arena header
// `{ i64 len, i64 cap, i8* data }` (24 bytes on wasm32 too: the 4-byte data
// pointer sits at offset 16). Per call the wrapper:
//   1. `nish_arena_mark()`, so everything below can be released afterwards;
//   2. for each typed-array argument: `nish_alloc_array(elemSize, len)` in the
//      module (runtime/runtime-wasm.c), a typed-array view on `memory.buffer`
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

import { LANGUAGE } from "./branding"
import { Compilation } from "./compilation"
import {
  banner,
  endsWithFold,
  ExternalFunction,
  holdsVector,
  jsExportName,
  POS_PARAM,
  POS_RETURN,
  pushAll,
  structsHoldingVectors,
  tsKeyword,
  tsSignatureLine,
  TypedView,
  typedView,
} from "./interop-abi"
import { takesRange } from "./emit-builtins"
import { StringSet } from "./map"
import { unwrapParens } from "./emit-util"
import { basename, dirname, relativePath, resolvePath } from "./paths"
import { elementStride, FunctionSig, inlineElementStruct } from "./program"
import {
  K_ARRAY,
  isHostWindow,
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
} from "./types"

/** `x.d.ts` -> `x.mjs`. */
export const wasmLoaderPath = (dtsFile: string): string => {
  const stem = endsWithFold(dtsFile, ".d.ts") ? dtsFile.substring(0, dtsFile.length - 5) : dtsFile
  return `${stem}.mjs`
}

export class WasmBridge {
  /** Functions JS can call: every type is a scalar or a typed view. */
  bridged: ExternalFunction[]
  /**
   * True when some bridged function passes an array, or some function checks a
   * ranged parameter on entry (WP31 §9), so the module must link runtime-wasm.c:
   * the arena for the one, the panic's `nish_panic` for the other.
   */
  needsRuntime: boolean

  constructor(bridged: ExternalFunction[], needsRuntime: boolean) {
    this.bridged = bridged
    this.needsRuntime = needsRuntime
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
  // WP31 §9: a ranged integer is an `i32`, so a `number`; the loader checks
  // an argument against the range (`wasmRangeIn`), and a result is already in it.
  if (table.isRanged(t)) {
    return "number"
  }
  // WP50 S2: a host handle is an `i32`, read by the page's `tsc` as the
  // branded number `nish`'s root types declare (`HostHandle` in runtime/nish.d.ts).
  if (table.isHostHandle(t)) {
    return table.typeName(t)
  }
  switch (table.kindOf(t)) {
    // WP15: an unsigned width crosses as the wasm value type of its LLVM type,
    // so u8/u16/u32 are a `number` like i32 and u64 is a `bigint` like i64.
    case T_I32:
      return "number"
    case T_U8:
      return "number"
    case T_U16:
      return "number"
    case T_U32:
      return "number"
    case T_F32:
      return "number"
    case T_F64:
      return "number"
    case T_I64:
      return "bigint"
    case T_U64:
      return "bigint"
    case T_BOOL:
      return position === POS_PARAM ? "boolean" : "WasmBool"
    // Only a result can be `void`; a parameter of that type does not exist,
    // and spelling one `void` would be a declaration the loader cannot honour.
    case T_VOID:
      return position === POS_RETURN ? "void" : ""
    case K_ARRAY: {
      const view = typedView(table, t)
      return view === null ? "" : view.ctor
    }
    // WP17: the packed shape, in either direction. The loader is what turns
    // the bigint the export answers into this object, and an argument back.
    case K_RESULT:
      return table.resultByValue(t) ? wasmResultType(table, t) : ""
    default:
      return ""
  }
}

const wasmCrosses = (table: TypeTable, t: i32, position: i32): boolean =>
  wasmType(table, t, position).length > 0

/**
 * Why this function is not on the bridge, or `""` when it is. Naming the
 * position and the type is the whole point: a reader of the `.d.ts` sees which
 * argument stopped it rather than the blanket sentence this used to be (and
 * that the N-API shim still writes for its own skips). `--emit-dts` writes it
 * as a comment and the loader omits exactly the same functions, because both
 * ask this.
 */
export const wasmSkipReason = (table: TypeTable, sig: FunctionSig, vectored: StringSet): string => {
  if (sig.name === "main") {
    return "`main` is reserved for a process entry"
  }
  let i = 0
  while (i < sig.paramTypes.length) {
    if (!wasmCrosses(table, sig.paramTypes[i], POS_PARAM)) {
      return `argument ${i + 1} (${sig.paramNames[i]}) is ${wasmMissing(table, sig.paramTypes[i], vectored)}`
    }
    i = i + 1
  }
  if (!wasmCrosses(table, sig.returnType, POS_RETURN)) {
    return `the result is ${wasmMissing(table, sig.returnType, vectored)}`
  }
  return ""
}

/**
 * A type the bridge does not carry, and why: a `nish:simd` vector, or a type
 * holding one, because no wasm export signature here spells a `v128`, the rest
 * because they need the runtime the freestanding profile leaves out.
 * `vectored` names the records that hold a vector (`structsHoldingVectors`).
 */
const wasmMissing = (table: TypeTable, t: i32, vectored: StringSet): string => {
  const shown = `\`${tsKeyword(table, t)}\``
  if (table.isVector(t)) {
    return `${shown}, a \`nish:simd\` vector, which the wasm bridge does not carry yet`
  }
  if (holdsVector(table, t, vectored)) {
    return `${shown}, which holds a \`nish:simd\` vector the wasm bridge does not carry yet`
  }
  return `${shown}, which needs the ${LANGUAGE} runtime the freestanding wasm profile does not include`
}

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
  const kind = table.kindOf(t)
  if (kind === T_U8) {
    return "0xff"
  }
  if (kind === T_U16) {
    return "0xffff"
  }
  return ""
}

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
  const kind = table.kindOf(t)
  if (kind === T_U8) {
    return `${value} & 0xff`
  }
  if (kind === T_U16) {
    return `${value} & 0xffff`
  }
  if (kind === T_U32) {
    return `${value} >>> 0`
  }
  if (kind === T_U64) {
    return `BigInt.asUintN(64, ${value})`
  }
  return value
}

/** The JS type of one packed `Result` payload, or `""` when it cannot cross. */
const wasmPayloadType = (table: TypeTable, t: i32): string => {
  switch (table.kindOf(t)) {
    case T_I32:
      return "number"
    case T_U8:
      return "number"
    case T_U16:
      return "number"
    case T_U32:
      return "number"
    case T_F32:
      return "number"
    // The loader builds the object, so it converts; a payload boolean is a
    // real boolean rather than the `WasmBool` a bare `i1` return comes back as.
    case T_BOOL:
      return "boolean"
    default:
      return ""
  }
}

/** `{ ok: true; value: number } | { ok: false; error: number }`. */
const wasmResultType = (table: TypeTable, t: i32): string => {
  const error = wasmPayloadType(table, table.errOf(t))
  if (error.length === 0) {
    return ""
  }
  const ok = table.okOf(t)
  if (table.kindOf(ok) === T_VOID) {
    return `{ ok: true } | { ok: false; error: ${error} }`
  }
  const value = wasmPayloadType(table, ok)
  if (value.length === 0) {
    return ""
  }
  return `{ ok: true; value: ${value} } | { ok: false; error: ${error} }`
}

/**
 * How the loader reads one packed payload out of the high half of the word.
 * `p` is already `BigInt.asUintN(32, word >> 32n)`, so each reader only has to
 * give the bits their type back: a signed width sign-extends, `f32` is a
 * reinterpretation rather than a conversion, and `boolean` is the low bit.
 */
const wasmPayloadReader = (table: TypeTable, t: i32): string => {
  switch (table.kindOf(t)) {
    case T_I32:
      return "(p) => Number(BigInt.asIntN(32, p))"
    case T_U8:
      return "(p) => Number(BigInt.asUintN(8, p))"
    case T_U16:
      return "(p) => Number(BigInt.asUintN(16, p))"
    case T_U32:
      return "(p) => Number(p)"
    case T_F32:
      return "f32Bits"
    case T_BOOL:
      return "(p) => (p & 1n) === 1n"
    default:
      return ""
  }
}

/** `resultOut(<call>, <ok reader or null>, <err reader>)` for a by-value `Result` return. */
const wasmResultUnpack = (table: TypeTable, call: string, t: i32): string => {
  const ok = table.kindOf(table.okOf(t)) === T_VOID ? "null" : wasmPayloadReader(table, table.okOf(t))
  return `resultOut(${call}, ${ok}, ${wasmPayloadReader(table, table.errOf(t))})`
}

/**
 * The inverse of `wasmPayloadReader`: how the loader puts one payload into the
 * high half of the word. A signed width is masked to 32 bits, `f32` goes
 * through the same bit view as on the way out, and `boolean` is one bit.
 * Each payload passes `payloadIn` first, so a payload of the wrong JavaScript
 * type (`1.5` or `"x"` for an `i32`, a bigint for an `f32`) is refused before
 * the module runs instead of throwing out of `BigInt` inside `guarded`.
 */
const wasmPayloadWriter = (table: TypeTable, t: i32): string => {
  switch (table.kindOf(t)) {
    case T_I32:
      return '(v) => BigInt.asUintN(32, BigInt(payloadIn(v, "integer")))'
    case T_U8:
      return '(v) => BigInt.asUintN(32, BigInt(payloadIn(v, "integer")))'
    case T_U16:
      return '(v) => BigInt.asUintN(32, BigInt(payloadIn(v, "integer")))'
    case T_U32:
      return '(v) => BigInt.asUintN(32, BigInt(payloadIn(v, "integer")))'
    case T_F32:
      return '(v) => f32Word(payloadIn(v, "number"))'
    case T_BOOL:
      return '(v) => (payloadIn(v, "boolean") ? 1n : 0n)'
    default:
      return ""
  }
}

/** `resultIn(<arg>, <ok writer or null>, <err writer>)` for a by-value `Result` argument. */
const wasmResultPack = (table: TypeTable, arg: string, t: i32): string => {
  const ok = table.kindOf(table.okOf(t)) === T_VOID ? "null" : wasmPayloadWriter(table, table.okOf(t))
  return `resultIn(${arg}, ${ok}, ${wasmPayloadWriter(table, table.errOf(t))})`
}

/** True when some bridged signature carries an f32 payload, so the loader needs the bit view. */
const wasmNeedsF32 = (table: TypeTable, fns: ExternalFunction[]): boolean => {
  for (const fn of fns) {
    if (wasmCarriesF32(table, fn.sig.returnType)) {
      return true
    }
    let i = 0
    while (i < fn.sig.paramTypes.length) {
      if (wasmCarriesF32(table, fn.sig.paramTypes[i])) {
        return true
      }
      i = i + 1
    }
  }
  return false
}

const wasmCarriesF32 = (table: TypeTable, t: i32): boolean => {
  if (table.kindOf(t) !== K_RESULT) {
    return false
  }
  return table.kindOf(table.okOf(t)) === T_F32 || table.kindOf(table.errOf(t)) === T_F32
}

/** True when some bridged signature takes or returns a packed `Result`. */
const wasmHasPackedResult = (table: TypeTable, fns: ExternalFunction[]): boolean => {
  for (const fn of fns) {
    if (wasmTakesPacked(table, fn.sig)) {
      return true
    }
  }
  return false
}

const wasmTakesPacked = (table: TypeTable, sig: FunctionSig): boolean => {
  if (table.resultByValue(sig.returnType)) {
    return true
  }
  let i = 0
  while (i < sig.paramTypes.length) {
    if (table.resultByValue(sig.paramTypes[i])) {
      return true
    }
    i = i + 1
  }
  return false
}

export const wasmBridged = (table: TypeTable, fns: ExternalFunction[], vectored: StringSet): WasmBridge => {
  const bridged: ExternalFunction[] = []
  for (const fn of fns) {
    if (wasmSkipReason(table, fn.sig, vectored).length === 0) {
      bridged.push(fn)
    }
  }
  // Every function in the module, bridged or not, is linked into it, and one
  // whose prologue checks a range (every external one that takes a range)
  // calls the panic's two runtime symbols.
  let needsRuntime = false
  for (const fn of fns) {
    if (takesRange(table, fn.sig)) {
      needsRuntime = true
    }
  }
  for (const fn of bridged) {
    if (typedView(table, fn.sig.returnType) !== null) {
      needsRuntime = true
    }
    let i = 0
    while (i < fn.sig.paramTypes.length) {
      if (typedView(table, fn.sig.paramTypes[i]) !== null) {
        needsRuntime = true
      }
      i = i + 1
    }
  }
  return new WasmBridge(bridged, needsRuntime)
}

/**
 * Names the loader's own locals use; a parameter spelled the same gets an
 * underscore. `guard` is a loader with the panic guard (`loaderGuarded`),
 * whose locals differ from the plain loader's.
 */
const wasmIsLoaderLocal = (name: string, guard: boolean): boolean =>
  (guard
    ? name === "guarded" || name === "state" || name === "refuse" || name === "typedIn"
    : name === "scoped") ||
  name === "raw" ||
  name === "memory" ||
  name === "header" ||
  name === "arrayIn" ||
  name === "arrayOut" ||
  name === "copyBack" ||
  name === "rangeIn" ||
  name === "resultIn" ||
  name === "resultOut" ||
  name === "payloadIn" ||
  name === "f32Word" ||
  name === "f32Bits" ||
  name === "result" ||
  name === "instance" ||
  name === "bytes"

const wasmJsParam = (name: string, guard: boolean): string =>
  wasmIsLoaderLocal(name, guard) ? `${name}_` : name

/** An error the loader throws for a bad argument: tagged by `refuse` in a guarded loader, so the module stays alive. */
const refused = (guard: boolean, error: string): string => (guard ? `refuse(${error})` : error)

/**
 * The check a ranged *argument* gets before the call (WP31 §9), or `""` for
 * any other type. The compiled function checks it too, on entry, but its
 * failure is a panic, which in the freestanding build is a trap: a host would
 * see a `RuntimeError` from inside the module and an instance that cannot be
 * trusted afterwards. So the loader throws the `RangeError` JavaScript itself
 * throws for `new Uint8Array(-1)`, naming the function, the parameter and the
 * range, and the module is never entered.
 *
 * The value is judged as the number it is. The wasm call would convert it with
 * ToInt32 first, which wraps 4294967301 to 5, a value inside `[0, 255]`, and
 * truncates 2.5 to 2; neither is what the caller passed.
 */
const wasmRangeIn = (table: TypeTable, sig: FunctionSig, param: string, i: i32): string => {
  const t = sig.paramTypes[i]
  if (!table.isRanged(t)) {
    return ""
  }
  const what = `${jsExportName(sig)}: argument ${i + 1} (${sig.paramNames[i]})`
  return `rangeIn(${param}, ${table.rangeLo(t)}, ${table.rangeHi(t)}, "${what}")`
}

/**
 * A guarded loader's check that a scalar argument is the JavaScript type its
 * declaration names, or `""`. Without it the call's own conversion is what
 * fails, a `TypeError` for `5` where a `bigint` is wanted or for a `bigint`
 * masked to its width, and it throws inside `guarded`, which cannot tell it
 * from an exception out of the module and leaves the module dead. A
 * `boolean`, `number` or `bigint` converts without running caller code, so
 * once this passes the conversion cannot throw.
 */
const wasmTypedIn = (table: TypeTable, sig: FunctionSig, param: string, i: i32): string => {
  const t = sig.paramTypes[i]
  const kind = table.kindOf(t)
  if (kind === K_ARRAY || kind === K_RESULT) {
    return ""
  }
  const scalar = table.isHostHandle(t) ? "number" : wasmType(table, t, POS_PARAM)
  if (scalar !== "number" && scalar !== "bigint" && scalar !== "boolean") {
    return ""
  }
  const what = `${jsExportName(sig)}: argument ${i + 1} (${sig.paramNames[i]})`
  return `typedIn(${param}, "${scalar}", "${what}")`
}

/** One non-array argument: packed, masked to its unsigned width, checked against its range or its type, or as it came. */
const wasmOperand = (
  table: TypeTable,
  sig: FunctionSig,
  params: string[],
  i: i32,
  guard: boolean
): string => {
  const t = sig.paramTypes[i]
  if (table.resultByValue(t)) {
    return wasmResultPack(table, params[i], t)
  }
  const checked = wasmRangeIn(table, sig, params[i], i)
  if (checked.length > 0) {
    return checked
  }
  const typed = guard ? wasmTypedIn(table, sig, params[i], i) : ""
  const param = typed.length > 0 ? typed : params[i]
  const mask = wasmUnsignedIn(table, t)
  return mask.length > 0 ? `${param} & ${mask}` : param
}

/** The call's value as JS should see it. The three cases are mutually exclusive. */
const wasmReturned = (table: TypeTable, sig: FunctionSig, ret: TypedView | null, call: string): string => {
  if (ret !== null) {
    return `arrayOut(${call}, ${ret.ctor})`
  }
  if (table.resultByValue(sig.returnType)) {
    return wasmResultUnpack(table, call, sig.returnType)
  }
  return wasmUnsignedOut(table, sig.returnType, call)
}

/**
 * The raw export an entry calls. The wasm export is the LLVM symbol itself, and
 * an instantiation's can hold the mangling's `.` (`sum$arr.i32`, WP18 G8),
 * which a property access cannot spell, so that one is indexed by its string.
 */
const wasmRaw = (sig: FunctionSig): string =>
  sig.name.indexOf(".") >= 0 ? `raw["${sig.name}"]` : `raw.${sig.name}`

/** Whether a plain loader's array-free export needs a wrapper: a narrow unsigned or ranged argument (WP31), a packed `Result`, or an unsigned result. */
const wasmConverts = (table: TypeTable, sig: FunctionSig): boolean => {
  for (const t of sig.paramTypes) {
    if (wasmUnsignedIn(table, t).length > 0 || table.isRanged(t)) {
      return true
    }
  }
  return wasmTakesPacked(table, sig) || wasmUnsignedResult(table, sig.returnType)
}

/** Whether `wasmUnsignedOut` has anything to do, which decides if a plain loader's export needs a wrapper at all. */
const wasmUnsignedResult = (table: TypeTable, t: i32): boolean => {
  const kind = table.kindOf(t)
  return kind === T_U8 || kind === T_U16 || kind === T_U32 || kind === T_U64
}

/**
 * One export's entry in `exportsOf`. In a guarded loader every export runs in
 * `guarded`; in a plain one an export with no array runs bare, or is the raw
 * export itself when nothing converts, and one with an array in `scoped`.
 */
const wasmWrapper = (table: TypeTable, fn: ExternalFunction, guard: boolean): string[] => {
  const sig = fn.sig
  const name = jsExportName(sig)
  const raw = wasmRaw(sig)
  const ret = typedView(table, sig.returnType)
  const views: (TypedView | null)[] = []
  let i = 0
  while (i < sig.paramTypes.length) {
    views.push(typedView(table, sig.paramTypes[i]))
    i = i + 1
  }
  const lines: string[] = []
  const params: string[] = []
  i = 0
  while (i < sig.paramNames.length) {
    params.push(wasmJsParam(sig.paramNames[i], guard))
    i = i + 1
  }

  let anyView = ret !== null
  for (const view of views) {
    if (view !== null) {
      anyView = true
    }
  }
  if (!anyView) {
    // WP17/WP15: a packed `Result` and an unsigned width both need converting,
    // and a ranged argument checking (WP31). Nothing is copied in; a plain
    // loader has nothing to release, and a guarded one still runs the call
    // in `guarded` (WP50 S3), which refuses a dead or re-entered module and
    // gives back whatever the call allocated.
    if (!guard && !wasmConverts(table, sig)) {
      lines.push(`${name}: ${raw},`)
      return lines
    }
    const operands: string[] = []
    i = 0
    while (i < sig.paramTypes.length) {
      operands.push(wasmOperand(table, sig, params, i, guard))
      i = i + 1
    }
    const call = `${raw}(${operands.join(", ")})`
    const value = wasmReturned(table, sig, ret, call)
    lines.push(`${name}: (${params.join(", ")}) => ${guard ? `guarded(() => ${value})` : value},`)
    return lines
  }

  const body: string[] = []
  const args: string[] = []
  i = 0
  while (i < sig.paramTypes.length) {
    const view = views[i]
    if (view === null) {
      args.push(wasmOperand(table, sig, params, i, guard))
    } else {
      const param = sig.paramNames[i]
      body.push(
        `const ${param}$ = arrayIn(${params[i]}, ${view.ctor}, ${view.elemSize}, "${name}: argument ${i + 1} (${param})");`
      )
      args.push(`${param}$`)
    }
    i = i + 1
  }
  const call = `${raw}(${args.join(", ")})`
  const isVoid = table.kindOf(sig.returnType) === T_VOID
  const value = wasmReturned(table, sig, ret, call)
  const copyBacks: string[] = []
  i = 0
  while (i < sig.paramNames.length) {
    if (views[i] !== null && fn.writtenParams.has(sig.paramNames[i])) {
      copyBacks.push(`copyBack(${sig.paramNames[i]}$, ${params[i]});`)
    }
    i = i + 1
  }
  if (copyBacks.length === 0) {
    body.push(isVoid ? `${value};` : `return ${value};`)
  } else {
    body.push(isVoid ? `${value};` : `const result = ${value};`)
    pushAll(body, copyBacks)
    if (!isVoid) {
      body.push("return result;")
    }
  }
  lines.push(`${name}: (${params.join(", ")}) => ${guard ? "guarded" : "scoped"}(() => {`)
  for (const line of body) {
    lines.push(`  ${line}`)
  }
  lines.push("}),")
  return lines
}

/**
 * `rangeIn`, the loader's half of WP31 §9 (`wasmRangeIn` says why it runs
 * before the call). A value that is not a number is the `TypeError` the N-API
 * shim throws for one, and a number that is not an integer in the range is the
 * `RangeError`, with both messages worded as the shim words them.
 */
const wasmRangeHelper = (table: TypeTable, bridged: ExternalFunction[], guard: boolean): string[] => {
  const lines: string[] = []
  let any = false
  for (const fn of bridged) {
    if (takesRange(table, fn.sig)) {
      any = true
    }
  }
  if (!any) {
    return lines
  }
  lines.push("  /** A ranged argument, judged as the number it is rather than after ToInt32 wraps it. */")
  lines.push("  const rangeIn = (value, lo, hi, what) => {")
  lines.push(
    `    if (typeof value !== "number") throw ${refused(guard, 'new TypeError(what + " must be a number")')};`
  )
  lines.push("    if (!Number.isInteger(value) || value < lo || value > hi)")
  lines.push(
    `      throw ${refused(guard, 'new RangeError(what + " must be an integer in [" + lo + ", " + hi + "]")')};`
  )
  lines.push("    return value;")
  lines.push("  };")
  return lines
}

/**
 * The loader's half of WP17. A packed `Result` reaches JS as the wasm export's
 * `i64`, i.e. a bigint: bit 0 is the discriminant and bits 32..63 are the arm
 * it selects. `resultOut` turns that into the object `--emit-dts` declares, so
 * a caller never sees the encoding.
 */
const wasmResultHelpers = (table: TypeTable, bridged: ExternalFunction[], guard: boolean): string[] => {
  const lines: string[] = []
  if (!wasmHasPackedResult(table, bridged)) {
    return lines
  }
  lines.push("  /** A Result in one i64 (WP17): bit 0 is the tag, bits 32..63 the payload. */")
  lines.push("  const resultOut = (word, readValue, readError) => {")
  lines.push("    const payload = BigInt.asUintN(32, word >> 32n);")
  lines.push("    if ((word & 1n) === 0n) return { ok: false, error: readError(payload) };")
  lines.push("    return readValue === null ? { ok: true } : { ok: true, value: readValue(payload) };")
  lines.push("  };")
  lines.push("  /** A payload of the JavaScript type its arm declares, so writing it cannot throw. */")
  lines.push("  const payloadIn = (v, type) => {")
  lines.push('    if (type === "integer" ? !Number.isInteger(v) : typeof v !== type)')
  lines.push(
    `      throw ${refused(guard, 'new TypeError("a Result payload must be " + (type === "integer" ? "an integer" : "a " + type))')};`
  )
  lines.push("    return v;")
  lines.push("  };")
  lines.push("  const resultIn = (r, writeValue, writeError) => {")
  lines.push('    if (r === null || typeof r !== "object")')
  lines.push(
    `      throw ${refused(guard, 'new TypeError("expected { ok: true, value } or { ok: false, error }")')};`
  )
  if (guard) {
    // A getter on the caller's object is caller code: what it throws is a
    // bad argument, not the module's failure.
    lines.push("    let ok, v;")
    lines.push("    try {")
    lines.push("      ok = r.ok;")
    lines.push("      v = ok === true ? r.value : r.error;")
    lines.push("    } catch (e) {")
    lines.push(
      '      throw refuse(e instanceof Object ? e : new TypeError("a Result argument threw " + String(e)));'
    )
    lines.push("    }")
  } else {
    lines.push("    const ok = r.ok;")
    lines.push("    const v = ok === true ? r.value : r.error;")
  }
  lines.push('    if (typeof ok !== "boolean")')
  lines.push(
    `      throw ${refused(guard, 'new TypeError("expected { ok: true, value } or { ok: false, error }")')};`
  )
  lines.push("    const payload = ok ? (writeValue === null ? 0n : writeValue(v)) : writeError(v);")
  lines.push("    return (payload << 32n) | (ok ? 1n : 0n);")
  lines.push("  };")
  if (wasmNeedsF32(table, bridged)) {
    lines.push("  /** An f32 payload is the same 32 bits, not a converted number. */")
    lines.push("  const f32View = new Float32Array(1);")
    lines.push("  const f32Words = new Uint32Array(f32View.buffer);")
    lines.push("  const f32Bits = (p) => {")
    lines.push("    f32Words[0] = Number(p);")
    lines.push("    return f32View[0];")
    lines.push("  };")
    lines.push("  const f32Word = (v) => {")
    lines.push("    f32View[0] = v;")
    lines.push("    return BigInt(f32Words[0]);")
    lines.push("  };")
  }
  return lines
}

// ---- WP50 S3: panics, death and re-entry -------------------------------------

/**
 * The loader's top level for panics (`docs/wp50-wasm-host.md` §6): the two
 * error classes, the `refuse` tag for an argument the loader turns away
 * before the module runs (which leaves it alive), the default reporter, the
 * per-load `state`, and `panicOf`, the `nish.panic` import runtime-wasm.c
 * calls under `--profile wasm-host` before it traps. The import formats the
 * message runtime.c would print, marks the module dead before it calls
 * `onPanic` (so a callback that calls back in meets a dead module, not a
 * half-unwound one), and throws `NishPanic`, which unwinds the module's
 * frames instead of the trap. `linkOf` is the import object of a program
 * with no host module; `importsOf` adds the import beside `host`.
 *
 * A module built with `--profile wasm` imports nothing, so the extra entry
 * in its import object is never read and its panics stay traps, which
 * `guarded` turns into a dead module all the same.
 */
const panicLoader = (hosts: boolean): string[] => {
  const lines: string[] = []
  lines.push(
    "/** A panic inside the module: `kind` names it, `site` indexes `<module>.wasm.sites.json`, or is -1. */"
  )
  lines.push("export class NishPanic extends Error {")
  lines.push("  constructor(message, kind, site) {")
  lines.push("    super(message);")
  lines.push('    this.name = "NishPanic";')
  lines.push("    this.kind = kind;")
  lines.push("    this.site = site;")
  lines.push("  }")
  lines.push("}")
  lines.push("")
  lines.push(
    "/** A call into the module while another call into it runs, refused before the module is touched. */"
  )
  lines.push("export class NishReentry extends Error {")
  lines.push("  constructor(message) {")
  lines.push("    super(message);")
  lines.push('    this.name = "NishReentry";')
  lines.push("  }")
  lines.push("}")
  lines.push("")
  lines.push("/** Errors thrown for an argument before the module runs: they leave the module alive. */")
  lines.push("const refused = new WeakSet();")
  lines.push("const refuse = (error) => {")
  lines.push("  refused.add(error);")
  lines.push("  return error;")
  lines.push("};")
  lines.push(
    "/** A scalar argument of the JavaScript type its declaration names, so the call's own conversion cannot throw. */"
  )
  lines.push("const typedIn = (value, type, what) => {")
  lines.push('  if (typeof value !== type) throw refuse(new TypeError(what + " must be a " + type));')
  lines.push("  return value;")
  lines.push("};")
  lines.push("")
  lines.push(
    "/** The default `onPanic`: the reporter nish/page exports, inlined so this file imports nothing. */"
  )
  lines.push("const reportPanic = (panic) => {")
  lines.push('  console.error("nish: " + panic.message);')
  lines.push("};")
  lines.push("")
  lines.push("/** One load: dead once a panic, trap or exception left the module, busy while a call runs. */")
  lines.push("const stateOf = (imports) => ({")
  lines.push("  dead: null,")
  lines.push("  busy: false,")
  lines.push("  memory: null,")
  lines.push(
    '  onPanic: imports != null && typeof imports.onPanic === "function" ? imports.onPanic : reportPanic,'
  )
  lines.push("  sites: imports != null && Array.isArray(imports.sites) ? imports.sites : null,")
  lines.push("});")
  lines.push("")
  lines.push('const panicKinds = ["panic", "index", "slice", "overflow", "memory", "exit"];')
  lines.push("const arithmetic = [")
  lines.push('  "attempt to add with overflow",')
  lines.push('  "attempt to subtract with overflow",')
  lines.push('  "attempt to multiply with overflow",')
  lines.push('  "attempt to negate with overflow",')
  lines.push('  "attempt to divide with overflow",')
  lines.push('  "attempt to divide by zero",')
  lines.push("];")
  lines.push("")
  lines.push("/** The words runtime.c prints for the panic, from the import's arguments. */")
  lines.push("const panicText = (state, kind, msg, len, a, b) => {")
  lines.push("  if (kind === 0) {")
  lines.push("    // The module names its own message; one outside memory is not read.")
  lines.push("    const size = state.memory === null ? 0 : state.memory.buffer.byteLength;")
  lines.push("    const at = msg >>> 0;")
  lines.push("    const n = len >>> 0;")
  lines.push('    if (at > size || n > size - at) return "panic (its message is outside memory)";')
  lines.push(
    '    return new TextDecoder().decode(new Uint8Array(state.memory.buffer, at, n)).replace(/\\n$/, "");'
  )
  lines.push("  }")
  lines.push('  if (kind === 1) return "index out of range: " + a + " >= " + b;')
  lines.push(
    '  if (kind === 2) return "slice out of range: [" + a + ", " + b + ") of length " + (len >>> 0);'
  )
  lines.push(
    '  if (kind === 3) return arithmetic[a] === undefined ? "arithmetic panic " + a : arithmetic[a];'
  )
  lines.push('  if (kind === 4) return "out of memory";')
  lines.push('  if (kind === 5) return "the program exited with code " + a;')
  lines.push('  return "panic";')
  lines.push("};")
  lines.push("")
  lines.push(
    "/** The `nish.panic` import: mark the module dead, tell the page, and unwind out of the module. */"
  )
  lines.push("const panicOf = (state) => (kind, site, msg, len, a, b) => {")
  lines.push("  const sites = state.sites;")
  lines.push("  const at = sites !== null && site >= 0 && site < sites.length ? sites[site] : null;")
  lines.push('  const name = kind === 3 && a >= 4 ? "divide" : (panicKinds[kind] ?? "panic");')
  lines.push(
    '  const where = at !== null && at !== undefined && typeof at.at === "string" ? " at " + at.at : "";'
  )
  lines.push("  const message = panicText(state, kind, msg, len, a, b) + where;")
  lines.push("  const panic = new NishPanic(message, name, site);")
  lines.push("  state.dead = panic;")
  lines.push("  try {")
  lines.push("    state.onPanic({ message, kind: name, site });")
  lines.push("  } catch {")
  lines.push("    // What unwinds the module is the panic, whatever the reporter threw.")
  lines.push("  }")
  lines.push("  throw panic;")
  lines.push("};")
  lines.push("")
  if (!hosts) {
    lines.push("/** The import object the module links against: the page's own, and the panic import. */")
    lines.push("const linkOf = (imports, state) => ({ ...imports, nish: { panic: panicOf(state) } });")
    lines.push("")
  }
  return lines
}

/**
 * `guarded`, inside `exportsOf`: every export runs in it. A dead module is
 * refused with a `NishPanic` and a busy one with a `NishReentry`, both before
 * the module is touched; with the runtime linked, everything the call
 * allocated in the arena is given back after the result has been read; and
 * anything but a refused argument that escapes the call (a panic, a trap, or
 * an exception out of a host function) leaves the module dead.
 */
const guardLoader = (needsRuntime: boolean): string[] => {
  const lines: string[] = []
  lines.push(
    "  /** One call: refused on a dead or busy module; anything but a bad argument escaping it kills it. */"
  )
  lines.push("  const guarded = (call) => {")
  lines.push("    const dead = state.dead;")
  lines.push(
    '    if (dead !== null) throw new NishPanic("the module is dead: " + dead.message, dead.kind, dead.site);'
  )
  lines.push("    if (state.busy)")
  lines.push(
    '      throw new NishReentry("a call into the module was made while another call into it was running");'
  )
  // The mark comes before `busy` is set: were it to throw, the module would
  // still not be stuck answering NishReentry to every later call.
  if (needsRuntime) {
    lines.push("    const mark = raw.nish_arena_mark();")
  }
  lines.push("    state.busy = true;")
  lines.push("    try {")
  lines.push("      return call();")
  lines.push("    } catch (e) {")
  lines.push("      if (state.dead === null && !refused.has(e)) {")
  lines.push(
    '        const kind = e instanceof WebAssembly.RuntimeError ? "trap" : e instanceof NishReentry ? "reentry" : "exception";'
  )
  lines.push("        state.dead = new NishPanic(e instanceof Error ? e.message : String(e), kind, -1);")
  lines.push("      }")
  lines.push("      throw e;")
  lines.push("    } finally {")
  lines.push("      state.busy = false;")
  if (needsRuntime) {
    lines.push("      if (state.dead === null) {")
    lines.push("        try {")
    lines.push("          raw.nish_arena_release(mark);")
    lines.push("        } catch (e) {")
    lines.push(
      '          state.dead = new NishPanic(e instanceof Error ? e.message : String(e), "trap", -1);'
    )
    lines.push("          throw e;")
    lines.push("        }")
    lines.push("      }")
  }
  lines.push("    }")
  lines.push("  };")
  return lines
}

/**
 * Whether the loader carries WP50 S3's panic guard (`docs/wp50-wasm-host.md`
 * §6): a program that imports a host module or declares module storage, the
 * programs written for `--profile wasm-host`. Any other program keeps the
 * plain loader and `.d.ts` byte for byte, whose trap releases the arena and
 * leaves the module callable, as `--profile wasm` promises.
 */
export const loaderGuarded = (compilation: Compilation): boolean => compilation.guardsPanics()

export const generateWasmLoader = (
  compilation: Compilation,
  fns: ExternalFunction[],
  dtsFile: string
): string => {
  const table = compilation.table
  const bridge = wasmBridged(table, fns, structsHoldingVectors(compilation))
  const layouts = storageLayouts(compilation)
  const lines: string[] = []
  lines.push(banner(compilation, "--emit-dts", "// "))
  lines.push(`// Loader for the wasm build; ${basename(dtsFile)} declares it. Build the module with`)
  lines.push(
    bridge.needsRuntime
      ? "//   scripts/build.sh <module.ll> runtime/runtime-wasm.c -o <module>.wasm --profile wasm-host"
      : "//   scripts/build.sh <module.ll> -o <module>.wasm --profile wasm-host"
  )
  lines.push("// Typed-array arguments are copied into the module's arena for the duration")
  lines.push("// of the call and results are copied out, so the arrays you hold stay yours.")
  lines.push("// The file imports nothing and reads no URL, so a bundler can inline it as it is.")
  lines.push("")
  lines.push("/**")
  lines.push(" * Instantiate the module and return its exports, arrays marshalled. `source` is")
  lines.push(" * the module's bytes (a BufferSource) or a compiled WebAssembly.Module.")
  lines.push(" */")
  // WP50 S2: with a host module the page owes `imports.host`, so there is no
  // default, and the object the module links against is `importsOf`'s.
  // WP50 S3: a guarded loader's every load has a `state` the panic import,
  // the guard around each export and the re-entry flag share (`panicLoader`).
  const hosts = hostFunctions(compilation)
  const guard = loaderGuarded(compilation)
  const params = hosts.length > 0 ? "source, imports" : "source, imports = {}"
  let linked = "imports"
  if (guard) {
    linked = hosts.length > 0 ? "importsOf(imports, state)" : "linkOf(imports, state)"
  }
  const bound = guard ? ", state" : ""
  lines.push(`export async function load(${params}) {`)
  if (guard) {
    lines.push("  const state = stateOf(imports);")
  }
  lines.push("  const instance =")
  lines.push("    source instanceof WebAssembly.Module")
  lines.push(`      ? await WebAssembly.instantiate(source, ${linked})`)
  lines.push(`      : (await WebAssembly.instantiate(source, ${linked})).instance;`)
  lines.push(`  return exportsOf(instance${bound});`)
  lines.push("}")
  lines.push("")
  lines.push("/**")
  lines.push(" * `load` without a promise, for a page that needs the exports before its first")
  lines.push(" * await. Chromium refuses to compile bytes over 8 MB synchronously on the main")
  lines.push(" * thread; above that, call `load`, or compile the module in a worker and pass it here.")
  lines.push(" */")
  lines.push(`export function loadSync(${params}) {`)
  if (guard) {
    lines.push("  const state = stateOf(imports);")
  }
  lines.push(
    "  const module = source instanceof WebAssembly.Module ? source : new WebAssembly.Module(source);"
  )
  lines.push(`  return exportsOf(new WebAssembly.Instance(module, ${linked})${bound});`)
  lines.push("}")
  lines.push("")
  if (guard) {
    pushAll(lines, panicLoader(hosts.length > 0))
  }
  if (hosts.length > 0) {
    pushAll(lines, hostImportsOf(table, hosts))
  }
  lines.push("/** The exports of one instance, arrays marshalled: the body `load` and `loadSync` share. */")
  lines.push(`function exportsOf(instance${bound}) {`)
  lines.push("  const raw = instance.exports;")
  if (guard) {
    lines.push("  state.memory = raw.memory;")
    pushAll(lines, guardLoader(bridge.needsRuntime))
  }
  if (bridge.needsRuntime) {
    lines.push("  const memory = raw.memory;")
    lines.push(
      "  // Header field offsets on wasm32: len at 0 (i64), cap at 8 (i64), data at 16 (i32 pointer)."
    )
    lines.push("  const header = (hdr) => {")
    lines.push("    const view = new DataView(memory.buffer);")
    lines.push(
      "    return { len: Number(view.getBigUint64(hdr, true)), data: view.getUint32(hdr + 16, true) };"
    )
    lines.push("  };")
    if (guard) {
      lines.push("  const typedArray = Object.getPrototypeOf(Int8Array.prototype);")
      lines.push("  const typedTag = Object.getOwnPropertyDescriptor(typedArray, Symbol.toStringTag).get;")
      lines.push('  const typedLength = Object.getOwnPropertyDescriptor(typedArray, "length").get;')
    }
    lines.push("  /** Copy a typed array into a fresh arena array; returns the header pointer. */")
    lines.push("  const arrayIn = (value, Ctor, elemSize, what) => {")
    // `u` is left out of the vowel set on purpose; `withArticle` in
    // interop-napi.ts carries the reason. `Uint8Array` takes `a`, the way
    // "a user" does.
    if (guard) {
      // The %TypedArray% getters check the brand and read the length without
      // running caller code, where `instanceof` and `.length` let a Proxy or a
      // re-prototyped DataView through and then throw from inside `guarded`,
      // killing the module. A detached array reads as length 0 and is copied
      // as an empty one.
      lines.push(
        `    if (typedTag.call(value) !== Ctor.name) throw ${refused(guard, 'new TypeError(what + " must be " + (/^[AEIO]/.test(Ctor.name) ? "an " : "a ") + Ctor.name)')};`
      )
      lines.push("    const n = typedLength.call(value);")
      lines.push("    const hdr = raw.nish_alloc_array(BigInt(elemSize), BigInt(n));")
      lines.push("    if (n > 0) new Ctor(memory.buffer, header(hdr).data, n).set(value);")
    } else {
      // With no guard there is no module state a throw could kill, so the
      // plain loader keeps its smaller check.
      lines.push(
        '    if (!(value instanceof Ctor)) throw new TypeError(what + " must be " + (/^[AEIO]/.test(Ctor.name) ? "an " : "a ") + Ctor.name);'
      )
      lines.push("    const hdr = raw.nish_alloc_array(BigInt(elemSize), BigInt(value.length));")
      lines.push("    new Ctor(memory.buffer, header(hdr).data, value.length).set(value);")
    }
    lines.push("    return hdr;")
    lines.push("  };")
    lines.push("  /** Copy an arena array out as a fresh typed array. */")
    lines.push("  const arrayOut = (hdr, Ctor) => {")
    lines.push("    const { len, data } = header(hdr);")
    lines.push("    return new Ctor(memory.buffer, data, len).slice();")
    lines.push("  };")
    lines.push("  /** After a call that writes through an array parameter: bring the arena bytes back. */")
    lines.push("  const copyBack = (hdr, value) => {")
    lines.push("    const { len, data } = header(hdr);")
    lines.push("    value.set(new value.constructor(memory.buffer, data, Math.min(len, value.length)));")
    lines.push("  };")
    if (!guard) {
      lines.push("  /** Run `fn`, then release everything it allocated in the arena, even when it traps. */")
      lines.push("  const scoped = (fn) => {")
      lines.push("    const mark = raw.nish_arena_mark();")
      lines.push("    try {")
      lines.push("      return fn();")
      lines.push("    } finally {")
      lines.push("      raw.nish_arena_release(mark);")
      lines.push("    }")
      lines.push("  };")
    }
    pushAll(lines, wasmResultHelpers(table, bridge.bridged, guard))
    pushAll(lines, wasmRangeHelper(table, bridge.bridged, guard))
    if (layouts.length > 0) {
      pushAll(lines, layoutLoader(layouts, "memory"))
    }
    lines.push("  return {")
    lines.push("    memory,")
    lines.push("    nish_reset_arena: raw.nish_reset_arena,")
    lines.push("    nish_free_arena: raw.nish_free_arena,")
  } else {
    pushAll(lines, wasmResultHelpers(table, bridge.bridged, guard))
    pushAll(lines, wasmRangeHelper(table, bridge.bridged, guard))
    if (layouts.length > 0) {
      pushAll(lines, layoutLoader(layouts, "raw.memory"))
    }
    lines.push("  return {")
    lines.push("    memory: raw.memory,")
  }
  if (layouts.length > 0) {
    lines.push("    layout,")
    lines.push("    views,")
  }
  for (const fn of bridge.bridged) {
    lines.push(tsSignatureLine(table, fn.sig, `    /** ${fn.unit.name}: `, " */"))
    for (const line of wasmWrapper(table, fn, guard)) {
      lines.push(`    ${line}`)
    }
  }
  lines.push("  };")
  lines.push("}")
  lines.push("")
  return lines.join("\n")
}

/**
 * Every function a host module exports (WP50 S2, `docs/wp50-wasm-host.md`
 * §3), in module order: each is a wasm import from module `host`, which the
 * loader fills from the page's `imports.host`. Empty for a program that
 * imports no host module, which is what keeps that program's sidecars as
 * they were.
 */
export const hostFunctions = (compilation: Compilation): FunctionSig[] => {
  const out: FunctionSig[] = []
  for (const unit of compilation.modules) {
    const program = unit.checker.program
    if (!program.source.host) {
      continue
    }
    for (const sig of program.functions) {
      if (sig.definedIn(program.source)) {
        out.push(sig)
      }
    }
  }
  return out
}

/**
 * The host modules a `.d.ts` at `dtsFile` names in `Imports`, each as a
 * specifier from the declaration's directory, `.ts` dropped, which is how
 * a bundler's or `tsc`'s `bundler` resolution spells a sibling module.
 */
export const hostSpecifiers = (compilation: Compilation, dtsFile: string): string[] => {
  const out: string[] = []
  const from = dirname(resolvePath(compilation.workingDir, dtsFile))
  for (const unit of compilation.modules) {
    const source = unit.checker.program.source
    if (!source.host) {
      continue
    }
    const target = relativePath(from, resolvePath(compilation.workingDir, source.path))
    const stem = target.endsWith(".ts") ? target.substring(0, target.length - 3) : target
    out.push(stem.startsWith("../") ? stem : `./${stem}`)
  }
  return out
}

/**
 * A host function's argument as the page should see it, from the i32 or i64
 * the module passes: a `boolean` is the `i1` the caller zero-extended, so
 * `!== 0` reads it; a `u32` or `u64` is the full width but arrives signed, so
 * it is read unsigned as an export's result is (`wasmUnsignedOut`). A `u8` and
 * a `u16` need nothing: the declaration's `zeroext` makes the module widen
 * them, so the number is already in range.
 */
const hostArgument = (table: TypeTable, t: i32, value: string): string => {
  const kind = table.kindOf(t)
  if (kind === T_BOOL) {
    return `${value} !== 0`
  }
  if (kind === T_U32 || kind === T_U64) {
    return wasmUnsignedOut(table, t, value)
  }
  return value
}

/**
 * A host function's result as the module may assume it: a `boolean` as `1` or
 * `0` and a `u8` or `u16` masked, since the declaration promises the module a
 * zero-extended value; a ranged integer checked, since the module assumes its
 * range. Every other width crosses as ToInt32, ToBigInt64 or a float
 * conversion makes it, which is the language's wrapping already.
 */
const hostResult = (table: TypeTable, sig: FunctionSig, call: string): string => {
  const t = sig.returnType
  if (table.isRanged(t)) {
    return `rangeOut(${call}, ${table.rangeLo(t)}, ${table.rangeHi(t)}, "host.${sig.name}")`
  }
  const kind = table.kindOf(t)
  if (kind === T_BOOL) {
    return `${call} ? 1 : 0`
  }
  if (kind === T_U8 || kind === T_U16) {
    return `${call} & ${wasmUnsignedIn(table, t)}`
  }
  return call
}

/**
 * `importsOf`, the loader's half of a host module: the import object the
 * module links against, with the page's functions under `host`. A function
 * whose values all cross as they stand is passed by reference, so a call is
 * the page's function and nothing else; any other is wrapped in one closure,
 * made here, once per load, which converts and allocates nothing on a call.
 * A missing or non-function export is a `TypeError` at load, before the
 * module runs, rather than a call that fails later.
 */
const hostImportsOf = (table: TypeTable, hosts: FunctionSig[]): string[] => {
  const lines: string[] = []
  lines.push("/**")
  lines.push(" * The import object the module links against: the page's host functions under")
  lines.push(" * `host`, each passed by reference, or wrapped once here where a value converts.")
  lines.push(" */")
  lines.push("function importsOf(imports, state) {")
  lines.push("  const host = imports === undefined || imports === null ? undefined : imports.host;")
  lines.push('  if (host === undefined || host === null || typeof host !== "object")')
  lines.push(
    '    throw new TypeError("imports.host must be the host module: import * as host from it and pass { host }");'
  )
  lines.push("  const hostFn = (name) => {")
  lines.push("    const fn = host[name];")
  lines.push(
    '    if (typeof fn !== "function") throw new TypeError("imports.host." + name + " must be a function");'
  )
  lines.push("    return fn;")
  lines.push("  };")
  let ranged = false
  for (const sig of hosts) {
    if (table.isRanged(sig.returnType)) {
      ranged = true
    }
  }
  if (ranged) {
    lines.push("  /** A ranged result, which the module assumes is in its range. */")
    lines.push("  const rangeOut = (value, lo, hi, what) => {")
    lines.push("    if (!Number.isInteger(value) || value < lo || value > hi)")
    lines.push('      throw new RangeError(what + " must return an integer in [" + lo + ", " + hi + "]");')
    lines.push("    return value;")
    lines.push("  };")
  }
  if (hostsLendWindows(table, hosts)) {
    lines.push("  /** Whole-memory views a window indexes, made again only when memory grows. */")
    lines.push("  let windowBuffer = null;")
    lines.push("  let windows = null;")
    lines.push("  const win = () => {")
    lines.push(
      '    if (state.memory === null) throw new Error("a host import lent a window before the module finished loading");'
    )
    lines.push("    const b = state.memory.buffer;")
    lines.push("    if (b !== windowBuffer) {")
    lines.push("      windowBuffer = b;")
    lines.push("      windows = {")
    lines.push("        u8: new Uint8Array(b),")
    lines.push("        u16: new Uint16Array(b),")
    lines.push("        u32: new Uint32Array(b),")
    lines.push("        i32: new Int32Array(b),")
    lines.push("        f32: new Float32Array(b),")
    lines.push("        f64: new Float64Array(b),")
    lines.push("      };")
    lines.push("    }")
    lines.push("    return windows;")
    lines.push("  };")
  }
  const entries: string[] = []
  for (const sig of hosts) {
    pushHostEntry(table, sig, lines, entries)
  }
  lines.push("  return {")
  lines.push("    ...imports,")
  lines.push("    nish: { panic: panicOf(state) },")
  lines.push("    host: {")
  pushAll(lines, entries)
  lines.push("    },")
  lines.push("  };")
  lines.push("}")
  lines.push("")
  return lines
}

/**
 * The `host` entry for one host function, into `entries`: the page's own
 * function when nothing converts, else an adapter over it, whose binding goes
 * into `lines`.
 */
const pushHostEntry = (table: TypeTable, sig: FunctionSig, lines: string[], entries: string[]): void => {
  const args: string[] = []
  const passed: string[] = []
  let i = 0
  while (i < sig.paramTypes.length) {
    args.push(`a${i}`)
    const window = windowView(table, sig.paramTypes[i])
    if (window !== "" && i + 1 < sig.paramTypes.length) {
      // WP50 S3 (§5.3): the page indexes a view of all memory, so the data
      // pointer becomes an element index and `at` is counted from it.
      args.push(`a${i + 1}`)
      passed.push(`win().${window}`)
      // `at` is a `u32` (`checkHostSignature`), so `hostArgument` would read it as `>>> 0`.
      passed.push(`(a${i} >>> ${windowShift(window)}) + (a${i + 1} >>> 0)`)
      i = i + 2
      continue
    }
    passed.push(hostArgument(table, sig.paramTypes[i], `a${i}`))
    i = i + 1
  }
  const call = `host_${sig.name}(${passed.join(", ")})`
  const body = hostResult(table, sig, call)
  if (body === `host_${sig.name}(${args.join(", ")})`) {
    entries.push(`      ${sig.name}: hostFn("${sig.name}"),`)
    return
  }
  lines.push(`  const host_${sig.name} = hostFn("${sig.name}");`)
  entries.push(`      ${sig.name}: (${args.join(", ")}) => ${body},`)
}

/** Whether any host function takes a buffer window (`win` is emitted only then). */
const hostsLendWindows = (table: TypeTable, hosts: FunctionSig[]): boolean => {
  for (const sig of hosts) {
    for (const t of sig.paramTypes) {
      if (isHostWindow(table, t)) {
        return true
      }
    }
  }
  return false
}

/** The `win()` view a window of type `t` indexes, or empty for any other type. */
const windowView = (table: TypeTable, t: i32): string => {
  if (!isHostWindow(table, t)) {
    return ""
  }
  const e = table.refOf(t)
  if (e === T_U8) {
    return "u8"
  }
  if (e === T_U16) {
    return "u16"
  }
  if (e === T_U32) {
    return "u32"
  }
  if (e === T_I32) {
    return "i32"
  }
  return e === T_F32 ? "f32" : "f64"
}

/** log2 of a window view's element size: the shift from a byte address to its index. */
const windowShift = (view: string): i32 => {
  if (view === "u8") {
    return 0
  }
  if (view === "u16") {
    return 1
  }
  return view === "f64" ? 3 : 2
}

// ---- WP50 S3: the layout of module storage ------------------------------------

/** One field of a record storage's element: its name, type and byte offset. */
export class StorageField {
  name: string
  type: string
  offset: i32
  /** A `boolean`: one byte the TypeScript reading answers `true` or `false` for. */
  flag: boolean

  constructor(name: string, offset: i32, type: string, flag: boolean) {
    this.name = name
    this.offset = offset
    this.type = type
    this.flag = flag
  }
}

/**
 * One module storage as the page sees it (`docs/wp50-wasm-host.md` §5.2): the
 * key `layout` names it by, the symbol whose `.data` the link exports, its
 * length and stride, and either the typed array one element reads as or the
 * fields of a record element.
 */
export class StorageLayout {
  key: string
  symbol: string
  length: i32
  stride: i32
  /** `Float32Array` and the like for a scalar element; empty for a record. */
  view: string
  /** A scalar storage of `boolean`s, read by the TypeScript reading as `true` or `false`. */
  flag: boolean
  fields: StorageField[]
  /** The index of the declaring module in the compilation, and the id of its `new` there: where `--emit-ts` writes the view. */
  module: i32
  newId: i32

  constructor(key: string, symbol: string, length: i32, stride: i32, view: string, flag: boolean) {
    this.key = key
    this.symbol = symbol
    this.length = length
    this.stride = stride
    this.view = view
    this.flag = flag
    this.fields = []
    this.module = -1
    this.newId = -1
  }
}

/**
 * The typed array that reads one slot of `t`, by its LLVM width and
 * signedness: a `boolean` is the byte, an enum or range the signed `i32`, and
 * a `HostHandle` the unsigned `u32` slot the page indexes its table with.
 */
const storageView = (table: TypeTable, t: i32): string => {
  const llvm = table.llvmType(t)
  if (llvm === "float") {
    return "Float32Array"
  }
  if (llvm === "double") {
    return "Float64Array"
  }
  const unsigned =
    t === T_U8 || t === T_U16 || t === T_U32 || t === T_U64 || t === T_BOOL || table.isHostHandle(t)
  if (llvm === "i8" || llvm === "i1") {
    return unsigned ? "Uint8Array" : "Int8Array"
  }
  if (llvm === "i16") {
    return unsigned ? "Uint16Array" : "Int16Array"
  }
  if (llvm === "i64") {
    return unsigned ? "BigUint64Array" : "BigInt64Array"
  }
  return unsigned ? "Uint32Array" : "Int32Array"
}

/**
 * Every module storage of the program, in module order then declaration
 * order: what `--emit-dts` spells as `Layout` and the loader fills. A name two
 * modules both use keeps the first and spells the second by its symbol. Empty
 * for a program with no storage, which is what keeps its sidecars as they were.
 */
export const storageLayouts = (compilation: Compilation): StorageLayout[] => {
  const table = compilation.table
  const out: StorageLayout[] = []
  const keys = new StringSet()
  let index = 0
  for (const unit of compilation.modules) {
    const program = unit.checker.program
    index = index + 1
    for (const info of program.constantList) {
      if (!info.storage || info.origin !== program.source || info.storageElem < 0) {
        continue
      }
      const key = keys.has(info.name) ? info.storageSymbol : info.name
      keys.add(key)
      const length = toI32(info.intValue)
      const stride = elementStride(program, table, info.storageElem)
      const record = inlineElementStruct(program, table, info.storageElem)
      const layout = new StorageLayout(
        key,
        info.storageSymbol,
        length,
        stride,
        record === null ? storageView(table, info.storageElem) : "",
        info.storageElem === T_BOOL
      )
      layout.module = index - 1
      layout.newId = unwrapParens(info.decl.children[2]).id
      if (record !== null) {
        // Built as a local and assigned whole: a push through `layout.fields`
        // reads as a write to shared memory, and the checker's witness for it
        // would then depend on which entry program loaded this module.
        const fields: StorageField[] = []
        for (const field of record.fields) {
          fields.push(
            new StorageField(field.name, field.offset, storageView(table, field.type), field.type === T_BOOL)
          )
        }
        layout.fields = fields
      }
      out.push(layout)
    }
  }
  return out
}

/** The whole-memory typed arrays `views()` answers, by key, each one the page indexes by byte address over its width. */
const heapViews = (): string[] => [
  "u8: Uint8Array",
  "i8: Int8Array",
  "u16: Uint16Array",
  "i16: Int16Array",
  "u32: Uint32Array",
  "i32: Int32Array",
  "f32: Float32Array",
  "f64: Float64Array",
  "i64: BigInt64Array",
  "u64: BigUint64Array",
]

/** `heapViews` as the loader makes them, each over `buffer`; the TypeScript reading makes the same. */
export const heapViewsNew = (): string[] => [
  "u8: new Uint8Array(buffer)",
  "i8: new Int8Array(buffer)",
  "u16: new Uint16Array(buffer)",
  "i16: new Int16Array(buffer)",
  "u32: new Uint32Array(buffer)",
  "i32: new Int32Array(buffer)",
  "f32: new Float32Array(buffer)",
  "f64: new Float64Array(buffer)",
  "i64: new BigInt64Array(buffer)",
  "u64: new BigUint64Array(buffer)",
]

/** `Layout` and `Views` for the `.d.ts` (§5.2): the literal-typed layout of every storage. */
export const layoutTypes = (layouts: StorageLayout[]): string[] => {
  const lines: string[] = []
  lines.push("/**")
  lines.push(" * Where module storage lives in `memory` (WP50 §5.2). `length`, `stride` and")
  lines.push(" * each field's byte offset are literal types, so a page that hard-codes one")
  lines.push(" * fails `tsc` once the layout changes. `at` is the byte address of the data,")
  lines.push(" * read from the instance at load; it never moves.")
  lines.push(" */")
  lines.push("export interface Layout {")
  for (const s of layouts) {
    if (s.view !== "") {
      lines.push(`  ${s.key}: { at: number; length: ${s.length}; stride: ${s.stride} };`)
      continue
    }
    const fields: string[] = []
    for (const f of s.fields) {
      fields.push(`${f.name}: ${f.offset}`)
    }
    lines.push(
      `  ${s.key}: { at: number; length: ${s.length}; stride: ${s.stride}; fields: { ${fields.join("; ")} } };`
    )
  }
  lines.push("}")
  lines.push("")
  lines.push("/**")
  lines.push(" * Typed arrays over the current `memory.buffer`: one per width over the whole")
  lines.push(" * memory, indexed by byte address over the width (`f32[(at + i * stride + off) >> 2]`),")
  lines.push(" * and one per scalar storage, indexed by element. `views()` answers the same")
  lines.push(" * object until memory grows; compare `buffer` with `memory.buffer` to know.")
  lines.push(" */")
  lines.push("export interface Views {")
  lines.push("  readonly buffer: ArrayBuffer;")
  for (const entry of heapViews()) {
    lines.push(`  readonly ${entry};`)
  }
  lines.push("  readonly storage: {")
  for (const s of layouts) {
    if (s.view !== "") {
      lines.push(`    readonly ${s.key}: ${s.view};`)
    }
  }
  lines.push("  };")
  lines.push("}")
  lines.push("")
  return lines
}

/**
 * The loader's half of §5.2, inside `exportsOf`: `layout` with each `at` read
 * from the exported `<symbol>.data` global, and `views()`, rebuilt only when
 * a grow replaced `memory.buffer`.
 */
const layoutLoader = (layouts: StorageLayout[], memory: string): string[] => {
  const lines: string[] = []
  lines.push("  const layout = {")
  for (const s of layouts) {
    const fields: string[] = []
    for (const f of s.fields) {
      fields.push(`${f.name}: ${f.offset}`)
    }
    const tail = s.view === "" ? `, fields: { ${fields.join(", ")} }` : ""
    lines.push(
      `    ${s.key}: { at: raw["${s.symbol}.data"].value, length: ${s.length}, stride: ${s.stride}${tail} },`
    )
  }
  lines.push("  };")
  lines.push("  let cached = null;")
  lines.push("  /** Typed arrays over the current buffer; the same object until memory grows. */")
  lines.push("  const views = () => {")
  lines.push(`    const buffer = ${memory}.buffer;`)
  lines.push("    if (cached !== null && cached.buffer === buffer) return cached;")
  lines.push("    cached = {")
  lines.push("      buffer,")
  for (const entry of heapViewsNew()) {
    lines.push(`      ${entry},`)
  }
  lines.push("      storage: {")
  for (const s of layouts) {
    if (s.view !== "") {
      lines.push(`        ${s.key}: new ${s.view}(buffer, layout.${s.key}.at, ${s.length}),`)
    }
  }
  lines.push("      },")
  lines.push("    };")
  lines.push("    return cached;")
  lines.push("  };")
  return lines
}
