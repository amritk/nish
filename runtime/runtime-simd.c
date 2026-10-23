/* Nish runtime, the vector half: byte searches that read sixteen or thirty-two
 * bytes at a time (WP38 S1, docs/wp38-simd.md §3.1).
 *
 * A translation unit of its own for the reason runtime-host.c is one: each file
 * carries its own measured `.text*` ceiling in tests/runtime-budgets.js, and
 * runtime.c had no room left when this arrived. Section GC means a program that
 * never calls a kernel links none of this file, and scripts/build.sh pairs it
 * with runtime.c like the other halves, so a link line still names one runtime.
 *
 * Every kernel has up to three paths. The scalar one runs anywhere. The base
 * one uses the vectors every machine of the target has -- SSE2 on x86-64, NEON
 * on AArch64, simd128 on wasm only when built with `-msimd128`, which is not
 * the default (wp38 §5) -- so it needs no question asked of the CPU. The AVX2
 * one is compiled for that extension alone with `target("avx2")`, so the binary
 * stays a baseline binary and only a machine that has it ever runs it.
 *
 * Which path runs is decided on a kernel's first call, never at program start.
 * The kernel is called through a pointer that starts at its resolver; the
 * resolver asks the CPU, stores the path it picked and calls it, and every
 * later call goes straight to the stored path. `NISH_SIMD` pins the choice:
 * `scalar` and `base` name their paths, and `avx2`, any other value, or no
 * value at all mean the best this machine has. A machine without AVX2 that is
 * asked for it gets the base path, because running it would fault. The
 * instruction gate sets `NISH_SIMD=base` (bench/run.mjs) so that a count does
 * not depend on the host it was measured on.
 */
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

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

/* One path of `nish_str_index_of_any`: the contract in nish.h. */
typedef int64_t (*nish_any_path)(const nish_str *s, const nish_str *set, int64_t from);

/* The scalar path, and the tail of the vector ones. A 256-bit membership
   table answers each byte with one load and one shift whatever the size of
   the set, so this path is also total: an empty set finds nothing and a set
   longer than sixteen bytes is answered correctly, which is why the vector
   paths hand any set outside 1..16 bytes to it rather than overrun their
   sixteen splatted registers. */
static int64_t nish_any_scalar(const nish_str *s, const nish_str *set, int64_t from) {
  uint32_t in[8] = {0};
  for (uint64_t k = 0; k < set->len; k++) {
    uint8_t b = (uint8_t)set->data[k];
    in[b >> 5] |= 1u << (b & 31);
  }
  for (uint64_t i = (uint64_t)from; i < s->len; i++) {
    uint8_t b = (uint8_t)s->data[i];
    if (in[b >> 5] >> (b & 31) & 1) return (int64_t)i;
  }
  return -1;
}

/* The vector paths compare each block against every byte of the set and OR
   the answers, rather than classify each byte by its two nibbles through a
   shuffle table as simdjson does. The shuffle is `pshufb`, which is SSSE3 and
   not in the x86-64 baseline, and a two-table classify is only exact for a
   set whose bytes fit eight nibble classes; an arbitrary set of sixteen bytes
   does not. A compare per set byte is exact for every set, and the sets this
   was built for -- a quote and a backslash, JSON's six structural bytes -- are
   small enough that the compares cost less than the shuffles would. */
#if defined(NISH_SIMD_SSE2)
static int64_t nish_any_base(const nish_str *s, const nish_str *set, int64_t from) {
  uint64_t k = set->len, n = s->len, i = (uint64_t)from;
  if (k - 1 >= 16) return nish_any_scalar(s, set, from);
  __m128i want[16];
  for (uint64_t j = 0; j < k; j++) want[j] = _mm_set1_epi8(set->data[j]);
  for (; i + 16 <= n; i += 16) {
    __m128i v = _mm_loadu_si128((const __m128i *)(s->data + i));
    __m128i hit = _mm_cmpeq_epi8(v, want[0]);
    for (uint64_t j = 1; j < k; j++) hit = _mm_or_si128(hit, _mm_cmpeq_epi8(v, want[j]));
    unsigned m = (unsigned)_mm_movemask_epi8(hit);
    if (m) return (int64_t)(i + (uint64_t)__builtin_ctz(m));
  }
  return nish_any_scalar(s, set, (int64_t)i);
}

