#!/usr/bin/env node
/**
 * statictsc: StaticTS -> LLVM IR command line driver.
 *
 *   statictsc <input.ts> [-o <output.ll>] [--number-mode i32|f64] [--plain] [--runtime-decls]
 */
import fs from "node:fs";
import path from "node:path";
import { compileToIR } from "./compiler";
import { CompileError } from "./diagnostics";
import { NumberMode } from "./types";

function usage(): never {
  console.error(
    [
      "usage: statictsc <input.ts> [options]",
      "  -o, --output <file.ll>     output path (default: <input>.ll)",
      "  --number-mode i32|f64      lowering of `number` (default: i32)",
      "  --plain                    no performance attributes or alignment hints",
      "  --runtime-decls            always emit the runtime ABI prelude (arena + strings)",
    ].join("\n")
  );
  process.exit(2);
}

function main(argv: string[]): number {
  let input: string | undefined;
  let output: string | undefined;
  let numberMode: NumberMode = "i32";
  let optimizeAttributes = true;
  let runtimeDecls = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-o" || arg === "--output") {
      output = argv[++i];
      if (!output) usage();
    } else if (arg === "--number-mode") {
      const mode = argv[++i];
      if (mode !== "i32" && mode !== "f64") usage();
      numberMode = mode;
    } else if (arg === "--plain") {
      optimizeAttributes = false;
    } else if (arg === "--runtime-decls") {
      runtimeDecls = true;
    } else if (arg === "-h" || arg === "--help") {
      usage();
    } else if (arg.startsWith("-")) {
      console.error(`unknown option: ${arg}`);
      usage();
    } else if (input === undefined) {
      input = arg;
    } else {
      usage();
    }
  }
  if (!input) usage();

  const source = fs.readFileSync(input, "utf8");
  let ir: string;
  try {
    ir = compileToIR(input, source, { numberMode, optimizeAttributes, runtimeDecls });
  } catch (err) {
    if (err instanceof CompileError || err instanceof Error) {
      console.error(err.message);
      return 1;
    }
    throw err;
  }

  const outPath = output ?? input.replace(/\.ts$/, "") + ".ll";
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, ir);
  console.error(`wrote ${outPath}`);
  return 0;
}

process.exit(main(process.argv.slice(2)));
