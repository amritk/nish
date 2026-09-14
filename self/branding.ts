// The one place stage1 spells the project's own name; `src/branding.ts` is the
// stage0 twin and holds the same language name. The two must agree: every
// diagnostic the two compilers produce is compared byte for byte by
// `tests/self/reject_oracle.js`, so a name changed on one side and not the
// other fails the suite.
//
// The driver still calls itself `compile` (`self/compile.ts`), so the CLI name
// is not a diagnostic here. It is here for two readers: the DWARF `producer` a
// `-g` build records, and the interop sidecars, which name the compiler in the
// text they generate — the banner on every generated file, the include guard on
// a header, the runtime header a header includes, and the error an N-API module
// throws when it cannot register its exports. Both sets of bytes are compared
// with stage0's. The environment variables stay stage0's.
//
// Every value is a literal rather than an expression over another constant,
// because a module constant here is folded at compile time and the folder has
// less to work with than stage0's does: `CLI.toUpperCase()` is how `src/`
// spells the guard prefix, and there is no `toUpperCase` in the language.
//
// The `nish_` prefix on the runtime's C symbols is deliberately not here: it
// is ABI rather than branding, it is in every golden `.ll`, and it is frozen —
// a rename does not follow it. See "Where the name lives" in
// `docs/ARCHITECTURE.md`.

/** The language, as a diagnostic names it: "`eval` is forbidden in Nish". */
export const LANGUAGE: string = "Nish";

/**
 * The compiler: the npm package, the `bin` entry, the word a generated file
 * uses when it talks about the tool that wrote it, and the way the DWARF
 * `producer` names it ("nish 0.1.0"). stage0 builds that string from `CLI`
 * and `packageVersion()`, and `tests/self/ir_oracle.js` compares the two byte
 * for byte on every `-g` case.
 */
export const CLI: string = "nish";

/**
 * The scheme a *builtin* module is imported under: `nish:fs`. It resolves to
 * no file — the import renames a builtin the checker already has — which is
 * what separates it from the standard library below. A literal, like every
 * value here, for the reason the header gives.
 */
export const BUILTIN_SCHEME: string = "nish:";

/**
 * The specifier the *standard library* is imported under: `nish/text` is
 * `std/text.ts` beside the compiler. Unlike a builtin this is ordinary Nish
 * source, compiled into the program that imports it. `docs/wp21-packages.md`
 * §2 is why it is here: it is the package's own name, and both compilers have
 * to agree on it before either can resolve a bare specifier.
 */
export const STD_PREFIX: string = "nish/";

/**
 * The `exports` condition a package declares to say that it has Nish source
 * for an Nish consumer to compile (`docs/wp21-packages.md` §2, §6). A literal,
 * like every value here, for the reason the header gives.
 *
 * It is here for the reason `STD_PREFIX` is: it is a spelling of the project's
 * name, and both compilers have to agree on it before either can resolve a
 * bare specifier — a package that matched under stage0 and not under stage1
 * would be a program that compiles with one compiler and not the other.
 */
export const PACKAGE_CONDITION: string = "nish";

/**
 * The mode-qualified spellings of the condition above: `nish-i32`, `nish-f64`.
 *
 * `--number-mode` decides what `number` *is*, so it is a compile-time ABI and a
 * package can be silently wrong about it. Putting the mode in the condition
 * makes a mismatch a resolution failure at the package boundary, before a byte
 * of the dependency is checked. A function rather than a constant, so the
 * literal rule above still holds of everything a constant here holds.
 */
export function packageConditionFor(numberMode: string): string {
  return `${PACKAGE_CONDITION}-${numberMode}`;
}

/**
 * The package version, baked in rather than read from `package.json`: stage1
 * has no JSON parser and no way to find the package root from a binary that
 * may have been copied anywhere. `tests/run.js` fails when this and
 * `package.json` disagree, which is the check that keeps a `npm version` bump
 * from going stale here.
 */
export const VERSION: string = "0.3.0";

/** The public C ABI header in `runtime/`; every generated header includes it. */
export const RUNTIME_HEADER: string = "nish.h";

/** Include guard on a generated header: `NISH_ADD_H` for `build/add.h`. */
export const HEADER_GUARD_PREFIX: string = "NISH";