/* Thirty-two bytes a block, then the base path for what is left: a tail of
   up to thirty-one bytes is at most one sixteen-byte block and a scalar run. */
__attribute__((target("avx2"))) static int64_t nish_any_avx2(const nish_str *s, const nish_str *set,
                                                             int64_t from) {
  uint64_t k = set->len, n = s->len, i = (uint64_t)from;
  if (k - 1 >= 16) return nish_any_scalar(s, set, from);
  __m256i want[16];
  for (uint64_t j = 0; j < k; j++) want[j] = _mm256_set1_epi8(set->data[j]);
  for (; i + 32 <= n; i += 32) {
    __m256i v = _mm256_loadu_si256((const __m256i *)(s->data + i));
    __m256i hit = _mm256_cmpeq_epi8(v, want[0]);
    for (uint64_t j = 1; j < k; j++) hit = _mm256_or_si256(hit, _mm256_cmpeq_epi8(v, want[j]));
    unsigned m = (unsigned)_mm256_movemask_epi8(hit);
    if (m) return (int64_t)(i + (uint64_t)__builtin_ctz(m));
  }
  return nish_any_base(s, set, (int64_t)i);
}
#elif defined(NISH_SIMD_NEON)
static int64_t nish_any_base(const nish_str *s, const nish_str *set, int64_t from) {
  uint64_t k = set->len, n = s->len, i = (uint64_t)from;
  if (k - 1 >= 16) return nish_any_scalar(s, set, from);
  uint8x16_t want[16];
  for (uint64_t j = 0; j < k; j++) want[j] = vdupq_n_u8((uint8_t)set->data[j]);
  for (; i + 16 <= n; i += 16) {
    uint8x16_t v = vld1q_u8((const uint8_t *)s->data + i);
    uint8x16_t hit = vceqq_u8(v, want[0]);
    for (uint64_t j = 1; j < k; j++) hit = vorrq_u8(hit, vceqq_u8(v, want[j]));
    /* NEON has no movemask. Shifting each 16-bit pair of answers right by four
       and narrowing keeps four bits of every byte's answer, in order, in one
       64-bit lane, so the first hit is the lowest set bit over four. The
       idea is Danila Kutenin's ("Porting x86 vector bitmask optimizations to
       Arm NEON", Arm Community blog, 2022). */
    uint64_t m = vget_lane_u64(vreinterpret_u64_u8(vshrn_n_u16(vreinterpretq_u16_u8(hit), 4)), 0);
    if (m) return (int64_t)(i + ((uint64_t)__builtin_ctzll(m) >> 2));
  }
  return nish_any_scalar(s, set, (int64_t)i);
}
#elif defined(NISH_SIMD_WASM)
static int64_t nish_any_base(const nish_str *s, const nish_str *set, int64_t from) {
  uint64_t k = set->len, n = s->len, i = (uint64_t)from;
  if (k - 1 >= 16) return nish_any_scalar(s, set, from);
  v128_t want[16];
  for (uint64_t j = 0; j < k; j++) want[j] = wasm_i8x16_splat(set->data[j]);
  for (; i + 16 <= n; i += 16) {
    v128_t v = wasm_v128_load(s->data + i);
    v128_t hit = wasm_i8x16_eq(v, want[0]);
    for (uint64_t j = 1; j < k; j++) hit = wasm_v128_or(hit, wasm_i8x16_eq(v, want[j]));
    uint32_t m = wasm_i8x16_bitmask(hit);
    if (m) return (int64_t)(i + (uint64_t)__builtin_ctz(m));
  }
  return nish_any_scalar(s, set, (int64_t)i);
}
#else
/* A target with no vectors in its baseline: wasm without `-msimd128`, the
   default there, among them. Its base path is the scalar one. */
#define nish_any_base nish_any_scalar
#endif

