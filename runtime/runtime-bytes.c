/* Nish runtime, the byte-class half: the runs `nish/bytes` steps over -- JSON's
 * blanks, the digits, the bytes a JSON string holds as themselves, and the bytes
 * a JSON writer copies without an escape -- read
 * sixteen or thirty-two bytes at a time (WP38 S6a, docs/wp38-simd.md §3.1).
 *
 * A translation unit of its own for the reason runtime-aes.c is one: each file
 * carries its own measured `.text*` ceiling in tests/runtime-budgets.js, and
 * these kernels would not fit in what runtime-simd.c has left
 * (RUNTIME_BYTES_TEXT_BUDGET says how much they need). Section GC means a
 * program that never calls a kernel links none of this file.
 *
 * The paths and their choice are runtime-simd.c's: a scalar path that runs
 * anywhere, a base path on the vectors every machine of the target has, an
 * AVX2 path compiled for that extension alone, and a choice made on the first
 * call and pinned by `NISH_SIMD` the same way. The one difference is a
 * freestanding wasm32 build, which has no libc to read `NISH_SIMD` with: there
 * the kernels call the base path directly, and the base path is the scalar one
 * unless the build adds `-msimd128`.
 */
#include <stdint.h>

#include "nish.h"

#if defined(__x86_64__) || defined(__i386__)
#if defined(__SSE2__)
#include <cpuid.h>
#include <immintrin.h>
#define NISH_SIMD_SSE2 1
#endif
#elif defined(__ARM_NEON)
#include <arm_neon.h>
#define NISH_SIMD_NEON 1
#elif defined(__wasm_simd128__)
#include <wasm_simd128.h>
#define NISH_SIMD_WASM 1
#endif

/* Whether `NISH_SIMD` can be read: everywhere but a freestanding wasm32 build. */
#if !defined(__wasm__) || defined(__wasi__)
#include <stdlib.h>
#include <string.h>
#define NISH_RUN_CHOOSES 1
#endif

#if defined(NISH_SIMD_SSE2)
/* runtime-simd.c's `nish_cpu_has_avx2`, which says why it asks `cpuid.h`
   rather than `__builtin_cpu_supports`. A copy rather than a shared symbol, as
   runtime-aes.c keeps its own question, so that each unit links alone. */
static int nish_cpu_has_avx2(void) {
  unsigned a, b, c, d;
  if (!__get_cpuid(1, &a, &b, &c, &d) || !(c & bit_OSXSAVE) || !(c & bit_AVX)) return 0;
  unsigned lo, hi;
  __asm__("xgetbv" : "=a"(lo), "=d"(hi) : "c"(0));
  if ((lo & 6) != 6) return 0;
  return __get_cpuid_count(7, 0, &a, &b, &c, &d) && (b & bit_AVX2);
}
#endif

/* The byte-class runs of `nish/bytes` -- `skipBlank`, `skipDigits`,
   `skipJsonText` and `skipJsonPlain` -- which answer the first index in
   [from, to) whose byte is outside a class, or `to`. The contracts are in
   nish.h. The first three share one resolver and one chooser, because they
   are one question asked of three classes: a path is one function taking the
   class, and each exported kernel calls it with its own constant. The fourth
   has paths and a pointer of its own, the same shape, which the one resolver
   sets beside the first's.

   The JSON text class is the bytes a string's scan steps over without a
   second look: printable ASCII other than `"` and `\`, and every complete,
   well-formed UTF-8 sequence that ends at or before `to` (RFC 3629 §4, the
   ranges `jsonTokUtf8Length` in std/json-tokenizer.ts checks). A block of
   ASCII is classified sixteen or thirty-two bytes at a time; a byte with its
   top bit set stops the block, and the sequence it leads is checked one byte
   at a time, as is every sequence after it until the next ASCII byte, so a
   run of CJK text costs one block load per run rather than one per
   character. A sequence that is malformed, or cut short by `to`, ends the
   run at its lead, where the caller's own checks judge it.

   The JSON plain class is the bytes a writer copies into a string as they
   are: every byte from 0x20 up other than `"` and `\`. It is the text class
   with no UTF-8 check -- a writer passes what it is given through, and the
   reader that checks it is on the other side -- so its vector stops are the
   text class's without the high bytes, and nothing in it resumes. It is kept
   out of the class paths because a fourth class there costs the other three:
   choosing its stops inside the shared block loop is a branch on the class in
   every block of the text loop JsonTokenizer runs, and a test on entry costs
   each path its loop unswitching at -O3 and a prologue's worth of bytes at
   -Oz. Its base path is the 16-byte one on every machine, AVX2 or not: a
   writer's strings are short, and a 32-byte copy would not fit the file's
   ceiling. */
