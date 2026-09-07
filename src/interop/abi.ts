/**
 * Shared ground for the interop generators (WP8): which functions a host can
 * call, and how a StaticType is spelled in C, N-API and TypeScript.
 *
 * Everything is derived from the `Compilation` the emitter already used, so
 * the header, the `.d.ts` and the N-API shim describe exactly the symbols
 * and signatures that ended up in the IR. Nothing here mutates the program.
 */
import path from "node:path";
import { FunctionSig } from "../checker";
import { FunctionFacts, analyzeFunctions } from "../codegen/attributes";
import { Compilation, ModuleUnit } from "../compilation";
import { StaticType } from "../types";

export interface ExternalFunction {
  sig: FunctionSig;
  unit: ModuleUnit;
  /**
   * Names of the array parameters the function (or a callee, by the same
   * fixpoint that decides `readonly` in the IR) stores through. Every other
   * array parameter is provably read-only, so C may spell it `const`.
   */
  writtenParams: Set<string>;
}

/**
 * Every function that is an external symbol of the final link, in module and
 * source order: exported functions always, non-exported ones unless
 * `--strict-exports` made them `internal`. The entry `export function main`
 * is excluded: it is emitted as `@sts_main` behind the process entry
 * wrapper and is not a library call.
 */
export function externalFunctions(compilation: Compilation): ExternalFunction[] {
  const out: ExternalFunction[] = [];
  const programs = compilation.modules.map((m) => m.checker.program);
  const facts = analyzeFunctions(programs, compilation.opts);
  for (const unit of compilation.modules) {
    const program = unit.checker.program;
    for (const sig of program.functions) {
      if (sig === program.entryMain) continue;
      if (!sig.exported && compilation.opts.strictExports) continue;
      out.push({ sig, unit, writtenParams: writtenArrayParams(sig, facts.get(sig.name)) });
    }
  }
  return out;
}

function writtenArrayParams(sig: FunctionSig, facts: FunctionFacts | undefined): Set<string> {
  const written = new Set<string>();
  for (const p of sig.params) {
    if (kindOf(p.type) === "array" && facts?.pointerParams.get(p.name)?.writesThrough) written.add(p.name);
  }
  return written;
}

/**
 * How an array with a scalar element type crosses to JavaScript (WP4/WP8):
 * the typed-array constructor whose element layout matches `data` byte for
 * byte, its N-API tag, and the C element type. Undefined for element types
 * JS has no flat view of (booleans would need 0/1 validation; strings,
 * arrays and objects are pointers into the arena).
 */
export interface TypedView {
  /** `Int32Array`, `Float32Array`, `Float64Array`, `BigInt64Array`: the StaticTS alias and the JS constructor. */
  ctor: string;
  elemSize: 4 | 8;
  cElem: string;
  napiType: string;
}

export function typedView(t: StaticType): TypedView | undefined {
  if (kindOf(t) !== "array") return undefined;
  switch (kindOf((t as { elem: StaticType }).elem)) {
    case "i32":
      return { ctor: "Int32Array", elemSize: 4, cElem: "int32_t", napiType: "napi_int32_array" };
    case "f32":
      return { ctor: "Float32Array", elemSize: 4, cElem: "float", napiType: "napi_float32_array" };
    case "f64":
      return { ctor: "Float64Array", elemSize: 8, cElem: "double", napiType: "napi_float64_array" };
    case "i64":
      return { ctor: "BigInt64Array", elemSize: 8, cElem: "int64_t", napiType: "napi_bigint64_array" };
    default:
      return undefined;
  }
}

/**
 * The type kind as a plain string. The type model is owned by another
 * package and may grow (`i64` is planned), so the generators switch on the
 * string and treat anything unknown as "not representable" rather than
 * assuming the union is closed.
 */
export function kindOf(t: StaticType): string {
  return (t as { kind: string }).kind;
}

