// `compile <file> [flags]`: stage1's compiler driver for one module
// (docs/wp14-selfhost.md milestone S4). It lexes, parses, validates, checks
// and emits, and writes the LLVM IR to stdout.
//
// One module at a time, deliberately. Resolving an `import` means loading
// another file, ordering the modules and running the attribute fixpoint over
// all of them at once, which is milestone S5's driver; until it lands this
// binary is what `tests/self/ir_oracle.js` compares against stage0's `-o`
// output over every import-free program in the corpus.
//
// The flags are the subset of stage0's that change the IR — everything else
// (`--link`, `--profile`, `-o dir/`, the interop sidecars, `-g`) is stage0's
// by D4, because it needs `spawnSync`, `mkdirSync` or a DWARF builder and none
// of that is on the path to the bootstrap proof.

import { analyzeFunctions, AnalysisUnit } from "./attributes";
import { Checker } from "./checker";
import { NUMBER_MODE_F64, NUMBER_MODE_I32 } from "./context";
import { DiagnosticSink, SourceFile } from "./diagnostics";
import { emitProgram } from "./emit";
import { Options } from "./options";
import { ParentTable } from "./parents";
import { Parser } from "./parser";
import { RuntimeTable } from "./runtime";
import { resolveTarget, supportedTargets } from "./target";
import { TypeTable } from "./types";
import { validate } from "./validator";

const USAGE: string =
  "usage: compile <file.ts> [--number-mode i32|f64] [--plain] [--strict-exports] [--unchecked-indexing] [--nsw] [--no-stack-alloc] [--runtime-decls] [--target <triple>]";

export function main(): number {
  if (process.argv.length < 2) {
    console.error(USAGE);
    return 2;
  }
  const opts = new Options();
  let path = "";
  let arg = 1;
  while (arg < process.argv.length) {
    const value = process.argv[arg];
    if (value === "--number-mode") {
      arg = arg + 1;
      if (arg >= process.argv.length) {
        console.error("compile: --number-mode needs a value (i32 or f64)");
        return 2;
      }
      opts.numberMode = process.argv[arg] === "f64" ? NUMBER_MODE_F64 : NUMBER_MODE_I32;
    } else if (value === "--target") {
      arg = arg + 1;
      if (arg >= process.argv.length) {
        console.error("compile: --target needs a triple");
        return 2;
      }
      opts.target = process.argv[arg];
      if (resolveTarget(opts.target) === null) {
        // `host` is stage0's: answering it means asking the operating system
        // what machine this is, and stage1 has no `process.platform`.
        console.error(`compile: unsupported target \`${opts.target}\`; supported: ${supportedTargets().join(", ")}`);
        return 2;
      }
    } else if (value === "--plain") {
      opts.optimizeAttributes = false;
    } else if (value === "--strict-exports") {
      opts.strictExports = true;
    } else if (value === "--unchecked-indexing") {
      opts.uncheckedIndexing = true;
    } else if (value === "--nsw") {
      opts.nsw = true;
    } else if (value === "--no-stack-alloc") {
      opts.stackAlloc = false;
    } else if (value === "--runtime-decls") {
      opts.runtimeDecls = true;
    } else if (value.startsWith("-")) {
      console.error(`compile: unknown flag \`${value}\`\n${USAGE}`);
      return 2;
    } else {
      path = value;
    }
    arg = arg + 1;
  }
  if (path.length === 0) {
    console.error(USAGE);
    return 2;
  }

  const text = readFileSyncOrNull(path);
  if (text === null) {
    console.error(`compile: cannot read ${path}`);
    return 1;
  }
  const source = new SourceFile(path, text);
  const parser = new Parser(source);
  const file = parser.parseSourceFile();
  for (const diagnostic of parser.diagnostics) {
    writeError(`${diagnostic.message()}\n`);
  }
  if (parser.diagnostics.length > 0) {
    return 1;
  }

  const sink = new DiagnosticSink();
  const table = new TypeTable();
  const checker = new Checker(table, source, file, true, parser.nodeCount, sink, opts.numberMode);
  // Phase 0 first: what is forbidden by design is refused before the checker
  // has a chance to report it as something merely unsupported.
  validate(checker.ctx, file);
  if (sink.hasErrors()) {
    writeError(`${sink.format(20)}\n`);
    return 1;
  }
  checker.collectSignatures();
  // A whole compilation asks the *entry* module; one module on its own is the
  // entry, so its own `main` is the answer.
  checker.ctx.entryHasMain = checker.program.entryMain !== null;
  checker.foldConstants();
  checker.checkBodies();
  if (sink.hasErrors()) {
    writeError(`${sink.format(20)}\n`);
    return 1;
  }

  const units: AnalysisUnit[] = [];
  units.push(new AnalysisUnit(checker.program, new ParentTable(file, parser.nodeCount)));
  const runtime = new RuntimeTable();
  const facts = analyzeFunctions(units, table, opts, runtime);
  write(emitProgram(units[0], table, opts, runtime, facts));
  return 0;
}