#if defined(NISH_SIMD_SSE2)
/* Whether this machine runs AVX2 code: the CPU has the extension (leaf 7,
   EBX bit 5) and the operating system saves the 256-bit registers across a
   context switch (OSXSAVE, then XCR0's SSE and AVX bits): the procedure the
   Intel SDM gives for detecting AVX2, and the three facts
   `__builtin_cpu_supports("avx2")` reads. That builtin is not used,
   because its answer lives in libgcc's `__cpu_model`, and the object that
   defines it carries a constructor that fills it in at start-up: once a link
   names it, every program pays, a kernel called or not. Measured on
   `examples/hello.ts` at `--profile speed`, that object took the binary from
   4,712 bytes to 10,000 and the run 374 instructions longer. `cpuid.h` is inline
   assembly and nothing else, so here the question is asked on the first call
   and never before it. */
static int nish_cpu_has_avx2(void) {
  unsigned a, b, c, d;
  if (!__get_cpuid(1, &a, &b, &c, &d) || !(c & bit_OSXSAVE) || !(c & bit_AVX)) return 0;
  unsigned lo, hi;
  __asm__("xgetbv" : "=a"(lo), "=d"(hi) : "c"(0));
  if ((lo & 6) != 6) return 0;
  return __get_cpuid_count(7, 0, &a, &b, &c, &d) && (b & bit_AVX2);
}
#endif

/* Which path `NISH_SIMD` and this machine pick, for every kernel here. AVX2 is
   asked of the CPU only when the answer could matter, so a pinned `scalar` or
   `base` never reads the CPU's feature bits at all. */
enum { NISH_PATH_SCALAR, NISH_PATH_BASE, NISH_PATH_AVX2 };

static int nish_simd_choose(void) {
  const char *pin = getenv("NISH_SIMD");
  if (pin != NULL && strcmp(pin, "scalar") == 0) return NISH_PATH_SCALAR;
  if (pin != NULL && strcmp(pin, "base") == 0) return NISH_PATH_BASE;
#if defined(NISH_SIMD_SSE2)
  if (nish_cpu_has_avx2()) return NISH_PATH_AVX2;
#endif
  return NISH_PATH_BASE;
}

static nish_any_path nish_any_choose(void) {
  int path = nish_simd_choose();
  if (path == NISH_PATH_SCALAR) return nish_any_scalar;
#if defined(NISH_SIMD_SSE2)
  if (path == NISH_PATH_AVX2) return nish_any_avx2;
#endif
  return nish_any_base;
}

static int64_t nish_any_resolve(const nish_str *s, const nish_str *set, int64_t from);

/* The path every call goes through, the resolver until the first call has
   run. The loads and the store are relaxed atomics, which are plain moves on
   every target, because under `--threads` two workers may make the first call
   at once; both pick the same path, so whichever store lands is the answer. */
static nish_any_path nish_any = nish_any_resolve;

static int64_t nish_any_resolve(const nish_str *s, const nish_str *set, int64_t from) {
  nish_any_path path = nish_any_choose();
  __atomic_store_n(&nish_any, path, __ATOMIC_RELAXED);
  return path(s, set, from);
}

int64_t nish_str_index_of_any(const nish_str *s, const nish_str *set, int64_t from) {
  return __atomic_load_n(&nish_any, __ATOMIC_RELAXED)(s, set, from);
}

/* `nish_regex_scan`, the search `nish/regex` starts its matches with: the
   first `i` at or after `from` where each of the `depth` bytes from `i` is in
   its position's byte set, the contract in nish.h. The vector paths look for
   the `width` positions from `off`, the rarest run the caller found, and test
   the others only where those hold.

   A position's set is 32 bytes of `masks`, any of the 256 bytes, and is read
   the way Hyperscan's "truffle" reads one (Intel, BSD-3-Clause; the layout
   only, no code): byte `b`'s row is the low nibble, in the first sixteen
   bytes when `b` is below 0x80 and in the second sixteen when not, and its
   bit in the row is the high nibble's low three bits. A vector shuffle looks
   up sixteen or thirty-two rows at once and answers 0 for an index with its
   top bit set, so one shuffle of each half covers the two halves of the byte
   range with no compare, and a third, of a constant, picks each byte's bit.
   That is exact for every set, where `nish_str_index_of_any`'s compare per
   byte stops at sixteen bytes: `[A-Z]` is twenty-six.

   Each set is also a 256-byte table, one byte a member, after the 32-byte
   forms. The scalar path and a vector block's candidates read those: a start
   the window passes is checked a load a position, and a branch on each load
   predicts better than a vector check of the whole block, which measured
   slower for the same instruction count. */
