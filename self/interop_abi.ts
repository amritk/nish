// Shared ground for stage1's interop generators (`src/interop/abi.ts`, WP8):
// which functions a host can call, and how a type is spelled in C, N-API and
// TypeScript.
//
// Every byte these generators write is compared with stage0's by
// `tests/self/interop_oracle.js`, so the text is stage0's to the character.
// Three shapes change and nothing else does:
//
//   - **A type is an `i32`** (`self/types.ts`), so the `kindOf(t)` string
//     switch of `src/` is a switch over the `T_*` / `K_*` ids.
//   - **The empty string stands in for `undefined`.** `cType` answers `""`
//     where `src/` answers `undefined`, and no C type is spelled `""`, so the
//     two readings cannot be confused. `typedView` answers `null` instead,
//     because a `TypedView` is an object and `T | null` is the language's
//     spelling of "or nothing".
//   - **The whole-program fixpoint runs once.** Each generator in `src/`
//     calls `externalFunctions` for itself, which re-runs the attribute
//     analysis three or four times over one program; here `self/compile.ts`
//     runs it once and threads the list, because stage1's arena is never
//     released and that analysis is the most allocation-heavy pass there is.
//
// Nothing here mutates the program: it is all derived from the `Compilation`
// the emitter already used, so the header, the `.d.ts` and the N-API shim
// describe exactly the symbols and signatures that ended up in the IR.

import { analyzeFunctions, AnalysisUnit, FunctionFacts } from "./attributes";
import { CLI } from "./branding";
import { Compilation, ModuleUnit } from "./compilation";
import { StringMap, StringSet } from "./map";
import { ROOT_PACKAGE } from "./packages";
import { basename } from "./paths";
import { FunctionSig } from "./program";
import { ResultLayout, resultLayout } from "./result";
import { StringBuilder } from "./strings";
import {
  K_ARRAY,
  K_NULLABLE,
  K_RESULT,
  K_ENUM,
  K_STRUCT,
  T_BOOL,
  T_F32,
  T_F64,
  T_I32,
  T_I64,
  T_STRING,
  T_U16,
  T_U32,
  T_U64,
  T_U8,
  T_VOID,
  TypeTable,
} from "./types";

/** Where a type is spelled: a parameter may be `const`-qualified, a return is not. */
export const POS_PARAM: i32 = 0;
export const POS_RETURN: i32 = 1;

const CHAR_DOT: i32 = 46;
const CHAR_DOLLAR: i32 = 36;
const CHAR_UNDERSCORE: i32 = 95;
const CHAR_ZERO: i32 = 48;
const CHAR_NINE: i32 = 57;
const CHAR_UPPER_A: i32 = 65;
const CHAR_UPPER_Z: i32 = 90;
const CHAR_LOWER_A: i32 = 97;
const CHAR_LOWER_Z: i32 = 122;
/** `a` - `A`: the one bit that separates the two ASCII cases. */
const CASE_SHIFT: i32 = 32;

/** Append every element of `src` to `dst`; the loop `src/` writes as a spread. */
export const pushAll = (dst: string[], src: string[]): void => {
  for (const line of src) {
    dst.push(line);
  }
};

export class ExternalFunction {
  sig: FunctionSig;
  unit: ModuleUnit;
  /**
   * Names of the array parameters the function (or a callee, by the same
   * fixpoint that decides `readonly` in the IR) stores through. Every other
   * array parameter is provably read-only, so C may spell it `const`.
   */
  writtenParams: StringSet;

  constructor(sig: FunctionSig, unit: ModuleUnit, writtenParams: StringSet) {
    this.sig = sig;
    this.unit = unit;
    this.writtenParams = writtenParams;
  }
}

