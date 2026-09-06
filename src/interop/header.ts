/**
 * `--emit-header <file.h>`: a C header for every function a host can call.
 *
 * The C ABI of a StaticTS function is the LLVM signature the emitter wrote:
 *   number   -> int32_t (i32 mode) or double (f64 mode)
 *   boolean  -> bool (i1, zero-extended in a register, as clang does)
 *   string   -> sts_str * (const-qualified as a parameter; see statictsc.h)
 *   void     -> void
 * Parameters are passed by value, in order; there is no hidden context
 * argument, no return-slot pointer, no name mangling. A `.ll` module and a C
 * file that includes this header therefore link with a plain `clang a.ll b.c`.
 */
import { StructInfo } from "../checker";
import { Compilation } from "../compilation";
import {
  banner,
  cFieldType,
  cFunctionName,
  cParamName,
  cPrototype,
  externalFunctions,
  ExternalFunction,
  guardStem,
  tsKeyword,
  tsSignature,
} from "./abi";

/**
 * `struct <Name> { ... };` for every class and interface of every module:
 * forward declarations first (a field may point at a struct defined later),
 * then the bodies in module order. The fields are exactly the compiled
 * `%struct.<Name>` at natural alignment, which is clang's layout for the same
 * C struct. A derived class (WP2b) lists its base's fields first, flattened:
 * nesting the base as a member would not match, since C never places a
 * following member in a nested struct's tail padding. A class without fields
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
    " * alignment; a derived class lists its base's fields first). Objects live in",
    " * the arena; a `T | null` parameter or field may be NULL. */",
  ];
  for (const { info } of structs) lines.push(`struct ${info.name};`);
  for (const { info, fileName } of structs) {
    const heritage = info.base ? ` extends ${info.base.name}` : "";
    const ifaces = info.implements.length ? ` implements ${info.implements.join(", ")}` : "";
    lines.push("", `/* ${fileName}: ${info.kind} ${info.name}${heritage}${ifaces} */`);
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

export function generateHeader(compilation: Compilation, outFile: string): string {
  const guard = `STATICTSC_${guardStem(outFile)}_H`;
  const lines: string[] = [
    banner(compilation, "--emit-header", (t) => `/* ${t}`),
    " *",
    " * C ABI of the StaticTS modules listed below. Link the .ll module(s) and",
    " * runtime/runtime.c next to your C code; include runtime/statictsc.h's",
    " * directory with -I. Strings (sts_str) live in the arena: a returned",
    " * string is valid until sts_reset_arena() / sts_free_arena(). */",
    `#ifndef ${guard}`,
    `#define ${guard}`,
    "",
    "#include <stdbool.h>",
    "#include <stdint.h>",
    '#include "statictsc.h"',
    "",
    "#ifdef __cplusplus",
    'extern "C" {',
    "#endif",
    ...structDefinitions(compilation),
  ];

  let lastUnit: ExternalFunction["unit"] | undefined;
  for (const fn of externalFunctions(compilation)) {
    if (fn.unit !== lastUnit) {
      lines.push("", `/* ${fn.unit.fileName} */`);
      lastUnit = fn.unit;
    }
    const ts = tsSignature(fn.sig, tsKeyword);
    if (fn.sig.name === "main") {
      lines.push(`/* ${ts}: not declared; a C host owns \`main\`. Export it to make it the process entry. */`);
      continue;
    }
    const proto = cPrototype(fn.sig);
    if (proto === undefined) {
      lines.push(`/* ${ts}: not declared; no C spelling for one of its types. */`);
      continue;
    }
    const { ident, label } = cFunctionName(fn.sig.name);
    const alias = label ? ` (${fn.sig.struct ? "a method" : "a C keyword"}: call it as ${ident})` : "";
    lines.push(`/* ${ts}${alias} */`, `${proto};`);
  }
  if (lastUnit === undefined) lines.push("", "/* No callable functions: every function is internal or the entry point. */");

  lines.push("", "#ifdef __cplusplus", "}", "#endif", "", `#endif /* ${guard} */`, "");
  return lines.join("\n");
}
