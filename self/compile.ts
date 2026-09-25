// `compile <entry.ts> [flags]`: stage1's compiler driver
// (docs/wp14-selfhost.md milestones S4 and S5).
//
// It loads the entry module and everything it imports — and every other file
// named on the command line, which is how a program names a module nothing
// imports — checks the program as a whole, and writes one `.ll` per module.
// Where they go is `planOutputs` below, and the rules are stage0's: `-o
// <dir>/` is one file per module, `-o <file.ll>` is the one module, `--link
// <exe>` puts them beside the binary, and naming nothing writes `<module>.ll`
// next to each source. Every directory in the way is made, the sidecars'
// included.
//
// The flags are the subset of stage0's that change the IR, `-g` included:
// DWARF is metadata in the `.ll` and costs the driver nothing. `--emit-checked`
// is here too, because the dump is this compiler's own tables and stage1
// already writes them byte for byte as stage0 does
// (`tests/self/checked_oracle.js`).
//
// The WP15 §8 performance warnings are here for the same reason and on the
// same terms: they change no byte of the IR, the analysis behind them is
// `self/checker.ts`'s and is already compared against stage0's word for word,
// so what was missing was the driver printing them. `--no-warn-performance`
// silences them, as it does on the other side.
//
// `--emit-header`, `--emit-dts` and `--emit-napi` write the WP8 sidecars
// beside the IR, spelled and placed exactly as stage0 spells and places them
// (`tests/self/interop_oracle.js` compares every byte), each into a directory
// made the way the IR's is.
//
// `-o`, `--link` and `--profile` are stage1's too, which is D4 answered rather
// than kept: `mkdirSync` and `spawnSync` are two runtime calls, and with them
// the output planning is the same twenty lines `src/index.ts` has and the link
// is the same `bash scripts/build.sh` that stage0 spawns. Nothing about the
// platform comes in with them, because the `uname` and the profile flag sets
// live in that script and always did — for both compilers.
//
// `--emit-ast` is answered here too (WP19 R1), and *what* it answers is the
// decision: stage0's AST dump prints the `typescript` package's node names and
// line:column spans, and stage1's tree is the flattened one `self/nodes.ts`
// defines, with its own vocabulary and byte offsets. Printing someone else's
// node names would be imitation rather than parity, so both compilers answer
// the flag and each answers it about its own tree. The printer is
// `ast_text.ts`, shared with `dump_ast.ts` so the flag and the parser oracle
// cannot drift, and the goldens are per compiler
// (`tests/cases/dump_ast.stdout` is stage0's, `tests/self/dump_ast.golden`
// this one's) because there is nothing between them to be an oracle.

import { astText } from "./ast_text";
import { CLI, VERSION } from "./branding";
import { Compilation } from "./compilation";
import { NUMBER_MODE_F64, NUMBER_MODE_I32 } from "./context";
import { checkedText } from "./dump";
import { acceptsSidecars, ExternalFunction, externalFunctions } from "./interop_abi";
import { generateDts } from "./interop_dts";
import { generateHeader } from "./interop_header";
import { generateNapiShim, napiBridges } from "./interop_napi";
import { generateWasmLoader, wasmLoaderPath } from "./interop_wasm";
import { Options } from "./options";
import { dirname } from "./paths";
import { jsonQuote, splitByte } from "./strings";
import { codeFor, TOOLCHAIN } from "./codes";
import { internalErrorFor, simulatedInternalError } from "./ice";
import { resolveTarget, supportedTargets } from "./target";

const usageText = (): string =>
  `usage: ${CLI} <file.ts> [more.ts ...] [-o, --output <file.ll>|<dir>/] [--link <exe>] [--profile speed|size|debug|wasi] [--number-mode i32|f64] [--plain] [--no-strict-exports] [--unchecked-indexing] [--wrapping] [--no-stack-alloc] [--threads] [--no-warn-performance] [--runtime-decls] [--target <triple>|host] [-g] [--json] [--emit-ast] [--emit-checked] [--emit-header <file.h>] [--emit-dts <file.d.ts>] [--emit-napi <shim.c>] [--emit-napi-async <shim.c>]\n       ${CLI} -v, --version | -h, --help`;

/**
 * The link recipes `scripts/build.sh` knows, in the order stage0 lists them
 * (`PROFILES` in `src/index.ts`). A module constant is a scalar here, so the
 * set is a predicate and the list is the string the message needs.
 */
