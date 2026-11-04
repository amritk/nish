/* Nish runtime, the SHA-256 half: the block function of FIPS 180-4 §6.2.2 on
 * the CPU's own SHA-256 instructions. std/crypto/sha256.ts is the hash; this is
 * a faster body for its private `sha256Compress`, which the compiler calls in
 * that function's place when `nish_sha256_hw` says this machine can run it
 * (src/kernels.ts).
 *
 * A translation unit of its own for the reason runtime-aes.c is one: its own
 * measured `.text*` ceiling in tests/runtime-budgets.js, and a program that
 * hashes links no AES and one that encrypts no SHA-256. Section GC means a
 * program that never calls the kernel links none of this file.
 *
 * There are two paths and no portable one. x86-64 runs the SHA extensions
 * (SHA-NI: `sha256rnds2`, `sha256msg1`, `sha256msg2`) with SSSE3's byte shuffle
 * and SSE4.1's word blend, compiled for those extensions alone with
 * `target(...)` so the binary stays a baseline binary; AArch64 runs the ARMv8
 * Cryptography Extension's SHA-256 instructions, likewise with
 * `target("+sha2")`. A machine without them, or a process with
 * `NISH_SHA256=soft`, runs the Nish code in std/crypto/sha256.ts instead: the
 * compiler keeps that code and branches on `nish_sha256_hw` at each call. Every
 * other target, wasm32 included, compiles `nish_sha256_hw` to `return 0` and
 * the kernel to a trap nothing reaches, so a link that names it still resolves.
 *
 * The kernel checks the guard `sha256Compress` runs its body under and returns
 * 0 without touching anything when it fails, so the caller runs the Nish
 * function, which panics with its own message: both paths fail the same way.
 *
 * Constant time: the kernel's branches are on array headers and `at`, which are
 * public, and its loads and stores are at addresses fixed by them; the
 * round-constant table is read whole, in order. tests/ct-asm-runtime.js reads
 * the `clang -O2` assembly of this file for both targets and holds the kernel
 * to that. The one branch on anything else is `nish_sha256_hw`'s, on the CPU's
 * feature bits and `NISH_SHA256` (docs/security/ct-verification.md).
 *
 * Wiping: the kernel keeps no buffer of its own; the state and the message
 * words live in vector registers between the load from `src` and the store to
 * `h`. What sits in those registers, and what the register allocator spills,
 * no store from C can reach (docs/security/crypto-sha256-hw.md).
 *
 * The algorithm is FIPS 180-4 §6.2.2; the instruction sequences are the ones
 * the instructions are defined for, written here from Intel's "Intel SHA
 * Extensions" (S. Gulley et al., 2013) and Arm's description of SHA256H,
 * SHA256H2, SHA256SU0 and SHA256SU1 (Arm ARM, DDI 0487).
 */
#include <stddef.h>
#include <stdint.h>

#include "nish.h"

#if defined(__x86_64__)
#include <cpuid.h>
#include <immintrin.h>
#define NISH_SHA256_X86 1
#elif defined(__aarch64__) && __BYTE_ORDER__ == __ORDER_LITTLE_ENDIAN__
#include <arm_neon.h>
#define NISH_SHA256_ARM 1
#endif

#if defined(NISH_SHA256_X86) || defined(NISH_SHA256_ARM)

/* Named here rather than through <stdlib.h>, for runtime-aes.c's reason: the
   constant-time check compiles this file for targets whose libc headers the
   host does not have. */
char *getenv(const char *name);

#if defined(__has_attribute) && __has_attribute(no_builtin)
#define NISH_SHA256_NO_LIBC no_builtin
#else
#define NISH_SHA256_NO_LIBC
#endif
#if defined(NISH_SHA256_X86)
#define NISH_SHA256_TARGET __attribute__((target("sha,sse4.1,ssse3"), NISH_SHA256_NO_LIBC))
#else
#define NISH_SHA256_TARGET __attribute__((target("+sha2"), NISH_SHA256_NO_LIBC))
#endif
#define NISH_SHA256_INLINE static inline __attribute__((always_inline)) NISH_SHA256_TARGET

/* K of FIPS 180-4 §4.2.2: the first 32 bits of the fractional parts of the cube
   roots of the first sixty-four primes. */
static const uint32_t nish_sha256_k[64] __attribute__((aligned(16))) = {
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
};

