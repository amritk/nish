#!/usr/bin/env node
/**
 * The command line driver: source in, LLVM IR out. The name in the usage line
 * below is spelled out because a usage line is read, not printed; every name
 * this file *prints* comes from `./branding`.
 *
 *   amritc <entry.ts> [more.ts ...] [-o <out.ll | out-dir/>] [--link <exe>] [options]
 *
 * The first input is the entry module. Files it imports are compiled too, so
 * a program that spans several modules needs `-o <dir>/` (one `.ll` per
 * module) unless it collapses to a single module. `--link` hands every `.ll`
 * plus the C runtime to scripts/build.sh and produces a native binary.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Compilation, EmittedModule } from "./compiler.js";
import {
  CompileError,
  allErrors,
  diagnosticJson,
  formatErrorReport,
  formatWarningReport,
} from "./diagnostics.js";
import { dumpAst, dumpChecked } from "./dump.js";
import { generateDts, generateHeader, generateNapiShim, generateWasmLoader, wasmLoaderPath } from "./interop/index.js";
import { NumberMode } from "./types.js";
import { SUPPORTED_TARGETS, resolveTarget } from "./codegen/target.js";
import { CLI, ENV_DEBUG, ENV_SIMULATE_ICE } from "./branding.js";
import { INTERNAL, TOOLCHAIN, codeFor } from "./codes.js";
import { PKG_ROOT, packageVersion } from "./version.js";

const PROFILES = ["speed", "size", "debug", "wasi"] as const;
type Profile = (typeof PROFILES)[number];

/**
 * Process exit codes (see docs/wp12-release.md):
 *   0  success
 *   1  the program was rejected (compile error, missing input, bad -o layout)
 *   2  usage error (unknown flag, missing argument, no inputs)
 *   3  toolchain error: `--link` could not find clang, or scripts/build.sh failed
 *   70 internal compiler error (EX_SOFTWARE): an unexpected exception; please report it
 */
const EXIT_OK = 0;
const EXIT_COMPILE_ERROR = 1;
const EXIT_USAGE = 2;
const EXIT_TOOLCHAIN = 3;
const EXIT_INTERNAL = 70;

/** A user-facing error raised by the driver itself (exit 1, message only). */
class CliError extends Error {}

/**
 * The `--json` object for a failure with no source location: an unusable C
 * toolchain, an internal compiler error, a path the driver could not read.
 * Same keys as `diagnosticJson`, minus the ones that need a position, so a
 * reader can parse every line of `--json` output the same way and never has to
 * fall back to scraping stderr to find out why a run failed.
 */
const failureJson = (code: string, message: string): string =>
  JSON.stringify({ severity: "error", code, message });

/** Node system errors (ENOENT on an input file, EACCES on the output dir, ...). */
function isSystemError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && typeof (err as NodeJS.ErrnoException).code === "string";
}

/** `scripts/build.sh` and `runtime/runtime.c`, resolved from the package root so a global install works from any cwd. */
const BUILD_SH = path.join(PKG_ROOT, "scripts", "build.sh");
const RUNTIME_C = path.join(PKG_ROOT, "runtime", "runtime.c");

/** Per-platform install hints for a missing C compiler; the current platform's line is marked with `>`. */
function toolchainInstallHint(): string {
  const lines = [
    ["linux", "Ubuntu / Debian:  sudo apt-get install -y clang-18 lld-18 llvm-18"],
    ["linux", "Fedora:           sudo dnf install clang lld llvm"],
    ["darwin", "macOS:            brew install llvm@18   (or: xcode-select --install)"],
    ["win32", "Windows:          use WSL (Ubuntu) and follow the Ubuntu line"],
  ];
  return lines.map(([platform, text]) => `${platform === os.platform() ? ">" : " "} ${text}`).join("\n");
}

/**
 * Check that the C compiler `scripts/build.sh` will use exists before we spawn
 * it, so a missing toolchain is one clear message instead of a bash trace.
 * Honours `CC` the same way build.sh does. Returns null when usable.
 */
