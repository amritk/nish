// The internal-error report for stage1 (`reportInternalError` in
// `src/index.ts`; docs/wp14-selfhost.md §7a).
//
// A broken invariant is not the program's fault, so it does not go through the
// diagnostic sink and it does not end the process the way a rejected program
// does. stage0 answers **70** (`EX_SOFTWARE`) with a report that names the
// compiler and its version, says what broke, and asks for a bug report; stage1
// answers with the same shape and the same code.
//
// **Why this is an ordinary function and not a second `panic`.** §7a costed
// two designs: a builtin beside `panic(m)` that exits 70, or `process.exit(70)`
// at every site. The second is much the cheaper *for the language*, which is
// the only budget that matters here: `panic(m)` already means "this message,
// then exit 1" and `process.exit(n)` already means "this code, now", so the
// status one program wants for its own bugs needs no new construct at all. The
// first design would put a compiler's reporting policy — the version line, the
// issue tracker, the word "internal" — inside the language that compiles it,
// and every other Nish program would carry a builtin it has no use for.
// What it costs instead is one statement per site, and those sites are `self/`'s
// own.
//
// The shape at each site is one statement rather than a report call followed by
// an exit:
//
//     process.exit(internalErrorFor("emitter: no callee recorded for `f`", this.opts.json));
//
// because the pair can be half-written and this cannot. `process.exit(...)` is
// what the definite-return analysis reads as a terminator, so a site that kept
// the report and dropped the exit would not compile.
//
// **What it cannot say, and says so.** stage0 catches the failure in one
// `try`/`catch` at the top of its driver, where the command line is still in
// hand and the exception carries a stack; it prints both, the stack only under
// `NISH_DEBUG=1`. stage1 has neither to give. The language has no exceptions,
// so the report is made at the site instead of at the top: there is no stack to
// unwind, and no `process.argv` to read either, because that builtin needs an
// entry `main` and the modules that report internal errors are compiled on
// their own as well (`tests/self/corpus.js`). The one thing the command line
// decides that the report needs -- whether `--json` owes it as an object -- is
// handed down to the site instead, as `Options.json`. Rather than print a line
// promising a stack that a rerun would not produce, the report names
// `NISH_DEBUG` and says there is nothing behind it here — and then asks, as
// stage0 does, for the input file and the command line, which is the half
// stage0 was echoing anyway.

import { CLI, VERSION } from "./branding";
import { INTERNAL } from "./codes";

/**
 * `EX_SOFTWARE` from `sysexits.h`, which is what stage0 exits with for an
 * internal error and what `docs/wp12-release.md` documents.
 */
export const EXIT_INTERNAL: i32 = 70;

/**
 * The variable stage0 reads for the stack behind an internal error. Named here
 * so the report can say what it would and would not do, and still not read,
 * which is now a decision rather than a limit: `getenv` is in the language
 * (WP19 §4), and reading this would change nothing. A stack trace is the only
 * thing the variable turns on, and a compiler with no exceptions has no stack
 * to print whether or not it is set — so the report says so once, rather than
 * branching on a variable to print two versions of the same "nothing here".
 */
const ENV_DEBUG: string = "NISH_DEBUG";

/**
 * The test hook for this report, stage0's `NISH_SIMULATE_ICE` carried over so
 * the exit-70 path stays provable once stage0 is gone (WP19 R6). A broken
 * invariant cannot be provoked from a program — that is what makes it one — so
 * `tests/run.js` asks for one through the environment instead. Not a user
 * feature: set and non-empty is all it reads, as stage0's truthiness test was.
 */
const ENV_SIMULATE_ICE: string = "NISH_SIMULATE_ICE";

/** Whether the run asked for a simulated internal error (`ENV_SIMULATE_ICE`). */
export const simulatedInternalError = (): boolean => {
  const value = getenv(ENV_SIMULATE_ICE);
  return value !== null && value.length > 0;
};

/** The sixteen digits a `\u00XX` escape spells a control character with. */
const HEX_DIGITS: string = "0123456789abcdef";

/**
 * Report a broken compiler invariant and answer the exit status for it. Every
 * caller is `process.exit(internalErrorFor(message, json))`, which ends the path.
 *
 * `json` is `Options.json`, handed down by the site because the site is where
 * the report is made: under `--json` the crash is also one `NL0003` object on
 * stdout, as stage0 printed it from its top-level catch, so a reader that asked
 * for JSON never has to scrape stderr for a failure. The human report goes to
 * stderr either way.
 *
 * The object is written in pieces, and `message` is escaped here rather than by
 * `jsonQuote` or any helper, for the attribute pass. Every site hands this a
 * string it has just built, and a string handed on to a user function counts as
 * escaping (`noteUse` in `self/attributes.ts`): `message` would escape, each
 * site's fresh string would leak, and every function that can reach a report
 * would lose its arena scope -- `Emitter.typeOf` and `Emitter.slotOf` among
 * them, which run on every expression. Handed only to builtins, as here, it
 * stays in the frame. The escapes are `jsonQuote`'s, byte for byte.
 */
export const internalErrorFor = (message: string, json: boolean): i32 => {
  if (json) {
    write('{"severity":"error","code":"');
    write(INTERNAL);
    write('","message":"internal compiler error: ');
    let start = 0;
    let i = 0;
    while (i < message.length) {
      const c = message.charCodeAt(i);
      if (c === 34 || c === 92 || c < 32) {
        if (i > start) {
          write(message.substring(start, i));
        }
        if (c === 34) {
          write('\\"');
        } else if (c === 92) {
          write("\\\\");
        } else if (c === 8) {
          write("\\b");
        } else if (c === 9) {
          write("\\t");
        } else if (c === 10) {
          write("\\n");
        } else if (c === 12) {
          write("\\f");
        } else if (c === 13) {
          write("\\r");
        } else {
          write("\\u00");
          write(HEX_DIGITS.substring(c >> 4, (c >> 4) + 1));
          write(HEX_DIGITS.substring(c & 15, (c & 15) + 1));
        }
        start = i + 1;
      }
      i = i + 1;
    }
    if (message.length > start) {
      write(message.substring(start, message.length));
    }
    write('"}\n');
  }
  console.error(`${CLI} ${VERSION}: internal compiler error`);
  console.error(`  ${message}`);
  console.error(`  (this compiler is self-hosted: there is no stack behind this, so ${ENV_DEBUG}=1 adds nothing)`);
  console.error(`This is a bug in ${CLI}, not in your program. Please report it with the input file and`);
  console.error("the command line at https://github.com/amritk/nish/issues");
  return EXIT_INTERNAL;
};

/**
 * The same report for a caller with no command line to answer to. Its lines
 * are `internalErrorFor`'s written out again rather than a call to it, for the
 * reason given there -- passing `message` on would make it escape here -- and
 * `tests/run.js` reads the report from both, so the two cannot drift apart
 * unnoticed.
 */
export const internalError = (message: string): i32 => {
  console.error(`${CLI} ${VERSION}: internal compiler error`);
  console.error(`  ${message}`);
  console.error(`  (this compiler is self-hosted: there is no stack behind this, so ${ENV_DEBUG}=1 adds nothing)`);
  console.error(`This is a bug in ${CLI}, not in your program. Please report it with the input file and`);
  console.error("the command line at https://github.com/amritk/nish/issues");
  return EXIT_INTERNAL;
};