/**
 * Every function of the *root package* that is an external symbol of the final
 * link, in module and source order: exported functions always, non-exported
 * ones unless `--strict-exports` made them `internal`. The entry
 * `export function main` is excluded: it is emitted as `@nish_main` behind the
 * process entry wrapper and is not a library call, and since WP21 S1 a
 * dependency package's exports are excluded too -- see the comment in the loop.
 *
 * An imported signature is skipped as well. Pass 1b appends it to the
 * importer's `functions` (`self/program.ts`), where `src/` leaves that list
 * holding only what the module declares, so `definedIn` is what keeps an
 * imported symbol from being declared once per importer.
 */
export const externalFunctions = (compilation: Compilation): ExternalFunction[] => {
  const units: AnalysisUnit[] = [];
  for (const unit of compilation.modules) {
    units.push(new AnalysisUnit(unit.checker.program, unit.parents));
  }
  const facts = analyzeFunctions(units, compilation.table, compilation.opts, compilation.runtime);
  const out: ExternalFunction[] = [];
  for (const unit of compilation.modules) {
    const program = unit.checker.program;
    const entryMain = program.entryMain;
    // WP21 S1: a dependency package's `export` is an export to an Nish
    // consumer, not a promise to a C host -- wp21-packages.md sections 1 and 4
    // are explicit that a package's artifact rows are a narrowed projection of
    // what an Nish consumer sees, and that the projection is the embedding
    // program's to choose. So the foreign surface is the root package's, which
    // for every single-package program is all of it and changes nothing.
    //
    // Re-exporting a dependency's function from the root package is how it
    // should reach the C ABI, and that needs `export { f } from`, which the
    // language does not have. So it waits on that construct rather than on a
    // stage of WP21: none of S3, S4 or S5 owns it (wp21-packages.md 10d).
    if (program.packageName !== ROOT_PACKAGE) {
      continue;
    }
    for (const sig of program.functions) {
      if (!sig.definedIn(program.source)) {
        continue;
      }
      if (entryMain !== null && sig === entryMain) {
        continue;
      }
      if (!sig.exported && compilation.opts.strictExports) {
        continue;
      }
      out.push(
        new ExternalFunction(sig, unit, writtenArrayParams(compilation.table, sig, facts.get(sig.name)))
      );
    }
  }
  return out;
};

const writtenArrayParams = (table: TypeTable, sig: FunctionSig, facts: FunctionFacts | null): StringSet => {
  const written = new StringSet();
  if (facts === null) {
    return written;
  }
  let i = 0;
  while (i < sig.paramNames.length) {
    // A `readonly T[]` is `const` because its type says so, and the fixpoint is
    // never consulted for one: `writesThrough` is a conservative *may-write*
    // that every escape sets, so a `readonly` parameter that is only returned
    // or stored would otherwise lose the `const` its annotation promised.
    if (table.isArray(sig.paramTypes[i]) && !table.isReadonlyArray(sig.paramTypes[i])) {
      const pointer = facts.pointerParam(sig.paramNames[i]);
      if (pointer !== null && pointer.writesThrough) {
        written.add(sig.paramNames[i]);
      }
    }
    i = i + 1;
  }
  return written;
};

/**
 * How an array with a scalar element type crosses to JavaScript (WP4/WP8):
 * the typed-array constructor whose element layout matches `data` byte for
 * byte, its N-API tag, and the C element type. `null` for element types JS
 * has no flat view of (booleans would need 0/1 validation; strings, arrays
 * and objects are pointers into the arena).
 *
 * WP15 §2a gave a *record* element type a flat layout too — `data` is a C
 * array of the structs themselves — and it still does not cross, because the
 * missing half was never the layout: JS has no typed array of a struct, so a
 * host would need a per-field unpack loop and a JS object per element, which
 * is marshalling rather than a view. The C header describes the block and the
 * wasm and N-API bridges go on declining these functions.
 */
export class TypedView {
  /** `Int32Array`, `Float32Array`, `Float64Array`, `BigInt64Array`: the language's alias and the JS constructor. */
  ctor: string;
  elemSize: i32;
  cElem: string;
  napiType: string;

