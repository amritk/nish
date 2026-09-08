// The one place stage1 spells the project's own name; `src/branding.ts` is the
// stage0 twin and holds the same language name. The two must agree: every
// diagnostic the two compilers produce is compared byte for byte by
// `tests/self/reject_oracle.js`, so a name changed on one side and not the
// other fails the suite.
//
// The driver still calls itself `compile` (`self/compile.ts`), so the CLI name
// is not a diagnostic here; it is here because the interop sidecars name the
// compiler in the text they generate — the banner on every generated file, the
// include guard on a header, the runtime header a header includes, and the
// error an N-API module throws when it cannot register its exports — and those
// bytes are compared with stage0's. The environment variables stay stage0's.
//
// Every value is a literal rather than an expression over another constant,
// because a module constant here is folded at compile time and the folder has
// less to work with than stage0's does: `CLI.toUpperCase()` is how `src/`
// spells the guard prefix, and there is no `toUpperCase` in the language.
//
// The `sts_` prefix on the runtime's C symbols is deliberately not here: it is
// ABI rather than branding, it is in every golden `.ll`, and it was never
// derived from the product name.

/** The language, as a diagnostic names it: "`eval` is forbidden in AmritScript". */
export const LANGUAGE: string = "AmritScript";

/**
 * The compiler: the npm package, the `bin` entry, and the word a generated
 * file uses when it talks about the tool that wrote it.
 */
export const CLI: string = "amritc";

/** The public C ABI header in `runtime/`; every generated header includes it. */
export const RUNTIME_HEADER: string = "amritc.h";

/** Include guard on a generated header: `AMRITC_ADD_H` for `build/add.h`. */
export const HEADER_GUARD_PREFIX: string = "AMRITC";