const PROFILE_NAMES: string = "speed, size, debug, wasi";

const isProfile = (name: string): boolean => name === "speed" || name === "size" || name === "debug" || name === "wasi";

/**
 * `mkdir -p`: the directory and every parent it needs. `mkdirSync` makes one
 * level and answers whether it is there afterwards, so this is the walk up and
 * back down that Node's `{ recursive: true }` hides.
 *
 * Answers false for the first level that could not be made, which the caller
 * turns into its own message: the compiler has no exceptions and the path is
 * the useful half of the diagnostic.
 */
const makeDirectory = (dir: string): boolean => {
  if (dir.length === 0 || dir === "." || dir === "/") {
    return true;
  }
  const parent = dirname(dir);
  if (parent !== dir && !makeDirectory(parent)) {
    return false;
  }
  return mkdirSync(dir);
};

/** `makeDirectory(dirname(file))`, reported once and the same way everywhere. */
const makeDirectoryFor = (file: string): boolean => {
  const dir = dirname(file);
  if (makeDirectory(dir)) {
    return true;
  }
  console.error(`compile: cannot create directory ${dir}`);
  return false;
};

/**
 * Where each module's IR goes, in module order — the same rules as
 * `planOutputs` in `src/index.ts`:
 *
 *   -o <dir>/     one `.ll` per module, named by its stem
 *   -o <file.ll>  the one module's IR; two or more modules is refused, with
 *                 their names, rather than silently picking one
 *   --link <exe>  `<exe>.ll` for a single module, `<exe>.modules/` otherwise,
 *                 so the intermediates land beside the binary
 *   (none)        `<module>.ll` beside each source
 *
 * Answers an empty array when it refused, having said why.
 *
 * `-o <dir>` *without* the trailing slash is a directory too when one is
 * already there, which is stage0's rule and needed the `stat` that
 * `isDirectorySync` now is (WP14 §7a). The trailing slash still names a
 * directory that does not exist yet, which is why both tests are here and in
 * that order: the spelling first, because it is an answer about the string and
 * not about the file system, and it is the one every caller in the tree writes.
 */
const planOutputs = (stems: string[], paths: string[], output: string, link: string): string[] => {
  const out: string[] = [];
  if (output.length > 0) {
    if (output.endsWith("/")) {
      return perModule(stems, output.substring(0, output.length - 1));
    }
    if (isDirectorySync(output)) {
      return perModule(stems, output);
    }
    if (stems.length === 1) {
      out.push(output);
      return out;
    }
    console.error(
      `compile: ${stems.length} modules would be written (${paths.join(", ")}); pass \`-o <dir>/\` to write one .ll per module`
    );
    return out;
  }
  if (link.length > 0) {
    // Keep intermediates next to the binary rather than next to the sources.
    if (stems.length === 1) {
      out.push(`${link}.ll`);
      return out;
    }
    return perModule(stems, `${link}.modules`);
  }
  for (const path of paths) {
    out.push(path.endsWith(".ts") ? `${path.substring(0, path.length - 3)}.ll` : `${path}.ll`);
  }
  return out;
};

const perModule = (stems: string[], dir: string): string[] => {
  const out: string[] = [];
  for (const stem of stems) {
    out.push(`${dir}/${stem}.ll`);
  }
  return out;
};

/**
 * The diagnostics of a failed compilation, in whichever of stage0's two shapes
 * was asked for: `--json` is one flat object per line on **stdout**, every
 * error and no excerpt, for an editor to read; the default is the human report
 * on stderr, capped where stage0 caps it.
 */
const report = (compilation: Compilation, json: boolean): void => {
  if (!json) {
    writeError(`${compilation.sink.format(20)}\n`);
    return;
  }
  for (const diagnostic of compilation.sink.sorted()) {
    console.log(diagnostic.json());
  }
};

/**
 * The WP15 §8 performance warnings, in the same two shapes and on the same two
 * streams stage0 prints them on (`reportPerformance` in `src/index.ts`): the
 * human report on **stderr**, capped where the error report is capped, or one
 * flat object per warning on **stdout** under `--json`. Neither touches the
 * exit code, and `--no-warn-performance` silences both.
 *
 * Only a compilation that checked cleanly gets here, which is the rule and not
 * an accident of placement: advice about code that does not compile is noise,
 * and the caller returns before this on an error.
 */
