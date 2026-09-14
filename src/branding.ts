/**
 * The one place stage0 spells the project's own name.
 *
 * Everything a user ever reads the name in — a diagnostic, `--help`, the
 * banner and include guard on a generated header, the DWARF producer string —
 * builds it from these constants instead of writing it out, so renaming the
 * language or the CLI is an edit to this file and to its stage1 twin
 * (`self/branding.ts`) rather than a sweep over the tree. The two files hold
 * the same language name, and `tests/self/reject_oracle.js` compares the two
 * compilers' messages byte for byte, so a name changed on one side and not the
 * other fails the suite.
 *
 * Prose is exempt: comments and `docs/` are written for humans and read badly
 * full of constants. The rule is only about strings the program itself prints.
 *
 * What deliberately does not live here is the `nish_` prefix on the runtime's
 * C symbols. That prefix is ABI — it is in every golden `.ll`, in `runtime.c`,
 * and in every binary linked against the runtime. Treat it as opaque: it is
 * frozen, and a rename does not follow it. (It has been rewritten twice, as
 * the last step of each rename: `sts_` became `amrit_`, and `amrit_` became
 * `nish_`. Both were affordable only because nothing had been released and
 * every golden could be regenerated, and "Where the name lives" in
 * `docs/ARCHITECTURE.md` says why that stops at the first release.)
 */

/** The language, as a diagnostic names it: "`eval` is forbidden in Nish". */
export const LANGUAGE = "Nish";

/**
 * The compiler: the npm package, the `bin` entry, and the word a message uses
 * when it talks about itself ("nish: cannot register the addon exports").
 */
export const CLI = "nish";

/**
 * The scheme a *builtin* module is imported under: `nish:fs`. It resolves to
 * no file — the import renames a builtin the checker already has — which is
 * what separates it from the standard library below.
 */
export const BUILTIN_SCHEME = `${CLI}:`;

/**
 * The specifier the *standard library* is imported under: `nish/text` is
 * `std/text.ts` beside the compiler. Unlike a builtin this is ordinary Nish
 * source, compiled into the program that imports it.
 *
 * It is here because it is the package's own name (`package.json#name`), and
 * `docs/wp21-packages.md` §2 says so explicitly: whatever the name ends up
 * being — the registry one is taken — it is a spelling of the project's, and
 * both compilers have to agree on it before either can resolve a bare
 * specifier.
 */
export const STD_PREFIX = `${CLI}/`;

/**
 * The `exports` condition a package declares to say that it has Nish source
 * for an Nish consumer to compile (`docs/wp21-packages.md` §2, §6).
 *
 * It is here for the reason `STD_PREFIX` is: it is a spelling of the project's
 * name, and **both compilers have to agree on it before either can resolve a
 * bare specifier** — a package that matched under stage0 and not under stage1
 * would be a program that compiles with one compiler and not the other.
 *
 * Its *presence* in a package's `exports` is the claim that the package is
 * Nish, which is what lets a bare import of an ordinary npm package fail
 * saying so rather than with a module-not-found that reads like the consumer's
 * own mistake.
 */
export const PACKAGE_CONDITION = CLI;

/**
 * The mode-qualified spellings of the condition above: `nish-i32`, `nish-f64`.
 *
 * `--number-mode` decides what `number` *is*, so it is a compile-time ABI and
 * a package can be silently wrong about it — `docs/wp21-packages.md` §6 has the
 * benchmark that prints two different answers under the two modes with nothing
 * in its source announcing which it was written for. Putting the mode in the
 * condition makes a mismatch a *resolution* failure at the package boundary,
 * before a byte of the dependency is checked, and costs no manifest key.
 */
export const packageConditionFor = (numberMode: string): string => `${PACKAGE_CONDITION}-${numberMode}`;

/** `NISH_DEBUG=1` prints the stack behind an internal compiler error. */
export const ENV_DEBUG = `${CLI.toUpperCase()}_DEBUG`;

/** `NISH_SIMULATE_ICE=1` is the test hook for that same path. */
export const ENV_SIMULATE_ICE = `${CLI.toUpperCase()}_SIMULATE_ICE`;

/** The public C ABI header in `runtime/`; every generated header includes it. */
export const RUNTIME_HEADER = `${CLI}.h`;

/** Include guard on a generated header: `NISH_ADD_H` for `build/add.h`. */
export const HEADER_GUARD_PREFIX = CLI.toUpperCase();