typedef int64_t (*nish_scan_path)(const nish_str *s, const nish_array *masks, int64_t depth, int64_t off,
                                  int64_t width, int64_t from);

/* Whether the bytes from `t` pass positions `j` to `end` of the membership
   tables `m`, a load a byte where the 32-byte form takes a dozen steps. */
__attribute__((always_inline)) static inline int nish_scan_holds(const uint8_t *t, const uint8_t *m, uint64_t j, uint64_t end) {
  for (; j < end; j++)
    if (!m[j << 8 | t[j]]) return 0;
  return 1;
}

/* Whether a start at `t` whose window from `off` holds passes the positions
   around the window as well. */
__attribute__((always_inline)) static inline int nish_scan_rest(const uint8_t *t, const uint8_t *m, uint64_t depth, uint64_t off, uint64_t w) {
  return nish_scan_holds(t, m, 0, off) && nish_scan_holds(t, m, off + w, depth);
}

/* The scalar path, and the tail of the vector ones: the window a byte at a
   time, then the rest. */
static int64_t nish_scan_scalar(const nish_str *s, const nish_array *masks, int64_t depth, int64_t off,
                                int64_t width, int64_t from) {
  const uint8_t *t = (const uint8_t *)s->data;
  uint64_t n = s->len, d = (uint64_t)depth, o = (uint64_t)off, w = (uint64_t)width;
  const uint8_t *m = (const uint8_t *)masks->data + 32 * d;
  for (uint64_t i = (uint64_t)from; i + d <= n; i++) {
    if (nish_scan_holds(t + i, m, o, o + w) && nish_scan_rest(t + i, m, d, o, w)) return (int64_t)i;
  }
  return -1;
}

/* The starts a vector block's `hit` bits mark from `i`, lowest first: the
   first whose other positions hold, -1 when the text ends before one could,
   or -2 to go on to the next block. `lanes` is 1 for a byte a bit and 4 for
   NEON's narrowing. */
__attribute__((always_inline)) static inline int64_t nish_scan_pick(const uint8_t *t, const uint8_t *m, uint64_t n, uint64_t i, uint64_t hit,
                                     unsigned lanes, uint64_t d, uint64_t o, uint64_t w) {
  while (hit) {
    uint64_t c = i + (uint64_t)__builtin_ctzll(hit) / lanes;
    if (c + d > n) return -1;
    if (nish_scan_rest(t + c, m, d, o, w)) return (int64_t)c;
    hit &= lanes == 1 ? hit - 1 : ~(((uint64_t)15) << ((c - i) * 4));
  }
  return -2;
}

#if defined(NISH_SIMD_SSE2)
/* SSE2 has no byte shuffle (`pshufb` is SSSE3), so the x86-64 base path is
   the scalar one; a machine with AVX2 takes the path below. */
#define nish_scan_base nish_scan_scalar

/* Thirty-two candidate starts a block: each window position's thirty-two
   bytes are loaded from its own offset and looked up, the picked bit
   compared into a whole byte (positions pick different bits, so the raw ANDs
   would not meet), and the bytes ANDed, so a set byte is a start whose window
   holds. The width is a constant in each copy, so the tables stay in
   registers rather than an array the loop reloads. A width of 4 takes the
   copy for 3: a narrower window is still a sound filter, since a candidate's
   positions outside it are checked one by one, and `nish/regex` asks for 3 at
   most, so a fourth copy would be 350 bytes nothing runs. */
