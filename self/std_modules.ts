// The standard library, as the resolver sees it: where it lives and what is in
// it (`src/std-modules.ts` is the stage0 twin).
//
// This is the counterpart of `nish_modules.ts`, and the contrast is the point.
// A `nish:` module is a builtin — no file, no code, nothing linked. A `nish/`
// module is ordinary Nish source that ships beside the compiler and is compiled
// into whatever imports it, so all this module answers is a path and a listing;
// everything after that is the ordinary module path.

import { STD_PREFIX } from "./branding";
import { normalizePath, packageRoot } from "./paths";

/** The directory the library lives in, relative to the package root. */
export const STD_DIR: string = "std";

/**
 * `nish/text` -> `<package root>/std/text.ts`, normalised.
 *
 * The normalisation is not cosmetic. A module's resolved path is its identity
 * *and* the name in its IR header, and `packageRoot()` answers
 * `<dir of argv[0]>/..` — so without this the header would read
 * `./build/../std/text.ts` where stage0 writes `std/text.ts`, and the two
 * compilers would disagree on a byte the parity gate compares.
 */
export const stdModulePath = (specifier: string): string =>
  normalizePath(`${packageRoot()}/${STD_DIR}/${specifier.substring(STD_PREFIX.length)}.ts`);

/**
 * The modules the installed library has, without their extension, for the
 * diagnostic that lists them. Read rather than written down: a list in the
 * source would be one more thing to forget beside the file it names, and the
 * goldens that pin the wording would then pass while the message was wrong.
 * `readdirSync` answers them already sorted, and `null` — an unreadable
 * directory — answers nothing rather than failing, because the caller is
 * already reporting an error when it asks.
 */
export const stdModuleNames = (): string => {
  const entries = readdirSync(normalizePath(`${packageRoot()}/${STD_DIR}`));
  if (entries === null) {
    return "";
  }
  const names: string[] = [];
  for (const entry of entries) {
    if (entry.endsWith(".ts")) {
      names.push(entry.substring(0, entry.length - 3));
    }
  }
  return names.join(", ");
};