const reportPerformance = (compilation: Compilation, enabled: boolean, json: boolean): void => {
  if (!enabled) {
    return;
  }
  if (compilation.sink.warnings.length === 0) {
    return;
  }
  if (json) {
    for (const warning of compilation.sink.warnings) {
      console.log(warning.json());
    }
    return;
  }
  writeError(`${compilation.sink.formatWarnings(20)}\n`);
};

/**
 * A failure that belongs to the command line rather than to the program: it
 * has no source span, so it cannot go through the sink. stage0 prints it with
 * an `error:` prefix on stderr, or as one flat object on stdout under
 * `--json`, and this answers in the same two shapes.
 */
const reportRootFailure = (message: string, json: boolean): void => {
  if (json) {
    console.log(`{"severity":"error","code":"${codeFor("error", message)}","message":${jsonQuote(message)}}`);
    return;
  }
  console.error(`error: ${message}`);
};

/**
 * A `--link` failure: the C toolchain could not be used, so the run is wrong
 * rather than the program. stage0 shapes it the same way (`failureJson` in
 * `src/index.ts`) and both carry the band-0 code, so a reader parses one shape
 * whichever compiler it ran.
 */
const reportToolchainFailure = (message: string, json: boolean): void => {
  if (json) {
    console.log(`{"severity":"error","code":"${TOOLCHAIN}","message":${jsonQuote(message)}}`);
    return;
  }
  console.error(message);
};

/**
 * The install line for a C toolchain on each platform, the one this compiler is
 * running on marked with `>`, so the reader finds theirs without being told
 * which it is.
 */
const toolchainInstallHint = (): string => {
  const lines: string[] = [];
  lines.push(`${platformMark("linux")} Ubuntu / Debian:  sudo apt-get install -y clang-18 lld-18 llvm-18`);
  lines.push(`${platformMark("linux")} Fedora:           sudo dnf install clang lld llvm`);
  lines.push(`${platformMark("darwin")} macOS:            brew install llvm@18   (or: xcode-select --install)`);
  lines.push(`${platformMark("win32")} Windows:          use WSL (Ubuntu) and follow the Ubuntu line`);
  return lines.join("\n");
};

/** `>` beside the install line for the platform this compiler is running on. */
const platformMark = (platform: string): string => (process.platform === platform ? ">" : " ");

/**
 * Whether the C compiler `scripts/build.sh` will use can be run at all: `CC`
 * when it is set and not empty, `clang` otherwise -- the rule the script itself
 * follows -- asked for `--version` with both streams discarded. Empty when it
 * answers 0, and otherwise the whole report, which names what was run, what it
 * answered, and how to install one.
 */
const missingToolchain = (): string => {
  const fromEnvironment = getenv("CC");
  const cc = fromEnvironment !== null && fromEnvironment.length > 0 ? fromEnvironment : "clang";
  const probe: string[] = [];
  probe.push(cc);
  probe.push("--version");
  const status = spawnSyncTo(probe, "/dev/null", "/dev/null");
  if (status === 0) {
    return "";
  }
  const why = status < 0 ? `${cc} could not be run` : `\`${cc} --version\` exited with ${status}`;
  const lines: string[] = [];
  lines.push(`--link: no usable C compiler found (${why}).`);
  lines.push(
    `${CLI} needs clang (LLVM 18 recommended) on PATH, or CC=<compiler>, to build a binary. Install it with:`
  );
  lines.push(toolchainInstallHint());
  lines.push(`See docs/INSTALL.md. Without --link, ${CLI} still writes the LLVM IR (.ll) for you to build yourself.`);
  return lines.join("\n");
};

