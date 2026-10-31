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
// `std/regex.ts` has one walker of the same kind: `regexScanFrom`, the search
// for a window of bytes each in its position's set that starts every match
// search, lowered to `nish_regex_scan`. Its callers hand it a `from` in
// `[0, length]`, a depth of 1 to 8, a window of 1 to 4 positions inside it and
// a mask array of 288 bytes a position (a 32-byte nibble mask and a 256-byte
// table), the contract `runtime/nish.h` states.
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
//
// `std/crypto/sha256.ts`'s block function, `sha256Compress`, is a seam of the
// same kind (`isSha256Seam`), on SHA-NI or the ARMv8 SHA-256 instructions in
// `runtime/runtime-sha256.c`, behind `nish_sha256_hw` and `NISH_SHA256`, and
// emitted as written on wasm32. It differs in one way: its guard is in the
// function, not its callers, so the kernel checks the same guard and answers
// whether it ran, and the branch falls to the Nish call, which panics with its
// own message, when it did not. The schedule array it is handed is the Nish
// code's scratch, which the kernel keeps in registers instead.
//
// `std/crypto/bcrypt.ts`'s batch cost loop body, `bcryptBodyN`, is a third
// seam of that kind (`isBcryptSeam`), on the generated x86-64 kernels in
// `runtime/runtime-bcrypt.c`, behind `nish_bcrypt_hw` and `NISH_BCRYPT`. It is
// emitted as written on wasm32 and on any other target a triple names, since
// the kernels are x86-64 alone; a target-neutral module keeps the branch,
// because its runtime answers 0 off x86-64. The kernel checks the width and the
// state's length and answers whether it ran.
//
// WP38 S6a: `nish/bytes` has five walks lowered S1's way, the call replaced
// outright (`bytesWalkOf`). Four are byte-class runs — JSON's blanks, the
// digits, the bytes a JSON string holds as themselves, and the bytes a JSON
// writer copies without an escape — each a kernel in
// `runtime/runtime-bytes.c` with a scalar path of its own; the fifth,
// `copyBytes`'s, is one `llvm.memmove`. Each public function clamps or checks
// its range before its one call, so a kernel is handed only the
// `0 <= from <= to <= length` its contract in `runtime/nish.h` asks for, and
// the copy only ranges that lie inside their arrays.
//
// WP38 CRC: `nish/compress/checksum`'s `Crc32.update` hands its loop to one
// private walker, `crc32Walk`, lowered S5's way — a branch on `nish_crc32_hw`,
// `nish_crc32_update` (`runtime/runtime-checksum.c`) on one arm and the
// original call on the other — with one difference: the walker answers the new
// CRC, so the two arms meet at a `phi`. A machine without PCLMULQDQ or the
// ARMv8 CRC32 instructions, a process run with `NISH_CRC32=soft`, and a wasm32
// build run the slicing-by-8 tables as written. The kernel reads the bytes the
// walker reads and nothing else; it ignores the walker's tables, which hold
// the one polynomial it computes.

import { CheckedProgram, FunctionSig } from "./program"
import { CLI } from "./branding"
import {
  isBytesModule,
  isCompressChecksumModule,
  isCryptoAesModule,
  isRegexModule,
  isTextModule,
  stdModuleName,
} from "./std-modules"
import { T_U32, T_VOID } from "./types"

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

/** The runtime symbol `nish/regex`'s scan becomes. */
export const REGEX_SCAN_KERNEL: string = "nish_regex_scan"

/** Whether a call in `program` to `sig` is `nish/regex`'s scan, tested as `isIndexOfAnyWalk` tests its walk. */
export const isRegexScanWalk = (program: CheckedProgram, sig: FunctionSig): boolean =>
  sig.owner === null &&
  sig.instance === null &&
  sig.sourceName === "regexScanFrom" &&
  isRegexModule(program.packageName, program.source.path)

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

/** The runtime's answer to whether this process runs the SHA-256 kernel. */
export const SHA256_HW: string = "nish_sha256_hw"

/** The runtime kernel `sha256Compress`'s call becomes on the hardware arm, which answers whether it ran. */
export const SHA256_KERNEL: string = "nish_sha256_compress"

/**
 * Whether a call in `program` to `sig` is `nish/crypto/sha256`'s block
 * function, tested as `isAesSeam` tests its seams: private, `void`, and in the
 * standard library's own `std/crypto/sha256.ts`. The module test is spelled
 * here because it has no other asker.
 */
export const isSha256Seam = (program: CheckedProgram, sig: FunctionSig): boolean =>
  sig.owner === null &&
  sig.instance === null &&
  sig.returnType === T_VOID &&
  sig.sourceName === "sha256Compress" &&
  program.packageName === CLI &&
  program.source.path === stdModuleName("nish/crypto/sha256")

