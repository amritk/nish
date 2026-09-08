// The one place stage1 spells the project's own name; `src/branding.ts` is the
// stage0 twin and holds the same language name. The two must agree: every
// diagnostic the two compilers produce is compared byte for byte by
// `tests/self/reject_oracle.js`, so a name changed on one side and not the
// other fails the suite.
//
// The language name and the two strings the DWARF producer is built from are
// here; the environment variables and the C header stay on stage0's side,
// because stage1 never prints them. stage1's driver still calls itself
// `compile` (`self/compile.ts`) — `CLI` is the *product* name a `-g` build
// records, not the name of this binary.
//
// The values are literals rather than expressions over another constant,
// because a module constant here is folded at compile time and the folder has
// less to work with than stage0's does.
//
// The `sts_` prefix on the runtime's C symbols is deliberately not here: it is
// ABI rather than branding, it is in every golden `.ll`, and it was never
// derived from the product name.

/** The language, as a diagnostic names it: "`eval` is forbidden in AmritScript". */
export const LANGUAGE: string = "AmritScript";

/**
 * The compiler, as the DWARF `producer` names it ("amritc 0.1.0"). stage0
 * builds the same string from `CLI` and `packageVersion()`, and
 * `tests/self/ir_oracle.js` compares the two byte for byte on every `-g` case.
 */
export const CLI: string = "amritc";

/**
 * The package version, baked in rather than read from `package.json`: stage1
 * has no JSON parser and no way to find the package root from a binary that
 * may have been copied anywhere. `tests/run.js` fails when this and
 * `package.json` disagree, which is the check that keeps a `npm version` bump
 * from going stale here.
 */
export const VERSION: string = "0.1.0";
