/* Nish runtime, the checksum half: CRC-32 (ISO 3309, gzip's, RFC 1952 §8) on
 * the CPU's carry-less multiply or CRC instructions, and Adler-32 (RFC 1950,
 * zlib's) on SSSE3 or NEON vectors (docs/wp38-simd.md §3.1).
 * std/compress/checksum.ts is the checksum; this is a faster body for its two
 * private walkers, `crc32Walk` and `adler32Walk`, which the compiler calls in
 * their place when `nish_crc32_hw` or `nish_adler32_hw` says this machine can
 * run it (src/kernels.ts). The CRC-32 half comes first; the Adler-32 half,
 * after it, says what its kernels are.
 *
 * A translation unit of its own for the reason runtime-aes.c is one: it carries
 * its own measured `.text*` ceiling in tests/runtime-budgets.js
 * (RUNTIME_CHECKSUM_TEXT_BUDGET), and a program that never checksums links
 * none of it once section GC has run.
 *
 * Two CRC-32 kernels, each compiled for its extensions alone with `target(...)`,
 * so the binary stays a baseline binary:
 *
 *   x86-64    PCLMULQDQ folding, four 128-bit lanes at a step, then a Barrett
 *             reduction to 32 bits; SSE4.1 for the lane extract. Never SSE4.2's
 *             `crc32` instruction, which is CRC-32C, another polynomial.
 *   AArch64   the ARMv8 CRC32 instructions (`crc32x` and its narrower kin),
 *             eight bytes a step, where AT_HWCAP has HWCAP_CRC32. PMULL folding
 *             is not used: on CI's AArch64 runner it measured 20.6 GB/s at 1 MiB
 *             against these instructions' 24.9 GB/s.
 *   the rest  no kernel: std/compress/checksum.ts's slicing-by-8 tables, which
 *             the compiler keeps behind the branch, so a C table here would only
 *             be a second copy of that code.
 *
 * A machine without the instructions, a process run with `NISH_CRC32=soft`, and
 * every other target (wasm32, i686, armv7, a big-endian AArch64, a toolchain
 * without the intrinsic headers) run the Nish code: there `nish_crc32_hw`
 * answers 0 and `nish_crc32_update` is a trap nothing reaches, so a link that
 * names it still resolves.
 *
 * The folding is the method of V. Gopal, E. Ozturk, J. Guilford, G. Wolrich,
 * W. Feghali, M. Dixon and D. Karakoyunlu, "Fast CRC Computation for Generic
 * Polynomials Using PCLMULQDQ Instruction" (Intel, 2009), written here from the
 * paper's description for the bit-reflected polynomial. Every constant below is
 * x^e mod P, or floor(x^64 / P), bit-reflected over 33 bits; tests/simd/crc32.c
 * computes each one again from P and holds this file to it.
 *
 * Neither checksum is a secret's here, so nothing is wiped and nothing is held
 * to constant time (docs/security/compress.md).
 */
#include <stdint.h>

#include "nish.h"

#if defined(__has_include)
#define NISH_CHECKSUM_HAS(h) __has_include(h)
#else
#define NISH_CHECKSUM_HAS(h) 0
#endif

#if defined(__x86_64__) && NISH_CHECKSUM_HAS(<cpuid.h>) && NISH_CHECKSUM_HAS(<wmmintrin.h>) && \
    NISH_CHECKSUM_HAS(<smmintrin.h>)
#include <cpuid.h>
#include <smmintrin.h>
#include <wmmintrin.h>
#define NISH_CRC32_X86 1
#elif defined(__aarch64__) && __BYTE_ORDER__ == __ORDER_LITTLE_ENDIAN__ && NISH_CHECKSUM_HAS(<arm_acle.h>)
#include <arm_acle.h>
#define NISH_CRC32_ARM 1
#endif

/* Named here rather than through <stdlib.h>, as runtime-aes.c names it: the
   file compiles for aarch64 on hosts with no aarch64 libc headers. A stub build
   declares it and never calls it, so it asks the C library for nothing. */
char *getenv(const char *name);

#if defined(NISH_CRC32_X86) || defined(NISH_CRC32_ARM)

/* The fold constants (the header comment says what each is): K1 and K2 fold a
   lane 512 bits on, K3 and K4 128 bits on, K5 64 bits on; P is the polynomial
   and U floor(x^64 / P), both reflected, for the Barrett reduction. */
