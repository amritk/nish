/**
 * `--emit-header <file.h>`: a C header for every function a host can call.
 *
 * The C ABI of a compiled function is the LLVM signature the emitter wrote:
 *   number   -> int32_t (i32 mode) or double (f64 mode)
 *   boolean  -> bool (i1, zero-extended in a register, as clang does)
 *   string   -> nish_str * (const-qualified as a parameter; see nish.h)
 *   T[]      -> nish_array * (WP4 header; `const` when the function provably
 *               never stores through it, the same proof that gives the IR
 *               parameter `readonly`); the element type is in the comment
 *   void     -> void
 *   Result<T,E> -> the one-word `nish_result_<T>_<E>_word` when it is returned
 *               by value (WP17), otherwise `struct nish_result_<T>_<E> *`; both
 *               are defined below and the word carries a `sizeof` assertion
 * Parameters are passed by value, in order; there is no hidden context
 * argument, no return-slot pointer, no name mangling. A `.ll` module and a C
 * file that includes this header therefore link with a plain `clang a.ll b.c`.
 */
import { StructInfo } from "../checker/index.js";
import { HEADER_GUARD_PREFIX, LANGUAGE, RUNTIME_HEADER } from "../branding.js";
import { Compilation } from "../compilation.js";
import { StaticType } from "../types.js";
import {
  banner,
  cFieldType,
  cType,
  kindOf,
  cFunctionName,
  cParamName,
  cPrototype,
  externalFunctions,
  ExternalFunction,
  guardStem,
  resultDefinitions,
  tsKeyword,
  tsSignature,
} from "./abi.js";

/** ` -- xs: double elements, returns int32_t elements`: what an `nish_array` holds, per array in the signature. */
function elementNotes(fn: ExternalFunction): string {
  const elem = (t: StaticType): string | undefined =>
    kindOf(t) === "array" ? (cType((t as { elem: StaticType }).elem, "return") ?? "nish_array *") : undefined;
  const notes: string[] = [];
  for (const p of fn.sig.params) {
    const e = elem(p.type);
    if (e) notes.push(`${p.name}: ${e} elements`);
  }
  const r = elem(fn.sig.returnType);
  if (r) notes.push(`returns ${r} elements`);
  return notes.length > 0 ? ` -- ${notes.join(", ")}` : "";
}

/**
 * `struct <Name> { ... };` for every class and interface of every module:
 * forward declarations first (a field may point at a struct defined later),
 * then the bodies in module order. The fields are exactly the compiled
 * `%struct.<Name>` at natural alignment, which is clang's layout for the same
 * C struct. A class that `implements` an interface (WP25) lists the
 * interface's fields first, flattened: nesting them as a member would not
 * match, since C never places a following member in a nested struct's tail
 * padding. A class without fields
 * stays an incomplete type (C has no empty structs); pointers to it still work.
 */
function structDefinitions(compilation: Compilation): string[] {
  const structs: { info: StructInfo; fileName: string }[] = [];
  for (const unit of compilation.modules) {
    for (const info of unit.checker.program.structs.values()) {
      if (info.decl.getSourceFile() === unit.sourceFile) structs.push({ info, fileName: unit.fileName });
    }
  }
  if (structs.length === 0) return [];
  const lines = [
    "",
    "/* Classes and interfaces: the field layout of the compiled objects (natural",
    " * alignment; a class that `implements` an interface lists its fields first).",
    " * Objects live in the arena; a `T | null` parameter or field may be NULL. */",
  ];
  for (const { info } of structs) lines.push(`struct ${info.name};`);
  for (const { info, fileName } of structs) {
    const ifaces = info.implements.length > 0 ? ` implements ${info.implements.join(", ")}` : "";
    lines.push("", `/* ${fileName}: ${info.kind} ${info.name}${ifaces} */`);
    if (info.fields.length === 0) {
      lines.push(`/* struct ${info.name} has no fields; it stays incomplete (pointers only). */`);
      continue;
    }
    lines.push(`struct ${info.name} {`);
    for (const f of info.fields) {
      const t = cFieldType(f.type);
      const name = cParamName(f.name); // a C keyword as a field name gets the same `_` suffix as a parameter
      const note = f.type.kind === "array" || name !== f.name ? ` /* ${f.name}: ${tsKeyword(f.type)} */` : "";
      lines.push(`  ${t}${t.endsWith("*") ? "" : " "}${name};${note}`);
    }
    lines.push("};");
  }
  return lines;
}

/** Every field type of every class and interface, for the `Result` definitions above. */
function structFieldTypes(compilation: Compilation): StaticType[] {
  const out: StaticType[] = [];
  for (const unit of compilation.modules) {
    for (const info of unit.checker.program.structs.values()) {
      for (const f of info.fields) out.push(f.type);
    }
  }
  return out;
}

export function generateHeader(compilation: Compilation, outFile: string): string {
  const guard = `${HEADER_GUARD_PREFIX}_${guardStem(outFile)}_H`;
  const lines: string[] = [
    banner(compilation, "--emit-header", (t) => `/* ${t}`),
    " *",
    ` * C ABI of the ${LANGUAGE} modules listed below. Link the .ll module(s) and`,
    ` * runtime/runtime.c next to your C code; include runtime/${RUNTIME_HEADER}'s`,
    " * directory with -I. Strings (nish_str) and arrays (nish_array, { len, cap,",
    " * data }) live in the arena: a returned value is valid until",
    " * nish_reset_arena() / nish_arena_release(). A `const nish_array *` parameter",
    " * is only read; an `nish_array *` one is written through. To pass your own",
    " * buffer build a header on the stack: nish_array a = { n, n, (char *)buf }. */",
    `#ifndef ${guard}`,
    `#define ${guard}`,
    "",
    "#include <stdbool.h>",
    "#include <stdint.h>",
    `#include "${RUNTIME_HEADER}"`,
    "",
    "#ifdef __cplusplus",
    'extern "C" {',
    "#endif",
    ...structDefinitions(compilation),
  ];

  const fns = externalFunctions(compilation);
  lines.push(...resultDefinitions(fns, structFieldTypes(compilation)));

  let lastUnit: ExternalFunction["unit"] | undefined;
  for (const fn of fns) {
    if (fn.unit !== lastUnit) {
      lines.push("", `/* ${fn.unit.fileName} */`);
      lastUnit = fn.unit;
    }
    const ts = tsSignature(fn.sig, tsKeyword);
    if (fn.sig.name === "main") {
      lines.push(
        `/* ${ts}: not declared; a C host owns \`main\`. Export it to make it the process entry. */`
      );
      continue;
    }
    const proto = cPrototype(fn.sig, fn.writtenParams);
    if (proto === undefined) {
      lines.push(`/* ${ts}: not declared; no C spelling for one of its types. */`);
      continue;
    }
    const { ident, label } = cFunctionName(fn.sig.name);
    // Three reasons a symbol cannot be spelled in C, and the comment says
    // which: a method (`Point.shifted`), a symbol inside a package
    // (`hash.helper`, WP21 S1), or a name that is a C keyword.
    const why = fn.sig.struct ? "a method" : fn.sig.name.includes(".") ? "in a package" : "a C keyword";
    const alias = label ? ` (${why}: call it as ${ident})` : "";
    lines.push(`/* ${ts}${alias}${elementNotes(fn)} */`, `${proto};`);
  }
  if (lastUnit === undefined)
    lines.push("", "/* No callable functions: every function is internal or the entry point. */");

  lines.push("", "#ifdef __cplusplus", "}", "#endif", "", `#endif /* ${guard} */`, "");
  return lines.join("\n");
}
