#!/usr/bin/env node
/**
 * statictsc: StaticTS -> LLVM IR command line driver.
 *
 *   statictsc <entry.ts> [more.ts ...] [-o <out.ll | out-dir/>] [--link <exe>] [options]
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
import { Compilation, EmittedModule } from "./compiler";
import { CompileError, allErrors, diagnosticJson, formatErrorReport } from "./diagnostics";
import { dumpAst, dumpChecked } from "./dump";
import { generateDts, generateHeader, generateNapiShim, generateWasmLoader, wasmLoaderPath } from "./interop";
import { NumberMode } from "./types";
import { SUPPORTED_TARGETS, resolveTarget } from "./codegen/target";
import { PKG_ROOT, packageVersion } from "./version";

const PROFILES = ["speed", "size", "debug"] as const;
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
    "statictsc needs clang (LLVM 18 recommended) on PATH, or CC=<compiler>, to build a binary. Install it with:",
    toolchainInstallHint(),
    "See docs/INSTALL.md. Without --link, statictsc still writes the LLVM IR (.ll) for you to build yourself.",
  ].join("\n");
}

function usage(): never {
  console.error(
    [
      "usage: statictsc <entry.ts> [more.ts ...] [options]",
      "       statictsc --version | --help",
      "  -o, --output <file.ll>     output path for a single module (default: <input>.ll)",
      "  -o, --output <dir>/        output directory: one <dir>/<module>.ll per module",
      "  --link <exe>               build a native binary from every module + runtime/runtime.c",
      "                             (entry module must declare `export function main`)",
      "  --profile speed|size|debug build profile for --link (default: speed)",
      "  --strict-exports           non-exported functions get `internal` linkage",
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
      "  --nsw                      integer add/sub/mul carry `nsw`: signed overflow is undefined (like C)",
      "  --no-stack-alloc           keep every allocation in the arena (disables escape-analysed allocas)",
      "  -g                         emit DWARF debug info (!dbg locations, variables); kept by --link",
      "  --json                     print diagnostics as one JSON object per line on stdout (no excerpt)",
      "  --emit-ast                 print the syntax tree of every module to stdout instead of IR",
      "  --emit-checked             print the checker's tables (signatures, locals, structs, facts) instead of IR",
      "  -v, --version              print the statictsc version and exit",
      "exit codes: 0 ok, 1 compile error, 2 usage, 3 toolchain (clang / build.sh), 70 internal error",
    ].join("\n")
  );
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

function main(argv: string[]): number {
  const inputs: string[] = [];
  let output: string | undefined;
  let link: string | undefined;
  let profile: Profile = "speed";
  let numberMode: NumberMode = "i32";
  let optimizeAttributes = true;
  let runtimeDecls = false;
  let strictExports = false;
  // WP8 interop outputs: each is derived from the checked program after emit.
  let emitHeader: string | undefined;
  let emitDts: string | undefined;
  let emitNapi: string | undefined;
  let uncheckedIndexing = false;
  let target: string | undefined; // WP9: canonical triple, validated below
  let nsw = false;
  let stackAlloc = true;
  // WP10 diagnostics and debugging.
  let debugInfo = false;
  let json = false;
  let dump: "ast" | "checked" | undefined;

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
    } else if (arg === "--no-stack-alloc") {
      stackAlloc = false;
    } else if (arg === "-g") {
      debugInfo = true;
    } else if (arg === "--json") {
      json = true;
    } else if (arg === "--emit-ast") {
      dump = "ast";
    } else if (arg === "--emit-checked") {
      dump = "checked";
    } else if (arg === "-h" || arg === "--help") {
      usage();
    } else if (arg === "-v" || arg === "--version") {
      console.log(`statictsc ${packageVersion()}`);
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
      console.error(problem);
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
    if (process.env.STATICTSC_SIMULATE_ICE) throw new TypeError("simulated internal compiler error");
    for (const input of inputs) compilation.addRoot(input);
    // `--emit-ast` needs only the parsed (and Phase 0 validated) modules; nothing is checked or written.
    if (dump === "ast") {
      for (const unit of compilation.modules) process.stdout.write(dumpAst(unit.sourceFile, unit.fileName));
      return EXIT_OK;
    }
    compilation.check();
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
      if (json) console.log(JSON.stringify({ severity: "error", message: err.message }));
      else console.error(err.message);
      return EXIT_COMPILE_ERROR;
    }
    if (isSystemError(err)) {
      const where = err.path ? ` ${err.path}` : "";
      const message = `cannot ${err.syscall ?? "access"}${where}: ${err.code}`;
      if (json) console.log(JSON.stringify({ severity: "error", message }));
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
      console.error(`--link: ${BUILD_SH} failed (${why}); the IR is in ${outputs.join(", ")}`);
      return EXIT_TOOLCHAIN;
    }
    // build.sh reports `<exe>: <bytes> bytes (<profile>)`.
    process.stderr.write(`linked ${build.stdout}`);
  }
  return EXIT_OK;
}

/**
 * Anything that escapes `main` is a bug in statictsc, not in the user's
 * program: report it as such (EX_SOFTWARE, 70) naming the input files, and
 * show the stack only on request so users are not buried in frames.
 */
function reportInternalError(err: unknown, argv: string[]): number {
  const takesValue = /^(-o|--output|--link|--profile|--number-mode|--emit-header|--emit-dts|--emit-napi|--target)$/;
  const inputs = argv.filter((a, i) => !a.startsWith("-") && !takesValue.test(argv[i - 1] ?? ""));
  const where = inputs.length > 0 ? ` while compiling ${inputs.join(", ")}` : "";
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  console.error(`statictsc ${packageVersion()}: internal compiler error${where}`);
  console.error(`  ${message}`);
  if (process.env.STATICTSC_DEBUG && err instanceof Error && err.stack) {
    console.error(err.stack);
  } else {
    console.error("  (re-run with STATICTSC_DEBUG=1 for the stack trace)");
  }
  console.error("This is a bug in statictsc, not in your program. Please report it with the input file and");
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
process.exit(code);