  constructor(ctor: string, elemSize: i32, cElem: string, napiType: string) {
    this.ctor = ctor;
    this.elemSize = elemSize;
    this.cElem = cElem;
    this.napiType = napiType;
  }
}

export const typedView = (table: TypeTable, t: i32): TypedView | null => {
  if (table.kindOf(t) !== K_ARRAY) {
    return null;
  }
  switch (table.kindOf(table.refOf(t))) {
    case T_I32:
      return new TypedView("Int32Array", 4, "int32_t", "napi_int32_array");
    case T_F32:
      return new TypedView("Float32Array", 4, "float", "napi_float32_array");
    case T_F64:
      return new TypedView("Float64Array", 8, "double", "napi_float64_array");
    case T_I64:
      return new TypedView("BigInt64Array", 8, "int64_t", "napi_bigint64_array");
    default:
      return null;
  }
};

/**
 * C spelling of a type at a parameter or return position; `""` when C has no
 * equivalent. `written` marks an array parameter the callee stores through
 * (`ExternalFunction.writtenParams`); every other array parameter is `const`.
 */
export const cType = (table: TypeTable, t: i32, position: i32, written: boolean): string => {
  switch (table.kindOf(t)) {
    case T_I32:
      return "int32_t";
    case T_I64:
      return "int64_t";
    // WP15: the unsigned widths are the <stdint.h> twins of the signed ones;
    // the LLVM type is the same, so the C prototype is the only place the
    // signedness of a parameter is visible to a host.
    case T_U8:
      return "uint8_t";
    case T_U16:
      return "uint16_t";
    case T_U32:
      return "uint32_t";
    case T_U64:
      return "uint64_t";
    case T_F32:
      return "float";
    case T_F64:
      return "double";
    case T_BOOL:
      return "bool";
    case T_STRING:
      // Strings are immutable, so a callee can promise not to write through
      // a parameter; a returned string is arena-owned and not const.
      return position === POS_PARAM ? "const nish_str *" : "nish_str *";
    case K_ARRAY:
      // One header type for every element type (the comment above the
      // prototype names it). `const` is the `readonly` proof from attributes.ts.
      return position === POS_PARAM && !written ? "const nish_array *" : "nish_array *";
    case T_VOID:
      return "void";
    case K_STRUCT:
      // A class or interface value is a pointer to its `struct` (declared in the
      // header with the flattened fields, WP2); a `T | null` is the same
      // pointer, possibly NULL.
      return `struct ${cStructName(table.nameOf(t))} *`;
    case K_NULLABLE:
      return cType(table, table.refOf(t), position, false);
    // WP17: a `Result` small enough to pack travels *by value* — in either
    // direction — as the one-word struct `cResultWord` declares, which is the
    // declaration clang itself lowers to `i64` on every native target, so the
    // header is the ABI rather than a description of it. Every other `Result`
    // is the arena pointer WP16 has always used
    // (`docs/wp17-result-abi.md` §3).
    case K_RESULT:
      return table.resultByValue(t) ? cResultWord(table, t) : `struct ${cResultName(table, t)} *`;
    default:
      return "";
  }
};

/**
 * The LLVM struct name as a C identifier: `nish_result.i32.$IoError` becomes
 * `nish_result_i32__IoError`. Both `.` and `$` become `_`, and that stays
 * unambiguous because `mangle` only ever writes `$` straight after a
 * separator: `Result<i32, string>` is `..._i32_str` and a `Result` over a
 * class called `str` is `..._i32__str`, since its `.$` collapses to two.
 */
export const cResultName = (table: TypeTable, t: i32): string => collapseSeparators(table.resultStructName(t), false);

/**
 * `.` and `$` to `_`, and optionally the `_` the user wrote to `_0`. Shared by
 * the two names that cross into C, because they collapse the same characters
 * and differ only in whether their input is entirely the mangler's.
 */
