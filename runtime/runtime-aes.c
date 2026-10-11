/* Nish runtime, the AES half: AES-128 and AES-256 in counter mode and GHASH on
 * the CPU's own AES and carry-less multiply instructions (WP38 S5,
 * docs/wp38-simd.md §3.1). std/crypto/aes.ts is the cipher; this is a faster
 * body for four of its private functions, which the compiler calls in their
 * place when `nish_aes_hw` says this machine can run it.
 *
 * A translation unit of its own for the reason runtime-simd.c is one: each file
 * carries its own measured `.text*` ceiling in tests/run.js, and this one would
 * not fit in what runtime-simd.c has left (RUNTIME_AES_TEXT_BUDGET says how
 * much it needs). It also keeps byte search and AES apart, so a program that
 * searches text links no AES and one that speaks TLS no byte search. Section GC
 * means a program that never calls a kernel links none of this file.
 *
 * There are two paths and no portable one. x86-64 runs AES-NI and PCLMULQDQ
 * (plus SSSE3's byte shuffle), compiled for those extensions alone with
 * `target(...)` so the binary stays a baseline binary; AArch64 runs the ARMv8
 * Cryptography Extension's AES and PMULL, likewise with `target("+aes")`. A
 * machine without them, or a process with `NISH_AES=soft`, runs the bitsliced
 * Nish code in std/crypto/aes.ts instead: the compiler keeps that code and
 * branches on `nish_aes_hw` at each call, so a table-free C AES here would only
 * be a second copy of the code under review. Every other target, wasm32
 * included, compiles `nish_aes_hw` to `return 0` and the kernels to a trap
 * nothing reaches, so a link that names them still resolves.
 *
 * The round-key array, `rk`, is the `8 * (rounds + 1)` words (88 or 120 u64s)
 * the bitsliced schedule uses, laid out differently on this path. One process
 * only ever uses one layout, because `nish_aes_hw`'s answer is fixed on its
 * first call. In bytes:
 *
 *   [0, 16 * (rounds + 1))   the FIPS 197 key schedule, round key r at 16 * r,
 *                            each in the byte order the cipher XORs it in
 *   [240, 304)               H, H^2, H^3 and H^4 for GHASH, H = E(K, 0^128),
 *                            each as two u64 lanes, low then high, of the block
 *                            read as a big-endian 128-bit number
 *   [304, 368)               for each power, its two halves XORed together in
 *                            both lanes: Karatsuba's middle operand, kept so a
 *                            multiply by a power costs three carry-less
 *                            products, not four
 *   everything else          zero
 *
 * H sits at a fixed offset rather than after the schedule because
 * `nish_aes_ghash` is not told `rounds`. `nish_aes_ghash` reads H and its
 * powers from `rk` and not from its `hHi`/`hLo` arguments, which the bitsliced
 * walker it stands in for needs and which hold the same H (std/crypto/aes.ts
 * computes them as E(K, 0^128) from this same schedule).
 *
 * Constant time: every kernel's branches are loop bounds on `length`, `rounds`
 * or an array header, and no load or store address depends on a key, data or
 * H. tests/ct-asm-runtime.js reads the `clang -O2` assembly of this file for
 * both targets and holds every kernel function to that. The one branch on
 * anything else is `nish_aes_hw`'s, on the CPU's feature bits and `NISH_AES`
 * (docs/security/ct-verification.md).
 *
 * Wiping: the kernels keep no copy of a round key, a counter block or the GHASH
 * state on the stack on purpose. The two stack buffers they do have, the
 * keystream of a partial last block and a zero-padded last block for GHASH, are
 * zeroed before return by volatile stores, the mechanism `nish:secret`'s wipe
 * uses, which tests/run.js holds against `clang -O2`. What sits in vector
 * registers, and what the register allocator spills, no store from C can
 * reach (docs/security/crypto-aead.md).
 *
 * The algorithms are FIPS 197 (the key expansion, with SubWord taken from the
 * AES instructions) and SP 800-38D (GCTR and GHASH); the GHASH multiply is the
 * bit-reflected carry-less method of S. Gueron and M. E. Kounavis, "Intel
 * Carry-Less Multiplication Instruction and its Usage for Computing the GCM
 * Mode" (Intel, rev. 2.02, 2014), written here from the paper's description,
 * with the aggregated reduction of its §5 over four blocks.
 */
