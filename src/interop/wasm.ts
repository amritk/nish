/**
 * The companion of `--emit-dts`: a small ES module, `<stem>.mjs` next to the
 * `.d.ts`, whose `load(bytes)` instantiates the wasm build and wraps every
 * export that takes or returns an array (WP4/WP8).
 *
 * A raw wasm export sees an array as an `i32` pointer to the arena header
 * `{ i64 len, i64 cap, i8* data }` (24 bytes on wasm32 too: the 4-byte data
 * pointer sits at offset 16). Per call the wrapper:
 *   1. `amrit_arena_mark()`, so everything below can be released afterwards;
 *   2. for each typed-array argument: `amrit_alloc_array(elemSize, len)` in the
 *      module (runtime/runtime_wasm.c), a typed-array view on `memory.buffer`
 *      at the header's data pointer, `.set(argument)`;
 *   3. the call;
 *   4. an array result: read `len` and `data` from the header, `.slice()` a
 *      copy out (a view would be detached by the next `memory.grow`);
 *      an argument the callee writes through (`fill(xs)`): copy the arena
 *      bytes back into the caller's typed array, so the wasm and N-API builds
 *      agree (N-API borrows the buffer, so writes land directly);
 *   5. `amrit_arena_release(mark)`, in a `finally`, so a trap leaks nothing.
 * `memory.buffer` is re-read after every module call because `memory.grow`
 * detaches the previous ArrayBuffer. String functions are omitted (no WASI
 * runtime).
 *
 * A scalar-only export is passed through untouched unless one of its types is
 * narrower or wider than the wasm value type carrying it. The wasm ABI has
 * only i32 / i64 / f32 / f64, so `u8`, `u16`, `u32` and `u64` all share a
 * value type with a signed one and the loader is the only place their range
 * can be restored: it masks a narrow unsigned argument on the way in and every
 * unsigned result on the way out (`unsignedIn` / `unsignedOut` say why each).
 * `f32` needs neither — the JS-to-wasm call rounds an argument to f32 exactly
 * as an `f32` parameter means, and every f32 is exactly representable in the
 * double a result comes back as.
 */
import path from "node:path";
import { Compilation } from "../compilation";
import { LANGUAGE } from "../branding";
import { FunctionSig } from "../checker";
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

/**
 * JS-visible type of a wasm export value; `undefined` when the value cannot
 * cross. This one table decides *both* what `--emit-dts` declares and what the
 * loader implements: `crossesWasm` is `wasmType(...) !== undefined` and
 * `generateDts` asks `wasmSkipReason`, which asks the same function. They
 * lived apart once and drifted — the declarations grew the unsigned widths
 * while the loader did not, so a `.d.ts` promised a `port(p: number)` the
 * `.mjs` had no entry for — and one table is what makes that unrepresentable.
 *
 * The wasm ABI has four value types, so several source types share one:
 *   i32 / u8 / u16 / u32 / f32 / f64  -> number
 *   i64 / u64                         -> bigint
 *   i1                                -> `WasmBool` (0 | 1) out, `boolean` in
 * The narrowing that share implies is the loader's job, not the declaration's
 * (see `unsignedIn` / `unsignedOut`).
 */
export function wasmType(t: StaticType, position: "param" | "return"): string | undefined {
  switch (kindOf(t)) {
    // WP15: an unsigned width crosses as the wasm value type of its LLVM type,
    // so u8/u16/u32 are a `number` like i32 and u64 is a `bigint` like i64.
    case "i32":
    case "u8":
    case "u16":
    case "u32":
    case "f32":
    case "f64":
      return "number";
    case "i64":
    case "u64":
      return "bigint";
    case "bool":
      return position === "param" ? "boolean" : "WasmBool";
    // Only a result can be `void`; a parameter of that type does not exist,
    // and spelling one `void` would be a declaration the loader cannot honour.
    case "void":
      return position === "return" ? "void" : undefined;
    case "array":
      return typedView(t)?.ctor;
    // WP17: the packed shape, in either direction. The loader is what turns
    // the bigint the export answers into this object, and an argument back.
    case "result":
      return resultByValue(t) ? wasmResultType(t as ResultType) : undefined;
    default:
      return undefined;
  }
}

