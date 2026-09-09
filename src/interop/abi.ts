/**
 * Shared ground for the interop generators (WP8): which functions a host can
 * call, and how a StaticType is spelled in C, N-API and TypeScript.
 *
 * Everything is derived from the `Compilation` the emitter already used, so
 * the header, the `.d.ts` and the N-API shim describe exactly the symbols
 * and signatures that ended up in the IR. Nothing here mutates the program.
 */
import path from "node:path";
import { CLI } from "../branding.js";
import { FunctionSig } from "../checker/index.js";
import { FunctionFacts, analyzeFunctions } from "../codegen/attributes.js";
import { Compilation, ModuleUnit } from "../compilation.js";
import { ResultType, StaticType, isReadonlyArray, resultByValue, resultStructName } from "../types.js";
import { ResultLayout, resultLayout, resultTypesIn } from "../checker/result.js";

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
 * is excluded: it is emitted as `@amrit_main` behind the process entry
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
    if (kindOf(p.type) !== "array") continue;
    // A `readonly T[]` is `const` because its type says so, and the fixpoint is
    // never consulted for one. That is not a shortcut: `writesThrough` is a
    // conservative *may-write* — `noteUse` sets it for every escape, on the
    // grounds that an alias may be written through later — so a `readonly`
    // parameter that is merely returned or stored in a field would land here
    // and lose the `const` its annotation promised. The checker is the thing
    // that makes the promise true (no store, no `push`, no `pop`, and no
    // widening back to a mutable `T[]`), and it is exact where this is not.
    if (isReadonlyArray(p.type)) continue;
    if (!facts?.pointerParams.get(p.name)?.writesThrough) continue;
    written.add(p.name);
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
  /** `Int32Array`, `Float32Array`, `Float64Array`, `BigInt64Array`: the language's alias and the JS constructor. */
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
      return position === "param" ? "const amrit_str *" : "amrit_str *";
    case "array":
      // One header type for every element type (the comment above the
      // prototype names it). `const` is the `readonly` proof from attributes.ts.
      return position === "param" && !written ? "const amrit_array *" : "amrit_array *";
    case "void":
      return "void";
    case "struct":
      // A class or interface value is a pointer to its `struct` (declared in the
      // header with the flattened fields, WP2/WP2b); a `T | null` is the same
      // pointer, possibly NULL.
      return `struct ${(t as { name: string }).name} *`;
    case "nullable":
      return cType((t as { inner: StaticType }).inner, position);
    // WP17: a `Result` small enough to pack travels *by value* — in either
    // direction — as the one-word struct `cResultWord` declares, which is the
    // declaration clang itself lowers to `i64` on every native target, so the
    // header is the ABI rather than a description of it. Every other `Result`
    // is the arena pointer WP16 has always used
    // (`docs/wp17-result-abi.md` §3).
    case "result":
      return resultByValue(t) ? cResultWord(t) : `struct ${cResultName(t)} *`;
    default:
      return undefined;
  }
}

/**
 * The LLVM struct name as a C identifier: `amrit_result.i32.$IoError` becomes
 * `amrit_result_i32__IoError`. Both `.` and `$` become `_`, and that stays
 * unambiguous because `mangleType` only ever writes `$` straight after a
 * separator: `Result<i32, string>` is `..._i32_str` and a `Result` over a
 * class called `str` is `..._i32__str`, since its `.$` collapses to two.
 */
export function cResultName(t: StaticType): string {
  return resultStructName(t).replace(/[.$]/g, "_");
}

/** The by-value spelling: one 64-bit word, `_word` as in the DWARF and the note. */
export function cResultWord(t: StaticType): string {
  return `${cResultName(t)}_word`;
}

/**
 * C spelling of a struct field. Everything a field can hold has one: the
 * scalars, `amrit_str *`, a pointer to another struct, and `amrit_array *` for
 * `T[]` (the header type from amritc.h; the element type is a comment).
 */
export function cFieldType(t: StaticType): string {
  if (kindOf(t) === "array") return "amrit_array *";
  // A field holds the in-memory `Result`, never the packed return word.
  if (kindOf(t) === "result") return `struct ${cResultName(t)} *`;
  return cType(t, "return") ?? "void *";
}

