/**
 * The standard library, as the resolver sees it: where it lives and what is
 * in it.
 *
 * This is the counterpart of `checker/nish-modules.ts` and the contrast is the
 * point. A `nish:` module is a builtin — no file, no code, nothing linked. A
 * `nish/` module is ordinary Nish source that ships beside the compiler and is
 * compiled into whatever imports it, so all this module has to answer is a
 * directory and a listing; everything after that is the ordinary module path.
 */
import fs from "node:fs";
import path from "node:path";
import { PKG_ROOT } from "./version.js";

/** The directory the library lives in, relative to the package root. */
export const STD_DIR = "std";

/**
 * `nish/text` -> `std/text.ts`: the name a standard-library module carries in
 * its IR header, its `DIFile` and its diagnostics.
 *
 * Package-relative and nothing else — not relative to the importer, and not
 * relative to a working directory. A `nish/` specifier does not resolve
 * *against* the importer the way `./text` does; it resolves against the
 * package this compiler shipped in, so naming it from the importer is
 * answering a question that was never asked. That is what
 * `importedName` in `compilation.ts` was doing, and it only showed when the
 * entry was named absolutely: `path.relative` then climbed out of the
 * importer's directory and back down, and the join put the whole checkout
 * path into the header. Named relatively — as every caller in this repository
 * names it — the two answers were the same string, which is why 12,000 runs of
 * `--parity` had not seen it and 815 programs did (WP19 §A3, §A5).
 *
 * `self/std_modules.ts` writes the same rule down for stage1 and its comment
 * asserts this one: "the header would read `./build/../std/text.ts` where
 * stage0 writes `std/text.ts`". This is what makes that sentence true under
 * every spelling of the entry rather than only under one.
 */
export const stdModuleName = (specifier: string, prefixLength: number): string =>
  path.posix.join(STD_DIR, `${specifier.slice(prefixLength)}.ts`);

/**
 * The modules the installed library has, without their extension and in a
 * fixed order, for the diagnostic that lists them. Read rather than written
 * down: a list in the source would be one more thing to forget beside the file
 * it names, and the two goldens that pin the wording would then pass while the
 * message was wrong. An unreadable directory answers nothing rather than
 * failing — the caller is already reporting an error when it asks.
 */
export const stdModuleNames = (): string[] => {
  try {
    return fs
      .readdirSync(path.join(PKG_ROOT, STD_DIR))
      .filter((f) => f.endsWith(".ts"))
      .map((f) => f.slice(0, -3))
      .sort();
  } catch {
    return [];
  }
};