#include <stdint.h>

#include "nish.h"

#if defined(__x86_64__)
#include <cpuid.h>
#include <tmmintrin.h>
#include <wmmintrin.h>
#define NISH_AES_X86 1
#elif defined(__aarch64__)
#include <arm_neon.h>
#define NISH_AES_ARM 1
#endif

#if defined(NISH_AES_X86) || defined(NISH_AES_ARM)

/* Named here rather than through <stdlib.h> and <sys/auxv.h>, because the
   constant-time check compiles this file for aarch64 on hosts with no aarch64
   libc headers, and these two prototypes are all it needs from them. */
char *getenv(const char *name);

/* GCC's vector extensions, which clang shares: XOR and per-lane shifts work on
   both targets, so GHASH's reduction is written once. The `u` types are the
   same vectors at byte alignment, for loads and stores through an array's
   data, and may alias the u64 slots they are read out of. */
typedef uint64_t nish_aes_u64x2 __attribute__((vector_size(16)));
typedef uint8_t nish_aes_u8x16 __attribute__((vector_size(16)));
typedef uint32_t nish_aes_u32x4 __attribute__((vector_size(16)));
typedef uint8_t nish_aes_u8x16u __attribute__((vector_size(16), aligned(1), may_alias));
typedef uint32_t nish_aes_u32u __attribute__((aligned(1), may_alias));

/* Every kernel and helper: the extensions it needs, and (under clang, the
   compiler build.sh uses) no calls to libc, so neither a byte loop nor a wipe
   turns into a `memcpy` or `memset` the constant-time check would have to
   take on trust. */
#if defined(__has_attribute) && __has_attribute(no_builtin)
#define NISH_AES_NO_LIBC no_builtin
#else
#define NISH_AES_NO_LIBC
#endif
#if defined(NISH_AES_X86)
#define NISH_AES_TARGET __attribute__((target("aes,pclmul,ssse3"), NISH_AES_NO_LIBC))
#else
#define NISH_AES_TARGET __attribute__((target("+aes"), NISH_AES_NO_LIBC))
#endif
#define NISH_AES_INLINE static inline __attribute__((always_inline)) NISH_AES_TARGET

/* Byte offsets in `rk` (the layout in the header). */
#define NISH_AES_HPOW 240
#define NISH_AES_HMID 304
#define NISH_AES_HEND 368

NISH_AES_INLINE nish_aes_u8x16 nish_aes_load(const char *p) {
  return *(const nish_aes_u8x16u *)p;
}

NISH_AES_INLINE void nish_aes_store(char *p, nish_aes_u8x16 v) {
  *(nish_aes_u8x16u *)p = v;
}

/* Zeroes sixteen bytes of the stack with stores `-O2` must keep. */
NISH_AES_INLINE void nish_aes_wipe16(void *p) {
  volatile uint64_t *v = (volatile uint64_t *)p;
  v[0] = 0;
  v[1] = 0;
}

/* The block read as a big-endian 128-bit number, as two lanes low then high:
   the order GHASH's multiply works in. Its own inverse. */
NISH_AES_INLINE nish_aes_u64x2 nish_aes_reflect(nish_aes_u8x16 b) {
  return (nish_aes_u64x2)__builtin_shufflevector(b, b, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0);
}

#if defined(NISH_AES_X86)
/* One block through `rounds` rounds of AES-NI: the whitening key, the middle
   rounds, and the last round, which skips MixColumns. Round keys are read from
   `k` at each use rather than held, so none is copied to the stack. */
NISH_AES_INLINE nish_aes_u8x16 nish_aes_encrypt(const char *k, int32_t rounds, nish_aes_u8x16 s) {
  __m128i x = (__m128i)s ^ (__m128i)nish_aes_load(k);
  for (int32_t r = 1; r < rounds; r++) x = _mm_aesenc_si128(x, (__m128i)nish_aes_load(k + 16 * r));
  return (nish_aes_u8x16)_mm_aesenclast_si128(x, (__m128i)nish_aes_load(k + 16 * rounds));
}