enum { NISH_RUN_BLANK = 0, NISH_RUN_DIGIT = 1, NISH_RUN_TEXT = 2, NISH_RUN_PLAIN = 3 };

/* One path of a run kernel: the class, then the nish.h contract. The plain
   kernel's paths take the class too and ignore it, so one resolver serves
   both pointers. */
typedef int64_t (*nish_run_path)(int cls, const uint8_t *p, int64_t from, int64_t to);

/* The length of the well-formed UTF-8 sequence whose lead is at `p[i]` and
   that ends at or before `to`, or 0. */
static inline int64_t nish_run_utf8(const uint8_t *p, int64_t i, int64_t to) {
  uint8_t lead = p[i];
  uint8_t low = 0x80, high = 0xbf;
  int64_t n;
  if (lead >= 0xc2 && lead <= 0xdf) {
    n = 2;
  } else if (lead >= 0xe0 && lead <= 0xef) {
    n = 3;
    if (lead == 0xe0) low = 0xa0;
    if (lead == 0xed) high = 0x9f;
  } else if (lead >= 0xf0 && lead <= 0xf4) {
    n = 4;
    if (lead == 0xf0) low = 0x90;
    if (lead == 0xf4) high = 0x8f;
  } else {
    return 0;
  }
  if (to - i < n) return 0;
  if (p[i + 1] < low || p[i + 1] > high) return 0;
  for (int64_t k = 2; k < n; k++) {
    if (p[i + k] < 0x80 || p[i + k] > 0xbf) return 0;
  }
  return n;
}

/* Whether ASCII-range byte `b` is in the class; for the text class a byte
   with its top bit set answers no here and is taken by `nish_run_utf8`. */
static inline int nish_run_in(int cls, uint8_t b) {
  if (cls == NISH_RUN_BLANK) return b == 0x20 || b == 0x0a || b == 0x0d || b == 0x09;
  if (cls == NISH_RUN_DIGIT) return (uint8_t)(b - 0x30) < 10;
  return b >= 0x20 && b < 0x80 && b != 0x22 && b != 0x5c;
}

/* Steps `i` over the run of UTF-8 sequences that starts there, stopping at
   the first ASCII byte, the first malformed sequence or `to`. */
static inline int64_t nish_run_wide(const uint8_t *p, int64_t i, int64_t to) {
  while (i < to && p[i] >= 0x80) {
    int64_t n = nish_run_utf8(p, i, to);
    if (n == 0) return i;
    i += n;
  }
  return i;
}

/* The plain class's scalar path, and the tail of its vector ones. */
static int64_t nish_plain_scalar(int cls, const uint8_t *p, int64_t i, int64_t to) {
  (void)cls;
  while (i < to && p[i] >= 0x20 && p[i] != 0x22 && p[i] != 0x5c) i++;
  return i;
}

/* The scalar path, and the tail of the vector ones. */
static int64_t nish_run_scalar(int cls, const uint8_t *p, int64_t from, int64_t to) {
  int64_t i = from;
  while (i < to) {
    uint8_t b = p[i];
    if (nish_run_in(cls, b)) {
      i++;
    } else if (cls == NISH_RUN_TEXT && b >= 0x80) {
      int64_t j = nish_run_wide(p, i, to);
      if (j == i) return i;
      i = j;
    } else {
      return i;
    }
  }
  return to;
}

#if defined(NISH_SIMD_SSE2) || defined(NISH_SIMD_NEON) || defined(NISH_SIMD_WASM)
/* A vector path's step past a block's first stop at `i`: `i` again when the
   stop ends the run, else where the run resumes. Only a text run resumes,
   and only past UTF-8. */
static inline int64_t nish_run_resume(int cls, const uint8_t *p, int64_t i, int64_t to) {
  if (cls != NISH_RUN_TEXT || p[i] < 0x80) return i;
  return nish_run_wide(p, i, to);
}
#endif