export const main = (): number => {
  if (process.argv.length < 2) {
    console.error(usageText());
    return 2;
  }
  const opts = new Options();
  // Where `nish/<module>` is resolved from, worked out once here because this
  // is the only place `process.argv` is legal (`packageRoot`).
  opts.packageRoot = packageRoot();
  const roots: string[] = [];
  let output = "";
  let link = "";
  let profile = "speed";
  let json = false;
  let emitChecked = false;
  let emitAst = false;
  // WP15 §8: on by default on both sides, and driver-level rather than an
  // `Options` field, because it changes no byte of the IR.
  let warnPerformance = true;
  let arg = 1;
  while (arg < process.argv.length) {
    const value = process.argv[arg];
    if (value === "--number-mode") {
      arg = arg + 1;
      if (arg >= process.argv.length) {
        console.error("compile: --number-mode needs a value (i32 or f64)");
        return 2;
      }
      const mode = process.argv[arg];
      if (mode !== "i32" && mode !== "f64") {
        // stage0 refuses an unknown mode rather than falling back to i32
        // (`src/index.ts`), and a silent fallback is the worst of the three
        // outcomes: the program compiles, in the other arithmetic.
        console.error(`compile: --number-mode must be i32 or f64, not \`${mode}\``);
        return 2;
      }
      opts.numberMode = mode === "f64" ? NUMBER_MODE_F64 : NUMBER_MODE_I32;
    } else if (value === "-o" || value === "--output") {
      arg = arg + 1;
      if (arg >= process.argv.length) {
        console.error("compile: -o needs a file or a directory");
        return 2;
      }
      output = process.argv[arg];
    } else if (value === "--link") {
      arg = arg + 1;
      if (arg >= process.argv.length) {
        console.error("compile: --link needs an output name");
        return 2;
      }
      link = process.argv[arg];
    } else if (value === "--profile") {
      arg = arg + 1;
      if (arg >= process.argv.length) {
        console.error(`compile: --profile needs one of ${PROFILE_NAMES}`);
        return 2;
      }
      profile = process.argv[arg];
      if (!isProfile(profile)) {
        // Refused before anything is compiled, as stage0 refuses it: the
        // recipe is not known and the compile would be spent for nothing.
        console.error(`compile: unknown profile \`${profile}\` (${PROFILE_NAMES})`);
        return 2;
      }
    } else if (value === "--target") {
      arg = arg + 1;
      if (arg >= process.argv.length) {
        console.error("compile: --target needs a triple");
        return 2;
      }
      const spec = process.argv[arg];
      const resolved = resolveTarget(spec);
      if (resolved === null) {
        console.error(
          `compile: unsupported target \`${spec}\`; supported: host, ${supportedTargets().join(", ")}`
        );
        return 2;
      }
      // The canonical triple, not the spelling that was typed: `host` and the
      // aliases are resolved once here, as stage0 resolves them once in its
      // own flag loop, so the emitter never asks the machine anything.
      opts.target = resolved.triple;
    } else if (value === "--emit-header") {
      arg = arg + 1;
      if (arg >= process.argv.length) {
        console.error("compile: --emit-header needs a file");
        return 2;
      }
      opts.emitHeader = process.argv[arg];
    } else if (value === "--emit-dts") {
      arg = arg + 1;
      if (arg >= process.argv.length) {
        console.error("compile: --emit-dts needs a file");
        return 2;
      }
      opts.emitDts = process.argv[arg];
    } else if (value === "--emit-napi") {
      arg = arg + 1;
      if (arg >= process.argv.length) {
        console.error("compile: --emit-napi needs a file");
        return 2;
      }
      opts.emitNapi = process.argv[arg];
    } else if (value === "--emit-napi-async") {
      arg = arg + 1;
      if (arg >= process.argv.length) {
        console.error("compile: --emit-napi-async needs a file");
        return 2;
      }
      opts.emitNapiAsync = process.argv[arg];
    } else if (value === "--plain") {
      opts.optimizeAttributes = false;
    } else if (value === "--strict-exports") {
      opts.strictExports = true;
    } else if (value === "--no-strict-exports") {
      opts.strictExports = false;
    } else if (value === "--unchecked-indexing") {
      opts.uncheckedIndexing = true;
    } else if (value === "--nsw") {
      opts.nsw = true;
    } else if (value === "--wrapping") {
      opts.nsw = false;
    } else if (value === "--no-stack-alloc") {
      opts.stackAlloc = false;
    } else if (value === "--threads") {
      opts.threads = true;
    } else if (value === "--no-warn-performance") {
      warnPerformance = false;
    } else if (value === "--runtime-decls") {
      opts.runtimeDecls = true;
    } else if (value === "--range-reference") {
      // Not in the usage: the test hook `Options.rangeReference` describes.
      opts.rangeReference = true;
    } else if (value === "-g") {
      opts.debugInfo = true;
    } else if (value === "--json") {
      json = true;
      opts.json = true;
    } else if (value === "--emit-checked") {
      emitChecked = true;
    } else if (value === "--emit-ast") {
      emitAst = true;
    } else if (value === "-h" || value === "--help") {
      // A request that succeeded, not a refusal: stdout and exit 0. stage0
      // answers it the same way (`usageText` in `src/index.ts`), so a script
      // that asks either compiler for its help sees the same shape; an actual
      // usage error still prints the usage on stderr and returns 2 below.
      console.log(usageText());
      return 0;
    } else if (value === "-v" || value === "--version") {
      // The line stage0 prints. stage1 cannot read `package.json`, so the
      // version is a constant in `self/branding.ts` and a check in
      // `tests/run.js` fails if the two ever disagree.
      console.log(`${CLI} ${VERSION}`);
      return 0;
    } else if (value.startsWith("-")) {
      console.error(`compile: unknown flag \`${value}\`\n${usageText()}`);
      return 2;
    } else {
      // Every positional is a root, as it is for stage0: a program whose
      // modules do not all reach the entry by `import` is named by listing
      // them. The first one is the entry.
      roots.push(value);
    }
    arg = arg + 1;
  }
  if (roots.length === 0) {
    console.error(usageText());
    return 2;
  }
  // What the build hands on decides who else may call the program's exports
  // (`hostVisible` in `self/visibility.ts`), so the checker is told.
  opts.link = link;
  opts.profile = profile;
  // WP24 A1: an asynchronous export allocates on a libuv worker while the JS
  // thread keeps going, so the arena has to be thread-local on both sides --
  // and its storage class is decided per module, not only in the runtime. A
  // module compiled without `--threads` reads `@nish_arena` as a plain global
  // when it allocates inline, which neither the shim's own `#error` nor the
  // link can see: a non-TLS reference against the runtime's `_Thread_local`
  // definition links without complaint in the `-shared -fPIC` napi build. So
  // it is refused where both facts are known, rather than turned on silently.
  if (opts.emitNapiAsync.length > 0 && !opts.threads) {
    console.error(`compile: --emit-napi-async requires --threads (its exports allocate on a worker thread)`);
    return 2;
  }

  // `--link` needs a C compiler, and a missing one is a problem with the run
  // rather than with the program, so it is found out before anything is
  // compiled or written: one clear sentence with the install line for this
  // platform, instead of `scripts/build.sh` failing after the IR is on disk.
  if (link.length > 0) {
    const problem = missingToolchain();
    if (problem.length > 0) {
      reportToolchainFailure(problem, json);
      return 3;
    }
  }

  // The exit-70 path on demand (`self/ice.ts`), at the point stage0 raised
  // its own: the command line is valid and nothing is compiled yet. It is the
  // real report, `--json` object included, so what the hook shows is what a
  // broken invariant would.
  if (simulatedInternalError()) {
    return internalErrorFor(`simulated internal compiler error while compiling ${roots[0]}`, json);
  }

  const compilation = new Compilation(opts);
  // The tree is printed from what parsed and validated, so pass 1's refusals
  // do not stop the load — stage0 records them and reaches its dump first.
  compilation.dumpOnly = emitAst;
  let loaded = true;
  for (const root of roots) {
    // A root is named by the path it was given, but its identity is
    // `identityOf` that path, so a root the entry already imports under
    // another spelling is found in `byPath` rather than loaded twice.
    if (!compilation.load(root, root, "")) {
      loaded = false;
      break;
    }
  }
  if (!loaded) {
    if (compilation.unreadableRoot.length > 0) {
      // stage0 answers a root it cannot open with the syscall it failed at,
      // on stderr with an `error:` prefix, or as one JSON object under
      // `--json` (`src/index.ts`). The errno itself stays stage0's: Node names
      // it, and `readFileSyncOrNull` answers null without saying why.
      reportRootFailure(`cannot open ${compilation.unreadableRoot}`, json);
    } else if (compilation.sink.hasErrors()) {
      report(compilation, json);
    }
    return 1;
  }
  // `--emit-ast` needs only the parsed and Phase 0 validated modules, so it
  // answers before `check` and writes no IR — the same point in the pipeline
  // stage0 answers it from. The tree is this compiler's own, not a mirror of
  // stage0's (`ast_text.ts` says why), so the two goldens differ by design.
  //
  // *Validated*, though, is the half that used to be missing: `load` reported
  // a Phase 0 refusal into the sink and answered true anyway, so a program
  // with `any` in it dumped a tree and exited 0 here while stage0 printed the
  // refusal, dumped nothing and exited 1. `load` answers false for that now,
  // so the failure is reported above and this is only ever reached with a
  // validated program — a dump flag does not turn a refused program into a
  // compiling one (WP19 §A3, `tests/cases/dump_ast_reject`).
  if (emitAst) {
    for (const unit of compilation.modules) {
      write(astText(unit.file, unit.name));
    }
    return 0;
  }
  if (!compilation.check()) {
    report(compilation, json);
    return 1;
  }
  reportPerformance(compilation, warnPerformance, json);
  // The checked dump is what pass 2 leaves behind, so it is written here
  // rather than after `emit`: nothing about the IR changes it.
  if (emitChecked) {
    write(checkedText(compilation));
    return 0;
  }
  // `--link` needs an entry point, and stage0 says so before it emits
  // anything rather than letting the linker answer `undefined reference to
  // main` two steps later.
  if (link.length > 0 && compilation.entry().checker.program.entryMain === null) {
    console.error(
      `--link: the entry module ${compilation.entry().name} must declare \`export const main = (): number => ...\` (or \`(): void\`)`
    );
    return 1;
  }
  // A sidecar that cannot describe the program is refused before any IR is
  // emitted or written, so a failed compile leaves nothing behind that the
  // header was meant to go with. No sidecar flag, no question asked (WP18 G8).
  const anySidecar =
    opts.emitHeader.length > 0 || opts.emitDts.length > 0 || opts.emitNapi.length > 0 || opts.emitNapiAsync.length > 0;
  const fns: ExternalFunction[] = anySidecar ? externalFunctions(compilation) : [];
  if (anySidecar && !acceptsSidecars(compilation, cDeclared(compilation, fns))) {
    report(compilation, json);
    return 1;
  }
  const emitted = compilation.emit();
  const stems: string[] = [];
  const paths: string[] = [];
  for (const module of emitted) {
    stems.push(module.stem);
  }
  for (const unit of compilation.modules) {
    paths.push(unit.name);
  }
  const outputs = planOutputs(stems, paths, output, link);
  if (outputs.length === 0) {
    return 1;
  }

  let i = 0;
  while (i < emitted.length) {
    const file = outputs[i];
    if (!makeDirectoryFor(file)) {
      return 1;
    }
    writeFileSync(file, emitted[i].ir);
    // stderr, as stage0 writes it: stdout belongs to `--json` and to the
    // dumps, and a build script that reads either must find nothing else there.
    console.error(`wrote ${file}`);
    i = i + 1;
  }
  if (anySidecar && !writeSidecars(compilation, fns)) {
    return 1;
  }
  if (link.length === 0) {
    return 0;
  }
  return linkProgram(outputs, link, profile, opts.debugInfo, opts.threads, json);
};

