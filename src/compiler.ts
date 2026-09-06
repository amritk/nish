/**
 * Pipeline driver: source text -> AST -> checked program -> LLVM IR text.
 */
import { parseSource } from "./parser";
import { checkProgram } from "./checker";
import { emitProgram } from "./codegen/emitter";
import { CompilerOptions, DEFAULT_OPTIONS } from "./types";

export function compileToIR(
  fileName: string,
  sourceText: string,
  options: Partial<CompilerOptions> = {}
): string {
  const opts: CompilerOptions = { ...DEFAULT_OPTIONS, ...options };
  const ast = parseSource(fileName, sourceText); // Phase A
  const program = checkProgram(ast, opts); // Phase B
  return emitProgram(program); // Phase C
}