#if defined(NISH_SIMD_SSE2)
/* The x86 paths check a text block's UTF-8 a block at a time rather than a
   sequence at a time, once its first stop is a high byte. A block starts on a
   sequence boundary, so with each byte `v` beside the three before it in the
   block (`p1`, `p2`, `p3`, zero before the block's first byte), the block's
   bytes are well formed exactly where none of these holds:

   - a byte is a continuation (0x80 to 0xbf) where no lead of the three before
     it reaches it, or is not one where one does: a sequence cut short, a
     stray continuation or one too many (a lead at 0xc0 reaches one byte on,
     at 0xe0 two, at 0xf0 three);
   - the byte is a lead no sequence has: 0xc0 or 0xc1, which only spell an
     overlong two-byte form, or 0xf5 and up, past U+10FFFF;
   - it is the second byte of a sequence outside the range its lead narrows it
     to, the same four `nish_run_utf8` narrows: below 0xa0 after 0xe0 or 0x90
     after 0xf0 (an overlong form), above 0x9f after 0xed (a surrogate) or
     0x8f after 0xf4 (past U+10FFFF).

   Each holds at a byte no later than the first stop that follows the bad
   sequence's lead, so a block whose first ASCII stop has nothing wrong at or
   before it is well formed up to it. This is compare and shift work alone, in
   the spirit of Keiser and Lemire's lookup validator ("Validating UTF-8 In
   Less Than One Instruction Per Byte", 2021) but without its table lookups,
   which SSE2 has no byte shuffle for, and written here rather than taken from
   any implementation of it. */
#define NISH_RUN_BAD(v, p1, p2, p3)                                                                   \
  (((((p1) >= 0xc0) | ((p2) >= 0xe0) | ((p3) >= 0xf0)) != (((v) & 0xc0) == 0x80)) | (((v) & 0xfe) == 0xc0) | \
   ((v) >= 0xf5) | (((p1) == 0xe0) & ((v) < 0xa0)) | (((p1) == 0xf0) & ((v) < 0x90)) |                  \
   (((p1) == 0xed) & ((v) > 0x9f)) | (((p1) == 0xf4) & ((v) > 0x8f)))

typedef uint8_t nish_u8x16 __attribute__((vector_size(16)));

/* How many of the bytes before `e` start a sequence that `e` cuts off, in a
   block whose UTF-8 is otherwise well formed: the block after starts at its
   lead. */
static inline int64_t nish_run_cut(const uint8_t *p, int64_t e) {
  if (p[e - 1] >= 0xc0) return 1;
  if (p[e - 2] >= 0xe0) return 2;
  return p[e - 3] >= 0xf0 ? 3 : 0;
}

/* The bytes of a 16-byte block that break its UTF-8, as a movemask. */
static inline unsigned nish_run_bad_sse2(__m128i x) {
  nish_u8x16 v = (nish_u8x16)x, p1 = (nish_u8x16)_mm_slli_si128(x, 1), p2 = (nish_u8x16)_mm_slli_si128(x, 2),
             p3 = (nish_u8x16)_mm_slli_si128(x, 3);
  return (unsigned)_mm_movemask_epi8((__m128i)NISH_RUN_BAD(v, p1, p2, p3));
}
#endif

/* Each vector path computes a mask of the block's stops -- the bytes outside
   the class, where for text every byte with its top bit set counts as a stop
   -- and either moves on a whole block or jumps to the first stop. */
#if defined(NISH_SIMD_SSE2)
static inline unsigned nish_run_stops_sse2(int cls, __m128i v) {
  if (cls == NISH_RUN_BLANK) {
    __m128i in = _mm_or_si128(_mm_or_si128(_mm_cmpeq_epi8(v, _mm_set1_epi8(0x20)), _mm_cmpeq_epi8(v, _mm_set1_epi8(0x0a))),
                              _mm_or_si128(_mm_cmpeq_epi8(v, _mm_set1_epi8(0x0d)), _mm_cmpeq_epi8(v, _mm_set1_epi8(0x09))));
    return ~(unsigned)_mm_movemask_epi8(in) & 0xffffu;
  }
  if (cls == NISH_RUN_DIGIT) {
    __m128i x = _mm_sub_epi8(v, _mm_set1_epi8(0x30));
    __m128i in = _mm_cmpeq_epi8(_mm_min_epu8(x, _mm_set1_epi8(9)), x);
    return ~(unsigned)_mm_movemask_epi8(in) & 0xffffu;
  }
  /* A control byte is one that `min(v, 0x1f)` leaves alone; a high byte is
     its own sign bit, which movemask reads straight off `v`. */
  __m128i stop = _mm_or_si128(_mm_or_si128(_mm_cmpeq_epi8(v, _mm_set1_epi8(0x22)), _mm_cmpeq_epi8(v, _mm_set1_epi8(0x5c))),
                              _mm_cmpeq_epi8(_mm_min_epu8(v, _mm_set1_epi8(0x1f)), v));
  return (unsigned)_mm_movemask_epi8(_mm_or_si128(stop, v));
}

