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
import { externalFunctions } from "./interop_abi";
import { generateDts } from "./interop_dts";
import { generateHeader } from "./interop_header";
import { generateNapiShim } from "./interop_napi";
import { generateWasmLoader, wasmLoaderPath } from "./interop_wasm";
import { Options } from "./options";
import { dirname } from "./paths";
import { jsonQuote } from "./strings";
import { codeFor, TOOLCHAIN } from "./codes";
import { resolveTarget, supportedTargets } from "./target";

const USAGE: string =
  "usage: compile <file.ts> [more.ts ...] [-o, --output <file.ll>|<dir>/] [--link <exe>] [--profile speed|size|debug|wasi] [--number-mode i32|f64] [--plain] [--no-strict-exports] [--unchecked-indexing] [--wrapping] [--no-stack-alloc] [--no-warn-performance] [--runtime-decls] [--target <triple>|host] [-g] [--json] [--emit-ast] [--emit-checked] [--emit-header <file.h>] [--emit-dts <file.d.ts>] [--emit-napi <shim.c>]\n       compile -v, --version | -h, --help";

/**
 * The link recipes `scripts/build.sh` knows, in the order stage0 lists them
 * (`PROFILES` in `src/index.ts`). A module constant is a scalar here, so the
 * set is a predicate and the list is the string the message needs.
 */
const PROFILE_NAMES: string = "speed, size, debug, wasi";

function isProfile(name: string): boolean {
  return name === "speed" || name === "size" || name === "debug" || name === "wasi";
}

/**
 * `mkdir -p`: the directory and every parent it needs. `mkdirSync` makes one
 * level and answers whether it is there afterwards, so this is the walk up and
 * back down that Node's `{ recursive: true }` hides.
 *
 * Answers false for the first level that could not be made, which the caller
 * turns into its own message: the compiler has no exceptions and the path is
 * the useful half of the diagnostic.
 */
function makeDirectory(dir: string): boolean {
  if (dir.length === 0 || dir === "." || dir === "/") {
    return true;
  }
  const parent = dirname(dir);
  if (parent !== dir && !makeDirectory(parent)) {
    return false;
  }
  return mkdirSync(dir);
}

/** `makeDirectory(dirname(file))`, reported once and the same way everywhere. */
function makeDirectoryFor(file: string): boolean {
  const dir = dirname(file);
  if (makeDirectory(dir)) {
    return true;
  }
  console.error(`compile: cannot create directory ${dir}`);
  return false;
}

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
function planOutputs(stems: string[], paths: string[], output: string, link: string): string[] {
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
}

function perModule(stems: string[], dir: string): string[] {
  const out: string[] = [];
  for (const stem of stems) {
    out.push(`${dir}/${stem}.ll`);
  }
  return out;
}

/**
 * The diagnostics of a failed compilation, in whichever of stage0's two shapes
 * was asked for: `--json` is one flat object per line on **stdout**, every
 * error and no excerpt, for an editor to read; the default is the human report
 * on stderr, capped where stage0 caps it.
 */
function report(compilation: Compilation, json: boolean): void {
  if (!json) {
    writeError(`${compilation.sink.format(20)}\n`);
    return;
  }
  for (const diagnostic of compilation.sink.sorted()) {
    console.log(diagnostic.json());
  }
}

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
function reportPerformance(compilation: Compilation, enabled: boolean, json: boolean): void {
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
}

/**
 * A failure that belongs to the command line rather than to the program: it
 * has no source span, so it cannot go through the sink. stage0 prints it with
 * an `error:` prefix on stderr, or as one flat object on stdout under
 * `--json`, and this answers in the same two shapes.
 */
function reportRootFailure(message: string, json: boolean): void {
  if (json) {
    console.log(`{"severity":"error","code":"${codeFor("error", message)}","message":${jsonQuote(message)}}`);
    return;
  }
  console.error(`error: ${message}`);
}

/**
 * A `--link` failure: the C toolchain could not be used, so the run is wrong
 * rather than the program. stage0 shapes it the same way (`failureJson` in
 * `src/index.ts`) and both carry the band-0 code, so a reader parses one shape
 * whichever compiler it ran.
 */
function reportToolchainFailure(message: string, json: boolean): void {
  if (json) {
    console.log(`{"severity":"error","code":"${TOOLCHAIN}","message":${jsonQuote(message)}}`);
    return;
  }
  console.error(message);
}