#define NISH_CRC32_K1 0x154442bd4ull /* x^(512+32) mod P */
#define NISH_CRC32_K2 0x1c6e41596ull /* x^(512-32) mod P */
#define NISH_CRC32_K3 0x1751997d0ull /* x^(128+32) mod P */
#define NISH_CRC32_K4 0x0ccaa009eull /* x^(128-32) mod P */
#define NISH_CRC32_K5 0x163cd6124ull /* x^64 mod P */
#define NISH_CRC32_P 0x1db710641ull
#define NISH_CRC32_U 0x1f7011641ull

/* Unaligned loads from an array's data, which may alias anything. */
typedef uint64_t nish_crc32_u64u __attribute__((aligned(1), may_alias));
typedef uint32_t nish_crc32_u32u __attribute__((aligned(1), may_alias));

#if defined(NISH_CRC32_X86)

#define NISH_CRC32_TARGET __attribute__((target("pclmul,sse4.1")))

/* The register advanced over one byte, four bits at a time: the bytes the
   folds leave over, fewer than sixteen, and inputs shorter than one lane. */
static const uint32_t nish_crc32_nibble[16] = {
    0x00000000, 0x1db71064, 0x3b6e20c8, 0x26d930ac, 0x76dc4190, 0x6b6b51f4, 0x4db26158, 0x5005713c,
    0xedb88320, 0xf00f9344, 0xd6d6a3e8, 0xcb61b38c, 0x9b64c2b0, 0x86d3d2d4, 0xa00ae278, 0xbdbdf21c,
};

static uint32_t nish_crc32_bytes(uint32_t c, const uint8_t *p, uint64_t n) {
  for (uint64_t i = 0; i < n; i++) {
    c ^= p[i];
    c = (c >> 4) ^ nish_crc32_nibble[c & 15];
    c = (c >> 4) ^ nish_crc32_nibble[c & 15];
  }
  return c;
}

/* `x` folded over 128 bits onto `next`: its low half times one constant, its
   high half times the other, both added to the lane that follows. */
static inline __attribute__((always_inline)) NISH_CRC32_TARGET __m128i nish_crc32_fold(__m128i x, __m128i k,
                                                                                        __m128i next) {
  return _mm_xor_si128(_mm_xor_si128(_mm_clmulepi64_si128(x, k, 0x00), _mm_clmulepi64_si128(x, k, 0x11)), next);
}

/* The register `c` (not inverted: the state between bytes) advanced over
   p[0..n). */
static NISH_CRC32_TARGET uint32_t nish_crc32_clmul(uint32_t c, const uint8_t *p, uint64_t n) {
  if (n < 16) return nish_crc32_bytes(c, p, n);
  const __m128i k34 = _mm_set_epi64x((long long)NISH_CRC32_K4, (long long)NISH_CRC32_K3);
  __m128i x = _mm_xor_si128(_mm_loadu_si128((const __m128i *)p), _mm_cvtsi32_si128((int)c));
  p += 16;
  n -= 16;
  if (n >= 48) {
    const __m128i k12 = _mm_set_epi64x((long long)NISH_CRC32_K2, (long long)NISH_CRC32_K1);
    __m128i x1 = _mm_loadu_si128((const __m128i *)p);
    __m128i x2 = _mm_loadu_si128((const __m128i *)(p + 16));
    __m128i x3 = _mm_loadu_si128((const __m128i *)(p + 32));
    p += 48;
    n -= 48;
    while (n >= 64) {
      x = nish_crc32_fold(x, k12, _mm_loadu_si128((const __m128i *)p));
      x1 = nish_crc32_fold(x1, k12, _mm_loadu_si128((const __m128i *)(p + 16)));
      x2 = nish_crc32_fold(x2, k12, _mm_loadu_si128((const __m128i *)(p + 32)));
      x3 = nish_crc32_fold(x3, k12, _mm_loadu_si128((const __m128i *)(p + 48)));
      p += 64;
      n -= 64;
    }
    x = nish_crc32_fold(x, k34, x1);
    x = nish_crc32_fold(x, k34, x2);
    x = nish_crc32_fold(x, k34, x3);
  }
  while (n >= 16) {
    x = nish_crc32_fold(x, k34, _mm_loadu_si128((const __m128i *)p));
    p += 16;
    n -= 16;
  }
  /* 128 bits to 64: the low half times x^96 onto the high half... */
  const __m128i low32 = _mm_set_epi32(0, -1, 0, -1);
  x = _mm_xor_si128(_mm_srli_si128(x, 8), _mm_clmulepi64_si128(x, k34, 0x10));
  /* ...then its low 32 bits times x^64 onto the 64 above them. */
  x = _mm_xor_si128(_mm_srli_si128(x, 4),
                    _mm_clmulepi64_si128(_mm_and_si128(x, low32), _mm_set_epi64x(0, (long long)NISH_CRC32_K5), 0x00));
  /* Barrett: q = (low 32 bits times U) mod x^32, and x + q P leaves the
     remainder in bits 32..63. */
  const __m128i pu = _mm_set_epi64x((long long)NISH_CRC32_U, (long long)NISH_CRC32_P);
  __m128i q = _mm_and_si128(_mm_clmulepi64_si128(_mm_and_si128(x, low32), pu, 0x10), low32);
  x = _mm_xor_si128(x, _mm_clmulepi64_si128(q, pu, 0x00));
  return nish_crc32_bytes((uint32_t)_mm_extract_epi32(x, 1), p, n);
}

