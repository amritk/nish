// The `nish:` modules for stage1 (`src/checker/nish-modules.ts`): the builtins
// a program may import by name instead of reaching for them as globals.
//
// A `nish:` specifier resolves to nothing on disk. There is no file to load,
// no signature to bind and no symbol to declare — the import *renames a
// builtin the checker already has*, so an imported `readFileSync` goes through
// the same check and lowers to the same IR as the global spelling.
//
// stage0 holds this as a table of objects and derives the diagnostics' lists
// from its keys. Here it is an `if` chain and the lists are written out, for
// the reason `builtins.ts` is an `if` chain: the language has no object
// literal to key by name, and a `StringMap` built at module load needs a
// mutable global the language does not have either. The lists therefore have
// to stay in the same order as stage0's table — the `.err` goldens match on
// the whole sentence.

import { BUILTIN_SCHEME } from "./branding";

/** One name a `nish:` module exports, and the builtin it stands for. */
export class BuiltinExport {
  /**
   * The spelling the builtin checkers are keyed by. It differs from the
   * exported name where the global form is dotted: `nish:process` exports
   * `exit`, and both compilers know it as `process.exit`.
   */
  canonical: string;
  /**
   * The two halves of `canonical`, so that a dotted builtin can be dispatched
   * without taking the name apart again: `"process"` and `"exit"` for
   * `process.exit`, and `""` with the name itself for an undotted one like
   * `readFileSync`. stage0 looks the whole dotted name up in a table and needs
   * neither; here every builtin is reached through a namespace and a member,
   * so the pair is what the checkers actually want.
   */
  namespace: string;
  member: string;
  /**
   * Whether the name is read as a value rather than called. The two take
   * different paths on both sides, so the kind is carried rather than guessed
   * from the name.
   */
  isProperty: boolean;

  constructor(namespace: string, member: string, isProperty: boolean) {
    this.canonical = namespace.length > 0 ? `${namespace}.${member}` : member;
    this.namespace = namespace;
    this.member = member;
    this.isProperty = isProperty;
  }
}

/**
 * Whether a specifier names a builtin module. A specifier that starts with
 * `nish:` is always one, even when the name after it is not a module: an
 * unknown `nish:sqlite` has to be reported as a bad module rather than as the
 * missing file it would become if it fell through to path resolution.
 */
export const isNishSpecifier = (specifier: string): boolean => specifier.startsWith(BUILTIN_SCHEME);

/** Whether the specifier is a module that exists. */
export const isNishModule = (specifier: string): boolean =>
  specifier === `${BUILTIN_SCHEME}fs` ||
  specifier === `${BUILTIN_SCHEME}process` ||
  specifier === `${BUILTIN_SCHEME}io`;

/** Every module name, for the diagnostic that lists them. */
export const nishModuleNames = (): string =>
  `${BUILTIN_SCHEME}fs, ${BUILTIN_SCHEME}process, ${BUILTIN_SCHEME}io`;

/** The names one module exports, in table order, for the diagnostic that lists them. */
export const nishModuleExports = (specifier: string): string => {
  if (specifier === `${BUILTIN_SCHEME}fs`) {
    return "readFileSync, readFileSyncOrNull, writeFileSync, appendFileSync, mkdirSync, isDirectorySync, readdirSync";
  }
  if (specifier === `${BUILTIN_SCHEME}process`) {
    return "exit, getenv, spawnSync, spawnSyncTo, monotonicNanos, argv, platform, arch";
  }
  return "write, writeError, panic";
};

/** The builtin `specifier` exports under `name`, or null when it exports no such name. */
export const nishExport = (specifier: string, name: string): BuiltinExport | null => {
  if (specifier === `${BUILTIN_SCHEME}fs`) {
    if (
      name === "readFileSync" ||
      name === "readFileSyncOrNull" ||
      name === "writeFileSync" ||
      name === "appendFileSync" ||
      name === "mkdirSync" ||
      name === "isDirectorySync" ||
      name === "readdirSync"
    ) {
      return new BuiltinExport("", name, false);
    }
    return null;
  }
  if (specifier === `${BUILTIN_SCHEME}process`) {
    if (name === "exit") {
      return new BuiltinExport("process", "exit", false);
    }
    if (name === "getenv" || name === "spawnSync" || name === "spawnSyncTo" || name === "monotonicNanos") {
      return new BuiltinExport("", name, false);
    }
    if (name === "argv" || name === "platform" || name === "arch") {
      return new BuiltinExport("process", name, true);
    }
    return null;
  }
  if (specifier === `${BUILTIN_SCHEME}io`) {
    if (name === "write" || name === "writeError" || name === "panic") {
      return new BuiltinExport("", name, false);
    }
    return null;
  }
  return null;
};
