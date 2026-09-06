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
import { Compilation } from "../compilation";
import { banner, cFunctionName, cPrototype, externalFunctions, ExternalFunction, guardStem, tsKeyword, tsSignature } from "./abi";

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
    const alias = label ? ` (a C keyword: call it as ${ident})` : "";
    lines.push(`/* ${ts}${alias} */`, `${proto};`);
  }
  if (lastUnit === undefined) lines.push("", "/* No callable functions: every function is internal or the entry point. */");

  lines.push("", "#ifdef __cplusplus", "}", "#endif", "", `#endif /* ${guard} */`, "");
  return lines.join("\n");
}