__attribute__((target("avx2"), always_inline)) static inline int64_t
nish_scan_avx2_w(const nish_str *s, const nish_array *masks, uint64_t d, uint64_t o, uint64_t w, int64_t from) {
  const uint8_t *t = (const uint8_t *)s->data, *mb = (const uint8_t *)masks->data;
  const __m128i *m = (const __m128i *)(mb + 32 * o);
  uint64_t n = s->len, i = (uint64_t)from;
  __m256i lo[3], hi[3];
  for (uint64_t j = 0; j < w; j++) {
    lo[j] = _mm256_broadcastsi128_si256(_mm_loadu_si128(m + 2 * j));
    hi[j] = _mm256_broadcastsi128_si256(_mm_loadu_si128(m + 2 * j + 1));
  }
  const __m256i bit = _mm256_setr_epi8(1, 2, 4, 8, 16, 32, 64, -128, 1, 2, 4, 8, 16, 32, 64, -128, 1, 2, 4, 8,
                                       16, 32, 64, -128, 1, 2, 4, 8, 16, 32, 64, -128);
  const __m256i nib = _mm256_set1_epi8(15), top = _mm256_set1_epi8(-128);
  for (; i + 31 + o + w <= n; i += 32) {
    __m256i all = _mm256_set1_epi8(-1);
    for (uint64_t j = 0; j < w; j++) {
      __m256i v = _mm256_loadu_si256((const __m256i *)(t + i + o + j));
      __m256i row = _mm256_or_si256(_mm256_shuffle_epi8(lo[j], v),
                                    _mm256_shuffle_epi8(hi[j], _mm256_xor_si256(v, top)));
      __m256i pick = _mm256_shuffle_epi8(bit, _mm256_and_si256(_mm256_srli_epi16(v, 4), nib));
      all = _mm256_and_si256(all, _mm256_cmpeq_epi8(_mm256_and_si256(row, pick), pick));
    }
    unsigned hit = (unsigned)_mm256_movemask_epi8(all);
    if (hit) {
      int64_t c = nish_scan_pick(t, mb + 32 * d, n, i, hit, 1, d, o, w);
      if (c != -2) return c;
    }
  }
  return nish_scan_scalar(s, masks, (int64_t)d, (int64_t)o, (int64_t)w, (int64_t)i);
}

__attribute__((target("avx2"))) static int64_t nish_scan_avx2(const nish_str *s, const nish_array *masks,
                                                              int64_t depth, int64_t off, int64_t width,
                                                              int64_t from) {
  uint64_t d = (uint64_t)depth, o = (uint64_t)off;
  switch (width) {
  case 1: return nish_scan_avx2_w(s, masks, d, o, 1, from);
  case 2: return nish_scan_avx2_w(s, masks, d, o, 2, from);
  default: return nish_scan_avx2_w(s, masks, d, o, 3, from);
  }
}
#elif defined(NISH_SIMD_NEON)
/* `tbl` answers 0 for an index past its table rather than looking at four
   bits, so the row is one two-register lookup, indexed by the low nibble
   with the top bit moved down to 16. */
static int64_t nish_scan_base(const nish_str *s, const nish_array *masks, int64_t depth, int64_t off,
                              int64_t width, int64_t from) {
  const uint8_t *t = (const uint8_t *)s->data, *mb = (const uint8_t *)masks->data;
  uint64_t n = s->len, d = (uint64_t)depth, o = (uint64_t)off, w = (uint64_t)width, i = (uint64_t)from;
  uint8x16x2_t row[4];
  for (uint64_t j = 0; j < w; j++) row[j] = vld1q_u8_x2(mb + 32 * (o + j));
  static const uint8_t bits[16] = {1, 2, 4, 8, 16, 32, 64, 128, 1, 2, 4, 8, 16, 32, 64, 128};
  const uint8x16_t bit = vld1q_u8(bits), nib = vdupq_n_u8(15), half = vdupq_n_u8(16);
  for (; i + 15 + o + w <= n; i += 16) {
    uint8x16_t all = vdupq_n_u8(255);
    for (uint64_t j = 0; j < w; j++) {
      uint8x16_t v = vld1q_u8(t + i + o + j);
      uint8x16_t at = vorrq_u8(vandq_u8(v, nib), vandq_u8(vshrq_n_u8(v, 3), half));
      all = vandq_u8(all, vtstq_u8(vqtbl2q_u8(row[j], at), vqtbl1q_u8(bit, vshrq_n_u8(v, 4))));
    }
    /* Kutenin's narrowing, as in `nish_any_base`: four bits a byte. */
    uint64_t hit = vget_lane_u64(vreinterpret_u64_u8(vshrn_n_u16(vreinterpretq_u16_u8(all), 4)), 0);
    if (hit) {
      int64_t c = nish_scan_pick(t, mb + 32 * d, n, i, hit, 4, d, o, w);
      if (c != -2) return c;
    }
  }
  return nish_scan_scalar(s, masks, depth, off, width, (int64_t)i);
}
#elif defined(NISH_SIMD_WASM)
/* `swizzle` answers 0 for an index past 15, as `pshufb` does for one with its
   top bit set, so the AVX2 path's lookups carry over with that bit kept and
   the three below it cleared. */