/* Four blocks at once: AESENC's latency is several cycles and one issues a
   cycle, so four independent blocks keep the unit busy where one would wait. */
NISH_AES_INLINE void nish_aes_encrypt4(const char *k, int32_t rounds, nish_aes_u8x16 *s) {
  __m128i k0 = (__m128i)nish_aes_load(k);
  __m128i a = (__m128i)s[0] ^ k0, b = (__m128i)s[1] ^ k0, c = (__m128i)s[2] ^ k0, d = (__m128i)s[3] ^ k0;
  for (int32_t r = 1; r < rounds; r++) {
    __m128i kr = (__m128i)nish_aes_load(k + 16 * r);
    a = _mm_aesenc_si128(a, kr);
    b = _mm_aesenc_si128(b, kr);
    c = _mm_aesenc_si128(c, kr);
    d = _mm_aesenc_si128(d, kr);
  }
  __m128i kl = (__m128i)nish_aes_load(k + 16 * rounds);
  s[0] = (nish_aes_u8x16)_mm_aesenclast_si128(a, kl);
  s[1] = (nish_aes_u8x16)_mm_aesenclast_si128(b, kl);
  s[2] = (nish_aes_u8x16)_mm_aesenclast_si128(c, kl);
  s[3] = (nish_aes_u8x16)_mm_aesenclast_si128(d, kl);
}

/* SubWord (FIPS 197 §5.2) of one key word, in the order its bytes sit in
   memory: AESKEYGENASSIST's lowest dword is SubWord of the dword above it. */
NISH_AES_INLINE uint32_t nish_aes_sub_word(uint32_t w) {
  return (uint32_t)_mm_cvtsi128_si32(_mm_aeskeygenassist_si128(_mm_set1_epi32((int)w), 0));
}

/* The low lanes' and the high lanes' 64 × 64 carry-less products. */
NISH_AES_INLINE nish_aes_u64x2 nish_aes_clmul_lo(nish_aes_u64x2 a, nish_aes_u64x2 b) {
  return (nish_aes_u64x2)_mm_clmulepi64_si128((__m128i)a, (__m128i)b, 0x00);
}

NISH_AES_INLINE nish_aes_u64x2 nish_aes_clmul_hi(nish_aes_u64x2 a, nish_aes_u64x2 b) {
  return (nish_aes_u64x2)_mm_clmulepi64_si128((__m128i)a, (__m128i)b, 0x11);
}
#else
/* The same on ARMv8. AESE XORs its key in before SubBytes and ShiftRows, where
   AESENC does it after MixColumns, so each round key moves one round earlier
   and the last one is XORed in on its own. */
NISH_AES_INLINE nish_aes_u8x16 nish_aes_encrypt(const char *k, int32_t rounds, nish_aes_u8x16 s) {
  uint8x16_t x = (uint8x16_t)s;
  for (int32_t r = 0; r < rounds - 1; r++) x = vaesmcq_u8(vaeseq_u8(x, (uint8x16_t)nish_aes_load(k + 16 * r)));
  x = vaeseq_u8(x, (uint8x16_t)nish_aes_load(k + 16 * (rounds - 1)));
  return (nish_aes_u8x16)x ^ nish_aes_load(k + 16 * rounds);
}

NISH_AES_INLINE void nish_aes_encrypt4(const char *k, int32_t rounds, nish_aes_u8x16 *s) {
  uint8x16_t a = (uint8x16_t)s[0], b = (uint8x16_t)s[1], c = (uint8x16_t)s[2], d = (uint8x16_t)s[3];
  for (int32_t r = 0; r < rounds - 1; r++) {
    uint8x16_t kr = (uint8x16_t)nish_aes_load(k + 16 * r);
    a = vaesmcq_u8(vaeseq_u8(a, kr));
    b = vaesmcq_u8(vaeseq_u8(b, kr));
    c = vaesmcq_u8(vaeseq_u8(c, kr));
    d = vaesmcq_u8(vaeseq_u8(d, kr));
  }
  uint8x16_t kp = (uint8x16_t)nish_aes_load(k + 16 * (rounds - 1));
  nish_aes_u8x16 kl = nish_aes_load(k + 16 * rounds);
  s[0] = (nish_aes_u8x16)vaeseq_u8(a, kp) ^ kl;
  s[1] = (nish_aes_u8x16)vaeseq_u8(b, kp) ^ kl;
  s[2] = (nish_aes_u8x16)vaeseq_u8(c, kp) ^ kl;
  s[3] = (nish_aes_u8x16)vaeseq_u8(d, kp) ^ kl;
}

