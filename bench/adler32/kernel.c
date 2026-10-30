// WP38: a vectorised Adler-32, measured against std/compress/checksum.ts's
// adler32Update (docs/wp38-simd.md §3.2). Two kernels, picked at run time:
// SSSE3 on x86-64 (`pmaddubsw` for the weighted sum, `psadbw` for the plain
// one) behind a target("ssse3") attribute and __builtin_cpu_supports, and
// NEON on AArch64, where it is baseline. Elsewhere, or on a toolchain without
// the intrinsics, there is no kernel and `time` says so. Both defer the modulo
// as adler32Update does: one reduction per NMAX bytes.
//
//   kernel verify          every length 0..4096 at offsets 0..15, then large
//                          inputs, kernel against the scalar reference; exit 0 when equal
//   kernel time [scale]    the kernel on the workloads bench/adler32.ts times
//   kernel scalar [scale]  the scalar reference on them, for scale
//
// `time` and `scalar` print what bench/adler32.ts prints, on the same bytes
// and in the same chain: `time <workload> <ns> <bytes> <ops>` per workload to
// stderr and `checksum <n>` to stdout. bench/adler32.mjs builds and drives it.
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#if defined(__x86_64__) && defined(__has_include)
#if __has_include(<tmmintrin.h>)
#include <tmmintrin.h>
#define ADLER_SSSE3 1
#endif
#elif defined(__aarch64__) && defined(__has_include)
#if __has_include(<arm_neon.h>)
#include <arm_neon.h>
#define ADLER_NEON 1
#endif
#endif

#define BASE 65521u
/** The most bytes before s2 can pass 2^32 - 1 from s1, s2 < BASE (RFC 1950's zlib). */
#define NMAX 5552
/** A vector block; NMAX / BLOCK blocks between reductions. */
#define BLOCK 32

/** The reference: the Nish adler32Update, line for line, in C. */
static uint32_t adler_scalar(uint32_t adler, const uint8_t *buf, size_t len) {
  uint32_t s1 = adler & 0xffff, s2 = adler >> 16;
  while (len > 0) {
    size_t n = len < NMAX ? len : NMAX;
    len -= n;
    while (n--) {
      s1 += *buf++;
      s2 += s1;
    }
    s1 %= BASE;
    s2 %= BASE;
  }
  return (s2 << 16) | s1;
}

/** The bytes after the last whole block, scalar, reduced once (len < BLOCK). */
static uint32_t adler_tail(uint32_t s1, uint32_t s2, const uint8_t *buf, size_t len) {
  while (len--) {
    s1 += *buf++;
    s2 += s1;
  }
  return ((s2 % BASE) << 16) | (s1 % BASE);
}

#if ADLER_SSSE3
static uint32_t hsum32(__m128i v) {
  v = _mm_add_epi32(v, _mm_shuffle_epi32(v, _MM_SHUFFLE(1, 0, 3, 2)));
  v = _mm_add_epi32(v, _mm_shuffle_epi32(v, _MM_SHUFFLE(2, 3, 0, 1)));
  return (uint32_t)_mm_cvtsi128_si32(v);
}

/**
 * Per 32-byte block: s2 gains 32 * s1 (summed in `ps` and shifted once per
 * stretch), the bytes weighted 32..1 (`pmaddubsw` then `pmaddwd`), and s1
 * the bytes (`psadbw`). The weighted sums cannot overflow: a lane's share of
 * s2 is at most s2's whole, which NMAX bounds.
 */