#else /* NISH_CRC32_ARM */

#define NISH_CRC32_TARGET __attribute__((target("+crc")))

/* The register `c` (not inverted) advanced over p[0..n) by the CRC32
   instructions, eight bytes a step. */
static inline __attribute__((always_inline)) NISH_CRC32_TARGET uint32_t nish_crc32_insn(uint32_t c, const uint8_t *p,
                                                                                         uint64_t n) {
  for (; n >= 8; p += 8, n -= 8) c = __crc32d(c, *(const nish_crc32_u64u *)p);
  if (n & 4) {
    c = __crc32w(c, *(const nish_crc32_u32u *)p);
    p += 4;
  }
  if (n & 2) {
    c = __crc32h(c, (uint16_t)(p[0] | p[1] << 8));
    p += 2;
  }
  if (n & 1) c = __crc32b(c, p[0]);
  return c;
}

static NISH_CRC32_TARGET uint32_t nish_crc32_arm(uint32_t c, const uint8_t *p, uint64_t n) {
  return nish_crc32_insn(c, p, n);
}

#endif

/* Which path this process runs, as `nish_crc32_answer` holds it. */
#define NISH_CRC32_UNSET 0
#define NISH_CRC32_KERNEL 1 /* PCLMULQDQ on x86-64; the CRC32 instructions on AArch64 */
#define NISH_CRC32_SOFT 2   /* std/compress/checksum.ts's tables */

#if defined(NISH_CRC32_X86)
/* CPUID leaf 1's ECX: PCLMULQDQ (bit 1) and SSE4.1 (bit 19), through `cpuid.h`
   rather than `__builtin_cpu_supports`, for runtime-aes.c's reason. */
static int32_t nish_crc32_cpu(void) {
  unsigned a, b, c, d;
  if (!__get_cpuid(1, &a, &b, &c, &d)) return NISH_CRC32_SOFT;
  return (c & bit_PCLMUL) != 0 && (c & bit_SSE4_1) != 0 ? NISH_CRC32_KERNEL : NISH_CRC32_SOFT;
}
#elif defined(__linux__)
/* AT_HWCAP (16): HWCAP_CRC32 is bit 7 (arch/arm64/include/uapi/asm/hwcap.h). */
unsigned long getauxval(unsigned long type);

static int32_t nish_crc32_cpu(void) {
  return (getauxval(16) & (1ul << 7)) != 0 ? NISH_CRC32_KERNEL : NISH_CRC32_SOFT;
}
#elif defined(__APPLE__)
/* Darwin answers by name; a name it does not know leaves `on` at 0. */
typedef __SIZE_TYPE__ nish_crc32_size;
int sysctlbyname(const char *name, void *old, nish_crc32_size *oldlen, void *new_, nish_crc32_size newlen);

static int32_t nish_crc32_sysctl(const char *name) {
  int on = 0;
  nish_crc32_size size = sizeof on;
  return sysctlbyname(name, &on, &size, 0, 0) == 0 && on != 0;
}

static int32_t nish_crc32_cpu(void) {
  return nish_crc32_sysctl("hw.optional.armv8_crc32") ? NISH_CRC32_KERNEL : NISH_CRC32_SOFT;
}
#else
/* Another AArch64 system: no question asked, so the tables. */
static int32_t nish_crc32_cpu(void) {
  return NISH_CRC32_SOFT;
}
#endif