/* SubWord from AESE with a zero key: with the word in all four columns,
   ShiftRows moves each byte to a column holding the same byte, so lane 0 is
   SubBytes of the word and nothing else. */
NISH_AES_INLINE uint32_t nish_aes_sub_word(uint32_t w) {
  return vgetq_lane_u32(vreinterpretq_u32_u8(vaeseq_u8(vreinterpretq_u8_u32(vdupq_n_u32(w)), vdupq_n_u8(0))), 0);
}

NISH_AES_INLINE nish_aes_u64x2 nish_aes_clmul_lo(nish_aes_u64x2 a, nish_aes_u64x2 b) {
  return (nish_aes_u64x2)vreinterpretq_u64_p128(vmull_p64((poly64_t)a[0], (poly64_t)b[0]));
}

NISH_AES_INLINE nish_aes_u64x2 nish_aes_clmul_hi(nish_aes_u64x2 a, nish_aes_u64x2 b) {
  return (nish_aes_u64x2)vreinterpretq_u64_p128(
      vmull_high_p64(vreinterpretq_p64_u64((uint64x2_t)a), vreinterpretq_p64_u64((uint64x2_t)b)));
}
#endif

/* GHASH's reduction (SP 800-38D §6.3): the 256-bit product `hi:lo` of two
   reflected blocks is the true product shifted right by one, so it is shifted
   left once, and then its low half -- the coefficients of x^128 and up -- is
   folded into the high half by x^128 = x^7 + x^2 + x + 1, in two steps
   because the fold of its lowest bits lands back in the low half (Gueron and
   Kounavis, Algorithm 4 and §4's shift). */
NISH_AES_INLINE nish_aes_u64x2 nish_aes_reduce(nish_aes_u64x2 hi, nish_aes_u64x2 lo) {
  const nish_aes_u64x2 zero = {0, 0};
  nish_aes_u64x2 hiOut = (hi << 1) | __builtin_shufflevector(hi >> 63, zero, 2, 0) |
                         __builtin_shufflevector(lo >> 63, zero, 1, 2);
  lo = (lo << 1) | __builtin_shufflevector(lo >> 63, zero, 2, 0);
  /* The first fold: x0's bits that x, x^2 and x^7 carry past the 128th
     position land in x1. */
  lo ^= __builtin_shufflevector((lo << 63) ^ (lo << 62) ^ (lo << 57), zero, 2, 0);
  /* The second: all of d:x0 times 1 + x + x^2 + x^7, which in the reflected
     order is d:x0 shifted right by 0, 1, 2 and 7 across both lanes. */
  nish_aes_u64x2 r1 = (lo >> 1) | __builtin_shufflevector(lo << 63, zero, 1, 2);
  nish_aes_u64x2 r2 = (lo >> 2) | __builtin_shufflevector(lo << 62, zero, 1, 2);
  nish_aes_u64x2 r7 = (lo >> 7) | __builtin_shufflevector(lo << 57, zero, 1, 2);
  return hiOut ^ lo ^ r1 ^ r2 ^ r7;
}

/* Karatsuba's middle operand: the two halves XORed, in both lanes. */
NISH_AES_INLINE nish_aes_u64x2 nish_aes_mid(nish_aes_u64x2 a) {
  return a ^ __builtin_shufflevector(a, a, 1, 0);
}

/* Accumulates one 128 × 128 carry-less product into `acc`: lane products
   into [0] and [1], the middle one into [2], `hm` being `h`'s middle operand. */
NISH_AES_INLINE void nish_aes_mul_acc(nish_aes_u64x2 *acc, nish_aes_u64x2 x, nish_aes_u64x2 h, nish_aes_u64x2 hm) {
  acc[0] ^= nish_aes_clmul_lo(x, h);
  acc[1] ^= nish_aes_clmul_hi(x, h);
  acc[2] ^= nish_aes_clmul_lo(nish_aes_mid(x), hm);
}

