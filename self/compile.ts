// `compile <entry.ts> [flags]`: stage1's compiler driver
// (docs/wp14-selfhost.md milestones S4 and S5).
//
// It loads the entry module and everything it imports, checks the program as a
// whole, and writes one `.ll` per module. With no `--out-dir` it writes the IR
// of a single-module program to stdout, which is what the S4 oracle compares;
// with `--out-dir <dir>` it writes `<dir>/<stem>.ll` per module, which is what
// the bootstrap links. The directory must already exist: `mkdir` would mean a
// runtime call stage1 does not have, and D4 keeps the host-dependent half of
// the driver in stage0.
//
// `--emit-header`, `--emit-dts` and `--emit-napi` write the WP8 sidecars
// beside the IR, spelled and placed exactly as stage0 spells and places them
// (`tests/self/interop_oracle.js` compares every byte). They need no directory
// of their own for the same reason the IR does not: the path is written where
// it was given. `--link`, `--profile`, `-g` and the dumps stay stage0's.

import { Compilation } from "./compilation";
import { NUMBER_MODE_F64, NUMBER_MODE_I32 } from "./context";
import { externalFunctions } from "./interop_abi";
import { generateDts } from "./interop_dts";
import { generateHeader } from "./interop_header";
import { generateNapiShim } from "./interop_napi";
import { generateWasmLoader, wasmLoaderPath } from "./interop_wasm";
import { Options } from "./options";
import { resolveTarget, supportedTargets } from "./target";

const USAGE: string =
  "usage: compile <file.ts> [--out-dir <dir>] [--number-mode i32|f64] [--plain] [--strict-exports] [--unchecked-indexing] [--nsw] [--no-stack-alloc] [--runtime-decls] [--target <triple>] [--emit-header <file.h>] [--emit-dts <file.d.ts>] [--emit-napi <shim.c>]";

export function main(): number {
  if (process.argv.length < 2) {
    console.error(USAGE);
    return 2;
  }
  const opts = new Options();
  let path = "";
  let outDir = "";
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

  const compilation = new Compilation(opts);
  if (!compilation.load(path)) {
    if (compilation.sink.hasErrors()) {
      writeError(`${compilation.sink.format(20)}\n`);
    }
    return 1;
  }
  if (!compilation.check()) {
    writeError(`${compilation.sink.format(20)}\n`);
    return 1;
  }
  const emitted = compilation.emit();
  if (outDir.length === 0) {
    if (emitted.length > 1) {
      console.error(
        `compile: ${path} imports ${emitted.length - 1} module(s); pass --out-dir <dir> so each one gets its own .ll`
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
    console.log(`wrote ${file}`);
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