/**
 * C spelling of a StaticType at a parameter or return position; `undefined`
 * when C has no equivalent. `written` marks an array parameter the callee
 * stores through (`ExternalFunction.writtenParams`); every other array
 * parameter is `const`.
 */
export function cType(t: StaticType, position: "param" | "return", written = false): string | undefined {
  switch (kindOf(t)) {
    case "i32":
      return "int32_t";
    case "i64":
      return "int64_t";
    // WP15: the unsigned widths are the <stdint.h> twins of the signed ones;
    // the LLVM type is the same, so the C prototype is the only place the
    // signedness of a parameter is visible to a host.
    case "u8":
      return "uint8_t";
    case "u16":
      return "uint16_t";
    case "u32":
      return "uint32_t";
    case "u64":
      return "uint64_t";
    case "f32":
      return "float";
    case "f64":
      return "double";
    case "bool":
      return "bool";
    case "string":
      // Strings are immutable, so a callee can promise not to write through
      // a parameter; a returned string is arena-owned and not const.
      return position === "param" ? "const sts_str *" : "sts_str *";
    case "array":
      // One header type for every element type (the comment above the
      // prototype names it). `const` is the `readonly` proof from attributes.ts.
      return position === "param" && !written ? "const sts_array *" : "sts_array *";
    case "void":
      return "void";
    case "struct":
      // A class or interface value is a pointer to its `struct` (declared in the
      // header with the flattened fields, WP2/WP2b); a `T | null` is the same
      // pointer, possibly NULL.
      return `struct ${(t as { name: string }).name} *`;
    case "nullable":
      return cType((t as { inner: StaticType }).inner, position);
    default:
      return undefined;
  }
}

/**
 * C spelling of a struct field. Everything a field can hold has one: the
 * scalars, `sts_str *`, a pointer to another struct, and `sts_array *` for
 * `T[]` (the header type from statictsc.h; the element type is a comment).
 */
export function cFieldType(t: StaticType): string {
  if (kindOf(t) === "array") return "sts_array *";
  return cType(t, "return") ?? "void *";
}

/**
 * True for the types the scalar-only bridges (N-API shim, wasm typings) can
 * pass without marshalling. `u8`/`u16`/`u32` and `f32` join `i32` and `f64`
 * because they all fit a JavaScript `number`; `i64` and `u64` do not, and stay
 * out exactly as `i64` always has.
 *
 * TODO(WP8): the N-API shim keeps its own reader table and has no unsigned
 * row yet, so a function with an unsigned parameter is skipped by the addon
 * generator rather than bridged. The C header and the wasm `.d.ts` do carry
 * the unsigned widths.
 */
export function isScalar(t: StaticType): boolean {
  const k = kindOf(t);
  return k === "i32" || k === "u8" || k === "u16" || k === "u32" || k === "f32" || k === "f64" || k === "bool" || k === "void";
}

/** TypeScript source spelling of a signature, for comments and declarations. */
export function tsSignature(sig: FunctionSig, tsType: (t: StaticType) => string): string {
  const params = sig.params.map((p) => `${p.name}: ${tsType(p.type)}`).join(", ");
  return `${sig.sourceName}(${params}): ${tsType(sig.returnType)}`;
}

/**
 * The StaticTS keyword for a type, as the user wrote it (`number` for i32/f64;
 * arrays as `number[]`, `i64[]`, ... since `Int32Array` and `i32[]` are one type).
 */
export function tsKeyword(t: StaticType): string {
  switch (kindOf(t)) {
    case "i32":
    case "f64":
      return "number";
    case "bool":
      return "boolean";
    case "struct":
      return (t as { name: string }).name;
    case "array":
      return `${tsKeyword((t as { elem: StaticType }).elem)}[]`;
    case "nullable":
      return `${tsKeyword((t as { inner: StaticType }).inner)} | null`;
    // WP16: a `Result` has no host spelling yet (its layout is monomorphised
    // and the C ABI for returning one by value is not settled), so the
    // generators skip the function and name the type in the note they leave.
    case "result": {
      const r = t as { ok: StaticType; err: StaticType };
      return `Result<${tsKeyword(r.ok)}, ${tsKeyword(r.err)}>`;
    }
    default:
      return kindOf(t);
  }
}