/* Reduces what `nish_aes_mul_acc` accumulated: the middle product, less the
   other two, straddles the halves at bit 64. */
NISH_AES_INLINE nish_aes_u64x2 nish_aes_mul_finish(const nish_aes_u64x2 *acc) {
  const nish_aes_u64x2 zero = {0, 0};
  nish_aes_u64x2 mid = acc[2] ^ acc[0] ^ acc[1];
  return nish_aes_reduce(acc[1] ^ __builtin_shufflevector(mid, zero, 1, 2),
                         acc[0] ^ __builtin_shufflevector(mid, zero, 2, 0));
}

NISH_AES_INLINE nish_aes_u64x2 nish_aes_mul(nish_aes_u64x2 x, nish_aes_u64x2 h) {
  nish_aes_u64x2 acc[3] = {{0, 0}, {0, 0}, {0, 0}};
  nish_aes_mul_acc(acc, x, h, nish_aes_mid(h));
  return nish_aes_mul_finish(acc);
}

/* `nish_aes_ctr`'s counter block `n` past J0: J0's first twelve bytes and its
   last four, read big-endian, plus `n`, modulo 2^32 as inc32 says. */
NISH_AES_INLINE nish_aes_u8x16 nish_aes_counter(nish_aes_u8x16 j0, uint32_t counter, uint32_t n) {
  nish_aes_u32x4 v = (nish_aes_u32x4)j0;
  v[3] = __builtin_bswap32(counter + n);
  return (nish_aes_u8x16)v;
}

NISH_AES_TARGET void nish_aes_schedule(const nish_array *key, int32_t rounds, nish_array *rk) {
  const int32_t nk = rounds - 6;
  const int32_t words = 4 * (rounds + 1);
  const nish_aes_u32u *in = (const nish_aes_u32u *)key->data;
  nish_aes_u32u *w = (nish_aes_u32u *)rk->data;
  for (int32_t i = 0; i < nk; i++) w[i] = in[i];
  /* FIPS 197 §5.2 on words read little-endian, so RotWord is a rotate right
     by eight and Rcon goes in the low byte. nk is 4 or 8, so `i % nk` is a
     mask. */
  uint32_t rcon = 1;
  for (int32_t i = nk; i < words; i++) {
    uint32_t t = w[i - 1];
    if ((i & (nk - 1)) == 0) {
      t = nish_aes_sub_word((t >> 8) | (t << 24)) ^ rcon;
      rcon = (rcon << 1) ^ ((rcon >> 7) * 0x11b);
    } else if (nk == 8 && (i & 7) == 4) {
      t = nish_aes_sub_word(t);
    }
    w[i] = w[i - nk] ^ t;
  }
  /* Every word after the schedule is zero but H's, so nothing the bitsliced
     layout left in a reused array survives into this one. */
  uint64_t *all = (uint64_t *)rk->data;
  for (uint64_t i = (uint64_t)words / 2; i < rk->len; i++) all[i] = 0;
  /* H = E(K, 0^128) and its powers, each with its middle operand. */
  const nish_aes_u8x16 zero = {0};
  nish_aes_u64x2 h = nish_aes_reflect(nish_aes_encrypt(rk->data, rounds, zero));
  nish_aes_u64x2 p = h;
  for (int32_t i = 0; i < 4; i++) {
    nish_aes_store(rk->data + NISH_AES_HPOW + 16 * i, (nish_aes_u8x16)p);
    nish_aes_store(rk->data + NISH_AES_HMID + 16 * i, (nish_aes_u8x16)nish_aes_mid(p));
    p = nish_aes_mul(p, h);
  }
}

NISH_AES_TARGET void nish_aes_block(const nish_array *rk, int32_t rounds, const nish_array *src, nish_array *dst) {
  nish_aes_store(dst->data, nish_aes_encrypt(rk->data, rounds, nish_aes_load(src->data)));
}

