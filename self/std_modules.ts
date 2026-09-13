// The standard library, as the resolver sees it: where it lives and what is in
// it (`src/std-modules.ts` is the stage0 twin).
//
// This is the counterpart of `nish_modules.ts`, and the contrast is the point.
// A `nish:` module is a builtin — no file, no code, nothing linked. A `nish/`
// module is ordinary Nish source that ships beside the compiler and is compiled
// into whatever imports it, so all this module answers is a path and a listing;
// everything after that is the ordinary module path.

import { STD_PREFIX } from "./branding";
import { normalizePath } from "./paths";

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
export const stdModulePath = (root: string, specifier: string): string =>
  normalizePath(`${root}/${STD_DIR}/${specifier.substring(STD_PREFIX.length)}.ts`);

/**
 * The modules the library has, for the diagnostic that lists them.
 *
 * A literal, not a directory read. `self/` has to compile under the *last
 * released* compiler — that is the WP19 G2 gate `scripts/bootstrap.sh --verify`
 * runs — so it may only use builtins that release already had, and
 * `readdirSync` is newer than the current one. stage0 reads the real directory
 * instead, and `tests/run.js` fails when the two disagree, which is the same
 * arrangement that keeps `VERSION` in `branding.ts` honest against
 * `package.json`.
 */
export const stdModuleNames = (): string => "testing, text";