static int64_t nish_plain_base(int cls, const uint8_t *p, int64_t i, int64_t to) {
  for (; to - i >= 16; i += 16) {
    __m128i v = _mm_loadu_si128((const __m128i *)(p + i));
    __m128i stop = _mm_or_si128(_mm_or_si128(_mm_cmpeq_epi8(v, _mm_set1_epi8(0x22)), _mm_cmpeq_epi8(v, _mm_set1_epi8(0x5c))),
                                _mm_cmpeq_epi8(_mm_min_epu8(v, _mm_set1_epi8(0x1f)), v));
    unsigned m = (unsigned)_mm_movemask_epi8(stop);
    if (m != 0) return i + __builtin_ctz(m);
  }
  return nish_plain_scalar(cls, p, i, to);
}

static int64_t nish_run_base(int cls, const uint8_t *p, int64_t from, int64_t to) {
  int64_t i = from;
  while (to - i >= 16) {
    __m128i v = _mm_loadu_si128((const __m128i *)(p + i));
    unsigned m = nish_run_stops_sse2(cls, v);
    if (m == 0) {
      i += 16;
      continue;
    }
    int64_t at = i + __builtin_ctz(m);
    /* A text block whose first stop is a high byte: its UTF-8 checked whole,
       up to its first ASCII stop or, with none, to its end less a sequence
       the end cuts off. Anything wrong goes to the step below, which finds
       the exact byte. A high byte is never an ASCII stop, so those are the
       stops less the bytes whose sign bit is set. */
    if (cls == NISH_RUN_TEXT && p[at] >= 0x80) {
      unsigned s = m & ~(unsigned)_mm_movemask_epi8(v), bad = nish_run_bad_sse2(v);
      if (s != 0 && (bad & (s ^ (s - 1))) == 0) return i + __builtin_ctz(s);
      if (s == 0 && bad == 0) {
        i += 16 - nish_run_cut(p, i + 16);
        continue;
      }
    }
    i = nish_run_resume(cls, p, at, to);
    if (i == at) return at;
  }
  return nish_run_scalar(cls, p, i, to);
}

__attribute__((target("avx2"))) static inline unsigned nish_run_stops_avx2(int cls, __m256i v) {
  if (cls == NISH_RUN_BLANK) {
    __m256i in = _mm256_or_si256(
        _mm256_or_si256(_mm256_cmpeq_epi8(v, _mm256_set1_epi8(0x20)), _mm256_cmpeq_epi8(v, _mm256_set1_epi8(0x0a))),
        _mm256_or_si256(_mm256_cmpeq_epi8(v, _mm256_set1_epi8(0x0d)), _mm256_cmpeq_epi8(v, _mm256_set1_epi8(0x09))));
    return ~(unsigned)_mm256_movemask_epi8(in);
  }
  if (cls == NISH_RUN_DIGIT) {
    __m256i x = _mm256_sub_epi8(v, _mm256_set1_epi8(0x30));
    __m256i in = _mm256_cmpeq_epi8(_mm256_min_epu8(x, _mm256_set1_epi8(9)), x);
    return ~(unsigned)_mm256_movemask_epi8(in);
  }
  __m256i stop = _mm256_or_si256(
      _mm256_or_si256(_mm256_cmpeq_epi8(v, _mm256_set1_epi8(0x22)), _mm256_cmpeq_epi8(v, _mm256_set1_epi8(0x5c))),
      _mm256_cmpeq_epi8(_mm256_min_epu8(v, _mm256_set1_epi8(0x1f)), v));
  return (unsigned)_mm256_movemask_epi8(_mm256_or_si256(stop, v));
}