NISH_AES_TARGET void nish_aes_ctr(const nish_array *rk, int32_t rounds, const nish_array *j0, const nish_array *src,
                                  nish_array *dst, int32_t length) {
  const char *k = rk->data;
  const char *in = src->data;
  char *out = dst->data;
  const nish_aes_u8x16 iv = nish_aes_load(j0->data);
  const uint32_t counter = __builtin_bswap32(*(const nish_aes_u32u *)(j0->data + 12));
  const uint32_t blocks = (uint32_t)length >> 4;
  uint32_t n = 0;
  /* Four blocks a pass, each read before its own block is written, so `dst`
     may be `src`. */
  for (; n + 4 <= blocks; n += 4) {
    nish_aes_u8x16 s[4];
    for (uint32_t j = 0; j < 4; j++) s[j] = nish_aes_counter(iv, counter, n + j + 1);
    nish_aes_encrypt4(k, rounds, s);
    for (uint32_t j = 0; j < 4; j++) {
      const uint64_t at = 16 * (uint64_t)(n + j);
      nish_aes_store(out + at, nish_aes_load(in + at) ^ s[j]);
    }
  }
  for (; n < blocks; n++) {
    const uint64_t at = 16 * (uint64_t)n;
    nish_aes_store(out + at, nish_aes_load(in + at) ^ nish_aes_encrypt(k, rounds, nish_aes_counter(iv, counter, n + 1)));
  }
  const uint32_t rest = (uint32_t)length & 15;
  if (rest != 0) {
    _Alignas(16) uint8_t ks[16];
    nish_aes_store((char *)ks, nish_aes_encrypt(k, rounds, nish_aes_counter(iv, counter, n + 1)));
    const uint64_t at = 16 * (uint64_t)n;
    for (uint32_t i = 0; i < rest; i++) out[at + i] = (char)(in[at + i] ^ ks[i]);
    nish_aes_wipe16(ks);
  }
}

NISH_AES_TARGET void nish_aes_ghash(nish_array *y, uint64_t hHi, uint64_t hLo, const nish_array *rk,
                                    const nish_array *data, int32_t length) {
  (void)hHi;
  (void)hLo;
  const char *k = rk->data;
  const char *in = data->data;
  /* y is two words, high then low; the multiply wants low then high. */
  nish_aes_u64x2 acc = (nish_aes_u64x2)nish_aes_load(y->data);
  acc = __builtin_shufflevector(acc, acc, 1, 0);
  const uint32_t blocks = (uint32_t)length >> 4;
  uint32_t n = 0;
  /* Four blocks a reduction: (Y ⊕ X1)·H^4 ⊕ X2·H^3 ⊕ X3·H^2 ⊕ X4·H is four
     blocks of the serial recurrence, and its products add before the one
     reduction they share. */
  if (blocks >= 4) {
    nish_aes_u64x2 hp[4], hm[4];
    for (int32_t i = 0; i < 4; i++) {
      hp[i] = (nish_aes_u64x2)nish_aes_load(k + NISH_AES_HPOW + 16 * i);
      hm[i] = (nish_aes_u64x2)nish_aes_load(k + NISH_AES_HMID + 16 * i);
    }
    for (; n + 4 <= blocks; n += 4) {
      nish_aes_u64x2 sum[3] = {{0, 0}, {0, 0}, {0, 0}};
      for (uint32_t j = 0; j < 4; j++) {
        nish_aes_u64x2 x = nish_aes_reflect(nish_aes_load(in + 16 * (uint64_t)(n + j)));
        if (j == 0) x ^= acc;
        nish_aes_mul_acc(sum, x, hp[3 - j], hm[3 - j]);
      }
      acc = nish_aes_mul_finish(sum);
    }
  }
  const nish_aes_u64x2 h = (nish_aes_u64x2)nish_aes_load(k + NISH_AES_HPOW);
  for (; n < blocks; n++) acc = nish_aes_mul(acc ^ nish_aes_reflect(nish_aes_load(in + 16 * (uint64_t)n)), h);
  const uint32_t rest = (uint32_t)length & 15;
  if (rest != 0) {
    _Alignas(16) uint8_t pad[16] = {0};
    const uint64_t at = 16 * (uint64_t)n;
    for (uint32_t i = 0; i < rest; i++) pad[i] = (uint8_t)in[at + i];
    acc = nish_aes_mul(acc ^ nish_aes_reflect(nish_aes_load((const char *)pad)), h);
    nish_aes_wipe16(pad);
  }
  nish_aes_store(y->data, (nish_aes_u8x16)__builtin_shufflevector(acc, acc, 1, 0));
}