__attribute__((target("ssse3"))) static uint32_t adler_ssse3(uint32_t adler, const uint8_t *buf, size_t len) {
  uint32_t s1 = adler & 0xffff, s2 = adler >> 16;
  const __m128i tap1 = _mm_setr_epi8(32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17);
  const __m128i tap2 = _mm_setr_epi8(16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1);
  const __m128i zero = _mm_setzero_si128();
  const __m128i ones = _mm_set1_epi16(1);
  while (len >= BLOCK) {
    size_t blocks = len / BLOCK;
    if (blocks > NMAX / BLOCK) {
      blocks = NMAX / BLOCK;
    }
    len -= blocks * BLOCK;
    s2 += s1 * (uint32_t)(blocks * BLOCK);
    __m128i ps = zero, vs1 = zero, vs2 = zero;
    do {
      const __m128i b1 = _mm_loadu_si128((const __m128i *)buf);
      const __m128i b2 = _mm_loadu_si128((const __m128i *)(buf + 16));
      ps = _mm_add_epi32(ps, vs1);
      vs1 = _mm_add_epi32(vs1, _mm_sad_epu8(b1, zero));
      vs1 = _mm_add_epi32(vs1, _mm_sad_epu8(b2, zero));
      vs2 = _mm_add_epi32(vs2, _mm_madd_epi16(_mm_maddubs_epi16(b1, tap1), ones));
      vs2 = _mm_add_epi32(vs2, _mm_madd_epi16(_mm_maddubs_epi16(b2, tap2), ones));
      buf += BLOCK;
    } while (--blocks);
    vs2 = _mm_add_epi32(vs2, _mm_slli_epi32(ps, 5));
    s1 += hsum32(vs1);
    s2 += hsum32(vs2);
    s1 %= BASE;
    s2 %= BASE;
  }
  return adler_tail(s1, s2, buf, len);
}
#endif

#if ADLER_NEON
/**
 * The same blocking on NEON: s1 by pairwise widening adds, the bytes' columns
 * summed in 16 bits (at most 173 blocks of 255 fit), weighted 32..1 once a
 * stretch by widening multiply-adds.
 */