export function main(): number {
  if (process.argv.length < 2) {
    console.error(USAGE);
    return 2;
  }
  const opts = new Options();
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
    } else if (value === "--no-warn-performance") {
      warnPerformance = false;
    } else if (value === "--runtime-decls") {
      opts.runtimeDecls = true;
    } else if (value === "-g") {
      opts.debugInfo = true;
    } else if (value === "--json") {
      json = true;
    } else if (value === "--emit-checked") {
      emitChecked = true;
    } else if (value === "--emit-ast") {
      emitAst = true;
    } else if (value === "-h" || value === "--help") {
      // A request that succeeded, not a refusal: stdout and exit 0. stage0
      // answers it the same way (`usageText` in `src/index.ts`), so a script
      // that asks either compiler for its help sees the same shape; an actual
      // usage error still prints USAGE on stderr and returns 2 below.
      console.log(USAGE);
      return 0;
    } else if (value === "-v" || value === "--version") {
      // The line stage0 prints. stage1 cannot read `package.json`, so the
      // version is a constant in `self/branding.ts` and a check in
      // `tests/run.js` fails if the two ever disagree.
      console.log(`${CLI} ${VERSION}`);
      return 0;
    } else if (value.startsWith("-")) {
      console.error(`compile: unknown flag \`${value}\`\n${USAGE}`);
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
    console.error(USAGE);
    return 2;
  }

  const compilation = new Compilation(opts);
  // The tree is printed from what parsed and validated, so pass 1's refusals
  // do not stop the load — stage0 records them and reaches its dump first.
  compilation.dumpOnly = emitAst;
  let loaded = true;
  for (const root of roots) {
    if (!compilation.load(root)) {
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
      write(astText(unit.file, unit.path));
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
      `--link: the entry module ${compilation.entry().path} must declare \`export function main(): number\` (or \`: void\`)`
    );
    return 1;
  }
  const emitted = compilation.emit();
  const stems: string[] = [];
  const paths: string[] = [];
  for (const module of emitted) {
    stems.push(module.stem);
  }
  for (const unit of compilation.modules) {
    paths.push(unit.path);
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
  if (!writeSidecars(compilation)) {
    return 1;
  }
  if (link.length === 0) {
    return 0;
  }
  return linkProgram(outputs, link, profile, opts.debugInfo, json);
}

/**
 * The package root: the directory holding `scripts/` and `runtime/`. stage0
 * reads it from `__dirname` (`src/version.ts`); this compiler is a binary, so
 * it derives it from the path it was invoked by — `<prefix>/bin/nish` and
 * `build/nish` both put it one level up — and falls back to the working
 * directory, which is what a checkout wants. Empty when neither has the
 * script, so the caller can say which two it looked in.
 */
function packageRoot(): string {
  const candidates: string[] = [`${dirname(process.argv[0])}/..`, "."];
  for (const root of candidates) {
    if (readFileSyncOrNull(`${root}/scripts/build.sh`) !== null) {
      return root;
    }
  }
  return "";
}

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
function linkProgram(outputs: string[], link: string, profile: string, debugInfo: boolean, json: boolean): number {
  const root = packageRoot();
  if (root.length === 0) {
    reportToolchainFailure(
      `--link: cannot find scripts/build.sh (looked in ${dirname(process.argv[0])}/.. and .); run the compiler from a checkout or an installed package`,
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
}

/**
 * The WP8 sidecars, after the IR and in stage0's order: the header, the wasm
 * declarations, the loader that implements them, then the N-API shim. Each
 * reads the same signatures the IR was emitted from, and the one whole-program
 * fixpoint they share is run once here rather than once per generator.
 *
 * The `wrote` lines go to stderr, as stage0's do, because a single-module
 * compile that named no output has the IR itself on stdout. Each sidecar's
 * directory is made the way the IR's is; false when one could not be.
 */
function writeSidecars(compilation: Compilation): boolean {
  const opts = compilation.opts;
  if (opts.emitHeader.length === 0 && opts.emitDts.length === 0 && opts.emitNapi.length === 0) {
    return true;
  }
  const fns = externalFunctions(compilation);
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
    writeFileSync(opts.emitNapi, generateNapiShim(compilation, fns));
    console.error(`wrote ${opts.emitNapi}`);
  }
  return true;
}
