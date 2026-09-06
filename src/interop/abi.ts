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
import { Compilation, ModuleUnit } from "../compilation";
import { StaticType } from "../types";

export interface ExternalFunction {
  sig: FunctionSig;
  unit: ModuleUnit;
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
  for (const unit of compilation.modules) {
    const program = unit.checker.program;
    for (const sig of program.functions) {
      if (sig === program.entryMain) continue;
      if (!sig.exported && compilation.opts.strictExports) continue;
      out.push({ sig, unit });
    }
  }
  return out;
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

/** C spelling of a StaticType at a parameter or return position; `undefined` when C has no equivalent. */
export function cType(t: StaticType, position: "param" | "return"): string | undefined {
  switch (kindOf(t)) {
    case "i32":
      return "int32_t";
    case "i64":
      return "int64_t";
    case "f64":
      return "double";
    case "bool":
      return "bool";
    case "string":
      // Strings are immutable, so a callee can promise not to write through
      // a parameter; a returned string is arena-owned and not const.
      return position === "param" ? "const sts_str *" : "sts_str *";
    case "void":
      return "void";
    default:
      return undefined;
  }
}

/** True for the types the scalar-only bridges (N-API shim, wasm typings) can pass without marshalling. */
export function isScalar(t: StaticType): boolean {
  const k = kindOf(t);
  return k === "i32" || k === "f64" || k === "bool" || k === "void";
}

/** TypeScript source spelling of a signature, for comments and declarations. */
export function tsSignature(sig: FunctionSig, tsType: (t: StaticType) => string): string {
  const params = sig.params.map((p) => `${p.name}: ${tsType(p.type)}`).join(", ");
  return `${sig.sourceName}(${params}): ${tsType(sig.returnType)}`;
}

/** The StaticTS keyword for a type, as the user wrote it (`number` for i32/f64). */
export function tsKeyword(t: StaticType): string {
  switch (kindOf(t)) {
    case "i32":
    case "f64":
      return "number";
    case "bool":
      return "boolean";
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
  "template", "this", "throw", "try", "typename", "using", "virtual", "xor", "sts_str", "sts_arena", "env",
  "info", "argv", "argc",
]);

export function cParamName(name: string): string {
  return C_RESERVED.has(name) ? `${name}_` : name;
}

/**
 * C identifier for a StaticTS function. A name that is a C keyword (`double`,
 * `int`, ...) is a perfectly good LLVM symbol but cannot be spelled in C, so
 * it is declared as `name_` bound to the real symbol with an asm label
 * (`STS_SYMBOL`, from statictsc.h; it adds the `_` prefix Mach-O needs).
 */
export function cFunctionName(symbol: string): { ident: string; label: string } {
  if (!C_RESERVED.has(symbol)) return { ident: symbol, label: "" };
  return { ident: `${symbol}_`, label: ` STS_SYMBOL("${symbol}")` };
}

/** `int32_t add(int32_t a, int32_t b)` for a signature, or `undefined` when a type has no C spelling. */
export function cPrototype(sig: FunctionSig): string | undefined {
  const ret = cType(sig.returnType, "return");
  if (ret === undefined) return undefined;
  const params: string[] = [];
  for (const p of sig.params) {
    const t = cType(p.type, "param");
    if (t === undefined) return undefined;
    params.push(`${t}${t.endsWith("*") ? "" : " "}${cParamName(p.name)}`);
  }
  const { ident, label } = cFunctionName(sig.name);
  return `${ret}${ret.endsWith("*") ? "" : " "}${ident}(${params.length ? params.join(", ") : "void"})${label}`;
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