static uint32_t adler_neon(uint32_t adler, const uint8_t *buf, size_t len) {
  uint32_t s1 = adler & 0xffff, s2 = adler >> 16;
  static const uint16_t taps[32] = {32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17,
                                    16, 15, 14, 13, 12, 11, 10, 9,  8,  7,  6,  5,  4,  3,  2,  1};
  while (len >= BLOCK) {
    size_t blocks = len / BLOCK;
    if (blocks > NMAX / BLOCK) {
      blocks = NMAX / BLOCK;
    }
    len -= blocks * BLOCK;
    s2 += s1 * (uint32_t)(blocks * BLOCK);
    uint32x4_t ps = vdupq_n_u32(0), vs1 = vdupq_n_u32(0);
    uint16x8_t c1 = vdupq_n_u16(0), c2 = c1, c3 = c1, c4 = c1;
    do {
      const uint8x16_t b1 = vld1q_u8(buf);
      const uint8x16_t b2 = vld1q_u8(buf + 16);
      ps = vaddq_u32(ps, vs1);
      vs1 = vpadalq_u16(vs1, vpadalq_u8(vpaddlq_u8(b1), b2));
      c1 = vaddw_u8(c1, vget_low_u8(b1));
      c2 = vaddw_u8(c2, vget_high_u8(b1));
      c3 = vaddw_u8(c3, vget_low_u8(b2));
      c4 = vaddw_u8(c4, vget_high_u8(b2));
      buf += BLOCK;
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
    s1 += vaddvq_u32(vs1);
    s2 += vaddvq_u32(vs2);
    s1 %= BASE;
    s2 %= BASE;
  }
  return adler_tail(s1, s2, buf, len);
}
#endif

typedef uint32_t (*adler_fn)(uint32_t, const uint8_t *, size_t);

/** The kernel this CPU runs and its name, or NULL where there is none. */
static adler_fn pick(const char **name) {
#if ADLER_SSSE3
  if (__builtin_cpu_supports("ssse3")) {
    *name = "ssse3";
    return adler_ssse3;
  }
#endif
#if ADLER_NEON
  *name = "neon";
  return adler_neon;
#endif
  *name = "none";
  return NULL;
}

/** The bytes each workload covers at scale 1: 64 MiB, as bench/adler32.ts. */
#define TOTAL 67108864
#define DATA (1048576 + 16)

/** bench/adler32.ts's input: a 32-bit LCG's top byte. */
static void fill(uint8_t *out, size_t n) {
  uint32_t x = 20261030u;
  for (size_t i = 0; i < n; i++) {
    x = x * 1103515245u + 12345u;
    out[i] = (uint8_t)(x >> 24);
  }
}

static int64_t nanos(void) {
  struct timespec t;
  clock_gettime(CLOCK_MONOTONIC, &t);
  return (int64_t)t.tv_sec * 1000000000 + t.tv_nsec;
}

/** bench/adler32.ts's workloads, on `f`. */
static int timed(adler_fn f, long scale) {
  static uint8_t data[DATA];
  fill(data, DATA);
  static const size_t sizes[] = {65536, 1048576};
  static const char *names[] = {"adler-64k", "adler-1m"};
  uint32_t a = 1;
  for (int s = 0; s < 2; s++) {
    const long count = TOTAL / (long)sizes[s] / scale;
    const int64_t started = nanos();
    for (long i = 0; i < count; i++) {
      a = f(a, data + i % 16, sizes[s]);
    }
    fprintf(stderr, "time %s %lld %lld %ld\n", names[s], (long long)(nanos() - started),
            (long long)sizes[s] * count, count);
  }
  printf("checksum %u\n", a);
  return 0;
}

static int verify(adler_fn f, const char *name) {
  enum { MAX = 4096 + 16, BIG = 3 * NMAX * 64 + 77 };
  uint8_t *data = malloc(BIG);
  if (data == NULL) {
    return 2;
  }
  long cases = 0;
  for (int round = 0; round < 2; round++) {
    // Random bytes, then all 0xff: the case that drives s1 and s2 the furthest.
    if (round == 0) {
      fill(data, BIG);
    } else {
      memset(data, 0xff, BIG);
    }
    for (size_t off = 0; off < 16; off++) {
      for (size_t len = 0; len + off <= MAX && len <= 4096; len++) {
        const uint32_t seed = round == 0 ? 1u : 0xfff0fff0u;
        if (f(seed, data + off, len) != adler_scalar(seed, data + off, len)) {
          fprintf(stderr, "adler32 %s: length %zu at offset %zu answers %08x, not %08x\n", name, len, off,
                  f(seed, data + off, len), adler_scalar(seed, data + off, len));
          return 1;
        }
        cases++;
      }
    }
    static const size_t large[] = {NMAX - 1, NMAX, NMAX + 1, 2 * NMAX, 1048576, BIG - 16};
    for (size_t k = 0; k < sizeof large / sizeof *large; k++) {
      for (uint32_t seed = 1; seed != 0; seed = seed == 1 ? (65520u << 16) | 65520u : 0) {
        if (f(seed, data + 3, large[k]) != adler_scalar(seed, data + 3, large[k])) {
          fprintf(stderr, "adler32 %s: length %zu answers %08x, not %08x\n", name, large[k],
                  f(seed, data + 3, large[k]), adler_scalar(seed, data + 3, large[k]));
          return 1;
        }
        cases++;
      }
    }
  }
  free(data);
  printf("adler32 %s: %ld cases agree with the scalar reference\n", name, cases);
  return 0;
}

int main(int argc, char **argv) {
  const char *name;
  const adler_fn kernel = pick(&name);
  const char *mode = argc > 1 ? argv[1] : "";
  const long scale = argc > 2 ? atol(argv[2]) : 1;
  if (scale < 1) {
    fprintf(stderr, "adler32: the scale is a positive count\n");
    return 2;
  }
  if (strcmp(mode, "scalar") == 0) {
    return timed(adler_scalar, scale);
  }
  if (strcmp(mode, "time") != 0 && strcmp(mode, "verify") != 0) {
    fprintf(stderr, "usage: kernel verify | time [scale] | scalar [scale]\n");
    return 2;
  }
  if (kernel == NULL) {
    fprintf(stderr, "adler32: no vector kernel on this machine or toolchain\n");
    return 3;
  }
  return strcmp(mode, "time") == 0 ? timed(kernel, scale) : verify(kernel, name);
}
