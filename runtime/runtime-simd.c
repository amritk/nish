/* Nish runtime, the vector half: byte searches that read sixteen or thirty-two
 * bytes at a time (WP38 S1, docs/wp38-simd.md §3.1).
 *
 * A translation unit of its own for the reason runtime-host.c is one: each file
 * carries its own measured `.text*` ceiling in tests/run.js, and runtime.c had
 * no room left when this arrived. Section GC means a program that never calls a
 * kernel links none of this file, and scripts/build.sh pairs it with runtime.c
 * like the other halves, so a link line still names one runtime.
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

/* Which path `NISH_SIMD` and this machine pick. AVX2 is asked of the CPU only
   when the answer could matter, so a pinned `scalar` or `base` never reads
   the CPU's feature bits at all. */
static nish_any_path nish_any_choose(void) {
  const char *pin = getenv("NISH_SIMD");
  if (pin != NULL && strcmp(pin, "scalar") == 0) return nish_any_scalar;
  if (pin != NULL && strcmp(pin, "base") == 0) return nish_any_base;
#if defined(NISH_SIMD_SSE2)
  if (nish_cpu_has_avx2()) return nish_any_avx2;
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
