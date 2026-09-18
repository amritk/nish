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
 * `text` -> `std/text.ts`: the name a standard-library module carries in its
 * IR header, its `DIFile` and its diagnostics.
 *
 * Package-relative and nothing else — not relative to the importer, and not
 * relative to a working directory. A `nish/` specifier does not resolve
 * *against* the importer the way `./text` does; it resolves against the
 * package this compiler shipped in, so naming it from the importer is
 * answering a question that was never asked. That is what `importedName` in
 * `compilation.ts` was doing, and it only showed when the entry was named
 * absolutely: `path.relative` then climbed out of the importer's directory and
 * back down, and the join put the whole checkout path into the header. Named
 * relatively — as every caller in this repository names it — the two answers
 * were the same string, which is why 12,000 runs of `--parity` had not seen it
 * and 815 programs did (WP19 §A3, §A7).
 *
 * `self/std_modules.ts` writes the same rule down for stage1 and its comment
 * asserts this one: "the header would read `./build/../std/text.ts` where
 * stage0 writes `std/text.ts`". This is what makes that sentence true under
 * every spelling of the entry rather than only under one.
 *
 * **The name is not validated, and "package-relative" is therefore a
 * description of every specifier anyone writes rather than a guarantee.**
 * `nish/../../escape2/lib` resolves — `stdModulePath` joins it and the file is
 * there — and answers `../escape2/lib.ts`, which begins with neither `std/`
 * nor anything fixed: it depends on where the compiler is installed. Refusing
 * it is a *language rule*, not a tidy-up: a new refusal needs a diagnostic
 * code, a negative case, a `docs/LANGUAGE.md` line and the same rule in
 * `self/std_modules.ts`, because stage0 refusing what stage1 compiles is the
 * divergence this file exists to close. Both compilers answer the same string
 * today, so it is a latent wart rather than a parity defect, and it is left
 * for the change that can state the rule on both sides at once.
 */
export const stdModuleName = (name: string): string => path.posix.join(STD_DIR, `${name}.ts`);

/**
 * `text` -> `<package root>/std/text.ts`: the file the name above names.
 *
 * One construction, read two ways, so that the module's identity on disk and
 * the name it carries in its header cannot drift apart — they used to be built
 * independently, in two files, which is how the drift this whole change is
 * about was possible in the first place.
 */
export const stdModulePath = (name: string): string => path.join(PKG_ROOT, stdModuleName(name));

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
