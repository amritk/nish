#!/usr/bin/env node
/**
 * One process, many golden cases: the compile half of section A of
 * `tests/run.js`, driven through the library API instead of the command line.
 *
 * Why this file exists at all is a measurement. A `node dist/index.js
 * <case>.ts -o out.ll` costs about 634 ms on the box this was written on, and
 * only 1.5 ms of that is compiling: 36 ms is Node starting, ~473 ms is
 * `import ts from "typescript"` in `src/parser.ts`, and ~85 ms is loading
 * `dist/`. Section A pays all of it once per case, six hundred times over, so
 * roughly 99% of its wall clock is an import. Driving `new Compilation({})` /
 * `addRoot` / `check` / `emit` in one process pays it once.
 *
 * Two properties of the compiler are what make that shareable, and both are
 * worth stating because the day either stops holding this file has to go back
 * to spawning:
 *
 *   1. **A rejection throws.** `CompileError` comes back out of `addRoot`,
 *      `check` or `emit`; nothing in the library calls `process.exit`, so a
 *      case that must be refused and a case that must compile can sit in the
 *      same process.
 *   2. **The IR is a pure function of the source and the options.** The one
 *      thing that leaks in from outside is the *spelling of the input path*,
 *      which `source_filename` records and which `-g` puts in a `DIFile`, so
 *      this file hands the compiler exactly the path string `tests/run.js`
 *      would have handed the CLI and changes it in no way
 *      (`docs/wp19-stage0-retirement.md` §A3 is the same hazard seen from the
 *      other side).
 *
 * `tests/batch_compile.js` is the parent that spawns this and reassembles the
 * results; `tests/run.js` checks them exactly as it checks a `spawnSync`
 * result, because that is the shape this answers in.
 *
 * Protocol: `node tests/batch_worker.js <results.ndjson> <case> [<case> ...]`.
 * One JSON record is appended per case *as soon as it is finished*, which is
 * what lets the parent name the case that killed the process rather than the
 * chunk it was in.
 */
import fs from "node:fs";
import path from "node:path";
import { Compilation } from "../dist/compiler.js";
import { CompileError, formatErrorReport, formatWarningReport } from "../dist/diagnostics.js";
import { dumpAst, dumpChecked } from "../dist/dump.js";
import { resolveTarget } from "../dist/codegen/target.js";
import { CLI, ENV_DEBUG } from "../dist/branding.js";
import { packageVersion } from "../dist/version.js";

const root = path.resolve(import.meta.dirname, "..");
const casesDir = path.join(root, "tests", "cases");
const buildDir = path.join(root, "build", "test");

/**
 * The CLI is spawned with `cwd: root` by `tests/run.js`, and an *imported*
 * module's `fileName` is named relative to the importer rather than to the
 * working directory — so nothing here depends on the directory this process
 * started in. It is set anyway: a fact the output depends on should not be
 * left to the caller's shell when one line pins it.
 */
process.chdir(root);

/**
 * Turn a case's `.args` into the `CompilerOptions` the CLI would have built,
 * or name the flag that cannot be expressed that way.
 *
 * Every flag in `src/index.ts` that ends up in the `new Compilation({...})`
 * call is here, plus the two dump flags and `--no-warn-performance`, which the
 * driver acts on itself. What is deliberately *not* here is the rest of the
 * driver's surface — `-o`, `--link`, `--profile`, `--json`, `--emit-header`,
 * `--emit-dts`, `--emit-napi`, `-v`, `--help` — because those are decisions
 * about files, processes and output formats rather than about lowering, and
 * reimplementing them would be reimplementing the CLI. A case that asks for
 * one comes back as a fallback and `tests/run.js` spawns the real CLI for it,
 * which is also what happens to a flag added after this file was written: an
 * unknown flag is a fallback, never a silently ignored option.
 */
const planOptions = (args) => {
  const options = {};
  let dump;
  let warnPerformance = true;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--plain") options.optimizeAttributes = false;
    else if (arg === "--runtime-decls") options.runtimeDecls = true;
    else if (arg === "--strict-exports") options.strictExports = true;
    else if (arg === "--no-strict-exports") options.strictExports = false;
    else if (arg === "--unchecked-indexing") options.uncheckedIndexing = true;
    else if (arg === "--nsw") options.nsw = true;
    else if (arg === "--wrapping") options.nsw = false;
    else if (arg === "--no-stack-alloc") options.stackAlloc = false;
    else if (arg === "--threads") options.threads = true;
    else if (arg === "-g") options.debugInfo = true;
    else if (arg === "--no-warn-performance") warnPerformance = false;
    else if (arg === "--emit-ast") dump = "ast";
    else if (arg === "--emit-checked") dump = "checked";
    else if (arg === "--number-mode") {
      const mode = args[++i];
      if (mode !== "i32" && mode !== "f64") return { fallback: `--number-mode ${mode}` };
      options.numberMode = mode;
    } else if (arg === "--target") {
      const spec = args[++i] ?? "";
      const resolved = resolveTarget(spec);
      if (!resolved) return { fallback: `--target ${spec}` };
      options.target = resolved.triple;
    } else return { fallback: arg };
  }
  return { options, dump, warnPerformance };
};