const collapseSeparators = (name: string, escapeUnderscore: boolean): string => {
  const out = new StringBuilder();
  let i = 0;
  while (i < name.length) {
    const c = name.charCodeAt(i);
    if (c === CHAR_DOT || c === CHAR_DOLLAR) {
      out.addChar(CHAR_UNDERSCORE);
    } else if (escapeUnderscore && c === CHAR_UNDERSCORE) {
      out.addChar(CHAR_UNDERSCORE);
      out.addChar(CHAR_ZERO);
    } else {
      out.addChar(c);
    }
    i = i + 1;
  }
  return out.toText();
};

/**
 * The C spelling of a class or interface name.
 *
 * A *declared* class or interface is already a C identifier and passes through
 * untouched, so the header of every program that existed before generics says
 * exactly what it always said. An instantiated generic is not: `Box$i32`
 * (WP18 G5) carries the mangling's `$` and `.`, and `-pedantic` refuses a `$`
 * in a C identifier. A *type* name is not a linker symbol, so unlike
 * `cFunctionName` there is nothing to bind it back to with `NISH_SYMBOL` — the
 * struct simply has a C spelling and an LLVM spelling, and only the layout
 * crosses.
 *
 * Collapsing `$` and `.` to `_` is what `cResultName` does, but the collapse is
 * not what makes that one injective: `nish_result.` is a prefix a user's own
 * class can never spell, and every name under it is the mangler's alone. An
 * instantiated generic's name is half user-chosen, so it needs both halves of
 * the argument written out:
 *
 *   - the reserved `nish_` prefix, because a program may declare
 *     `class Box_i32` beside `Box<i32>` and a bare collapse would emit two
 *     conflicting `struct Box_i32` definitions, which is a header that does
 *     not compile (`tests/cases/gen_export_header`);
 *   - an escape for the `_` the user wrote, because the template's name and a
 *     class-typed argument are user identifiers: `Box_arr$i32` and
 *     `Box$arr.i32` would otherwise collapse to one name. A user's `_` becomes
 *     `_0`, and a digit can never follow one of the mangling's separators --
 *     no type tag and no identifier begins with one -- so a `_0` in the output
 *     is always the one the user wrote.
 */
export const cStructName = (name: string): string => {
  if (name.indexOf("$") < 0) {
    return name;
  }
  return `nish_gen_${collapseSeparators(name, true)}`;
};

/** The by-value spelling: one 64-bit word, `_word` as in the DWARF and the note. */
export const cResultWord = (table: TypeTable, t: i32): string => `${cResultName(table, t)}_word`;

/**
 * C spelling of a struct field. Everything a field can hold has one: the
 * scalars, `nish_str *`, a pointer to another struct, and `nish_array *` for
 * `T[]` (the header type from nish.h; the element type is a comment).
 */
export const cFieldType = (table: TypeTable, t: i32): string => {
  if (table.kindOf(t) === K_ARRAY) {
    return "nish_array *";
  }
  // A field holds the in-memory `Result`, never the packed return word.
  if (table.kindOf(t) === K_RESULT) {
    return `struct ${cResultName(table, t)} *`;
  }
  const c = cType(table, t, POS_RETURN, false);
  return c.length > 0 ? c : "void *";
};

/** Every `Result` type mentioned inside `t`, itself included, innermost first. */
export const resultTypesIn = (table: TypeTable, t: i32, out: i32[]): void => {
  const kind = table.kindOf(t);
  if (kind === K_ARRAY || kind === K_NULLABLE) {
    resultTypesIn(table, table.refOf(t), out);
  } else if (kind === K_RESULT) {
    resultTypesIn(table, table.okOf(t), out);
    resultTypesIn(table, table.errOf(t), out);
    out.push(t);
  }
};

/**
 * One `Result` type the generated C must define. `word` is set for a type
 * that travels by value somewhere — a return or a parameter — `object` for
 * one that appears as a pointer: a large `Result` either way, a class field,
 * or a payload of another `Result`. Both can be true of one type.
 */
