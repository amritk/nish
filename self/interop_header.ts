// `--emit-header <file.h>`: a C header for every function a host can call
// (`src/interop/header.ts`, WP8).
//
// The C ABI of a compiled function is the LLVM signature the emitter wrote:
//   number   -> int32_t (i32 mode) or double (f64 mode)
//   boolean  -> bool (i1, zero-extended in a register, as clang does)
//   string   -> amrit_str * (const-qualified as a parameter; see amritc.h)
//   T[]      -> amrit_array * (WP4 header; `const` when the function provably
//               never stores through it, the same proof that gives the IR
//               parameter `readonly`); the element type is in the comment
//   void     -> void
//   Result<T,E> -> the one-word `amrit_result_<T>_<E>_word` when it is returned
//               by value (WP17), otherwise `struct amrit_result_<T>_<E> *`; both
//               are defined below and the word carries a `sizeof` assertion
// Parameters are passed by value, in order; there is no hidden context
// argument, no return-slot pointer, no name mangling. A `.ll` module and a C
// file that includes this header therefore link with a plain `clang a.ll b.c`.

import { HEADER_GUARD_PREFIX, LANGUAGE, RUNTIME_HEADER } from "./branding";
import { Compilation, ModuleUnit } from "./compilation";
import {
  banner,
  cFieldType,
  cFunctionName,
  cParamName,
  cPrototype,
  cType,
  ExternalFunction,
  guardStem,
  POS_RETURN,
  pushAll,
  resultDefinitions,
  spaceAfter,
  tsKeyword,
  tsSignature,
} from "./interop_abi";
import { StructInfo, STRUCT_CLASS } from "./program";
import { K_ARRAY, TypeTable } from "./types";

/** ` -- xs: double elements, returns int32_t elements`: what an `amrit_array` holds, per array in the signature. */
function elementNotes(table: TypeTable, fn: ExternalFunction): string {
  const notes: string[] = [];
  let i = 0;
  while (i < fn.sig.paramNames.length) {
    const elem = elementType(table, fn.sig.paramTypes[i]);
    if (elem.length > 0) {
      notes.push(`${fn.sig.paramNames[i]}: ${elem} elements`);
    }
    i = i + 1;
  }
  const returned = elementType(table, fn.sig.returnType);
  if (returned.length > 0) {
    notes.push(`returns ${returned} elements`);
  }
  return notes.length > 0 ? ` -- ${notes.join(", ")}` : "";
}

/** The C element type of an array, or `""` when the type is not an array. */
function elementType(table: TypeTable, t: i32): string {
  if (table.kindOf(t) !== K_ARRAY) {
    return "";
  }
  const c = cType(table, table.refOf(t), POS_RETURN, false);
  return c.length > 0 ? c : "amrit_array *";
}

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
  const table = compilation.table;
  const structs: StructInfo[] = [];
  const files: string[] = [];
  for (const unit of compilation.modules) {
    for (const info of unit.checker.program.structList) {
      if (info.origin === unit.source) {
        structs.push(info);
        files.push(unit.path);
      }
    }
  }
  const lines: string[] = [];
  if (structs.length === 0) {
    return lines;
  }
  lines.push("");
  lines.push("/* Classes and interfaces: the field layout of the compiled objects (natural");
  lines.push(" * alignment; a derived class lists its base's fields first). Objects live in");
  lines.push(" * the arena; a `T | null` parameter or field may be NULL. */");
  for (const info of structs) {
    lines.push(`struct ${info.name};`);
  }
  let i = 0;
  while (i < structs.length) {
    const info = structs[i];
    const base = info.base;
    const heritage = base === null ? "" : ` extends ${base.name}`;
    const ifaces = info.implementsNames.length > 0 ? ` implements ${info.implementsNames.join(", ")}` : "";
    const kind = info.kind === STRUCT_CLASS ? "class" : "interface";
    lines.push("");
    lines.push(`/* ${files[i]}: ${kind} ${info.name}${heritage}${ifaces} */`);
    if (info.fields.length === 0) {
      lines.push(`/* struct ${info.name} has no fields; it stays incomplete (pointers only). */`);
      i = i + 1;
      continue;
    }
    lines.push(`struct ${info.name} {`);
    for (const f of info.fields) {
      const t = cFieldType(table, f.type);
      // A C keyword as a field name gets the same `_` suffix as a parameter.
      const name = cParamName(f.name);
      const note =
        table.kindOf(f.type) === K_ARRAY || name !== f.name
          ? ` /* ${f.name}: ${tsKeyword(table, f.type)} */`
          : "";
      lines.push(`  ${t}${spaceAfter(t)}${name};${note}`);
    }
    lines.push("};");
    i = i + 1;
  }
  return lines;
}