#if defined(NISH_SHA256_X86)
/* One block. `sha256rnds2` runs two rounds on the state split as ABEF and CDGH
   (the words high lane to low), taking W + K for the two rounds from its third
   operand's low two lanes, so the eight words are shuffled into that order
   once, on the way in, and back on the way out. */
NISH_SHA256_INLINE void nish_sha256_block(char *state, const char *in) {
  /* Each of the sixteen bytes' places in a big-endian word read little-endian. */
  const __m128i bswap = _mm_set_epi64x(0x0c0d0e0f08090a0bLL, 0x0405060700010203LL);
  __m128i dcba = _mm_loadu_si128((const __m128i *)state);
  __m128i hgfe = _mm_loadu_si128((const __m128i *)(state + 16));
  __m128i cdab = _mm_shuffle_epi32(dcba, 0xb1);
  __m128i efgh = _mm_shuffle_epi32(hgfe, 0x1b);
  __m128i abef = _mm_alignr_epi8(cdab, efgh, 8);
  __m128i cdgh = _mm_blend_epi16(efgh, cdab, 0xf0);
  const __m128i abef0 = abef;
  const __m128i cdgh0 = cdgh;
  /* W in four-word groups, a ring of the last four: group i is W[4i .. 4i + 4). */
  __m128i w[4];
  for (int i = 0; i < 16; i++) {
    if (i < 4) {
      w[i] = _mm_shuffle_epi8(_mm_loadu_si128((const __m128i *)(in + 16 * i)), bswap);
    } else {
      /* (6.2) for t = 4i .. 4i + 3: msg1 adds σ0 of the next word to W[t - 16],
         the align brings in W[t - 7], and msg2 adds σ1 of W[t - 2], two of
         which it computes itself from the words before. */
      __m128i w7 = _mm_alignr_epi8(w[(i - 1) & 3], w[(i - 2) & 3], 4);
      w[i & 3] = _mm_sha256msg2_epu32(_mm_add_epi32(_mm_sha256msg1_epu32(w[i & 3], w[(i - 3) & 3]), w7),
                                      w[(i - 1) & 3]);
    }
    __m128i wk = _mm_add_epi32(w[i & 3], _mm_load_si128((const __m128i *)&nish_sha256_k[4 * i]));
    cdgh = _mm_sha256rnds2_epu32(cdgh, abef, wk);
    abef = _mm_sha256rnds2_epu32(abef, cdgh, _mm_shuffle_epi32(wk, 0x0e));
  }
  abef = _mm_add_epi32(abef, abef0);
  cdgh = _mm_add_epi32(cdgh, cdgh0);
  __m128i feba = _mm_shuffle_epi32(abef, 0x1b);
  __m128i dchg = _mm_shuffle_epi32(cdgh, 0xb1);
  _mm_storeu_si128((__m128i *)state, _mm_blend_epi16(feba, dchg, 0xf0));
  _mm_storeu_si128((__m128i *)(state + 16), _mm_alignr_epi8(dchg, feba, 8));
}
#else
/* One block. SHA256H and SHA256H2 run four rounds on ABCD and EFGH together,
   each giving one half of the new state, with W + K for the four in their
   third operand. */
NISH_SHA256_INLINE void nish_sha256_block(char *state, const char *in) {
  uint32x4_t abcd = vld1q_u32((const uint32_t *)state);
  uint32x4_t efgh = vld1q_u32((const uint32_t *)(state + 16));
  const uint32x4_t abcd0 = abcd;
  const uint32x4_t efgh0 = efgh;
  uint32x4_t w[4];
  for (int i = 0; i < 16; i++) {
    if (i < 4) {
      w[i] = vreinterpretq_u32_u8(vrev32q_u8(vld1q_u8((const uint8_t *)(in + 16 * i))));
    } else {
      /* (6.2) for t = 4i .. 4i + 3: SU0 adds σ0 to W[t - 16], SU1 adds W[t - 7]
         and σ1 of W[t - 2]. */
      w[i & 3] = vsha256su1q_u32(vsha256su0q_u32(w[i & 3], w[(i - 3) & 3]), w[(i - 2) & 3], w[(i - 1) & 3]);
    }
    uint32x4_t wk = vaddq_u32(w[i & 3], vld1q_u32(&nish_sha256_k[4 * i]));
    uint32x4_t before = abcd;
    abcd = vsha256hq_u32(abcd, efgh, wk);
    efgh = vsha256h2q_u32(efgh, before, wk);
  }
  vst1q_u32((uint32_t *)state, vaddq_u32(abcd, abcd0));
  vst1q_u32((uint32_t *)(state + 16), vaddq_u32(efgh, efgh0));
}
#endif