export class ResultUse {
  type: i32;
  layout: ResultLayout;
  word: boolean;
  object: boolean;

  constructor(type: i32, layout: ResultLayout) {
    this.type = type;
    this.layout = layout;
    this.word = false;
    this.object = false;
  }
}

/**
 * Which C definitions the `Result` types of these signatures need, in the
 * order a header can emit them (a payload before the `Result` that carries
 * it).
 */
export const resultTypesUsed = (table: TypeTable, fns: ExternalFunction[], fields: i32[]): ResultUse[] => {
  const uses: ResultUse[] = [];
  const index = new StringMap();
  for (const fn of fns) {
    if (fn.sig.name === "main") {
      continue;
    }
    noteResultTypes(table, uses, index, fn.sig.returnType, table.resultByValue(fn.sig.returnType));
    let i = 0;
    while (i < fn.sig.paramTypes.length) {
      const t = fn.sig.paramTypes[i];
      noteResultTypes(table, uses, index, t, table.resultByValue(t));
      i = i + 1;
    }
  }
  // A class field holding a `Result` is the pointer too, and the header
  // declares its struct so a host can follow it rather than being left with an
  // incomplete type.
  for (const t of fields) {
    noteResultTypes(table, uses, index, t, false);
  }
  return uses;
};

/** Record every `Result` inside `t`, in first-seen order; `src/` writes this as a closure. */
const noteResultTypes = (
  table: TypeTable,
  uses: ResultUse[],
  index: StringMap,
  t: i32,
  byValue: boolean
): void => {
  const inner: i32[] = [];
  resultTypesIn(table, t, inner);
  for (const type of inner) {
    const name = cResultName(table, type);
    let at = index.get(name, -1);
    if (at < 0) {
      at = uses.length;
      index.set(name, at);
      uses.push(new ResultUse(type, resultLayout(table, type)));
    }
    // Only the outermost type of a by-value return travels in a register;
    // anything nested inside it is a payload, and a payload is a pointer.
    const use = uses[at];
    if (byValue && type === t) {
      use.word = true;
    } else {
      use.object = true;
    }
  }
};

/** TypeScript source spelling of a signature, for comments and declarations. */
export const tsSignature = (table: TypeTable, sig: FunctionSig): string => {
  const params: string[] = [];
  let i = 0;
  while (i < sig.paramNames.length) {
    params.push(`${sig.paramNames[i]}: ${tsKeyword(table, sig.paramTypes[i])}`);
    i = i + 1;
  }
  return `${sig.sourceName}(${params.join(", ")}): ${tsKeyword(table, sig.returnType)}`;
};

/**
 * The source keyword for a type, as the user wrote it (`number` for i32/f64;
 * arrays as `number[]`, `i64[]`, ... since `Int32Array` and `i32[]` are one type).
 */
export const tsKeyword = (table: TypeTable, t: i32): string => {
  switch (table.kindOf(t)) {
    case T_I32:
      return "number";
    case T_F64:
      return "number";
    case T_BOOL:
      return "boolean";
    case K_STRUCT:
      return table.nameOf(t);
    // WP23: an enum does not cross to C or JS — `cType` and `wasmType` have no
    // entry for it — but it can still appear in the comment above a
    // declaration that was skipped, and there it reads as its own name.
    case K_ENUM:
      return table.nameOf(t);
    case K_ARRAY:
      // The comment above the prototype is the signature as it was written, so
      // a `readonly T[]` says so: it is what makes the `const` on the C
      // parameter beside it read as the promise the source made.
      return table.isReadonlyArray(t)
        ? `readonly ${tsKeyword(table, table.refOf(t))}[]`
        : `${tsKeyword(table, table.refOf(t))}[]`;
    case K_NULLABLE:
      return `${tsKeyword(table, table.refOf(t))} | null`;
    // WP17: the type as the programmer wrote it, for the comment above the
    // declaration; `cType` / `wasmType` decide how it actually crosses.
    case K_RESULT:
      return `Result<${tsKeyword(table, table.okOf(t))}, ${tsKeyword(table, table.errOf(t))}>`;
    default:
      return table.scalarName(t);
  }
};