#if defined(NISH_AES_X86)
/* Whether this CPU runs the kernels: CPUID leaf 1's ECX has AES (bit 25),
   PCLMULQDQ (bit 1) and SSSE3 (bit 9), whose byte shuffle reverses a block for
   GHASH. Asked through `cpuid.h`, which is inline assembly, and not through
   `__builtin_cpu_supports`, whose libgcc object runs a constructor at every
   start-up once a link names it (runtime-simd.c, `nish_cpu_has_avx2`). The
   128-bit registers need no question of the operating system: x86-64 saves
   them on every context switch. */
static int32_t nish_aes_cpu(void) {
  unsigned a, b, c, d;
  if (!__get_cpuid(1, &a, &b, &c, &d)) return 0;
  return (c & bit_AES) != 0 && (c & bit_PCLMUL) != 0 && (c & bit_SSSE3) != 0;
}
#elif defined(__linux__)
/* Linux reports the ARMv8 Cryptography Extension in the auxiliary vector:
   AT_HWCAP is 16, and its HWCAP_AES and HWCAP_PMULL bits are 3 and 4
   (arch/arm64/include/uapi/asm/hwcap.h). */
unsigned long getauxval(unsigned long type);

static int32_t nish_aes_cpu(void) {
  unsigned long caps = getauxval(16);
  return (caps & (1ul << 3)) != 0 && (caps & (1ul << 4)) != 0;
}
#elif defined(__APPLE__)
/* Every Apple AArch64 core has both: they are part of the A7's ARMv8.0 and of
   every core since. */
static int32_t nish_aes_cpu(void) {
  return 1;
}
#else
/* Another AArch64 system: no question asked, so the bitsliced path. */
static int32_t nish_aes_cpu(void) {
  return 0;
}
#endif

/* The answer: 0 until the first call, then 1 for the kernels or 2 for the
   bitsliced path. The load and the store are relaxed atomics, plain moves on
   both targets, because under `--threads` two workers may make the first call
   at once; both reach the same answer, so whichever store lands is it. */
static int32_t nish_aes_answer;

int32_t nish_aes_hw(void) {
  int32_t answer = __atomic_load_n(&nish_aes_answer, __ATOMIC_RELAXED);
  if (answer == 0) {
    /* `soft` pins the bitsliced path and never asks the CPU; anything else,
       or nothing, means the best this machine has. */
    const char *pin = getenv("NISH_AES");
    int soft = pin != 0 && pin[0] == 's' && pin[1] == 'o' && pin[2] == 'f' && pin[3] == 't' && pin[4] == 0;
    answer = !soft && nish_aes_cpu() ? 1 : 2;
    __atomic_store_n(&nish_aes_answer, answer, __ATOMIC_RELAXED);
  }
  return answer == 1;
}

#else

/* A target with no AES instructions this file uses, wasm32 among them: the
   bitsliced path always, and kernels that a program whose every call is behind
   `nish_aes_hw` never reaches. */
int32_t nish_aes_hw(void) {
  return 0;
}

void nish_aes_schedule(const nish_array *key, int32_t rounds, nish_array *rk) {
  (void)key, (void)rounds, (void)rk;
  __builtin_trap();
}

void nish_aes_block(const nish_array *rk, int32_t rounds, const nish_array *src, nish_array *dst) {
  (void)rk, (void)rounds, (void)src, (void)dst;
  __builtin_trap();
}

void nish_aes_ctr(const nish_array *rk, int32_t rounds, const nish_array *j0, const nish_array *src, nish_array *dst,
                  int32_t length) {
  (void)rk, (void)rounds, (void)j0, (void)src, (void)dst, (void)length;
  __builtin_trap();
}

void nish_aes_ghash(nish_array *y, uint64_t hHi, uint64_t hLo, const nish_array *rk, const nish_array *data,
                    int32_t length) {
  (void)y, (void)hHi, (void)hLo, (void)rk, (void)data, (void)length;
  __builtin_trap();
}

#endif