function missingToolchain(): string | null {
  const cc = process.env.CC || "clang";
  const probe = spawnSync(cc, ["--version"], { stdio: "ignore" });
  if (probe.error === undefined && probe.status === 0) return null;
  const why = probe.error ? `${cc}: ${probe.error.message}` : `\`${cc} --version\` exited with ${probe.status}`;
  return [
    `--link: no usable C compiler found (${why}).`,
    `${CLI} needs clang (LLVM 18 recommended) on PATH, or CC=<compiler>, to build a binary. Install it with:`,
    toolchainInstallHint(),
    `See docs/INSTALL.md. Without --link, ${CLI} still writes the LLVM IR (.ll) for you to build yourself.`,
  ].join("\n");
}

/**
 * The usage text. Split from the two ways it is printed because they are not
 * the same event: `--help` is a request that succeeded (stdout, exit 0, in
 * `main`), and a usage error is a refusal (`usage` below: stderr, exit 2).
 */
const usageText = (): string =>
  [
    `usage: ${CLI} <entry.ts> [more.ts ...] [options]`,
    `       ${CLI} --version | --help`,
    "  -o, --output <file.ll>     output path for a single module (default: <input>.ll)",
    "  -o, --output <dir>/        output directory: one <dir>/<module>.ll per module",
    "  --link <exe>               build a native binary from every module + runtime/runtime.c",
    "                             (entry module must declare `export function main`)",
    "  --profile speed|size|debug|wasi",
    "                             build profile for --link (default: speed); wasi needs a WASI sysroot",
    "  --no-strict-exports        every function is an external symbol (default: non-exported",
    "                             functions get `internal` linkage)",
    "  --number-mode i32|f64      lowering of `number` (default: i32)",
    "  --plain                    no performance attributes or alignment hints",
    "  --runtime-decls            always emit the runtime ABI prelude (arena + strings)",
    "  --emit-header <file.h>     also write a C header for the callable functions",
    "  --emit-dts <file.d.ts>     also write TypeScript declarations for the wasm exports, plus",
    "                             <file>.mjs, a loader that marshals typed arrays",
    "  --emit-napi <shim.c>       also write an N-API shim (build with --profile napi)",
    "  --unchecked-indexing       drop array bounds checks (unsafe; for benchmarks)",
    "  --target <triple>|host     emit `target datalayout`/`target triple` for that machine",
    `                             (${SUPPORTED_TARGETS.join(", ")}); default: target-neutral IR`,
    "  --wrapping                 signed integer add/sub/mul wrap two's-complement (default: they",
    "                             carry `nsw`, so signed overflow is undefined, like C)",
    "  --no-stack-alloc           keep every allocation in the arena (disables escape-analysed allocas)",
    "  --no-warn-performance      do not report the `performance` diagnostics (WP15 §8; they are on by",
    "                             default, print on stderr, and never change the exit code)",
    "  -g                         emit DWARF debug info (!dbg locations, variables); kept by --link",
    "  --json                     print diagnostics as one JSON object per line on stdout (no excerpt)",
    "  --emit-ast                 print the syntax tree of every module to stdout instead of IR",
    "  --emit-checked             print the checker's tables (signatures, locals, structs, facts) instead of IR",
    `  -v, --version              print the ${CLI} version and exit`,
    "exit codes: 0 ok, 1 compile error, 2 usage, 3 toolchain (clang / build.sh), 70 internal error",
  ].join("\n");

/**
 * A usage *error*: the request was refused, so the text goes to stderr and the
 * exit code is 2. `-h` / `--help` is the other half and deliberately not this
 * one -- see the branch in `main`.
 */
function usage(): never {
  console.error(usageText());
  process.exit(EXIT_USAGE);
}

function isDirectoryOutput(out: string): boolean {
  if (out.endsWith("/") || out.endsWith(path.sep)) return true;
  try {
    return fs.statSync(out).isDirectory();
  } catch {
    return false;
  }
}