/**
 * Identifiers that are legal parameter names in the language but would not
 * survive a C or C++ compiler (keywords, and the macros <stdbool.h> defines).
 * A colliding name gets a trailing underscore; the C ABI does not care about
 * parameter names, only the header reader does.
 *
 * `src/` holds these in a `Set`. A chain of comparisons is what the language
 * has, and it costs about what hashing the name would have cost anyway.
 */
export const isCReserved = (name: string): boolean => (
    name === "auto" ||
    name === "bool" ||
    name === "break" ||
    name === "case" ||
    name === "char" ||
    name === "const" ||
    name === "continue" ||
    name === "default" ||
    name === "do" ||
    name === "double" ||
    name === "else" ||
    name === "enum" ||
    name === "extern" ||
    name === "false" ||
    name === "float" ||
    name === "for" ||
    name === "goto" ||
    name === "if" ||
    name === "inline" ||
    name === "int" ||
    name === "long" ||
    name === "register" ||
    name === "restrict" ||
    name === "return" ||
    name === "short" ||
    name === "signed" ||
    name === "sizeof" ||
    name === "static" ||
    name === "struct" ||
    name === "switch" ||
    name === "true" ||
    name === "typedef" ||
    name === "union" ||
    name === "unsigned" ||
    name === "void" ||
    name === "volatile" ||
    name === "while" ||
    name === "_Bool" ||
    name === "alignas" ||
    name === "alignof" ||
    name === "and" ||
    name === "asm" ||
    name === "catch" ||
    name === "class" ||
    name === "delete" ||
    name === "explicit" ||
    name === "export" ||
    name === "friend" ||
    name === "mutable" ||
    name === "namespace" ||
    name === "new" ||
    name === "not" ||
    name === "operator" ||
    name === "or" ||
    name === "private" ||
    name === "protected" ||
    name === "public" ||
    name === "template" ||
    name === "this" ||
    name === "throw" ||
    name === "try" ||
    name === "typename" ||
    name === "using" ||
    name === "virtual" ||
    name === "xor" ||
    name === "nish_str" ||
    name === "nish_arena" ||
    name === "nish_array" ||
    name === "env" ||
    name === "info" ||
    name === "argv" ||
    name === "argc" ||
    name === "type" ||
    name === "out" ||
    name === "result" ||
    name === "mark"
  );

export const cParamName = (name: string): string => isCReserved(name) ? `${name}_` : name;

/** A C identifier and the asm label that binds it to the real LLVM symbol. */
export class CName {
  ident: string;
  /** ` NISH_SYMBOL("...")`, or the empty string when the identifier is already the symbol. */
  label: string;

  constructor(ident: string, label: string) {
    this.ident = ident;
    this.label = label;
  }
}

/**
 * C identifier for a compiled function. A name that is a C keyword (`double`,
 * `int`, ...) is a perfectly good LLVM symbol but cannot be spelled in C, so
 * it is declared as `name_` bound to the real symbol with an asm label
 * (`NISH_SYMBOL`, from nish.h; it adds the `_` prefix Mach-O needs).
 * Methods and constructors (`Point.shifted`, `Point.constructor`, WP2) are
 * declared the same way as `Point_shifted` / `Point_constructor`, taking the
 * object pointer first: a C host may call them on objects it holds.
 */