/** `:`, the byte `$PATH` is cut on. */
const COLON: i32 = 58;

/**
 * The file `argv[0]` names, when `argv[0]` names no directory — a command found
 * on `$PATH` arrives as the bare word the user typed, so there is nothing to
 * take the parent of and nothing to hand `realpathSync`.
 *
 * The shell ran the first executable of that name on `$PATH`, so the first
 * entry holding a readable file of that name is the one that ran. The file is
 * read rather than stat'd because there is no `isFileSync` in the language and
 * `isDirectorySync` answers the wrong question; the cost is one read of the
 * compiler's own binary, on the one path that reaches here, and only until the
 * first entry matches.
 *
 * It answers the file rather than the root because the caller needs both
 * answers the file gives — the parent of its directory, and the parent of the
 * directory its *real* path is in, which are different directories exactly when
 * a link is what `$PATH` found. Empty when no entry has it, and when `PATH` is
 * unset, so the caller falls through to `.`.
 *
 * An empty `$PATH` entry means the working directory, which is POSIX.
 */
const programOnPath = (program: string): string => {
  const pathVar = getenv("PATH");
  if (pathVar === null) {
    return "";
  }
  const entries = splitByte(pathVar, COLON);
  let i = 0;
  while (i < entries.length) {
    const entry = entries[i];
    const dir = entry.length === 0 ? "." : entry;
    const candidate = `${dir}/${program}`;
    if (readFileSyncOrNull(candidate) !== null) {
      return candidate;
    }
    i = i + 1;
  }
  return "";
};