/** The runtime's answer to whether this process runs the bcrypt kernels. */
export const BCRYPT_HW: string = "nish_bcrypt_hw"

/** The runtime kernel `bcryptBodyN`'s call becomes on the hardware arm, which answers whether it ran. */
export const BCRYPT_KERNEL: string = "nish_bcrypt_body_n"

/**
 * Whether a call in `program` to `sig` is `nish/crypto/bcrypt`'s batch cost
 * loop body, tested as `isSha256Seam` tests its seam.
 */
export const isBcryptSeam = (program: CheckedProgram, sig: FunctionSig): boolean =>
  sig.owner === null &&
  sig.instance === null &&
  sig.returnType === T_VOID &&
  sig.sourceName === "bcryptBodyN" &&
  program.packageName === CLI &&
  program.source.path === stdModuleName("nish/crypto/bcrypt")

/** The runtime's answer to whether this process runs the CRC-32 kernel. */
export const CRC32_HW: string = "nish_crc32_hw"

/** The runtime kernel `crc32Walk`'s call becomes on the hardware arm. */
export const CRC32_KERNEL: string = "nish_crc32_update"

/**
 * Whether a call in `program` to `sig` is `crc32Walk(table, braid, crc, buf,
 * off, len)`, `Crc32.update`'s loop, tested as `isAesSeam` tests its seams.
 * The emitter's join is an `i32` `phi`, so a walker that came to answer
 * another type would be emitted as written rather than lowered.
 */
export const isCrc32Seam = (program: CheckedProgram, sig: FunctionSig): boolean =>
  sig.owner === null &&
  sig.instance === null &&
  sig.sourceName === "crc32Walk" &&
  sig.returnType === T_U32 &&
  isCompressChecksumModule(program.packageName, program.source.path)

/** A call that is none of `nish/bytes`'s walks. */
export const BYTES_WALK_NONE: i32 = 0
/** `skipBlankWalk(b, from, to)`: `nish_bytes_skip_blank`. */
const BYTES_WALK_BLANK: i32 = 1
/** `skipDigitsWalk(b, from, to)`: `nish_bytes_skip_digits`. */
const BYTES_WALK_DIGITS: i32 = 2
/** `skipJsonTextWalk(b, from, to)`: `nish_bytes_skip_json_text`. */
const BYTES_WALK_JSON_TEXT: i32 = 3
/** `copyBytesWalk(dst, at, src, from, count)`: one `llvm.memmove`. */
export const BYTES_WALK_COPY: i32 = 4
/** `skipJsonPlainWalk(b, from, to)`: `nish_bytes_skip_json_plain`. */
const BYTES_WALK_JSON_PLAIN: i32 = 5

/**
 * Which of `nish/bytes`'s walks a call in `program` to `sig` is, or
 * `BYTES_WALK_NONE`. The walks are private, so a call to one can only be
 * written in that module, and, as for `isIndexOfAnyWalk`, a root-package file
 * that happens to sit at `std/bytes.ts` is an ordinary module.
 */
export const bytesWalkOf = (program: CheckedProgram, sig: FunctionSig): i32 => {
  if (sig.owner !== null || sig.instance !== null) {
    return BYTES_WALK_NONE
  }
  // The name first, as `isAesSeam` tests it: the module test builds a path.
  const name = sig.sourceName
  let walk: i32 = BYTES_WALK_NONE
  if (name === "skipBlankWalk") {
    walk = BYTES_WALK_BLANK
  } else if (name === "skipDigitsWalk") {
    walk = BYTES_WALK_DIGITS
  } else if (name === "skipJsonTextWalk") {
    walk = BYTES_WALK_JSON_TEXT
  } else if (name === "copyBytesWalk") {
    walk = BYTES_WALK_COPY
  } else if (name === "skipJsonPlainWalk") {
    walk = BYTES_WALK_JSON_PLAIN
  }
  if (walk === BYTES_WALK_NONE || !isBytesModule(program.packageName, program.source.path)) {
    return BYTES_WALK_NONE
  }
  return walk
}

/** The runtime kernel a byte-class walk's call becomes; never asked for `BYTES_WALK_COPY`. */
export const bytesKernelOf = (walk: i32): string => {
  if (walk === BYTES_WALK_BLANK) {
    return "nish_bytes_skip_blank"
  }
  if (walk === BYTES_WALK_DIGITS) {
    return "nish_bytes_skip_digits"
  }
  if (walk === BYTES_WALK_JSON_PLAIN) {
    return "nish_bytes_skip_json_plain"
  }
  return "nish_bytes_skip_json_text"
}