export const cFunctionName = (symbol: string): CName => {
  // `.` from a method and `$` from a generic instantiation (WP18) are both
  // legal LLVM and illegal C, so both collapse to `_` and the declaration is
  // bound to the real symbol with an asm label.
  if (symbol.indexOf(".") >= 0 || symbol.indexOf("$") >= 0) {
    const ident = new StringBuilder();
    let i = 0;
    while (i < symbol.length) {
      const c = symbol.charCodeAt(i);
      ident.addChar(c === CHAR_DOT || c === CHAR_DOLLAR ? CHAR_UNDERSCORE : c);
      i = i + 1;
    }
    return new CName(ident.toText(), ` NISH_SYMBOL("${symbol}")`);
  }
  if (!isCReserved(symbol)) {
    return new CName(symbol, "");
  }
  return new CName(`${symbol}_`, ` NISH_SYMBOL("${symbol}")`);
};

/** `int32_t add(int32_t a, int32_t b)` for a signature, or `""` when a type has no C spelling. */
export const cPrototype = (table: TypeTable, sig: FunctionSig, writtenParams: StringSet): string => {
  const ret = cType(table, sig.returnType, POS_RETURN, false);
  if (ret.length === 0) {
    return "";
  }
  const params: string[] = [];
  let i = 0;
  while (i < sig.paramNames.length) {
    const t = cType(table, sig.paramTypes[i], POS_PARAM, writtenParams.has(sig.paramNames[i]));
    if (t.length === 0) {
      return "";
    }
    params.push(`${t}${spaceAfter(t)}${cParamName(sig.paramNames[i])}`);
    i = i + 1;
  }
  const name = cFunctionName(sig.name);
  const list = params.length > 0 ? params.join(", ") : "void";
  return `${ret}${spaceAfter(ret)}${name.ident}(${list})${name.label}`;
};

/** A pointer type already ends in `*`; every other one needs a space before the name. */
export const spaceAfter = (type: string): string => type.endsWith("*") ? "" : " ";

/** `ADD` for `build/add.h`: the stem of an output path as an identifier fragment. */
export const guardStem = (outFile: string): string => {
  const stem = stripHeaderSuffix(basename(outFile));
  const id = new StringBuilder();
  let i = 0;
  while (i < stem.length) {
    const c = stem.charCodeAt(i);
    if (c >= CHAR_LOWER_A && c <= CHAR_LOWER_Z) {
      id.addChar(c - CASE_SHIFT);
    } else if ((c >= CHAR_UPPER_A && c <= CHAR_UPPER_Z) || (c >= CHAR_ZERO && c <= CHAR_NINE)) {
      id.addChar(c);
    } else {
      id.addChar(CHAR_UNDERSCORE);
    }
    i = i + 1;
  }
  const text = id.toText();
  if (text.length === 0) {
    return "MODULE";
  }
  const first = text.charCodeAt(0);
  return first >= CHAR_ZERO && first <= CHAR_NINE ? `_${text}` : text;
};

/**
 * The one trailing `.h` / `.hpp` / `.d.ts` / `.c`, case-insensitively, that
 * `src/` strips with a regular expression. `.d.ts` is tested first because
 * that alternation is anchored at the leftmost `.` from which some arm
 * reaches the end of the string, which for `add.d.ts` is the `.d`.
 */
const stripHeaderSuffix = (stem: string): string => {
  if (endsWithFold(stem, ".d.ts")) {
    return stem.substring(0, stem.length - 5);
  }
  if (endsWithFold(stem, ".hpp")) {
    return stem.substring(0, stem.length - 4);
  }
  if (endsWithFold(stem, ".h") || endsWithFold(stem, ".c")) {
    return stem.substring(0, stem.length - 2);
  }
  return stem;
};

/** `endsWith` with ASCII case folding, which is all the `/i` flag means here. */
export const endsWithFold = (text: string, suffix: string): boolean => {
  if (suffix.length > text.length) {
    return false;
  }
  const offset = text.length - suffix.length;
  let i = 0;
  while (i < suffix.length) {
    if (foldByte(text.charCodeAt(offset + i)) !== foldByte(suffix.charCodeAt(i))) {
      return false;
    }
    i = i + 1;
  }
  return true;
};