/* Thirty-two bytes a block, then the base path for what is left. */
__attribute__((target("avx2"))) static int64_t nish_run_avx2(int cls, const uint8_t *p, int64_t from, int64_t to) {
  int64_t i = from;
  while (to - i >= 32) {
    unsigned m = nish_run_stops_avx2(cls, _mm256_loadu_si256((const __m256i *)(p + i)));
    if (m == 0) {
      i += 32;
      continue;
    }
    int64_t at = i + __builtin_ctz(m);
    if (cls != NISH_RUN_TEXT || p[at] < 0x80) return at;
    /* Past UTF-8 the base path's block check takes the rest of the run:
       text that has one multi-byte sequence tends to have more. */
    return nish_run_base(cls, p, at, to);
  }
  return nish_run_base(cls, p, i, to);
}
#elif defined(NISH_SIMD_NEON)
static inline uint64_t nish_run_stops_neon(int cls, uint8x16_t v) {
  uint8x16_t stop;
  if (cls == NISH_RUN_BLANK) {
    stop = vmvnq_u8(vorrq_u8(vorrq_u8(vceqq_u8(v, vdupq_n_u8(0x20)), vceqq_u8(v, vdupq_n_u8(0x0a))),
                             vorrq_u8(vceqq_u8(v, vdupq_n_u8(0x0d)), vceqq_u8(v, vdupq_n_u8(0x09)))));
  } else if (cls == NISH_RUN_DIGIT) {
    stop = vcgtq_u8(vsubq_u8(v, vdupq_n_u8(0x30)), vdupq_n_u8(9));
  } else {
    stop = vorrq_u8(vorrq_u8(vceqq_u8(v, vdupq_n_u8(0x22)), vceqq_u8(v, vdupq_n_u8(0x5c))),
                    vorrq_u8(vcleq_u8(v, vdupq_n_u8(0x1f)), vcgeq_u8(v, vdupq_n_u8(0x80))));
  }
  /* runtime-simd.c's NEON movemask: four bits a byte, in order. */
  return vget_lane_u64(vreinterpret_u64_u8(vshrn_n_u16(vreinterpretq_u16_u8(stop), 4)), 0);
}

static int64_t nish_plain_base(int cls, const uint8_t *p, int64_t i, int64_t to) {
  for (; to - i >= 16; i += 16) {
    uint8x16_t v = vld1q_u8(p + i);
    uint8x16_t stop = vorrq_u8(vorrq_u8(vceqq_u8(v, vdupq_n_u8(0x22)), vceqq_u8(v, vdupq_n_u8(0x5c))), vcleq_u8(v, vdupq_n_u8(0x1f)));
    uint64_t m = vget_lane_u64(vreinterpret_u64_u8(vshrn_n_u16(vreinterpretq_u16_u8(stop), 4)), 0);
    if (m != 0) return i + (int64_t)(__builtin_ctzll(m) >> 2);
  }
  return nish_plain_scalar(cls, p, i, to);
}

static int64_t nish_run_base(int cls, const uint8_t *p, int64_t from, int64_t to) {
  int64_t i = from;
  while (to - i >= 16) {
    uint64_t m = nish_run_stops_neon(cls, vld1q_u8(p + i));
    if (m == 0) {
      i += 16;
      continue;
    }
    int64_t at = i + (int64_t)(__builtin_ctzll(m) >> 2);
    i = nish_run_resume(cls, p, at, to);
    if (i == at) return at;
  }
  return nish_run_scalar(cls, p, i, to);
}
#elif defined(NISH_SIMD_WASM)
static inline uint32_t nish_run_stops_wasm(int cls, v128_t v) {
  v128_t stop;
  if (cls == NISH_RUN_BLANK) {
    stop = wasm_v128_not(wasm_v128_or(wasm_v128_or(wasm_i8x16_eq(v, wasm_i8x16_splat(0x20)), wasm_i8x16_eq(v, wasm_i8x16_splat(0x0a))),
                                      wasm_v128_or(wasm_i8x16_eq(v, wasm_i8x16_splat(0x0d)), wasm_i8x16_eq(v, wasm_i8x16_splat(0x09)))));
  } else if (cls == NISH_RUN_DIGIT) {
    stop = wasm_u8x16_gt(wasm_i8x16_sub(v, wasm_i8x16_splat(0x30)), wasm_i8x16_splat(9));
  } else {
    stop = wasm_v128_or(wasm_v128_or(wasm_i8x16_eq(v, wasm_i8x16_splat(0x22)), wasm_i8x16_eq(v, wasm_i8x16_splat(0x5c))),
                        wasm_v128_or(wasm_u8x16_le(v, wasm_i8x16_splat(0x1f)), v));
  }
  return wasm_i8x16_bitmask(stop);
}