/** Decide where each module's IR goes; returns paths in module order. */
function planOutputs(
  compilation: Compilation,
  modules: EmittedModule[],
  output: string | undefined,
  link: string | undefined
): string[] {
  const stems = compilation.outputStems();
  const perModule = (dir: string) => modules.map((m) => path.join(dir, `${stems.get(m.unit)!}.ll`));

  if (output !== undefined) {
    if (isDirectoryOutput(output)) return perModule(output);
    if (modules.length === 1) return [output];
    const names = modules.map((m) => m.unit.fileName).join(", ");
    throw new CliError(
      `${modules.length} modules would be written (${names}); pass \`-o <dir>/\` to write one .ll per module`
    );
  }
  if (link !== undefined) {
    // Keep intermediates next to the binary rather than next to the sources.
    return modules.length === 1 ? [`${link}.ll`] : perModule(`${link}.modules`);
  }
  return modules.map((m) => m.unit.fileName.replace(/\.ts$/, "") + ".ll");
}

/**
 * Print the `performance` diagnostics of a successful compilation (WP15 §8),
 * capped like the error report at `MAX_REPORTED_ERRORS`. Never changes the
 * exit code and never writes anything when the class is switched off or when
 * nothing was found.
 */
const reportPerformance = (compilation: Compilation, enabled: boolean, json: boolean): void => {
  if (!enabled) return;
  const warnings = compilation.sink.performanceWarnings;
  if (warnings.length === 0) return;
  if (json) for (const w of warnings) console.log(diagnosticJson(w));
  else console.error(formatWarningReport(warnings));
};

