/**
 * `--emit-header <file.h>`: a C header for every function a host can call.
 *
 * The C ABI of a StaticTS function is the LLVM signature the emitter wrote:
 *   number   -> int32_t (i32 mode) or double (f64 mode)
 *   boolean  -> bool (i1, zero-extended in a register, as clang does)
 *   string   -> sts_str * (const-qualified as a parameter; see statictsc.h)
 *   T[]      -> sts_array * (WP4 header; `const` when the function provably
 *               never stores through it, the same proof that gives the IR
 *               parameter `readonly`); the element type is in the comment
 *   void     -> void
 * Parameters are passed by value, in order; there is no hidden context
 * argument, no return-slot pointer, no name mangling. A `.ll` module and a C
 * file that includes this header therefore link with a plain `clang a.ll b.c`.
 */
import { Compilation } from "../compilation";
import { StaticType } from "../types";
import { banner, cFunctionName, cPrototype, cType, externalFunctions, ExternalFunction, guardStem, kindOf, tsKeyword, tsSignature } from "./abi";

/** ` -- xs: double elements, returns int32_t elements`: what an `sts_array` holds, per array in the signature. */
function elementNotes(fn: ExternalFunction): string {
  const elem = (t: StaticType): string | undefined => (kindOf(t) === "array" ? cType((t as { elem: StaticType }).elem, "return") ?? "sts_array *" : undefined);
  const notes: string[] = [];
  for (const p of fn.sig.params) {
    const e = elem(p.type);
    if (e) notes.push(`${p.name}: ${e} elements`);
  }
  const r = elem(fn.sig.returnType);
  if (r) notes.push(`returns ${r} elements`);
  return notes.length > 0 ? ` -- ${notes.join(", ")}` : "";
}

export function generateHeader(compilation: Compilation, outFile: string): string {
  const guard = `STATICTSC_${guardStem(outFile)}_H`;
  const lines: string[] = [
    banner(compilation, "--emit-header", (t) => `/* ${t}`),
    " *",
    " * C ABI of the StaticTS modules listed below. Link the .ll module(s) and",
    " * runtime/runtime.c next to your C code; include runtime/statictsc.h's",
    " * directory with -I. Strings (sts_str) and arrays (sts_array, { len, cap,",
    " * data }) live in the arena: a returned value is valid until",
    " * sts_reset_arena() / sts_arena_release(). A `const sts_array *` parameter",
    " * is only read; an `sts_array *` one is written through. To pass your own",
    " * buffer build a header on the stack: sts_array a = { n, n, (char *)buf }. */",
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
    const proto = cPrototype(fn.sig, fn.writtenParams);
    if (proto === undefined) {
      lines.push(`/* ${ts}: not declared; no C spelling for one of its types. */`);
      continue;
    }
    const { ident, label } = cFunctionName(fn.sig.name);
    const alias = label ? ` (a C keyword: call it as ${ident})` : "";
    lines.push(`/* ${ts}${alias}${elementNotes(fn)} */`, `${proto};`);
  }
  if (lastUnit === undefined) lines.push("", "/* No callable functions: every function is internal or the entry point. */");

  lines.push("", "#ifdef __cplusplus", "}", "#endif", "", `#endif /* ${guard} */`, "");
  return lines.join("\n");
}