/* The answer, fixed by the first call: relaxed atomics, as runtime-aes.c's,
   because two `--threads` workers may make that call at once and reach the
   same answer. */
static int32_t nish_crc32_answer;

static int32_t nish_crc32_path(void) {
  int32_t answer = __atomic_load_n(&nish_crc32_answer, __ATOMIC_RELAXED);
  if (answer == NISH_CRC32_UNSET) {
    /* `soft` pins the tables and never asks the CPU; anything else, or
       nothing, means the best this machine has. */
    const char *pin = getenv("NISH_CRC32");
    int soft = pin != 0 && pin[0] == 's' && pin[1] == 'o' && pin[2] == 'f' && pin[3] == 't' && pin[4] == 0;
    answer = soft ? NISH_CRC32_SOFT : nish_crc32_cpu();
    __atomic_store_n(&nish_crc32_answer, answer, __ATOMIC_RELAXED);
  }
  return answer;
}

int32_t nish_crc32_hw(void) {
  return nish_crc32_path() != NISH_CRC32_SOFT;
}

uint32_t nish_crc32_update(uint32_t crc, const nish_array *buf, int32_t off, int32_t len) {
  const uint8_t *p = (const uint8_t *)buf->data + off;
#if defined(NISH_CRC32_X86)
  return ~nish_crc32_clmul(~crc, p, (uint64_t)len);
#else
  return ~nish_crc32_arm(~crc, p, (uint64_t)len);
#endif
}

#else

/* A target with none of the instructions this file uses: the tables always,
   and a kernel that a program whose every call is behind `nish_crc32_hw` never
   reaches. */
int32_t nish_crc32_hw(void) {
  return 0;
}

uint32_t nish_crc32_update(uint32_t crc, const nish_array *buf, int32_t off, int32_t len) {
  (void)crc, (void)buf, (void)off, (void)len;
  __builtin_trap();
}

#endif

/* ---- Adler-32 (RFC 1950 §9, zlib's) ------------------------------------------

   The same seam for std/compress/checksum.ts's `adler32Walk`: `nish_adler32_hw`
   answers once per process, `NISH_ADLER32=soft` pins the Nish loop, and the
   compiler calls `nish_adler32_update` in the walk's place when the answer is 1.

   Two kernels on one blocking: 32-byte blocks, at most NMAX / 32 of them between
   reductions, s2 given the earlier blocks' s1 once per block (summed in `ps` and
   shifted once a stretch) and the block's bytes weighted 32..1, s1 the bytes.

     x86-64    SSSE3, behind `target("ssse3")` and cpuid leaf 1 ECX bit 9:
               `pmaddubsw` then `pmaddwd` for the weighted sum, `psadbw` for s1.
     AArch64   NEON, baseline on every AArch64, so no target and no question
               asked: pairwise widening adds for s1, the block's byte columns
               summed in 16 bits (173 blocks * 255 fits) and weighted once a
               stretch by widening multiply-adds.

   Elsewhere (wasm32, i686, armv7, a big-endian AArch64, a toolchain without the
   headers) the stub below. Written from RFC 1950 and the Intel and Arm
   intrinsic references (bench/adler32/kernel.c measured them first); the
   blocking is the standard technique zlib-ng and Chromium also use, and no
   upstream code was copied. A checksum, not a secret: nothing is wiped. */

#if defined(__x86_64__) && NISH_CHECKSUM_HAS(<cpuid.h>) && NISH_CHECKSUM_HAS(<tmmintrin.h>)
#include <cpuid.h>
#include <tmmintrin.h>
#define NISH_ADLER32_X86 1
#elif defined(__aarch64__) && __BYTE_ORDER__ == __ORDER_LITTLE_ENDIAN__ && NISH_CHECKSUM_HAS(<arm_neon.h>)
#include <arm_neon.h>
#define NISH_ADLER32_ARM 1
#endif

#if defined(NISH_ADLER32_X86) || defined(NISH_ADLER32_ARM)

#define NISH_ADLER32_BASE 65521u
/* The most bytes before s2 can pass 2^32 - 1 from s1, s2 < BASE (zlib's NMAX). */
#define NISH_ADLER32_NMAX 5552
#define NISH_ADLER32_BLOCK 32