function main(argv: string[]): number {
  const inputs: string[] = [];
  let output: string | undefined;
  let link: string | undefined;
  let profile: Profile = "speed";
  let numberMode: NumberMode = "i32";
  let optimizeAttributes = true;
  let runtimeDecls = false;
  // WP15 §3: both fast defaults are on; `--no-strict-exports` and `--wrapping` opt out.
  let strictExports = true;
  // WP8 interop outputs: each is derived from the checked program after emit.
  let emitHeader: string | undefined;
  let emitDts: string | undefined;
  let emitNapi: string | undefined;
  let uncheckedIndexing = false;
  let target: string | undefined; // WP9: canonical triple, validated below
  let nsw = true;
  let stackAlloc = true;
  // WP10 diagnostics and debugging.
  let debugInfo = false;
  let json = false;
  let dump: "ast" | "checked" | undefined;
  // WP15 §8: the performance warnings are on by default. The checker computes
  // them either way — the walk is a few hundred nodes and costs nothing worth
  // a `CompilerOptions` field that both compilers, `--emit-checked` and the
  // interop surfaces would then have to carry — and this only decides whether
  // the driver prints them.
  let warnPerformance = true;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-o" || arg === "--output") {
      output = argv[++i];
      if (!output) usage();
    } else if (arg === "--emit-header") {
      emitHeader = argv[++i];
      if (!emitHeader) usage();
    } else if (arg === "--emit-dts") {
      emitDts = argv[++i];
      if (!emitDts) usage();
    } else if (arg === "--emit-napi") {
      emitNapi = argv[++i];
      if (!emitNapi) usage();
    } else if (arg === "--link") {
      link = argv[++i];
      if (!link) usage();
    } else if (arg === "--profile") {
      const p = argv[++i];
      if (!PROFILES.includes(p as Profile)) usage();
      profile = p as Profile;
    } else if (arg === "--strict-exports") {
      strictExports = true;
    } else if (arg === "--no-strict-exports") {
      strictExports = false;
    } else if (arg === "--number-mode") {
      const mode = argv[++i];
      if (mode !== "i32" && mode !== "f64") usage();
      numberMode = mode;
    } else if (arg === "--plain") {
      optimizeAttributes = false;
    } else if (arg === "--runtime-decls") {
      runtimeDecls = true;
    } else if (arg === "--unchecked-indexing") {
      uncheckedIndexing = true;
    } else if (arg === "--target") {
      const spec = argv[++i];
      const resolved = spec ? resolveTarget(spec) : undefined;
      if (!resolved) {
        console.error(
          `--target: unsupported target \`${spec ?? ""}\` (supported: host, ${SUPPORTED_TARGETS.join(", ")})`
        );
        usage();
      }
      target = resolved.triple;
    } else if (arg === "--nsw") {
      nsw = true;
    } else if (arg === "--wrapping") {
      nsw = false;
    } else if (arg === "--no-stack-alloc") {
      stackAlloc = false;
    } else if (arg === "--no-warn-performance") {
      warnPerformance = false;
    } else if (arg === "-g") {
      debugInfo = true;
    } else if (arg === "--json") {
      json = true;
    } else if (arg === "--emit-ast") {
      dump = "ast";
    } else if (arg === "--emit-checked") {
      dump = "checked";
    } else if (arg === "-h" || arg === "--help") {
      // A request that succeeded, not a refusal: stdout and exit 0, the way
      // clang, tsc and git answer it, so a script or an agent that wraps the
      // compiler can read the text without treating the run as a failure.
      // `usage()` keeps stderr and exit 2 for an actual usage error. Returning
      // rather than calling `process.exit` matters here for the reason at the
      // bottom of this file: the usage text is the longest thing the driver
      // writes to stdout and `process.exit` would truncate it into a pipe.
      console.log(usageText());
      return EXIT_OK;
    } else if (arg === "-v" || arg === "--version") {
      console.log(`${CLI} ${packageVersion()}`);
      return EXIT_OK;
    } else if (arg.startsWith("-")) {
      console.error(`unknown option: ${arg}`);
      usage();
    } else {
      inputs.push(arg);
    }
  }
  if (inputs.length === 0) usage();

  let modules: EmittedModule[];
  let outputs: string[];
  // Fail fast on a missing toolchain: no point compiling if we cannot link.
  if (link !== undefined) {
    const problem = missingToolchain();
    if (problem !== null) {
      if (json) console.log(failureJson(TOOLCHAIN, problem));
      else console.error(problem);
      return EXIT_TOOLCHAIN;
    }
  }

  const compilation = new Compilation({
    numberMode,
    optimizeAttributes,
    runtimeDecls,
    strictExports,
    uncheckedIndexing,
    target,
    nsw,
    stackAlloc,
    debugInfo,
  });
  try {
    // Test hook for the internal-error path (tests/run.js, WP12 block); not a user feature.
    if (process.env[ENV_SIMULATE_ICE]) throw new TypeError("simulated internal compiler error");
    for (const input of inputs) compilation.addRoot(input);
    // `--emit-ast` needs only the parsed (and Phase 0 validated) modules; nothing is checked or written.
    if (dump === "ast") {
      for (const unit of compilation.modules) process.stdout.write(dumpAst(unit.sourceFile, unit.fileName));
      return EXIT_OK;
    }
    compilation.check();
    // WP15 §8. Only a compilation that got this far has warnings to print: an
    // error report is never diluted with advice, so the `catch` below drops
    // them. They go to stderr like every other human-readable diagnostic, and
    // to stdout as JSON objects under `--json`, and neither touches the exit
    // code.
    reportPerformance(compilation, warnPerformance, json);
    if (dump === "checked") {
      process.stdout.write(dumpChecked(compilation));
      return EXIT_OK;
    }
    if (link !== undefined && !compilation.entry.checker.program.entryMain) {
      throw new CliError(
        `--link: the entry module ${compilation.entry.fileName} must declare \`export function main(): number\` (or \`: void\`)`
      );
    }
    modules = compilation.emit();
    outputs = planOutputs(compilation, modules, output, link);
  } catch (err) {
    // Expected failures: the program is wrong (CompileError), the driver refused
    // the request (CliError), or an input/output path is unusable (ENOENT, ...).
    if (err instanceof CompileError) {
      // `--json`: one object per line on stdout for editors; otherwise the
      // human report (every collected error, capped) on stderr.
      if (json) for (const e of allErrors(err)) console.log(diagnosticJson(e));
      else console.error(formatErrorReport(err));
      return EXIT_COMPILE_ERROR;
    }
    if (err instanceof CliError) {
      if (json) console.log(failureJson(codeFor("error", err.message), err.message));
      else console.error(err.message);
      return EXIT_COMPILE_ERROR;
    }
    if (isSystemError(err)) {
      const where = err.path ? ` ${err.path}` : "";
      const message = `cannot ${err.syscall ?? "access"}${where}: ${err.code}`;
      if (json) console.log(failureJson(codeFor("error", message), message));
      else console.error(`error: ${message}`);
      return EXIT_COMPILE_ERROR;
    }
    throw err; // anything else is an internal compiler error, reported at top level
  }

  modules.forEach((m, i) => {
    fs.mkdirSync(path.dirname(outputs[i]), { recursive: true });
    fs.writeFileSync(outputs[i], m.ir);
    console.error(`wrote ${outputs[i]}`);
  });

  // Interop artefacts (WP8). They read the same signatures the IR was emitted from.
  const sidecars: [string | undefined, () => string][] = [
    [emitHeader, () => generateHeader(compilation, emitHeader!)],
    [emitDts, () => generateDts(compilation)],
    // The `.d.ts` declares `load()`; the `.mjs` next to it implements it (array marshalling included).
    [emitDts && wasmLoaderPath(emitDts), () => generateWasmLoader(compilation, emitDts!)],
    [emitNapi, () => generateNapiShim(compilation)],
  ];
  for (const [file, generate] of sidecars) {
    if (file === undefined) continue;
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    fs.writeFileSync(file, generate());
    console.error(`wrote ${file}`);
  }

  if (link !== undefined) {
    fs.mkdirSync(path.dirname(path.resolve(link)), { recursive: true });
    // `-g` is passed through so runtime.c gets debug info too and build.sh does not strip the binary.
    const flags = debugInfo ? ["-g"] : [];
    const build = spawnSync("bash", [BUILD_SH, ...outputs, RUNTIME_C, "-o", link, "--profile", profile, ...flags], {
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    });
    if (build.error !== undefined || build.status !== 0) {
      // Surface the compiler/linker output verbatim, then say what failed.
      if (build.stderr) process.stderr.write(build.stderr.endsWith("\n") ? build.stderr : `${build.stderr}\n`);
      const why = build.error ? `could not run bash: ${build.error.message}` : `exit ${build.status}`;
      const failed = `--link: ${BUILD_SH} failed (${why}); the IR is in ${outputs.join(", ")}`;
      if (json) console.log(failureJson(TOOLCHAIN, failed));
      else console.error(failed);
      return EXIT_TOOLCHAIN;
    }
    // build.sh reports `<exe>: <bytes> bytes (<profile>)`.
    process.stderr.write(`linked ${build.stdout}`);
  }
  return EXIT_OK;
}