/** Every field type of every class and interface, for the `Result` definitions above. */
function structFieldTypes(compilation: Compilation): i32[] {
  const out: i32[] = [];
  for (const unit of compilation.modules) {
    for (const info of unit.checker.program.structList) {
      for (const f of info.fields) {
        out.push(f.type);
      }
    }
  }
  return out;
}

export function generateHeader(compilation: Compilation, fns: ExternalFunction[], outFile: string): string {
  const table = compilation.table;
  const guard = `${HEADER_GUARD_PREFIX}_${guardStem(outFile)}_H`;
  const lines: string[] = [];
  lines.push(banner(compilation, "--emit-header", "/* "));
  lines.push(" *");
  lines.push(` * C ABI of the ${LANGUAGE} modules listed below. Link the .ll module(s) and`);
  lines.push(` * runtime/runtime.c next to your C code; include runtime/${RUNTIME_HEADER}'s`);
  lines.push(" * directory with -I. Strings (amrit_str) and arrays (amrit_array, { len, cap,");
  lines.push(" * data }) live in the arena: a returned value is valid until");
  lines.push(" * amrit_reset_arena() / amrit_arena_release(). A `const amrit_array *` parameter");
  lines.push(" * is only read; an `amrit_array *` one is written through. To pass your own");
  lines.push(" * buffer build a header on the stack: amrit_array a = { n, n, (char *)buf }. */");
  lines.push(`#ifndef ${guard}`);
  lines.push(`#define ${guard}`);
  lines.push("");
  lines.push("#include <stdbool.h>");
  lines.push("#include <stdint.h>");
  lines.push(`#include "${RUNTIME_HEADER}"`);
  lines.push("");
  lines.push("#ifdef __cplusplus");
  lines.push('extern "C" {');
  lines.push("#endif");
  pushAll(lines, structDefinitions(compilation));

  pushAll(lines, resultDefinitions(table, fns, structFieldTypes(compilation)));

  // A module's path is its identity in this compilation (`self/compilation.ts`),
  // so comparing paths is comparing the units, without a nullable to narrow.
  let lastPath = "";
  let anyModule = false;
  for (const fn of fns) {
    if (!anyModule || fn.unit.path !== lastPath) {
      lines.push("");
      lines.push(`/* ${fn.unit.path} */`);
      lastPath = fn.unit.path;
      anyModule = true;
    }
    const source = tsSignature(table, fn.sig);
    if (fn.sig.name === "main") {
      lines.push(
        `/* ${source}: not declared; a C host owns \`main\`. Export it to make it the process entry. */`
      );
      continue;
    }
    const proto = cPrototype(table, fn.sig, fn.writtenParams);
    if (proto.length === 0) {
      lines.push(`/* ${source}: not declared; no C spelling for one of its types. */`);
      continue;
    }
    const name = cFunctionName(fn.sig.name);
    const alias =
      name.label.length > 0
        ? ` (${fn.sig.owner !== null ? "a method" : "a C keyword"}: call it as ${name.ident})`
        : "";
    lines.push(`/* ${source}${alias}${elementNotes(table, fn)} */`);
    lines.push(`${proto};`);
  }
  if (!anyModule) {
    lines.push("");
    lines.push("/* No callable functions: every function is internal or the entry point. */");
  }

  lines.push("");
  lines.push("#ifdef __cplusplus");
  lines.push("}");
  lines.push("#endif");
  lines.push("");
  lines.push(`#endif /* ${guard} */`);
  lines.push("");
  return lines.join("\n");
}