/**
 * The package root: the directory holding `scripts/`, `runtime/` and `std/`.
 * stage0 reads it from `import.meta.dirname` (`src/version.ts`); this compiler
 * is a binary, so it derives it from the path it was invoked by —
 * `<prefix>/bin/nish` and `build/nish` both put it one level up — and falls
 * back to the working directory, which is what a checkout wants. Empty when
 * nothing has the script, so the caller can say where it looked.
 *
 * **`argv[0]` is not always a path, and it is not always the compiler's own
 * path either. Those are the two things this has to get right**, and each was a
 * release in which an ordinary install could not `--link` (wp19 §5a item 4).
 *
 * A command invoked by a path — `./build/nish`, `/usr/local/bin/nish` — carries
 * its directory, and the parent of that directory is the root. A command found
 * on `$PATH` carries the bare word instead, so `dirname` answers `.` and the
 * parent of the *working directory* gets searched: `--link` then fails against
 * wherever the user happened to be standing, while `--version` and `-o` keep
 * working, because only `--link` needs a file from the package. That is what
 * unpacking a release tarball onto `$PATH` is. `programOnPath` above is the
 * answer for that spelling.
 *
 * And either spelling may name a **symbolic link** rather than the compiler:
 * npm links every command as one (`node_modules/.bin/nish -> ../<pkg>/bin/nish`),
 * and so does an admin's `ln -s /opt/nish/bin/nish /usr/local/bin/nish`. The
 * parent of the *link's* directory is not the package, and a `$PATH` lookup
 * does not help, because the link is itself a perfectly good path. So the real
 * path of whatever was invoked is a candidate too, which is what `realpathSync`
 * is for — the builtin landed one release ahead of this call site, because
 * `self/` is compiled by the last released compiler and may only use what that
 * compiler has (the rolling freeze, wp19 G3).
 *
 * The candidates are tried in order and the first with `scripts/build.sh` in it
 * wins, and the order is where the care is. The unresolved spelling comes first,
 * so a compiler that is *not* reached through a link answers exactly the root it
 * answered before — spelled the way it was invoked rather than absolutely, which
 * is what keeps every `std/` path and every diagnostic where it was — and a link
 * is the only thing that adds a candidate at all. `.` is last and is the
 * fallback for a compiler beside no package whatsoever, which is the checkout a
 * developer is standing in; a symlinked install that *is* a package now wins
 * over that cwd, exactly as a directly-invoked one always did.
 *
 * It lives in the driver rather than beside the path helpers because
 * `process.argv` is legal only in a program with an entry `main`, and every
 * `self/` module is compiled on its own by `tests/run.js`. Everything that
 * needs the root is handed it through `Options.packageRoot`.
 */