/** Node system errors, the way `src/index.ts` recognises them. */
const isSystemError = (err) => err instanceof Error && typeof err.code === "string";

/**
 * The exit-70 report, reproduced from `reportInternalError` in `src/index.ts`.
 *
 * A green suite never reaches this, and a case that does is a red case either
 * way — but it has to be red *for the right reason*, so the text is the
 * driver's rather than a paraphrase: a reader comparing this run with a CLI run
 * of the same case should see the same words.
 */
const internalErrorReport = (err, src) => {
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  const lines = [
    `${CLI} ${packageVersion()}: internal compiler error while compiling ${src}`,
    `  ${message}`,
  ];
  if (process.env[ENV_DEBUG] && err instanceof Error && err.stack) lines.push(err.stack);
  else lines.push(`  (re-run with ${ENV_DEBUG}=1 for the stack trace)`);
  lines.push(`This is a bug in ${CLI}, not in your program. Please report it with the input file and`);
  lines.push("the command line at https://github.com/amritk/nish/issues");
  return lines.join("\n") + "\n";
};

/**
 * Compile one case and answer in the shape `spawnSync` answers in, so the
 * caller cannot tell which path produced the result. `status` follows the
 * CLI's exit codes: 0 ok, 1 the program was rejected, 70 internal error.
 */
const compileCase = (name) => {
  const src = path.join(casesDir, `${name}.ts`);
  const argsFile = path.join(casesDir, `${name}.args`);
  const args = fs.existsSync(argsFile)
    ? fs.readFileSync(argsFile, "utf8").trim().split(/\s+/).filter(Boolean)
    : [];
  const plan = planOptions(args);
  if (plan.fallback !== undefined) return { fallback: plan.fallback };

  const outLl = path.join(buildDir, `${name}.ll`);
  let stdout = "";
  let stderr = "";
  const compilation = new Compilation(plan.options);
  try {
    compilation.addRoot(src);
    // `--emit-ast` needs only the parsed and validated modules; nothing is checked or written.
    if (plan.dump === "ast") {
      for (const unit of compilation.modules) stdout += dumpAst(unit.sourceFile, unit.fileName);
      return { status: 0, stdout, stderr };
    }
    compilation.check();
    // WP15 §8: the performance warnings belong to a compilation that got this
    // far, and an error report is never diluted with advice -- so they are
    // written here and not in the `catch`, exactly as the driver has it.
    if (plan.warnPerformance) {
      const warnings = compilation.sink.performanceWarnings;
      if (warnings.length > 0) stderr += formatWarningReport(warnings) + "\n";
    }
    if (plan.dump === "checked") {
      stdout += dumpChecked(compilation);
      return { status: 0, stdout, stderr };
    }
    const modules = compilation.emit();
    if (modules.length !== 1) {
      // `planOutputs` in `src/index.ts` refuses a program of several modules
      // when `-o` names a file, and section A always names a file. Reproduced
      // rather than delegated because the message is a user-facing refusal a
      // `.err` sidecar is allowed to pin.
      const names = modules.map((m) => m.unit.fileName).join(", ");
      stderr += `${modules.length} modules would be written (${names}); pass \`-o <dir>/\` to write one .ll per module\n`;
      return { status: 1, stdout, stderr };
    }
    fs.mkdirSync(path.dirname(outLl), { recursive: true });
    fs.writeFileSync(outLl, modules[0].ir);
    stderr += `wrote ${outLl}\n`;
    return { status: 0, stdout, stderr };
  } catch (err) {
    if (err instanceof CompileError) return { status: 1, stdout, stderr: stderr + formatErrorReport(err) + "\n" };
    if (isSystemError(err)) {
      const where = err.path ? ` ${err.path}` : "";
      return {
        status: 1,
        stdout,
        stderr: `${stderr}error: cannot ${err.syscall ?? "access"}${where}: ${err.code}\n`,
      };
    }
    // Anything else is an internal compiler error. Caught rather than allowed
    // to escape so that one broken case does not cost the whole chunk its
    // results; a crash the runtime cannot catch at all is the parent's problem.
    return { status: 70, stdout, stderr: stderr + internalErrorReport(err, src) };
  }
};

const [resultsFile, ...names] = process.argv.slice(2);
if (resultsFile === undefined) {
  console.error("usage: node tests/batch_worker.js <results.ndjson> <case> [<case> ...]");
  process.exitCode = 2;
} else {
  for (const name of names) {
    const record = { name, ...compileCase(name) };
    // Appended per case, not at the end: a case that takes the process down
    // with it is then the first name with no record, which is how the parent
    // attributes a crash to a case instead of to a chunk of fifty.
    fs.appendFileSync(resultsFile, JSON.stringify(record) + "\n");
  }
}