/* `sha256Compress`'s own guard, then the block. That guard reads the source's
   length through `toI32`, which saturates at 2^31 - 1, so it refuses a block
   ending past that offset whatever the length: `at > INT32_MAX - 64`. */
NISH_SHA256_TARGET int32_t nish_sha256_compress(nish_array *h, const nish_array *w, const nish_array *src,
                                                int32_t at) {
  if (h->len < 8 || w->len < 64 || at < 0 || at > INT32_MAX - 64 || src->len < 64 || (uint64_t)at > src->len - 64)
    return 0;
  nish_sha256_block(h->data, src->data + at);
  return 1;
}

#if defined(NISH_SHA256_X86)
/* Whether this CPU runs the kernel: CPUID leaf 7's EBX has SHA (bit 29), and
   leaf 1's ECX SSE4.1 (bit 19) and SSSE3 (bit 9). Asked through `cpuid.h`, for
   runtime-aes.c's reason; `__get_cpuid_count` answers 0 when leaf 7 is past
   the CPU's highest. */
static int32_t nish_sha256_cpu(void) {
  unsigned a, b, c, d;
  if (!__get_cpuid(1, &a, &b, &c, &d)) return 0;
  if ((c & bit_SSE4_1) == 0 || (c & bit_SSSE3) == 0) return 0;
  if (!__get_cpuid_count(7, 0, &a, &b, &c, &d)) return 0;
  return (b & bit_SHA) != 0;
}
#elif defined(__linux__)
/* Linux reports the ARMv8 SHA-256 instructions in the auxiliary vector:
   AT_HWCAP is 16, and its HWCAP_SHA2 bit is 6
   (arch/arm64/include/uapi/asm/hwcap.h). */
unsigned long getauxval(unsigned long type);

static int32_t nish_sha256_cpu(void) {
  return (getauxval(16) & (1ul << 6)) != 0;
}
#elif defined(__APPLE__)
/* macOS names the feature in sysctl (macOS 12 and later). A system that does
   not know the name answers as a CPU without it: the Nish path. */
int sysctlbyname(const char *name, void *oldp, size_t *oldlenp, void *newp, size_t newlen);

static int32_t nish_sha256_cpu(void) {
  int32_t has = 0;
  size_t size = sizeof has;
  if (sysctlbyname("hw.optional.arm.FEAT_SHA256", &has, &size, 0, 0) != 0) return 0;
  return has != 0;
}
#else
/* Another AArch64 system: no question asked, so the Nish path. */
static int32_t nish_sha256_cpu(void) {
  return 0;
}
#endif

/* The answer: 0 until the first call, then 1 for the kernel or 2 for the Nish
   path, with runtime-aes.c's relaxed atomics for the same reason. */
static int32_t nish_sha256_answer;

int32_t nish_sha256_hw(void) {
  int32_t answer = __atomic_load_n(&nish_sha256_answer, __ATOMIC_RELAXED);
  if (answer == 0) {
    /* `soft` pins the Nish path and never asks the CPU; anything else, or
       nothing, means the best this machine has. */
    const char *pin = getenv("NISH_SHA256");
    int soft = pin != 0 && pin[0] == 's' && pin[1] == 'o' && pin[2] == 'f' && pin[3] == 't' && pin[4] == 0;
    answer = !soft && nish_sha256_cpu() ? 1 : 2;
    __atomic_store_n(&nish_sha256_answer, answer, __ATOMIC_RELAXED);
  }
  return answer == 1;
}

#else

/* A target with no SHA-256 instructions this file uses, wasm32 among them: the
   Nish path always, and a kernel that a program whose every call is behind
   `nish_sha256_hw` never reaches. */
int32_t nish_sha256_hw(void) {
  return 0;
}

int32_t nish_sha256_compress(nish_array *h, const nish_array *w, const nish_array *src, int32_t at) {
  (void)h, (void)w, (void)src, (void)at;
  __builtin_trap();
}

#endif
