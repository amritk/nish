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
 * What deliberately does not live here is the `amrit_` prefix on the runtime's
 * C symbols. That prefix is ABI — it is in every golden `.ll`, in `runtime.c`,
 * and in every binary linked against the runtime. Treat it as opaque: it is
 * frozen, and a rename does not follow it. (It was `sts_` before the
 * AmritScript rename. Rewriting it was the last step of that rename, done
 * while nothing had been released and every golden could be regenerated, and
 * "Where the name lives" in `docs/ARCHITECTURE.md` says why that does not
 * happen again.)
 */

/** The language, as a diagnostic names it: "`eval` is forbidden in AmritScript". */
export const LANGUAGE = "AmritScript";

/**
 * The compiler: the npm package, the `bin` entry, and the word a message uses
 * when it talks about itself ("amritc: cannot register the addon exports").
 */
export const CLI = "amritc";

/** `AMRITC_DEBUG=1` prints the stack behind an internal compiler error. */
export const ENV_DEBUG = `${CLI.toUpperCase()}_DEBUG`;

/** `AMRITC_SIMULATE_ICE=1` is the test hook for that same path. */
export const ENV_SIMULATE_ICE = `${CLI.toUpperCase()}_SIMULATE_ICE`;

/** The public C ABI header in `runtime/`; every generated header includes it. */
export const RUNTIME_HEADER = `${CLI}.h`;

/** Include guard on a generated header: `AMRITC_ADD_H` for `build/add.h`. */
export const HEADER_GUARD_PREFIX = CLI.toUpperCase();
