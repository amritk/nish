// `--emit-header <file.h>`: a C header for every function a host can call
// (`src/interop/header.ts`, WP8).
//
// The C ABI of a compiled function is the LLVM signature the emitter wrote:
//   number   -> int32_t (i32 mode) or double (f64 mode)
//   boolean  -> bool (i1, zero-extended in a register, as clang does)
//   string   -> nish_str * (const-qualified as a parameter; see nish.h)
//   T[]      -> nish_array * (WP4 header; `const` when the function provably
//               never stores through it, the same proof that gives the IR
//               parameter `readonly`); the element type is in the comment
//   void     -> void
//   Result<T,E> -> the one-word `nish_result_<T>_<E>_word` when it is returned
//               by value (WP17), otherwise `struct nish_result_<T>_<E> *`; both
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
  cStructName,
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
import { CheckedProgram, inlineElementStruct, StructInfo, STRUCT_CLASS } from "./program";
import { K_ARRAY, TypeTable } from "./types";

/**
 * ` -- xs: double elements, returns int32_t elements`: what an `nish_array`
 * holds, per array in the signature.
 *
 * WP15 §2a made this two answers rather than one. A record element type (an
 * `interface`) is stored *inline*: `data` is a C array of the structs
 * themselves, so the note spells the element `struct Point` with no `*` and
 * says `inline`, which is a host's cue that `((struct Point *)a->data)[i]` is
 * element `i` and needs no marshalling. Every other element type is one
 * pointer per slot and keeps the pointer spelling it always had.
 */
const elementNotes = (table: TypeTable, fn: ExternalFunction): string => {
  const notes: string[] = [];
  const program = fn.unit.checker.program;
  let i = 0;
  while (i < fn.sig.paramNames.length) {
    const elem = elementNote(program, table, fn.sig.paramTypes[i]);
    if (elem.length > 0) {
      notes.push(`${fn.sig.paramNames[i]}: ${elem}`);
    }
    i = i + 1;
  }
  const returned = elementNote(program, table, fn.sig.returnType);
  if (returned.length > 0) {
    notes.push(`returns ${returned}`);
  }
  return notes.length > 0 ? ` -- ${notes.join(", ")}` : "";
};

/** What an array's elements are, or `""` when the type is not an array. */
const elementNote = (program: CheckedProgram, table: TypeTable, t: i32): string => {
  if (table.kindOf(t) !== K_ARRAY) {
    return "";
  }
  const elem = table.refOf(t);
  const inline = inlineElementStruct(program, table, elem);
  if (inline !== null) {
    return `struct ${cStructName(inline.name)} elements, inline`;
  }
  const c = cType(table, elem, POS_RETURN, false);
  return c.length > 0 ? `${c} elements` : "nish_array * elements";
};

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
const structDefinitions = (compilation: Compilation): string[] => {
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
  lines.push(" * alignment; a class that `implements` an interface lists its fields first).");
  lines.push(" * Objects live in the arena; a `T | null` parameter or field may be NULL. */");
  for (const info of structs) {
    lines.push(`struct ${cStructName(info.name)};`);
  }
  let i = 0;
  while (i < structs.length) {
    const info = structs[i];
    const ifaces = info.implementsNames.length > 0 ? ` implements ${info.implementsNames.join(", ")}` : "";
    const kind = info.kind === STRUCT_CLASS ? "class" : "interface";
    lines.push("");
    lines.push(`/* ${files[i]}: ${kind} ${info.name}${ifaces} */`);
    if (info.fields.length === 0) {
      lines.push(`/* struct ${cStructName(info.name)} has no fields; it stays incomplete (pointers only). */`);
      i = i + 1;
      continue;
    }
    lines.push(`struct ${cStructName(info.name)} {`);
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
};

/** Every field type of every class and interface, for the `Result` definitions above. */
const structFieldTypes = (compilation: Compilation): i32[] => {
  const out: i32[] = [];
  for (const unit of compilation.modules) {
    for (const info of unit.checker.program.structList) {
      for (const f of info.fields) {
        out.push(f.type);
      }
    }
  }
  return out;
};

export const generateHeader = (compilation: Compilation, fns: ExternalFunction[], outFile: string): string => {
  const table = compilation.table;
  const guard = `${HEADER_GUARD_PREFIX}_${guardStem(outFile)}_H`;
  const lines: string[] = [];
  lines.push(banner(compilation, "--emit-header", "/* "));
  lines.push(" *");
  lines.push(` * C ABI of the ${LANGUAGE} modules listed below. Link the .ll module(s) and`);
  lines.push(` * runtime/runtime.c next to your C code; include runtime/${RUNTIME_HEADER}'s`);
  lines.push(" * directory with -I. Strings (nish_str) and arrays (nish_array, { len, cap,");
  lines.push(" * data }) live in the arena: a returned value is valid until");
  lines.push(" * nish_reset_arena() / nish_arena_release(). A `const nish_array *` parameter");
  lines.push(" * is only read; an `nish_array *` one is written through. To pass your own");
  lines.push(" * buffer build a header on the stack: nish_array a = { n, n, (char *)buf }.");
  lines.push(" * An array of records (an interface below) holds them inline, so its data is");
  lines.push(" * a C array of that struct; every other element type is one pointer per");
  lines.push(" * slot. The comment above each prototype says which. */");
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
    // Three reasons a symbol cannot be spelled in C, and the comment says
    // which: a method (`Point.shifted`), a symbol inside a package
    // (`hash.helper`, WP21 S1), or a name that is a C keyword.
    let why = "a C keyword";
    if (fn.sig.owner !== null) {
      why = "a method";
    } else if (fn.sig.name.indexOf(".") >= 0) {
      why = "in a package";
    }
    const alias = name.label.length > 0 ? ` (${why}: call it as ${name.ident})` : "";
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
};