static int64_t nish_scan_base(const nish_str *s, const nish_array *masks, int64_t depth, int64_t off,
                              int64_t width, int64_t from) {
  const uint8_t *t = (const uint8_t *)s->data, *mb = (const uint8_t *)masks->data;
  uint64_t n = s->len, d = (uint64_t)depth, o = (uint64_t)off, w = (uint64_t)width, i = (uint64_t)from;
  v128_t lo[4], hi[4];
  for (uint64_t j = 0; j < w; j++) {
    lo[j] = wasm_v128_load(mb + 32 * (o + j));
    hi[j] = wasm_v128_load(mb + 32 * (o + j) + 16);
  }
  const v128_t bit = wasm_u8x16_const(1, 2, 4, 8, 16, 32, 64, 128, 1, 2, 4, 8, 16, 32, 64, 128);
  const v128_t keep = wasm_u8x16_splat(0x8f), top = wasm_u8x16_splat(0x80);
  for (; i + 15 + o + w <= n; i += 16) {
    v128_t all = wasm_u8x16_splat(255);
    for (uint64_t j = 0; j < w; j++) {
      v128_t v = wasm_v128_load(t + i + o + j);
      v128_t row = wasm_v128_or(wasm_i8x16_swizzle(lo[j], wasm_v128_and(v, keep)),
                                wasm_i8x16_swizzle(hi[j], wasm_v128_and(wasm_v128_xor(v, top), keep)));
      v128_t pick = wasm_v128_and(row, wasm_i8x16_swizzle(bit, wasm_u8x16_shr(v, 4)));
      all = wasm_v128_and(all, wasm_i8x16_ne(pick, wasm_i64x2_const(0, 0)));
    }
    uint32_t hit = wasm_i8x16_bitmask(all);
    if (hit) {
      int64_t c = nish_scan_pick(t, mb + 32 * d, n, i, hit, 1, d, o, w);
      if (c != -2) return c;
    }
  }
  return nish_scan_scalar(s, masks, depth, off, width, (int64_t)i);
}
#else
#define nish_scan_base nish_scan_scalar
#endif

static nish_scan_path nish_scan_choose(void) {
  int path = nish_simd_choose();
  if (path == NISH_PATH_SCALAR) return nish_scan_scalar;
#if defined(NISH_SIMD_SSE2)
  if (path == NISH_PATH_AVX2) return nish_scan_avx2;
#endif
  return nish_scan_base;
}

static int64_t nish_scan_resolve(const nish_str *s, const nish_array *masks, int64_t depth, int64_t off,
                                 int64_t width, int64_t from);

/* Resolved on the first call and stored as `nish_any` is. */
static nish_scan_path nish_scan = nish_scan_resolve;

static int64_t nish_scan_resolve(const nish_str *s, const nish_array *masks, int64_t depth, int64_t off,
                                 int64_t width, int64_t from) {
  nish_scan_path path = nish_scan_choose();
  __atomic_store_n(&nish_scan, path, __ATOMIC_RELAXED);
  return path(s, masks, depth, off, width, from);
}

int64_t nish_regex_scan(const nish_str *s, const nish_array *masks, int64_t depth, int64_t off, int64_t width,
                        int64_t from) {
  return __atomic_load_n(&nish_scan, __ATOMIC_RELAXED)(s, masks, depth, off, width, from);
}
