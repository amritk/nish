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
//
// WP38 S5: four private functions of `std/crypto/aes.ts` — the key schedule,
// one block, GCTR over a run of bytes and GHASH over a run of bytes — have a
// runtime kernel each in `runtime/runtime-aes.c`, on AES-NI and PCLMULQDQ or
// on the ARMv8 AES and PMULL instructions. They are recognised the same way,
// by module and name (`isAesSeam`), and each seam's one call is replaced by
// the same arguments handed to its kernel, the contract `runtime/nish.h`
// states and the seam's one caller has already checked.
//
// The lowering differs from S1's in one way: the walker stays called. The C
// kernel for `indexOfAny` has a scalar loop of its own, so nothing needs the
// Nish walker natively. An AES kernel has no portable path, by design: a
// table-free AES in C would be a second copy of the bitsliced code under
// review. So the call becomes a branch on `nish_aes_hw`, the kernel on one
// arm and the original call, unchanged, on the other, and a machine without
// the instructions, or a process run with `NISH_AES=soft`, runs the bitsliced
// code it always ran. `nish_aes_hw` answers once per process and never
// changes its answer, which matters because the kernel keeps its own layout in
// a key's round keys: a key is made and used under one answer, so one array
// never meets both layouts. The whole-program facts are again the walker's,
// and the kernels touch only what the walkers touch, reading `rk` where the
// GHASH walker reads `hHi:hLo`.
//
// A wasm32 build never takes the branch, because it has no instructions to
// branch to: the call is emitted as written there, and the module references
// no `nish_aes_` symbol at all.

import { CheckedProgram, FunctionSig } from "./program"
import { isCryptoAesModule, isTextModule } from "./std-modules"
import { T_VOID } from "./types"

/** The runtime symbol the walker's call becomes. */
export const INDEX_OF_ANY_KERNEL: string = "nish_str_index_of_any"

/** The walker in `std/text.ts` whose one call is the kernel. */
const INDEX_OF_ANY_WALK: string = "indexOfAnyFrom"

/**
 * Whether a call in `program` to `sig` is `indexOfAny`'s walk, lowered to
 * `INDEX_OF_ANY_KERNEL`. The walker is private to `nish/text`, so a call to it
 * can only be written there, and the caller's module is the one to test. The
 * package is part of that test (`isTextModule`): a root-package file that
 * happens to sit at `std/text.ts` is an ordinary module, and its walker runs
 * as it is written.
 */
export const isIndexOfAnyWalk = (program: CheckedProgram, sig: FunctionSig): boolean =>
  sig.owner === null &&
  sig.instance === null &&
  sig.sourceName === INDEX_OF_ANY_WALK &&
  isTextModule(program.packageName, program.source.path)

/** A call that is none of the AES seams. */
export const AES_SEAM_NONE: i32 = 0
/** `aesScheduleInto(key, rounds, rk)`, the key schedule: `nish_aes_schedule`. */
const AES_SEAM_SCHEDULE: i32 = 1
/** `aesBlockInto(rk, rounds, src, dst)`, one block: `nish_aes_block`. */
const AES_SEAM_BLOCK: i32 = 2
/** `aesCtrInto(rk, rounds, j0, src, dst, length)`, GCTR: `nish_aes_ctr`. */
const AES_SEAM_CTR: i32 = 3
/** `ghashBlocksInto(y, hHi, hLo, rk, data, length)`, GHASH: `nish_aes_ghash`. */
const AES_SEAM_GHASH: i32 = 4

/** The runtime's answer to whether this process runs the AES kernels. */
export const AES_HW: string = "nish_aes_hw"

/**
 * Which of `nish/crypto/aes`'s four seams a call in `program` to `sig` is, or
 * `AES_SEAM_NONE`. As for `isIndexOfAnyWalk`, the seams are private, so a call
 * to one can only be written in that module, and a root-package file that
 * happens to sit at `std/crypto/aes.ts` is an ordinary module. Every seam is
 * `void`, which the emitter's join relies on, so one that came to answer a
 * value would be emitted as written rather than lowered.
 */
export const isAesSeam = (program: CheckedProgram, sig: FunctionSig): i32 => {
  if (sig.owner !== null || sig.instance !== null || sig.returnType !== T_VOID) {
    return AES_SEAM_NONE
  }
  // The name first: the module test builds a path, and this runs at every
  // `void` call the emitter meets.
  const name = sig.sourceName
  let seam: i32 = AES_SEAM_NONE
  if (name === "aesScheduleInto") {
    seam = AES_SEAM_SCHEDULE
  } else if (name === "aesBlockInto") {
    seam = AES_SEAM_BLOCK
  } else if (name === "aesCtrInto") {
    seam = AES_SEAM_CTR
  } else if (name === "ghashBlocksInto") {
    seam = AES_SEAM_GHASH
  }
  if (seam === AES_SEAM_NONE || !isCryptoAesModule(program.packageName, program.source.path)) {
    return AES_SEAM_NONE
  }
  return seam
}

/** The runtime kernel a seam's call becomes on the hardware arm. */
export const aesKernelOf = (seam: i32): string => {
  if (seam === AES_SEAM_SCHEDULE) {
    return "nish_aes_schedule"
  }
  if (seam === AES_SEAM_BLOCK) {
    return "nish_aes_block"
  }
  if (seam === AES_SEAM_CTR) {
    return "nish_aes_ctr"
  }
  return "nish_aes_ghash"
}