const foldByte = (c: i32): i32 => c >= CHAR_UPPER_A && c <= CHAR_UPPER_Z ? c + CASE_SHIFT : c;

/** `// Generated by nish --emit-x from main.ts; do not edit.` (the CLI names itself). */
export const banner = (compilation: Compilation, flag: string, comment: string): string => `${comment}Generated by ${CLI} ${flag} from ${compilation.entry().name}; do not edit.`;

/**
 * `Result` definitions (WP17). Two shapes, and a signature uses whichever its
 * position calls for:
 *
 *   `struct nish_result_<T>_<E>`      the arena object WP16 has always had —
 *                                    `{ ok, value, error }` at the offsets the
 *                                    checker derived, which is exactly what
 *                                    clang lays this same declaration out as
 *   `nish_result_<T>_<E>_word`        the packed by-value form, in either
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
export const resultDefinitions = (table: TypeTable, fns: ExternalFunction[], fields: i32[]): string[] => {
  const uses = resultTypesUsed(table, fns, fields);
  const lines: string[] = [];
  if (uses.length === 0) {
    return lines;
  }
  lines.push("");
  lines.push("/* `Result<T, E>` (WP16/WP17). A `Result` small enough to travel in a");
  lines.push(" * register — returned or passed — is the `_word` struct: read `ok`, then");
  lines.push(" * `as.value` or `as.error`. Every other `Result` is a pointer to the arena");
  lines.push(" * object, valid until nish_reset_arena() / nish_arena_release() like every");
  lines.push(" * other arena value. */");
  lines.push("#if defined(__cplusplus)");
  lines.push("#define NISH_RESULT_ASSERT(c, m) static_assert(c, m)");
  lines.push("#elif defined(__STDC_VERSION__) && __STDC_VERSION__ >= 201112L");
  lines.push("#define NISH_RESULT_ASSERT(c, m) _Static_assert(c, m)");
  lines.push("#else");
  lines.push("#define NISH_RESULT_ASSERT(c, m) /* pre-C11: no static assertion available */");
  lines.push("#endif");
  for (const use of uses) {
    lines.push("");
    pushAll(lines, resultDefinition(table, use));
  }
  return lines;
};

const resultDefinition = (table: TypeTable, use: ResultUse): string[] => {
  const layout = use.layout;
  const lines: string[] = [];
  lines.push(`/* ${tsKeyword(table, use.type)} */`);
  if (use.object) {
    lines.push(`struct ${cResultName(table, use.type)} {`);
    lines.push("  bool ok; /* 1 = value, 0 = error */");
    if (layout.hasValue) {
      lines.push(`  ${resultField(table, layout.valueType, "value")}`);
    }
    lines.push(`  ${resultField(table, layout.errorType, "error")}`);
    lines.push("};");
  }
  if (use.word) {
    const arms: string[] = [];
    if (layout.hasValue) {
      arms.push(resultField(table, layout.valueType, "value"));
    }
    arms.push(resultField(table, layout.errorType, "error"));
    const name = cResultWord(table, use.type);
    lines.push(`typedef struct ${name} {`);
    lines.push("  int32_t ok; /* 1 = value, 0 = error */");
    lines.push(`  union { ${arms.join(" ")} } as; /* the arm \`ok\` selects; the other is not written */`);
    lines.push(`} ${name};`);
    lines.push(
      `NISH_RESULT_ASSERT(sizeof(${name}) == 8, "${tsKeyword(table, use.type)} travels in one 64-bit register");`
    );
  }
  return lines;
};

/** One member of a `Result` definition; the payload note names the source type. */
const resultField = (table: TypeTable, t: i32, name: string): string => {
  const c = cFieldType(table, t);
  const kind = table.kindOf(t);
  const note = kind === K_ARRAY || kind === K_RESULT ? ` /* ${tsKeyword(table, t)} */` : "";
  return `${c}${spaceAfter(c)}${name};${note}`;
};
