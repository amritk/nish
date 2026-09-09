/**
 * Pipeline driver: source text -> AST -> checked program -> LLVM IR text.
 *
 * Every compile goes through a `Compilation` (src/compilation.ts), which
 * loads the imports of the given file(s), checks all modules together, and
 * emits one IR module per source file. Phase order per module: A parse,
 * (0 validate), B check; then C emit for the whole program.
 */
import { Compilation, EmittedModule } from "./compilation.js";
import { CompilerOptions } from "./types.js";

export { Compilation, parseModule } from "./compilation.js";
export type { EmittedModule, ModuleUnit } from "./compilation.js";

/**
 * Compile one file (given as text) and return *its* IR. Modules it imports are
 * loaded, checked, and analysed alongside it, but only the entry's IR is
 * returned; use `compileProgram` to get every module.
 */
export function compileToIR(
  fileName: string,
  sourceText: string,
  options: Partial<CompilerOptions> = {}
): string {
  const compilation = new Compilation(options);
  const entry = compilation.addRoot(fileName, sourceText);
  compilation.check();
  return compilation.emit().find((m) => m.unit === entry)!.ir;
}

/** Compile a whole program from root files; the first root is the entry module. */
export function compileProgram(
  rootFiles: string[],
  options: Partial<CompilerOptions> = {}
): { compilation: Compilation; modules: EmittedModule[] } {
  const compilation = new Compilation(options);
  for (const file of rootFiles) compilation.addRoot(file);
  compilation.check();
  return { compilation, modules: compilation.emit() };
}