#define NISH_ADLER32_UNSET 0
#define NISH_ADLER32_KERNEL 1
#define NISH_ADLER32_SOFT 2

/* The bytes after the last whole block, fewer than 32, then the reduction. */
static uint32_t nish_adler32_tail(uint32_t s1, uint32_t s2, const uint8_t *p, uint64_t n) {
  for (uint64_t i = 0; i < n; i++) {
    s1 += p[i];
    s2 += s1;
  }
  return ((s2 % NISH_ADLER32_BASE) << 16) | (s1 % NISH_ADLER32_BASE);
}

#if defined(NISH_ADLER32_X86)

#define NISH_ADLER32_TARGET __attribute__((target("ssse3")))

static inline __attribute__((always_inline)) NISH_ADLER32_TARGET uint32_t nish_adler32_hsum(__m128i v) {
  v = _mm_add_epi32(v, _mm_shuffle_epi32(v, _MM_SHUFFLE(1, 0, 3, 2)));
  v = _mm_add_epi32(v, _mm_shuffle_epi32(v, _MM_SHUFFLE(2, 3, 0, 1)));
  return (uint32_t)_mm_cvtsi128_si32(v);
}

/* The weighted sums cannot overflow a lane: a lane's share of s2 is at most
   s2's whole, which NMAX bounds even from an unreduced 0xffff seed. */
static NISH_ADLER32_TARGET uint32_t nish_adler32_ssse3(uint32_t adler, const uint8_t *p, uint64_t n) {
  uint32_t s1 = adler & 0xffff, s2 = adler >> 16;
  const __m128i tap1 = _mm_setr_epi8(32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17);
  const __m128i tap2 = _mm_setr_epi8(16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1);
  const __m128i zero = _mm_setzero_si128();
  const __m128i ones = _mm_set1_epi16(1);
  while (n >= NISH_ADLER32_BLOCK) {
    uint64_t blocks = n / NISH_ADLER32_BLOCK;
    if (blocks > NISH_ADLER32_NMAX / NISH_ADLER32_BLOCK) blocks = NISH_ADLER32_NMAX / NISH_ADLER32_BLOCK;
    n -= blocks * NISH_ADLER32_BLOCK;
    s2 += s1 * (uint32_t)(blocks * NISH_ADLER32_BLOCK);
    __m128i ps = zero, vs1 = zero, vs2 = zero;
    do {
      const __m128i b1 = _mm_loadu_si128((const __m128i *)p);
      const __m128i b2 = _mm_loadu_si128((const __m128i *)(p + 16));
      ps = _mm_add_epi32(ps, vs1);
      vs1 = _mm_add_epi32(vs1, _mm_sad_epu8(b1, zero));
      vs1 = _mm_add_epi32(vs1, _mm_sad_epu8(b2, zero));
      vs2 = _mm_add_epi32(vs2, _mm_madd_epi16(_mm_maddubs_epi16(b1, tap1), ones));
      vs2 = _mm_add_epi32(vs2, _mm_madd_epi16(_mm_maddubs_epi16(b2, tap2), ones));
      p += NISH_ADLER32_BLOCK;
    } while (--blocks);
    vs2 = _mm_add_epi32(vs2, _mm_slli_epi32(ps, 5));
    s1 = (s1 + nish_adler32_hsum(vs1)) % NISH_ADLER32_BASE;
    s2 = (s2 + nish_adler32_hsum(vs2)) % NISH_ADLER32_BASE;
  }
  return nish_adler32_tail(s1, s2, p, n);
}

static int32_t nish_adler32_cpu(void) {
  unsigned a, b, c, d;
  return __get_cpuid(1, &a, &b, &c, &d) && (c & bit_SSSE3) != 0 ? NISH_ADLER32_KERNEL : NISH_ADLER32_SOFT;
}

#else