/**
 * Identifiers that are legal StaticTS parameter names but would not survive
 * a C or C++ compiler (keywords, and the macros <stdbool.h> defines). A
 * colliding name gets a trailing underscore; the C ABI does not care about
 * parameter names, only the header reader does.
 */
const C_RESERVED = new Set([
  "auto", "bool", "break", "case", "char", "const", "continue", "default", "do", "double", "else", "enum",
  "extern", "false", "float", "for", "goto", "if", "inline", "int", "long", "register", "restrict", "return",
  "short", "signed", "sizeof", "static", "struct", "switch", "true", "typedef", "union", "unsigned", "void",
  "volatile", "while", "_Bool", "alignas", "alignof", "and", "asm", "catch", "class", "delete", "explicit",
  "export", "friend", "mutable", "namespace", "new", "not", "operator", "or", "private", "protected", "public",
  "template", "this", "throw", "try", "typename", "using", "virtual", "xor", "sts_str", "sts_arena", "sts_array",
  "env", "info", "argv", "argc", "type", "out", "result", "mark",
]);

export function cParamName(name: string): string {
  return C_RESERVED.has(name) ? `${name}_` : name;
}

/**
 * C identifier for a StaticTS function. A name that is a C keyword (`double`,
 * `int`, ...) is a perfectly good LLVM symbol but cannot be spelled in C, so
 * it is declared as `name_` bound to the real symbol with an asm label
 * (`STS_SYMBOL`, from statictsc.h; it adds the `_` prefix Mach-O needs).
 * Methods and constructors (`Point.shifted`, `Point.constructor`, WP2) are
 * declared the same way as `Point_shifted` / `Point_constructor`, taking the
 * object pointer first: a C host may call them on objects it holds.
 */
export function cFunctionName(symbol: string): { ident: string; label: string } {
  if (symbol.includes(".")) return { ident: symbol.replace(/\./g, "_"), label: ` STS_SYMBOL("${symbol}")` };
  if (!C_RESERVED.has(symbol)) return { ident: symbol, label: "" };
  return { ident: `${symbol}_`, label: ` STS_SYMBOL("${symbol}")` };
}

/** `int32_t add(int32_t a, int32_t b)` for a signature, or `undefined` when a type has no C spelling. */
export function cPrototype(sig: FunctionSig, writtenParams: ReadonlySet<string> = new Set()): string | undefined {
  const ret = cType(sig.returnType, "return");
  if (ret === undefined) return undefined;
  const params: string[] = [];
  for (const p of sig.params) {
    const t = cType(p.type, "param", writtenParams.has(p.name));
    if (t === undefined) return undefined;
    params.push(`${t}${t.endsWith("*") ? "" : " "}${cParamName(p.name)}`);
  }
  const { ident, label } = cFunctionName(sig.name);
  return `${ret}${ret.endsWith("*") ? "" : " "}${ident}(${params.length > 0 ? params.join(", ") : "void"})${label}`;
}

/** `ADD` for `build/add.h`: the stem of an output path as an identifier fragment. */
export function guardStem(outFile: string): string {
  const stem = path.basename(outFile).replace(/\.(h|hpp|d\.ts|c)$/i, "");
  const id = stem.replace(/[^A-Za-z0-9]/g, "_").toUpperCase();
  return /^[0-9]/.test(id) ? `_${id}` : id || "MODULE";
}

/** `// Generated by statictsc --emit-x from main.ts; do not edit.` */
export function banner(compilation: Compilation, flag: string, comment: (text: string) => string): string {
  return comment(`Generated by statictsc ${flag} from ${compilation.entry.fileName}; do not edit.`);
}