const packageRootCandidates = (): string[] => {
  const candidates: string[] = [];
  const program = process.argv[0];
  const invoked = program.indexOf("/") < 0 ? programOnPath(program) : program;
  if (invoked.length > 0) {
    const asInvoked = `${dirname(invoked)}/..`;
    candidates.push(asInvoked);
    // Only when it differs, so the ordinary install — a real path, no link in
    // it — keeps naming one directory in the diagnostic and keeps answering the
    // relative spelling it was invoked with.
    const real = realpathSync(invoked);
    if (real !== null) {
      const throughLink = `${dirname(real)}/..`;
      if (throughLink !== asInvoked) {
        candidates.push(throughLink);
      }
    }
  }
  candidates.push(".");
  return candidates;
};

const packageRoot = (): string => {
  const candidates = packageRootCandidates();
  let i = 0;
  while (i < candidates.length) {
    const root = candidates[i];
    if (readFileSyncOrNull(`${root}/scripts/build.sh`) !== null) {
      return root;
    }
    i = i + 1;
  }
  return "";
};

/**
 * `--link`: hand the emitted IR and `runtime/runtime.c` to
 * `scripts/build.sh`, which is the same script `src/index.ts` spawns and the
 * only place either compiler knows what `uname` says or what `-O3 -flto` is
 * spelled on this platform. Answers the process exit code.
 *
 * The script's own stdout — one `<exe>: <n> bytes (<profile>)` line — is sent
 * to `/dev/null` and re-emitted here with stage0's `linked ` prefix, from the
 * size of the file it just wrote, so both compilers print the same line on the
 * same stream. Its stderr is inherited, so a clang diagnostic reaches the
 * caller as it happens rather than after the link has finished.
 */