static int64_t nish_plain_base(int cls, const uint8_t *p, int64_t i, int64_t to) {
  for (; to - i >= 16; i += 16) {
    v128_t v = wasm_v128_load(p + i);
    v128_t stop = wasm_v128_or(wasm_v128_or(wasm_i8x16_eq(v, wasm_i8x16_splat(0x22)), wasm_i8x16_eq(v, wasm_i8x16_splat(0x5c))),
                               wasm_u8x16_le(v, wasm_i8x16_splat(0x1f)));
    uint32_t m = wasm_i8x16_bitmask(stop);
    if (m != 0) return i + __builtin_ctz(m);
  }
  return nish_plain_scalar(cls, p, i, to);
}

static int64_t nish_run_base(int cls, const uint8_t *p, int64_t from, int64_t to) {
  int64_t i = from;
  while (to - i >= 16) {
    uint32_t m = nish_run_stops_wasm(cls, wasm_v128_load(p + i));
    if (m == 0) {
      i += 16;
      continue;
    }
    int64_t at = i + __builtin_ctz(m);
    i = nish_run_resume(cls, p, at, to);
    if (i == at) return at;
  }
  return nish_run_scalar(cls, p, i, to);
}
#else
#define nish_run_base nish_run_scalar
#define nish_plain_base nish_plain_scalar
#endif

#if defined(NISH_RUN_CHOOSES)
/* Which path `NISH_SIMD` and this machine pick: runtime-simd.c's
   `nish_any_choose`, for the run kernels. */
static nish_run_path nish_run_choose(void) {
  const char *pin = getenv("NISH_SIMD");
  if (pin != NULL && strcmp(pin, "scalar") == 0) return nish_run_scalar;
  if (pin != NULL && strcmp(pin, "base") == 0) return nish_run_base;
#if defined(NISH_SIMD_SSE2)
  if (nish_cpu_has_avx2()) return nish_run_avx2;
#endif
  return nish_run_base;
}

static int64_t nish_run_resolve(int cls, const uint8_t *p, int64_t from, int64_t to);

/* runtime-simd.c's `nish_any`, for the run kernels: a pointer that starts at
   the resolver, read and written with relaxed atomics, plain moves, because
   under `--threads` two workers may make the first call at once and both
   store the same path. The plain kernel has a pointer of its own. */
static nish_run_path nish_run = nish_run_resolve;
static nish_run_path nish_plain = nish_run_resolve;

/* Asks the chooser once and sets both pointers: the plain kernel takes its
   scalar path when the chooser picks the scalar one, else its base path. */
static void nish_run_settle(void) {
  nish_run_path path = nish_run_choose();
  __atomic_store_n(&nish_run, path, __ATOMIC_RELAXED);
  __atomic_store_n(&nish_plain, path == nish_run_scalar ? nish_plain_scalar : nish_plain_base, __ATOMIC_RELAXED);
}

#define NISH_RUN_PATH __atomic_load_n(&nish_run, __ATOMIC_RELAXED)
#define NISH_PLAIN_PATH __atomic_load_n(&nish_plain, __ATOMIC_RELAXED)

static int64_t nish_run_resolve(int cls, const uint8_t *p, int64_t from, int64_t to) {
  nish_run_settle();
  return (cls == NISH_RUN_PLAIN ? NISH_PLAIN_PATH : NISH_RUN_PATH)(cls, p, from, to);
}
#else
#define NISH_RUN_PATH nish_run_base
#define NISH_PLAIN_PATH nish_plain_base
#endif

int64_t nish_bytes_skip_blank(const uint8_t *p, int64_t from, int64_t to) {
  return NISH_RUN_PATH(NISH_RUN_BLANK, p, from, to);
}

int64_t nish_bytes_skip_digits(const uint8_t *p, int64_t from, int64_t to) {
  return NISH_RUN_PATH(NISH_RUN_DIGIT, p, from, to);
}

int64_t nish_bytes_skip_json_text(const uint8_t *p, int64_t from, int64_t to) {
  return NISH_RUN_PATH(NISH_RUN_TEXT, p, from, to);
}

int64_t nish_bytes_skip_json_plain(const uint8_t *p, int64_t from, int64_t to) {
  return NISH_PLAIN_PATH(NISH_RUN_PLAIN, p, from, to);
}