function crossesWasm(t: StaticType, position: "param" | "return"): boolean {
  return wasmType(t, position) !== undefined;
}

/**
 * Why this function is not on the bridge, or `undefined` when it is. Naming the
 * position and the type is the whole point: a reader of the `.d.ts` sees which
 * argument stopped it rather than the blanket sentence this used to be (and
 * that the N-API shim still writes for its own skips). `--emit-dts` writes it
 * as a comment and the loader omits exactly the same functions, because both
 * ask this.
 */
export function wasmSkipReason(sig: FunctionSig): string | undefined {
  if (sig.name === "main") return "`main` is reserved for a process entry";
  const tail = ` runtime the freestanding wasm profile does not include`;
  const cannot = (what: string, t: StaticType) =>
    `${what} is \`${tsKeyword(t)}\`, which needs the ${LANGUAGE}${tail}`;
  for (let i = 0; i < sig.params.length; i++) {
    const p = sig.params[i];
    if (!crossesWasm(p.type, "param")) return cannot(`argument ${i + 1} (${p.name})`, p.type);
  }
  if (!crossesWasm(sig.returnType, "return")) return cannot("the result", sig.returnType);
  return undefined;
}

/**
 * The mask a narrow unsigned *argument* needs on the way in, or `undefined`
 * when the value crosses as it stands.
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
function unsignedIn(t: StaticType): string | undefined {
  switch (kindOf(t)) {
    case "u8":
      return "0xff";
    case "u16":
      return "0xffff";
    default:
      return undefined;
  }
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
function unsignedOut(t: StaticType, value: string): string {
  switch (kindOf(t)) {
    case "u8":
      return `${value} & 0xff`;
    case "u16":
      return `${value} & 0xffff`;
    case "u32":
      return `${value} >>> 0`;
    case "u64":
      return `BigInt.asUintN(64, ${value})`;
    default:
      return value;
  }
}

/** Whether `unsignedOut` has anything to do, which decides if the export needs a wrapper at all. */
function unsignedResult(t: StaticType): boolean {
  const k = kindOf(t);
  return k === "u8" || k === "u16" || k === "u32" || k === "u64";
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

/**
 * The inverse of `payloadReader`: how the loader puts one payload into the
 * high half of the word. A signed width is masked to 32 bits, `f32` goes
 * through the same bit view as on the way out, and `boolean` is one bit.
 */
function payloadWriter(t: StaticType): string | undefined {
  switch (kindOf(t)) {
    case "i32":
    case "u8":
    case "u16":
    case "u32":
      return "(v) => BigInt.asUintN(32, BigInt(v))";
    case "f32":
      return "f32Word";
    case "bool":
      return "(v) => (v ? 1n : 0n)";
    default:
      return undefined;
  }
}

/** `resultIn(<arg>, <ok writer or null>, <err writer>)` for a by-value `Result` argument. */
function resultPack(arg: string, t: ResultType): string {
  const ok = t.ok.kind === "void" ? "null" : payloadWriter(t.ok)!;
  return `resultIn(${arg}, ${ok}, ${payloadWriter(t.err)!})`;
}

/** True when some bridged signature carries an f32 payload, so the loader needs the bit view. */
function needsF32(fns: readonly ExternalFunction[]): boolean {
  const carriesF32 = (t: StaticType): boolean =>
    t.kind === "result" && (kindOf(t.ok) === "f32" || kindOf(t.err) === "f32");
  return fns.some((fn) => carriesF32(fn.sig.returnType) || fn.sig.params.some((p) => carriesF32(p.type)));
}

/** True when some bridged signature takes or returns a packed `Result`. */
function hasPackedResult(fns: readonly ExternalFunction[]): boolean {
  return fns.some(
    (fn) => resultByValue(fn.sig.returnType) || fn.sig.params.some((p) => resultByValue(p.type))
  );
}

export function wasmBridged(fns: ExternalFunction[]): WasmBridge {
  const bridged = fns.filter((fn) => wasmSkipReason(fn.sig) === undefined);
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
  const masks = sig.params.map((p) => unsignedIn(p.type));
  const out = unsignedResult(sig.returnType);
  const packed = resultByValue(sig.returnType) || sig.params.some((p) => resultByValue(p.type));
  const params = sig.params.map((p) => jsParam(p.name));
  /** One non-array argument: packed, masked to its unsigned width, or as it came. */
  const operand = (i: number): string => {
    const p = sig.params[i];
    if (resultByValue(p.type)) return resultPack(params[i], p.type as ResultType);
    return masks[i] ? `${params[i]} & ${masks[i]}` : params[i];
  };
  /** The call's value as JS should see it. The three cases are mutually exclusive. */
  const returned = (call: string): string => {
    if (ret) return `arrayOut(${call}, ${ret.ctor})`;
    if (resultByValue(sig.returnType)) return resultUnpack(call, sig.returnType as ResultType);
    return unsignedOut(sig.returnType, call);
  };

  if (!ret && views.every((v) => v === undefined)) {
    // WP17/WP15: a packed `Result` and an unsigned width both need converting
    // but no arena scope — nothing was copied into the module for the call, so
    // there is nothing to release.
    if (packed || out || masks.some((m) => m !== undefined)) {
      const call = `raw.${sig.name}(${sig.params.map((_, i) => operand(i)).join(", ")})`;
      return [`${sig.name}: (${params.join(", ")}) => ${returned(call)},`];
    }
    return [`${sig.name}: raw.${sig.name},`];
  }

  const body: string[] = [];
  const args = sig.params.map((p, i) => {
    const v = views[i];
    if (!v) return operand(i);
    body.push(`const ${p.name}$ = arrayIn(${jsParam(p.name)}, ${v.ctor}, ${v.elemSize}, "${sig.sourceName}: argument ${i + 1} (${p.name})");`);
    return `${p.name}$`;
  });
  const isVoid = kindOf(sig.returnType) === "void";
  const value = returned(`raw.${sig.name}(${args.join(", ")})`);
  const copyBacks = sig.params.filter((p, i) => views[i] && fn.writtenParams.has(p.name)).map((p) => `copyBack(${p.name}$, ${jsParam(p.name)});`);
  if (copyBacks.length === 0) body.push(isVoid ? `${value};` : `return ${value};`);
  else body.push(isVoid ? `${value};` : `const result = ${value};`, ...copyBacks, ...(isVoid ? [] : ["return result;"]));
  return [`${sig.name}: (${params.join(", ")}) => scoped(() => {`, ...body.map((l) => `  ${l}`), "}),"];
}

/**
 * The loader's half of WP17. A packed `Result` reaches JS as the wasm export's
 * `i64`, i.e. a bigint: bit 0 is the discriminant and bits 32..63 are the arm
 * it selects. `resultOut` turns that into the object `--emit-dts` declares, so
 * a caller never sees the encoding.
 */
function resultHelpers(bridged: readonly ExternalFunction[]): string[] {
  if (!hasPackedResult(bridged)) return [];
  const lines = [
    "  /** A Result in one i64 (WP17): bit 0 is the tag, bits 32..63 the payload. */",
    "  const resultOut = (word, readValue, readError) => {",
    "    const payload = BigInt.asUintN(32, word >> 32n);",
    "    if ((word & 1n) === 0n) return { ok: false, error: readError(payload) };",
    "    return readValue === null ? { ok: true } : { ok: true, value: readValue(payload) };",
    "  };",
    "  const resultIn = (r, writeValue, writeError) => {",
    '    if (r === null || typeof r !== "object" || typeof r.ok !== "boolean")',
    '      throw new TypeError("expected { ok: true, value } or { ok: false, error }");',
    "    const payload = r.ok ? (writeValue === null ? 0n : writeValue(r.value)) : writeError(r.error);",
    "    return (payload << 32n) | (r.ok ? 1n : 0n);",
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
      "  };",
      "  const f32Word = (v) => {",
      "    f32View[0] = v;",
      "    return BigInt(f32Words[0]);",
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
      "    const hdr = raw.amrit_alloc_array(BigInt(elemSize), BigInt(value.length));",
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
      "    const mark = raw.amrit_arena_mark();",
      "    try {",
      "      return fn();",
      "    } finally {",
      "      raw.amrit_arena_release(mark);",
      "    }",
      "  };",
      ...resultHelpers(bridged),
      "  return {",
      "    memory,",
      "    amrit_reset_arena: raw.amrit_reset_arena,",
      "    amrit_free_arena: raw.amrit_free_arena,"
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