/**
 * Which C definitions the `Result` types of these signatures need, in the
 * order a header can emit them (a payload before the `Result` that carries
 * it). `word` is set for a type that travels by value somewhere — a return or
 * a parameter — `object` for one that appears as a pointer: a large `Result`
 * either way, a class field, or a payload of another `Result`. Both can be
 * true of one type.
 */
export interface ResultUse {
  type: ResultType;
  layout: ResultLayout;
  word: boolean;
  object: boolean;
}

export function resultTypesUsed(
  fns: readonly ExternalFunction[],
  fields: readonly StaticType[] = []
): ResultUse[] {
  const uses = new Map<string, ResultUse>();
  const note = (t: StaticType, byValue: boolean): void => {
    for (const inner of resultTypesIn(t)) {
      const name = cResultName(inner);
      const use = uses.get(name) ?? { type: inner as ResultType, layout: resultLayout(inner), word: false, object: false };
      // Only the outermost type of a by-value return travels in a register;
      // anything nested inside it is a payload, and a payload is a pointer.
      if (byValue && inner === t) use.word = true;
      else use.object = true;
      uses.set(name, use);
    }
  };
  for (const fn of fns) {
    if (fn.sig.name === "main") continue;
    note(fn.sig.returnType, resultByValue(fn.sig.returnType));
    for (const p of fn.sig.params) note(p.type, resultByValue(p.type));
  }
  // A class field holding a `Result` is the pointer too, and the header
  // declares its struct so a host can follow it rather than being left with an
  // incomplete type.
  for (const t of fields) note(t, false);
  return [...uses.values()];
}

/**
 * True for the types that reach JavaScript as a plain `number`, with no
 * marshalling and no other JS type standing in for them. `u8`/`u16`/`u32` and
 * `f32` join `i32` and `f64` because they all fit a `number` exactly; `i64`
 * and `u64` do not, and cross as a `bigint` instead, which is why they are
 * false here even though the bridges carry them.
 *
 * This is a question about the JS *type*, not about what a bridge supports:
 * the N-API shim has a reader and a boxer for every one of these widths (and
 * for the two bigint ones), and `--emit-dts` spells them all `number` too.
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
 * The source keyword for a type, as the user wrote it (`number` for i32/f64;
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
      // The comment above the prototype is the signature as it was written, so
      // a `readonly T[]` says so: it is what makes the `const` on the C
      // parameter beside it read as the promise the source made.
      return `${isReadonlyArray(t) ? "readonly " : ""}${tsKeyword((t as { elem: StaticType }).elem)}[]`;
    case "nullable":
      return `${tsKeyword((t as { inner: StaticType }).inner)} | null`;
    // WP17: the type as the programmer wrote it, for the comment above the
    // declaration; `cType` / `wasmType` decide how it actually crosses.
    case "result": {
      const r = t as { ok: StaticType; err: StaticType };
      return `Result<${tsKeyword(r.ok)}, ${tsKeyword(r.err)}>`;
    }
    default:
      return kindOf(t);
  }
}

/**
 * Identifiers that are legal parameter names in the language but would not survive
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
  "template", "this", "throw", "try", "typename", "using", "virtual", "xor", "amrit_str", "amrit_arena", "amrit_array",
  "env", "info", "argv", "argc", "type", "out", "result", "mark",
]);

export function cParamName(name: string): string {
  return C_RESERVED.has(name) ? `${name}_` : name;
}

/**
 * C identifier for a compiled function. A name that is a C keyword (`double`,
 * `int`, ...) is a perfectly good LLVM symbol but cannot be spelled in C, so
 * it is declared as `name_` bound to the real symbol with an asm label
 * (`AMRIT_SYMBOL`, from amritc.h; it adds the `_` prefix Mach-O needs).
 * Methods and constructors (`Point.shifted`, `Point.constructor`, WP2) are
 * declared the same way as `Point_shifted` / `Point_constructor`, taking the
 * object pointer first: a C host may call them on objects it holds.
 */
