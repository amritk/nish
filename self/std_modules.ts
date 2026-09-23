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
import { splitByte } from "./strings";

const SLASH: i32 = 47;
const DOT: i32 = 46;

/** The directory the library lives in, relative to the package root. */
export const STD_DIR: string = "std";

/**
 * `nish/text` -> `std/text.ts`: the name a standard-library module carries in
 * its IR header, its `DIFile` and its diagnostics (`src/std-modules.ts` answers
 * the same string).
 *
 * Package-relative and nothing else, which is the half of a module's identity
 * that `packageRoot()` must not reach. The path below is where the file *is*,
 * and it is `<dir of argv[0]>/../std/text.ts`, so it says as much about how the
 * compiler was invoked as about the program: `./build/nish` and
 * `/abs/build/nish` name one module two ways, and the harness happened to use
 * the spelling that agreed with stage0 (WP19 §A7's third bullet). The name is
 * what goes in the IR, so the name is the one that may not depend on it.
 */
export const stdModuleName = (specifier: string): string =>
  `${STD_DIR}/${specifier.substring(STD_PREFIX.length)}.ts`;

/**
 * `nish/text` -> `<package root>/std/text.ts`, normalised: the file to open.
 *
 * The normalisation keeps the *identity* tidy — `packageRoot()` answers
 * `<dir of argv[0]>/..`, so without it the path would be
 * `./build/../std/text.ts` — and it is no longer what keeps the two compilers'
 * headers equal, because the header is `stdModuleName` now.
 */
export const stdModulePath = (root: string, specifier: string): string =>
  normalizePath(`${root}/${STD_DIR}/${specifier.substring(STD_PREFIX.length)}.ts`);

/**
 * Whether `nish/<name>` names a module *inside* the library
 * (`isStdModuleName` in `src/std-modules.ts` is the same rule).
 *
 * `parseBareSpecifier`'s rule, one package along: no segment may be empty or
 * begin with a `.`, which rules out a `..` climbing out of the package and a
 * `//` that joins to nothing. It is what makes the name above package-relative
 * as a property rather than as a description of the specifiers people happen to
 * write — `nish/../../escape/lib` would be named from wherever the compiler is
 * installed, and every install would spell it differently.
 *
 * The empty name is left to the caller: `nish/` is answered by the sentence
 * that lists the library, which is the more useful of the two.
 */
export const isStdModuleName = (name: string): boolean => {
  for (const segment of splitByte(name, SLASH)) {
    if (segment.length === 0 || segment.charCodeAt(0) === DOT) {
      return false;
    }
  }
  return true;
};

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
export const stdModuleNames = (): string => "json, pair, testing, text";
