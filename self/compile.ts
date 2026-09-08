// `compile <entry.ts> [flags]`: stage1's compiler driver
// (docs/wp14-selfhost.md milestones S4 and S5).
//
// It loads the entry module and everything it imports — and every other file
// named on the command line, which is how a program names a module nothing
// imports — checks the program as a whole, and writes one `.ll` per module. With no `--out-dir` it writes the IR
// of a single-module program to stdout, which is what the S4 oracle compares;
// with `--out-dir <dir>` it writes `<dir>/<stem>.ll` per module, which is what
// the bootstrap links. The directory must already exist: `mkdir` would mean a
// runtime call stage1 does not have, and D4 keeps the host-dependent half of
// the driver in stage0.
//
// The flags are the subset of stage0's that change the IR, `-g` included:
// DWARF is metadata in the `.ll` and costs the driver nothing. `--emit-checked`
// is here too, because the dump is this compiler's own tables and stage1
// already writes them byte for byte as stage0 does
// (`tests/self/checked_oracle.js`).
//
// `--emit-header`, `--emit-dts` and `--emit-napi` write the WP8 sidecars
// beside the IR, spelled and placed exactly as stage0 spells and places them
// (`tests/self/interop_oracle.js` compares every byte). They need no directory
// of their own for the same reason the IR does not: the path is written where
// it was given.
//
// `--link` and `--profile` stay stage0's, and so does `--emit-ast`. The last
// one is not an omission: stage0's AST dump prints the *`typescript` package's*
// node names and line:column spans, and stage1's tree is the flattened one
// `self/nodes.ts` defines, with its own vocabulary and byte offsets. Printing
// someone else's node names would be imitation rather than parity, so stage1
// keeps `self/dump_ast.ts` in the shape its parser oracle compares and the
// wrapper refuses `--emit-ast` by name.

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
import { jsonQuote } from "./strings";
import { resolveTarget, supportedTargets } from "./target";

const USAGE: string =
  "usage: compile <file.ts> [more.ts ...] [--out-dir <dir>] [--number-mode i32|f64] [--plain] [--strict-exports] [--unchecked-indexing] [--nsw] [--no-stack-alloc] [--runtime-decls] [--target <triple>] [-g] [--json] [--emit-checked] [--emit-header <file.h>] [--emit-dts <file.d.ts>] [--emit-napi <shim.c>]\n       compile --version | --help";

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
 * A failure that belongs to the command line rather than to the program: it
 * has no source span, so it cannot go through the sink. stage0 prints it with
 * an `error:` prefix on stderr, or as one flat object on stdout under
 * `--json`, and this answers in the same two shapes.
 */
function reportRootFailure(message: string, json: boolean): void {
  if (json) {
    console.log(`{"severity":"error","message":${jsonQuote(message)}}`);
    return;
  }
  console.error(`error: ${message}`);
}

export function main(): number {
  if (process.argv.length < 2) {
    console.error(USAGE);
    return 2;
  }
  const opts = new Options();
  const roots: string[] = [];
  let outDir = "";
  let json = false;
  let emitChecked = false;
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
    } else if (value === "--out-dir") {
      arg = arg + 1;
      if (arg >= process.argv.length) {
        console.error("compile: --out-dir needs a directory");
        return 2;
      }
      outDir = process.argv[arg];
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
    } else if (value === "--unchecked-indexing") {
      opts.uncheckedIndexing = true;
    } else if (value === "--nsw") {
      opts.nsw = true;
    } else if (value === "--no-stack-alloc") {
      opts.stackAlloc = false;
    } else if (value === "--runtime-decls") {
      opts.runtimeDecls = true;
    } else if (value === "-g") {
      opts.debugInfo = true;
    } else if (value === "--json") {
      json = true;
    } else if (value === "--emit-checked") {
      emitChecked = true;
    } else if (value === "-h" || value === "--help") {
      // stage0 answers `--help` on stderr and exits 2, so a script that asks
      // either compiler for its help sees the same shape.
      console.error(USAGE);
      return 2;
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
  if (!compilation.check()) {
    report(compilation, json);
    return 1;
  }
  // The checked dump is what pass 2 leaves behind, so it is written here
  // rather than after `emit`: nothing about the IR changes it.
  if (emitChecked) {
    write(checkedText(compilation));
    return 0;
  }
  const emitted = compilation.emit();
  if (outDir.length === 0) {
    if (emitted.length > 1) {
      console.error(
        `compile: ${roots[0]} imports ${emitted.length - 1} module(s); pass --out-dir <dir> so each one gets its own .ll`
      );
      return 2;
    }
    write(emitted[0].ir);
    writeSidecars(compilation);
    return 0;
  }
  for (const module of emitted) {
    const file = `${outDir}/${module.stem}.ll`;
    writeFileSync(file, module.ir);
    // stderr, as stage0 writes it: stdout is where the IR goes when there is
    // no `--out-dir`, and `--json` owns it outright.
    console.error(`wrote ${file}`);
  }
  writeSidecars(compilation);
  return 0;
}

/**
 * The WP8 sidecars, after the IR and in stage0's order: the header, the wasm
 * declarations, the loader that implements them, then the N-API shim. Each
 * reads the same signatures the IR was emitted from, and the one whole-program
 * fixpoint they share is run once here rather than once per generator.
 *
 * The `wrote` lines go to stderr, as stage0's do, because a single-module
 * compile with no `--out-dir` has the IR itself on stdout.
 */
function writeSidecars(compilation: Compilation): void {
  const opts = compilation.opts;
  if (opts.emitHeader.length === 0 && opts.emitDts.length === 0 && opts.emitNapi.length === 0) {
    return;
  }
  const fns = externalFunctions(compilation);
  if (opts.emitHeader.length > 0) {
    writeFileSync(opts.emitHeader, generateHeader(compilation, fns, opts.emitHeader));
    console.error(`wrote ${opts.emitHeader}`);
  }
  if (opts.emitDts.length > 0) {
    writeFileSync(opts.emitDts, generateDts(compilation, fns));
    console.error(`wrote ${opts.emitDts}`);
    const loader = wasmLoaderPath(opts.emitDts);
    writeFileSync(loader, generateWasmLoader(compilation, fns, opts.emitDts));
    console.error(`wrote ${loader}`);
  }
  if (opts.emitNapi.length > 0) {
    writeFileSync(opts.emitNapi, generateNapiShim(compilation, fns));
    console.error(`wrote ${opts.emitNapi}`);
  }
}