const linkProgram = (
  outputs: string[],
  link: string,
  profile: string,
  debugInfo: boolean,
  threads: boolean,
  json: boolean
): number => {
  const root = packageRoot();
  if (root.length === 0) {
    reportToolchainFailure(
      `--link: cannot find scripts/build.sh (looked in ${packageRootCandidates().join(" and ")}); run the compiler from a checkout or an installed package`,
      json
    );
    return 3;
  }
  if (!makeDirectoryFor(link)) {
    return 1;
  }
  const script = `${root}/scripts/build.sh`;
  // `bash -c 'exec "$@" >/dev/null' <argv0> bash <script> ...` runs the script
  // with its stdout dropped and nothing else changed; `$0` is the name the
  // shell would use in its own errors.
  const argv: string[] = [];
  argv.push("bash");
  argv.push("-c");
  argv.push('exec "$@" >/dev/null');
  argv.push("nish");
  argv.push("bash");
  argv.push(script);
  for (const file of outputs) {
    argv.push(file);
  }
  argv.push(`${root}/runtime/runtime.c`);
  argv.push("-o");
  argv.push(link);
  argv.push("--profile");
  argv.push(profile);
  // `-g` is passed on so runtime.c gets debug info too and build.sh does not
  // strip the binary, which is what keeps the DWARF the IR already carries.
  if (debugInfo) {
    argv.push("-g");
  }
  // `--threads` likewise: it compiles runtime.c with -DNISH_THREADS, which is
  // what makes its `nish_arena` thread-local. The two halves cannot disagree
  // silently — ELF refuses a non-TLS reference to a TLS definition — so a
  // mismatch is a link error rather than a program with two arenas.
  if (threads) {
    argv.push("--threads");
  }
  const status = spawnSync(argv);
  if (status !== 0) {
    const why = status < 0 ? "could not run bash" : `exit ${status}`;
    reportToolchainFailure(`--link: ${script} failed (${why}); the IR is in ${outputs.join(", ")}`, json);
    return 3;
  }
  const binary = readFileSyncOrNull(link);
  if (binary !== null) {
    console.error(`linked ${link}: ${binary.length} bytes (${profile})`);
  }
  return 0;
};

/**
 * The functions a C sidecar will declare a prototype for, which are the ones
 * whose C names must not clash: all of them when a header is written, and
 * otherwise only those the N-API shim bridges, since it declares nothing else.
 */
const cDeclared = (compilation: Compilation, fns: ExternalFunction[]): ExternalFunction[] => {
  const opts = compilation.opts;
  if (opts.emitHeader.length > 0) {
    return fns;
  }
  if (opts.emitNapi.length === 0 && opts.emitNapiAsync.length === 0) {
    return [];
  }
  const out: ExternalFunction[] = [];
  for (const fn of fns) {
    if (napiBridges(compilation.table, fn)) {
      out.push(fn);
    }
  }
  return out;
};

/**
 * The WP8 sidecars, after the IR and in stage0's order: the header, the wasm
 * declarations, the loader that implements them, then the N-API shim. Each
 * reads the same signatures the IR was emitted from, and the one whole-program
 * fixpoint they share is run once, by the caller, rather than once per
 * generator: the caller needs the list first, to ask whether it can be
 * described at all. Only called when at least one sidecar was asked for.
 *
 * The `wrote` lines go to stderr, as stage0's do, because a single-module
 * compile that named no output has the IR itself on stdout. Each sidecar's
 * directory is made the way the IR's is; false when one could not be.
 */
const writeSidecars = (compilation: Compilation, fns: ExternalFunction[]): boolean => {
  const opts = compilation.opts;
  if (opts.emitHeader.length > 0) {
    if (!makeDirectoryFor(opts.emitHeader)) {
      return false;
    }
    writeFileSync(opts.emitHeader, generateHeader(compilation, fns, opts.emitHeader));
    console.error(`wrote ${opts.emitHeader}`);
  }
  if (opts.emitDts.length > 0) {
    if (!makeDirectoryFor(opts.emitDts)) {
      return false;
    }
    writeFileSync(opts.emitDts, generateDts(compilation, fns));
    console.error(`wrote ${opts.emitDts}`);
    const loader = wasmLoaderPath(opts.emitDts);
    writeFileSync(loader, generateWasmLoader(compilation, fns, opts.emitDts));
    console.error(`wrote ${loader}`);
  }
  if (opts.emitNapi.length > 0) {
    if (!makeDirectoryFor(opts.emitNapi)) {
      return false;
    }
    writeFileSync(opts.emitNapi, generateNapiShim(compilation, fns, false));
    console.error(`wrote ${opts.emitNapi}`);
  }
  if (opts.emitNapiAsync.length > 0) {
    if (!makeDirectoryFor(opts.emitNapiAsync)) {
      return false;
    }
    writeFileSync(opts.emitNapiAsync, generateNapiShim(compilation, fns, true));
    console.error(`wrote ${opts.emitNapiAsync}`);
  }
  return true;
};
