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
import { Compilation, EmittedModule } from "./compiler";
import { NumberMode } from "./types";

const PROFILES = ["speed", "size", "debug"] as const;
type Profile = (typeof PROFILES)[number];

/** Package root (dist/index.js -> ..), for scripts/build.sh and runtime/runtime.c. */
const PKG_ROOT = path.resolve(__dirname, "..");

function usage(): never {
  console.error(
    [
      "usage: statictsc <entry.ts> [more.ts ...] [options]",
      "  -o, --output <file.ll>     output path for a single module (default: <input>.ll)",
      "  -o, --output <dir>/        output directory: one <dir>/<module>.ll per module",
      "  --link <exe>               build a native binary from every module + runtime/runtime.c",
      "                             (entry module must declare `export function main`)",
      "  --profile speed|size|debug build profile for --link (default: speed)",
      "  --strict-exports           non-exported functions get `internal` linkage",
      "  --number-mode i32|f64      lowering of `number` (default: i32)",
      "  --plain                    no performance attributes or alignment hints",
      "  --runtime-decls            always emit the runtime ABI prelude (arena + strings)",
    ].join("\n")
  );
  process.exit(2);
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
    throw new Error(
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

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-o" || arg === "--output") {
      output = argv[++i];
      if (!output) usage();
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
    } else if (arg === "-h" || arg === "--help") {
      usage();
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
  const compilation = new Compilation({ numberMode, optimizeAttributes, runtimeDecls, strictExports });
  try {
    for (const input of inputs) compilation.addRoot(input);
    compilation.check();
    if (link !== undefined && !compilation.entry.checker.program.entryMain) {
      throw new Error(
        `--link: the entry module ${compilation.entry.fileName} must declare \`export function main(): number\` (or \`: void\`)`
      );
    }
    modules = compilation.emit();
    outputs = planOutputs(compilation, modules, output, link);
  } catch (err) {
    if (err instanceof Error) {
      console.error(err.message);
      return 1;
    }
    throw err;
  }

  modules.forEach((m, i) => {
    fs.mkdirSync(path.dirname(outputs[i]), { recursive: true });
    fs.writeFileSync(outputs[i], m.ir);
    console.error(`wrote ${outputs[i]}`);
  });

  if (link !== undefined) {
    fs.mkdirSync(path.dirname(path.resolve(link)), { recursive: true });
    const build = spawnSync(
      "bash",
      [
        path.join(PKG_ROOT, "scripts", "build.sh"),
        ...outputs,
        path.join(PKG_ROOT, "runtime", "runtime.c"),
        "-o",
        link,
        "--profile",
        profile,
      ],
      { stdio: ["ignore", "pipe", "inherit"] }
    );
    if (build.status !== 0) {
      console.error(`--link: scripts/build.sh failed (exit ${build.status})`);
      return 1;
    }
    // build.sh reports `<exe>: <bytes> bytes (<profile>)`.
    process.stderr.write(`linked ${String(build.stdout)}`);
  }
  return 0;
}

process.exit(main(process.argv.slice(2)));