export function cFunctionName(symbol: string): { ident: string; label: string } {
  if (symbol.includes(".")) return { ident: symbol.replace(/\./g, "_"), label: ` AMRIT_SYMBOL("${symbol}")` };
  if (!C_RESERVED.has(symbol)) return { ident: symbol, label: "" };
  return { ident: `${symbol}_`, label: ` AMRIT_SYMBOL("${symbol}")` };
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

/** `// Generated by amritc --emit-x from main.ts; do not edit.` (the CLI names itself). */
export function banner(compilation: Compilation, flag: string, comment: (text: string) => string): string {
  return comment(`Generated by ${CLI} ${flag} from ${compilation.entry.fileName}; do not edit.`);
}

/**
 * `Result` definitions (WP17). Two shapes, and a signature uses whichever its
 * position calls for:
 *
 *   `struct amrit_result_<T>_<E>`      the arena object WP16 has always had —
 *                                    `{ ok, value, error }` at the offsets the
 *                                    checker derived, which is exactly what
 *                                    clang lays this same declaration out as
 *   `amrit_result_<T>_<E>_word`        the packed by-value form, in either
 *                                    direction: a 32-bit discriminant and the
 *                                    arm it selects, one 64-bit word
 *
 * The word is not a description of the ABI, it *is* the ABI: clang lowers a
 * function returning this type to `i64` on every supported native target, so
 * a host that includes this header and a module the emitter wrote agree by
 * construction. `docs/wp17-result-abi.md` §3 has the four `declare` lines.
 * The `sizeof` assertion is there so a compiler that disagreed would fail the
 * build rather than mis-read a register.
 */
export function resultDefinitions(
  fns: readonly ExternalFunction[],
  fields: readonly StaticType[] = []
): string[] {
  const uses = resultTypesUsed(fns, fields);
  if (uses.length === 0) return [];
  const lines = [
    "",
    "/* `Result<T, E>` (WP16/WP17). A `Result` small enough to travel in a",
    " * register — returned or passed — is the `_word` struct: read `ok`, then",
    " * `as.value` or `as.error`. Every other `Result` is a pointer to the arena",
    " * object, valid until amrit_reset_arena() / amrit_arena_release() like every",
    " * other arena value. */",
    "#if defined(__cplusplus)",
    "#define AMRIT_RESULT_ASSERT(c, m) static_assert(c, m)",
    "#elif defined(__STDC_VERSION__) && __STDC_VERSION__ >= 201112L",
    "#define AMRIT_RESULT_ASSERT(c, m) _Static_assert(c, m)",
    "#else",
    "#define AMRIT_RESULT_ASSERT(c, m) /* pre-C11: no static assertion available */",
    "#endif",
  ];
  for (const use of uses) lines.push("", ...resultDefinition(use));
  return lines;
}

function resultDefinition(use: ResultUse): string[] {
  const { type, layout } = use;
  const lines = [`/* ${tsKeyword(type)} */`];
  if (use.object) {
    lines.push(`struct ${cResultName(type)} {`, "  bool ok; /* 1 = value, 0 = error */");
    if (layout.value) lines.push(`  ${field(layout.value.type, "value")}`);
    lines.push(`  ${field(layout.error.type, "error")}`, "};");
  }
  if (use.word) {
    const arms = [
      ...(layout.value ? [field(layout.value.type, "value")] : []),
      field(layout.error.type, "error"),
    ].join(" ");
    const name = cResultWord(type);
    lines.push(
      `typedef struct ${name} {`,
      "  int32_t ok; /* 1 = value, 0 = error */",
      `  union { ${arms} } as; /* the arm \`ok\` selects; the other is not written */`,
      `} ${name};`,
      `AMRIT_RESULT_ASSERT(sizeof(${name}) == 8, "${tsKeyword(type)} travels in one 64-bit register");`
    );
  }
  return lines;
}

/** One member of a `Result` definition; the payload note names the source type. */
function field(t: StaticType, name: string): string {
  const c = cFieldType(t);
  const note = kindOf(t) === "array" || kindOf(t) === "result" ? ` /* ${tsKeyword(t)} */` : "";
  return `${c}${c.endsWith("*") ? "" : " "}${name};${note}`;
}