/**
 * Anything that escapes `main` is a bug in amritc, not in the user's
 * program: report it as such (EX_SOFTWARE, 70) naming the input files, and
 * show the stack only on request so users are not buried in frames.
 */
function reportInternalError(err: unknown, argv: string[]): number {
  const takesValue = /^(-o|--output|--link|--profile|--number-mode|--emit-header|--emit-dts|--emit-napi|--target)$/;
  const inputs = argv.filter((a, i) => !a.startsWith("-") && !takesValue.test(argv[i - 1] ?? ""));
  const where = inputs.length > 0 ? ` while compiling ${inputs.join(", ")}` : "";
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  // Read off argv rather than passed in: this runs outside `main`, which is the
  // point -- it catches what `main` could not. Under `--json` the crash is a
  // parseable line too, so a wrapper is never left with an empty stdout and an
  // exit code it has to guess about; the human report still goes to stderr.
  if (argv.includes("--json")) {
    console.log(failureJson(INTERNAL, `internal compiler error${where}: ${message}`));
  }
  console.error(`${CLI} ${packageVersion()}: internal compiler error${where}`);
  console.error(`  ${message}`);
  if (process.env[ENV_DEBUG] && err instanceof Error && err.stack) {
    console.error(err.stack);
  } else {
    console.error(`  (re-run with ${ENV_DEBUG}=1 for the stack trace)`);
  }
  console.error(`This is a bug in ${CLI}, not in your program. Please report it with the input file and`);
  console.error("the command line at https://github.com/amritk/compiler/issues");
  return EXIT_INTERNAL;
}

const argv = process.argv.slice(2);
let code: number;
try {
  code = main(argv);
} catch (err) {
  code = reportInternalError(err, argv);
}
// `process.exit` here would drop whatever is still buffered in stdout: writes
// to a pipe are asynchronous and take 64 KB at a time, so `--emit-checked` on a
// program of any size came out truncated mid-line when the output was piped
// rather than written to a terminal or a file. Setting the code instead lets
// Node flush the pending write and then exit with it; nothing in the compiler
// holds the event loop open, so the process still exits as soon as it is done.
process.exitCode = code;
