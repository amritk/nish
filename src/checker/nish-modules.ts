/**
 * The `nish:` modules: the builtins a program may import by name rather than
 * reach for as globals (`import { readFileSync } from "nish:fs"`).
 *
 * A `nish:` specifier resolves to nothing on disk. There is no file to load,
 * no signature to bind and no symbol to declare — the import *renames a
 * builtin the checker already has*, so an imported `readFileSync` goes
 * through the same `BuiltinCallChecker` and lowers to the same IR as the
 * global spelling, and `runtime.c` does not move a byte. That is why this
 * table holds strings rather than checkers: the canonical spelling is the key
 * into whichever builtin table already owns the name, which also keeps this
 * module free of the sibling imports `checker/builtins.ts` avoids for the
 * same reason.
 *
 * Only the libc-backed builtins are here. `Math.sqrt` lowers to an LLVM
 * intrinsic and `toI32` to a single instruction: they cost no runtime at all,
 * read as language rather than as library, and stay global.
 */
import { lookup } from "../lookup.js";

/** One name a `nish:` module exports, and the builtin it stands for. */
export type BuiltinExport = {
  /**
   * The spelling the builtin tables are keyed by. It differs from the exported
   * name where the global form is dotted: `nish:process` exports `exit`, and
   * the checker and emitter know it as `process.exit`.
   */
  canonical: string;
  /**
   * `call` is a function the program calls; `property` is read as a value.
   * The two take different paths on both sides — `builtinFunctions` and
   * `builtinCalls` against `namespaceProperties` — so the kind has to be
   * carried rather than guessed from the name.
   */
  kind: "call" | "property";
};

const call = (canonical: string): BuiltinExport => ({ canonical, kind: "call" });
const property = (canonical: string): BuiltinExport => ({ canonical, kind: "property" });

/**
 * Every `nish:` module, by specifier. The grouping is Node's where Node has
 * an obvious counterpart and plainer where it does not: `spawnSync` sits in
 * `nish:process` beside the rest of the process surface rather than in a
 * `nish:child_process` that would hold one function.
 */
export const NISH_MODULES: Record<string, Record<string, BuiltinExport>> = {
  "nish:fs": {
    readFileSync: call("readFileSync"),
    readFileSyncOrNull: call("readFileSyncOrNull"),
    writeFileSync: call("writeFileSync"),
    appendFileSync: call("appendFileSync"),
    mkdirSync: call("mkdirSync"),
    isDirectorySync: call("isDirectorySync"),
    readdirSync: call("readdirSync"),
  },
  "nish:process": {
    exit: call("process.exit"),
    getenv: call("getenv"),
    spawnSync: call("spawnSync"),
    spawnSyncTo: call("spawnSyncTo"),
    // Node spells the monotonic clock `process.hrtime.bigint()`, so this is
    // where a reader looks for it, and one clock function is not a module.
    monotonicNanos: call("monotonicNanos"),
    argv: property("process.argv"),
    platform: property("process.platform"),
    arch: property("process.arch"),
  },
  "nish:io": {
    write: call("write"),
    writeError: call("writeError"),
    panic: call("panic"),
  },
};

/** The `nish:` prefix, matched before the specifier is treated as a path. */
export const NISH_SPECIFIER_PREFIX = "nish:";

/**
 * Whether a specifier names a builtin module. A specifier that starts with
 * `nish:` is always one, even when the name after it is not a module: an
 * unknown `nish:sqlite` has to be reported as a bad module rather than as a
 * missing file, which is what it would become if it fell through to path
 * resolution.
 */
export const isNishSpecifier = (specifier: string): boolean => specifier.startsWith(NISH_SPECIFIER_PREFIX);

/** The exports of a `nish:` module, or undefined when the module does not exist. */
export const nishModule = (specifier: string): Record<string, BuiltinExport> | undefined =>
  lookup(NISH_MODULES, specifier);

/** One export of a `nish:` module, or undefined when the module does not export that name. */
export const nishExport = (specifier: string, name: string): BuiltinExport | undefined => {
  const module = nishModule(specifier);
  return module === undefined ? undefined : lookup(module, name);
};

/** Every module name, for the diagnostic that lists them. */
export const nishModuleNames = (): string[] => Object.keys(NISH_MODULES);
