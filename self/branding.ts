// The one place stage1 spells the project's own name; `src/branding.ts` is the
// stage0 twin and holds the same language name. The two must agree: every
// diagnostic the two compilers produce is compared byte for byte by
// `tests/self/reject_oracle.js`, so a name changed on one side and not the
// other fails the suite.
//
// Only the language name is here, because that is the only name stage1 ever
// prints: its driver calls itself `compile` (`self/compile.ts`), and the CLI
// name, the environment variables and the C header live on stage0's side.
//
// The value is a literal rather than an expression over another constant,
// because a module constant here is folded at compile time and the folder has
// less to work with than stage0's does.
//
// The `sts_` prefix on the runtime's C symbols is deliberately not here: it is
// ABI rather than branding, it is in every golden `.ll`, and it was never
// derived from the product name.

/** The language, as a diagnostic names it: "`eval` is forbidden in AmritScript". */
export const LANGUAGE: string = "AmritScript";