static uint32_t nish_adler32_neon(uint32_t adler, const uint8_t *p, uint64_t n) {
  static const uint16_t taps[32] = {32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17,
                                    16, 15, 14, 13, 12, 11, 10, 9,  8,  7,  6,  5,  4,  3,  2,  1};
  uint32_t s1 = adler & 0xffff, s2 = adler >> 16;
  while (n >= NISH_ADLER32_BLOCK) {
    uint64_t blocks = n / NISH_ADLER32_BLOCK;
    if (blocks > NISH_ADLER32_NMAX / NISH_ADLER32_BLOCK) blocks = NISH_ADLER32_NMAX / NISH_ADLER32_BLOCK;
    n -= blocks * NISH_ADLER32_BLOCK;
    s2 += s1 * (uint32_t)(blocks * NISH_ADLER32_BLOCK);
    uint32x4_t ps = vdupq_n_u32(0), vs1 = vdupq_n_u32(0);
    uint16x8_t c1 = vdupq_n_u16(0), c2 = c1, c3 = c1, c4 = c1;
    do {
      const uint8x16_t b1 = vld1q_u8(p);
      const uint8x16_t b2 = vld1q_u8(p + 16);
      ps = vaddq_u32(ps, vs1);
      vs1 = vpadalq_u16(vs1, vpadalq_u8(vpaddlq_u8(b1), b2));
      c1 = vaddw_u8(c1, vget_low_u8(b1));
      c2 = vaddw_u8(c2, vget_high_u8(b1));
      c3 = vaddw_u8(c3, vget_low_u8(b2));
      c4 = vaddw_u8(c4, vget_high_u8(b2));
      p += NISH_ADLER32_BLOCK;
    } while (--blocks);
    uint32x4_t vs2 = vshlq_n_u32(ps, 5);
    vs2 = vmlal_u16(vs2, vget_low_u16(c1), vld1_u16(taps));
    vs2 = vmlal_u16(vs2, vget_high_u16(c1), vld1_u16(taps + 4));
    vs2 = vmlal_u16(vs2, vget_low_u16(c2), vld1_u16(taps + 8));
    vs2 = vmlal_u16(vs2, vget_high_u16(c2), vld1_u16(taps + 12));
    vs2 = vmlal_u16(vs2, vget_low_u16(c3), vld1_u16(taps + 16));
    vs2 = vmlal_u16(vs2, vget_high_u16(c3), vld1_u16(taps + 20));
    vs2 = vmlal_u16(vs2, vget_low_u16(c4), vld1_u16(taps + 24));
    vs2 = vmlal_u16(vs2, vget_high_u16(c4), vld1_u16(taps + 28));
    s1 = (s1 + vaddvq_u32(vs1)) % NISH_ADLER32_BASE;
    s2 = (s2 + vaddvq_u32(vs2)) % NISH_ADLER32_BASE;
  }
  return nish_adler32_tail(s1, s2, p, n);
}

static int32_t nish_adler32_cpu(void) {
  return NISH_ADLER32_KERNEL;
}

#endif

/* Fixed by the first call, as nish_crc32_answer is. */
static int32_t nish_adler32_answer;

static int32_t nish_adler32_path(void) {
  int32_t answer = __atomic_load_n(&nish_adler32_answer, __ATOMIC_RELAXED);
  if (answer == NISH_ADLER32_UNSET) {
    const char *pin = getenv("NISH_ADLER32");
    int soft = pin != 0 && pin[0] == 's' && pin[1] == 'o' && pin[2] == 'f' && pin[3] == 't' && pin[4] == 0;
    answer = soft ? NISH_ADLER32_SOFT : nish_adler32_cpu();
    __atomic_store_n(&nish_adler32_answer, answer, __ATOMIC_RELAXED);
  }
  return answer;
}

int32_t nish_adler32_hw(void) {
  return nish_adler32_path() != NISH_ADLER32_SOFT;
}

uint32_t nish_adler32_update(uint32_t adler, const nish_array *buf, int32_t off, int32_t len) {
  /* The walk hands an empty window's value back as it came, reduced or not;
     the kernels always reduce, so an empty window never reaches them. */
  if (len == 0) return adler;
  const uint8_t *p = (const uint8_t *)buf->data + off;
#if defined(NISH_ADLER32_X86)
  return nish_adler32_ssse3(adler, p, (uint64_t)len);
#else
  return nish_adler32_neon(adler, p, (uint64_t)len);
#endif
}

#else

/* No kernel for this target: the Nish loop always, and a kernel that a program
   whose every call is behind `nish_adler32_hw` never reaches. */
int32_t nish_adler32_hw(void) {
  return 0;
}

uint32_t nish_adler32_update(uint32_t adler, const nish_array *buf, int32_t off, int32_t len) {
  (void)adler, (void)buf, (void)off, (void)len;
  __builtin_trap();
}

#endif
