// WP38 S1: the standard-library walks the compiler replaces with a runtime
// kernel (docs/wp38-simd.md §3.1).
//
// `std/text.ts` is ordinary Nish: `indexOfAny` checks its arguments and hands
// the search to one private walker, a plain loop over `charCodeAt`, and that
// loop is what runs under Node. Natively the compiler recognises the walker by
// module and name, as `src/parallel.ts` recognises `nish/threads`'s templates,
// and replaces the one call `indexOfAny` makes to it with the runtime's
// `nish_str_index_of_any` (`runtime/runtime-simd.c`), which reads sixteen or
// thirty-two bytes at a time. Everything around the call — the checks on the
// set, the clamp of `from` — is emitted as written, so the kernel is only ever
// handed what its contract in `runtime/nish.h` allows: a `from` in
// `[0, length]` and a set of 1 to 16 bytes.
//
// The walker's body is still emitted, as an `internal` function nothing calls,
// and the optimiser drops it. The whole-program facts are taken from it rather
// than from the kernel: it reads its two strings and nothing else, which is
// all the kernel does that a caller can see.

import { CLI, STD_PREFIX } from "./branding"
import { CheckedProgram, FunctionSig } from "./program"
import { stdModuleName } from "./std-modules"

/** The runtime symbol the walker's call becomes. */
export const INDEX_OF_ANY_KERNEL: string = "nish_str_index_of_any"

/** The walker in `std/text.ts` whose one call is the kernel. */
const INDEX_OF_ANY_WALK: string = "indexOfAnyFrom"

/** `std/text.ts`: the name `nish/text` loads under. */
const textModuleName = (): string => stdModuleName(`${STD_PREFIX}text`)

/**
 * Whether `program` is the standard library's `std/text.ts`. The package is
 * part of the test, as it is for `nish/threads` (`isThreadsModule`): a
 * root-package file that happens to sit at `std/text.ts` is an ordinary
 * module, and its walker runs as it is written.
 */
const isTextModule = (program: CheckedProgram): boolean =>
  program.packageName === CLI && program.source.path === textModuleName()

/**
 * Whether a call in `program` to `sig` is `indexOfAny`'s walk, lowered to
 * `INDEX_OF_ANY_KERNEL`. The walker is private to `nish/text`, so a call to it
 * can only be written there, and the caller's module is the one to test.
 */
export const isIndexOfAnyWalk = (program: CheckedProgram, sig: FunctionSig): boolean =>
  sig.owner === null && sig.instance === null && sig.sourceName === INDEX_OF_ANY_WALK && isTextModule(program)
