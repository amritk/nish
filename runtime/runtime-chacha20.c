/* Nish runtime, the ChaCha20 half: the keystream of RFC 8439 §2.3 and §2.4,
 * several blocks at once in vector registers. std/crypto/chacha20poly1305.ts
 * is the cipher and the AEAD; this is a faster body for its private
 * `chacha20XorInto`, which the compiler calls in that function's place when
 * `nish_chacha20_hw` says this machine runs it (src/kernels.ts). Poly1305
 * stays in Nish: WP38 S10 timed it beside this kernel and found the Nish
 * code within the noise of a C copy (docs/wp38-simd.md §3.1).
 *
 * A translation unit of its own for the reason runtime-aes.c is one: its own
 * measured `.text*` ceiling in tests/runtime-budgets.js, and a program that
 * never encrypts with ChaCha20 links none of it (section GC).
 *
 * The paths. x86-64 runs eight blocks at once in AVX2's 256-bit registers,
 * then four in 128-bit ones, then one at a time for what is left, all
 * compiled with `target("avx2")` alone so the binary stays a baseline binary.
 * A block is a lane: word `i` of block `b` is lane `b` of vector `i`, so the
 * rounds are the scalar quarter rounds on vectors, and nothing shuffles
 * until the words are written out. AArch64 has the same four-block loop in
 * NEON, which every AArch64 CPU has; `NISH_CHACHA20_ARM_ON` says whether the
 * resolver takes it (see there). A CPU without AVX2, a process with
 * `NISH_CHACHA20=soft`, and every other target, wasm32 included, run the Nish
 * code: the compiler keeps it and branches on `nish_chacha20_hw` at each call,
 * and here the resolver answers 0 and the kernel is a trap nothing reaches.
 *
 * The kernel takes a buffer of four blocks or more and answers 0 for anything
 * shorter, so a short message (a TLS record header, the Poly1305 key's one
 * block, a QUIC header mask) costs no call and no wipe: S10 measured the
 * kernel losing at 64 bytes until it did. It answers 0 too, touching
 * nothing, when a window is outside its array or the two windows overlap
 * without being the same bytes, so the Nish function runs and fails, or
 * writes in its own order, as it would have.
 *
 * Constant time: ChaCha20 is additions, xors and rotations by constants, with
 * no table and no secret-dependent branch. The kernel's branches are on array
 * headers, offsets and the length, which are public, and its loads and stores
 * are at addresses fixed by them. tests/ct-asm-runtime.js reads the
 * `clang -O2` assembly of this file for both targets and holds the kernel to
 * that. The one branch on anything else is `nish_chacha20_hw`'s, on the CPU's
 * feature bits and `NISH_CHACHA20` (docs/security/ct-verification.md).
 *
 * Wiping: the working words, the per-call input block and the keystream
 * buffers on the stack are zeroed by volatile stores before the kernel
 * returns, the mechanism runtime-aes.c and `nish:secret`'s wipe use. The
 * caller's state is the caller's to wipe, as with the Nish function. What
 * the vector registers hold, and what the register allocator spills, no
 * store from C can reach (docs/security/crypto-chacha20-hw.md).
 *
 * Written from RFC 8439 in this file's own structure; the block-a-lane layout
 * is the one §3 of the RFC points at ("SIMD"), and nothing is ported.
 */
#include <stddef.h>
#include <stdint.h>

#include "nish.h"

#if defined(__x86_64__)
#include <cpuid.h>
#define NISH_CHACHA20_X86 1
#elif defined(__aarch64__) && defined(__ARM_NEON) && defined(__ORDER_LITTLE_ENDIAN__) && \
    __BYTE_ORDER__ == __ORDER_LITTLE_ENDIAN__
#include <arm_neon.h>
#define NISH_CHACHA20_ARM 1
#endif

#if defined(NISH_CHACHA20_X86) || defined(NISH_CHACHA20_ARM)

/* Named here rather than through <stdlib.h>, for runtime-aes.c's reason: the
   constant-time check compiles this file for targets whose libc headers the
   host does not have. */
char *getenv(const char *name);

#if defined(__has_attribute) && __has_attribute(no_builtin)
#define NISH_CHACHA20_NO_LIBC no_builtin
#else
#define NISH_CHACHA20_NO_LIBC
#endif
#if defined(NISH_CHACHA20_X86)
#define NISH_CHACHA20_TARGET __attribute__((target("avx2"), NISH_CHACHA20_NO_LIBC))
#else
#define NISH_CHACHA20_TARGET __attribute__((NISH_CHACHA20_NO_LIBC))
#endif
#define NISH_CHACHA20_INLINE static inline __attribute__((always_inline)) NISH_CHACHA20_TARGET

/* The buffer a vector loop needs before it runs: four blocks. */
#define NISH_CHACHA20_MIN 256

/* Zeroes `n` bytes, a multiple of 8, by volatile 8-byte stores. */
NISH_CHACHA20_INLINE void nish_chacha20_wipe(void *p, size_t n) {
  volatile uint64_t *v = (volatile uint64_t *)p;
  for (size_t i = 0; i < n / 8; i++) v[i] = 0;
}

NISH_CHACHA20_INLINE uint32_t nish_chacha20_rotl(uint32_t x, int n) {
  return (x << n) | (x >> (32 - n));
}

#define NISH_CHACHA20_QR(a, b, c, d)    \
  a += b;                               \
  d = nish_chacha20_rotl(d ^ a, 16);    \
  c += d;                               \
  b = nish_chacha20_rotl(b ^ c, 12);    \
  a += b;                               \
  d = nish_chacha20_rotl(d ^ a, 8);     \
  c += d;                               \
  b = nish_chacha20_rotl(b ^ c, 7)

/* What is left after the vector loops, a block at a time as the Nish loop
   does: `len` bytes under the keystream from `s`'s counter on, the counter
   moved one a block, the last partial block taken byte by byte. */
NISH_CHACHA20_INLINE void nish_chacha20_tail(uint32_t s[16], const uint8_t *src, uint8_t *dst, size_t len) {
  uint32_t x[16];
  /* The block's words, which on these little-endian targets are its
     keystream bytes in order: adding into words, not storing byte by byte,
     keeps every store at a fixed offset of the frame. */
  uint32_t ks[16];
  const uint8_t *ks_bytes = (const uint8_t *)ks;
  int ran = len > 0;
  while (len > 0) {
    for (int i = 0; i < 16; i++) x[i] = s[i];
    for (int r = 0; r < 10; r++) {
      NISH_CHACHA20_QR(x[0], x[4], x[8], x[12]);
      NISH_CHACHA20_QR(x[1], x[5], x[9], x[13]);
      NISH_CHACHA20_QR(x[2], x[6], x[10], x[14]);
      NISH_CHACHA20_QR(x[3], x[7], x[11], x[15]);
      NISH_CHACHA20_QR(x[0], x[5], x[10], x[15]);
      NISH_CHACHA20_QR(x[1], x[6], x[11], x[12]);
      NISH_CHACHA20_QR(x[2], x[7], x[8], x[13]);
      NISH_CHACHA20_QR(x[3], x[4], x[9], x[14]);
    }
    for (int i = 0; i < 16; i++) ks[i] = x[i] + s[i];
    s[12] += 1;
    size_t take = len < 64 ? len : 64;
    for (size_t i = 0; i < take; i++) dst[i] = src[i] ^ ks_bytes[i];
    src += take;
    dst += take;
    len -= take;
  }
  if (ran) {
    nish_chacha20_wipe(x, sizeof x);
    nish_chacha20_wipe(ks, sizeof ks);
  }
}

#if defined(NISH_CHACHA20_X86)

typedef uint32_t nish_u32x4 __attribute__((vector_size(16)));
typedef uint32_t nish_u32x8 __attribute__((vector_size(32)));

/* The rotate lane by lane; LLVM turns 16 and 8 into byte shuffles. */
#define NISH_CHACHA20_VROTL(x, n) (((x) << (n)) | ((x) >> (32 - (n))))

#define NISH_CHACHA20_VQR(a, b, c, d)        \
  a += b;                                    \
  d = NISH_CHACHA20_VROTL(d ^ a, 16);        \
  c += d;                                    \
  b = NISH_CHACHA20_VROTL(b ^ c, 12);        \
  a += b;                                    \
  d = NISH_CHACHA20_VROTL(d ^ a, 8);         \
  c += d;                                    \
  b = NISH_CHACHA20_VROTL(b ^ c, 7)

#define NISH_CHACHA20_VROUNDS(x)                       \
  for (int r = 0; r < 10; r++) {                       \
    NISH_CHACHA20_VQR(x[0], x[4], x[8], x[12]);        \
    NISH_CHACHA20_VQR(x[1], x[5], x[9], x[13]);        \
    NISH_CHACHA20_VQR(x[2], x[6], x[10], x[14]);       \
    NISH_CHACHA20_VQR(x[3], x[7], x[11], x[15]);       \
    NISH_CHACHA20_VQR(x[0], x[5], x[10], x[15]);       \
    NISH_CHACHA20_VQR(x[1], x[6], x[11], x[12]);       \
    NISH_CHACHA20_VQR(x[2], x[7], x[8], x[13]);        \
    NISH_CHACHA20_VQR(x[3], x[4], x[9], x[14]);        \
  }

/* `lanes` blocks at once, `vec` lanes of `lanes` words: the input block with
   the counter stepped one a lane, the rounds, then the sum written out word
   by word (lane `b` of word `i` to byte 64b + 4i of the keystream) and
   xored into `dst` a vector at a time. Answers the bytes it covered. */
#define NISH_CHACHA20_LOOP(vec, lanes, s, src, dst, len, ...)                             \
  {                                                                                       \
    vec x[16];                                                                            \
    vec in[16];                                                                           \
    uint8_t ks[64 * (lanes)] __attribute__((aligned(32)));                                \
    const vec step = {__VA_ARGS__};                                                       \
    int ran = (len) >= 64 * (lanes);                                                      \
    while ((len) >= 64 * (lanes)) {                                                       \
      for (int i = 0; i < 16; i++) in[i] = (vec){0} + (s)[i];                             \
      in[12] += step;                                                                     \
      for (int i = 0; i < 16; i++) x[i] = in[i];                                          \
      NISH_CHACHA20_VROUNDS(x)                                                            \
      for (int i = 0; i < 16; i++) {                                                      \
        vec w = x[i] + in[i];                                                             \
        for (int b = 0; b < (lanes); b++) __builtin_memcpy(ks + 64 * b + 4 * i, (const uint8_t *)&w + 4 * b, 4); \
      }                                                                                   \
      for (size_t i = 0; i < 64 * (lanes); i += sizeof(vec)) {                            \
        vec p, k;                                                                         \
        __builtin_memcpy(&p, (src) + i, sizeof p);                                        \
        __builtin_memcpy(&k, ks + i, sizeof k);                                           \
        p ^= k;                                                                           \
        __builtin_memcpy((dst) + i, &p, sizeof p);                                        \
      }                                                                                   \
      (s)[12] += (lanes);                                                                 \
      (src) += 64 * (lanes);                                                              \
      (dst) += 64 * (lanes);                                                              \
      (len) -= 64 * (lanes);                                                              \
    }                                                                                     \
    if (ran) {                                                                            \
      nish_chacha20_wipe(x, sizeof x);                                                    \
      nish_chacha20_wipe(in, sizeof in);                                                  \
      nish_chacha20_wipe(ks, sizeof ks);                                                  \
    }                                                                                     \
  }

NISH_CHACHA20_INLINE void nish_chacha20_blocks(uint32_t s[16], const uint8_t *src, uint8_t *dst, size_t len) {
  NISH_CHACHA20_LOOP(nish_u32x8, 8, s, src, dst, len, 0, 1, 2, 3, 4, 5, 6, 7)
  NISH_CHACHA20_LOOP(nish_u32x4, 4, s, src, dst, len, 0, 1, 2, 3)
  nish_chacha20_tail(s, src, dst, len);
}

#else

#define NISH_CHACHA20_NROTL(x, n) vsriq_n_u32(vshlq_n_u32((x), (n)), (x), 32 - (n))
#define NISH_CHACHA20_NROT16(x) vreinterpretq_u32_u16(vrev32q_u16(vreinterpretq_u16_u32(x)))
#define NISH_CHACHA20_NQR(a, b, c, d)            \
  a = vaddq_u32(a, b);                           \
  d = NISH_CHACHA20_NROT16(veorq_u32(d, a));     \
  c = vaddq_u32(c, d);                           \
  b = NISH_CHACHA20_NROTL(veorq_u32(b, c), 12);  \
  a = vaddq_u32(a, b);                           \
  d = NISH_CHACHA20_NROTL(veorq_u32(d, a), 8);   \
  c = vaddq_u32(c, d);                           \
  b = NISH_CHACHA20_NROTL(veorq_u32(b, c), 7)

/* Four blocks at once in NEON, a block a lane; `vst4q` interleaves four
   words so each 16-byte row it stores is one row of one block. */
NISH_CHACHA20_INLINE void nish_chacha20_blocks(uint32_t s[16], const uint8_t *src, uint8_t *dst, size_t len) {
  uint32x4_t x[16];
  uint32x4_t in[16];
  uint32_t rows[16] __attribute__((aligned(16)));
  uint8_t ks[256] __attribute__((aligned(16)));
  const uint32_t step_words[4] = {0, 1, 2, 3};
  const uint32x4_t step = vld1q_u32(step_words);
  int ran = len >= 256;
  while (len >= 256) {
    for (int i = 0; i < 16; i++) in[i] = vdupq_n_u32(s[i]);
    in[12] = vaddq_u32(in[12], step);
    for (int i = 0; i < 16; i++) x[i] = in[i];
    for (int r = 0; r < 10; r++) {
      NISH_CHACHA20_NQR(x[0], x[4], x[8], x[12]);
      NISH_CHACHA20_NQR(x[1], x[5], x[9], x[13]);
      NISH_CHACHA20_NQR(x[2], x[6], x[10], x[14]);
      NISH_CHACHA20_NQR(x[3], x[7], x[11], x[15]);
      NISH_CHACHA20_NQR(x[0], x[5], x[10], x[15]);
      NISH_CHACHA20_NQR(x[1], x[6], x[11], x[12]);
      NISH_CHACHA20_NQR(x[2], x[7], x[8], x[13]);
      NISH_CHACHA20_NQR(x[3], x[4], x[9], x[14]);
    }
    for (int i = 0; i < 16; i += 4) {
      uint32x4x4_t w;
      w.val[0] = vaddq_u32(x[i], in[i]);
      w.val[1] = vaddq_u32(x[i + 1], in[i + 1]);
      w.val[2] = vaddq_u32(x[i + 2], in[i + 2]);
      w.val[3] = vaddq_u32(x[i + 3], in[i + 3]);
      vst4q_u32(rows, w);
      for (int b = 0; b < 4; b++) __builtin_memcpy(ks + 64 * b + 4 * i, rows + 4 * b, 16);
    }
    for (size_t i = 0; i < 256; i += 16) vst1q_u8(dst + i, veorq_u8(vld1q_u8(src + i), vld1q_u8(ks + i)));
    s[12] += 4;
    src += 256;
    dst += 256;
    len -= 256;
  }
  if (ran) {
    nish_chacha20_wipe(x, sizeof x);
    nish_chacha20_wipe(in, sizeof in);
    nish_chacha20_wipe(rows, sizeof rows);
    nish_chacha20_wipe(ks, sizeof ks);
  }
  nish_chacha20_tail(s, src, dst, len);
}

#endif

/* `chacha20XorInto`'s contract, checked rather than trusted: 1 when it ran,
   0, writing nothing, unless `state` has its sixteen words, `len` is four
   blocks or more, both windows are inside their arrays and end before
   INT32_MAX - 64, and the windows are the same bytes or do not overlap.
   The Nish function reads and writes byte
   by byte in order, so an in-place call (the AEAD's and `chacha20Block`'s)
   agrees with a kernel that loads a vector before it stores it; a shifted
   overlap would not, and is left to the Nish function. */
NISH_CHACHA20_TARGET int32_t nish_chacha20_xor(nish_array *state, const nish_array *src, int32_t src_at,
                                               int32_t len, nish_array *dst, int32_t dst_at) {
  if (state->len < 16 || len < NISH_CHACHA20_MIN || src_at < 0 || dst_at < 0) return 0;
  if ((uint64_t)src_at + (uint64_t)len > src->len || (uint64_t)dst_at + (uint64_t)len > dst->len) return 0;
  /* The Nish function's i32 sums reach a window's end and its last block's
     end, so past INT32_MAX - 64 it panics on an overflow; past that the
     kernel refuses, and the Nish function panics as it would have. */
  if ((uint64_t)src_at + (uint64_t)len > INT32_MAX - 64 || (uint64_t)dst_at + (uint64_t)len > INT32_MAX - 64) return 0;
  const uint8_t *from = (const uint8_t *)src->data + src_at;
  uint8_t *to = (uint8_t *)dst->data + dst_at;
  uintptr_t f = (uintptr_t)from, t = (uintptr_t)to;
  if (f != t && f < t + (uintptr_t)len && t < f + (uintptr_t)len) return 0;
  nish_chacha20_blocks((uint32_t *)(void *)state->data, from, to, (size_t)len);
  return 1;
}

#if defined(NISH_CHACHA20_X86)
/* Whether this CPU and its OS give AVX2: CPUID leaf 1's OSXSAVE and AVX,
   XCR0's SSE and AVX state, and leaf 7's AVX2. Asked through `cpuid.h`, for
   runtime-aes.c's reason. */
static int32_t nish_chacha20_cpu(void) {
  unsigned a, b, c, d;
  if (!__get_cpuid(1, &a, &b, &c, &d)) return 0;
  if ((c & bit_OSXSAVE) == 0 || (c & bit_AVX) == 0) return 0;
  unsigned lo, hi;
  __asm__("xgetbv" : "=a"(lo), "=d"(hi) : "c"(0));
  (void)hi;
  if ((lo & 6) != 6) return 0;
  if (!__get_cpuid_count(7, 0, &a, &b, &c, &d)) return 0;
  return (b & bit_AVX2) != 0;
}
#else
/* NEON is in every AArch64 CPU, so the question is only whether the kernel
   pays here: `NISH_CHACHA20_ARM_ON` is S10's AArch64 verdict
   (docs/wp38-simd.md §3.1). */
#ifndef NISH_CHACHA20_ARM_ON
#define NISH_CHACHA20_ARM_ON 1
#endif
static int32_t nish_chacha20_cpu(void) {
  return NISH_CHACHA20_ARM_ON;
}
#endif

/* The answer: 0 until the first call, then 1 for the kernel or 2 for the Nish
   path, with runtime-aes.c's relaxed atomics for the same reason. */
static int32_t nish_chacha20_answer;

int32_t nish_chacha20_hw(void) {
  int32_t answer = __atomic_load_n(&nish_chacha20_answer, __ATOMIC_RELAXED);
  if (answer == 0) {
    /* `soft` pins the Nish path and never asks the CPU; anything else, or
       nothing, means the best this machine has. */
    const char *pin = getenv("NISH_CHACHA20");
    int soft = pin != 0 && pin[0] == 's' && pin[1] == 'o' && pin[2] == 'f' && pin[3] == 't' && pin[4] == 0;
    answer = !soft && nish_chacha20_cpu() ? 1 : 2;
    __atomic_store_n(&nish_chacha20_answer, answer, __ATOMIC_RELAXED);
  }
  return answer == 1;
}

#else

/* A target with no vector path here, wasm32 among them: the Nish path
   always, and a kernel that a program whose every call is behind
   `nish_chacha20_hw` never reaches. */
int32_t nish_chacha20_hw(void) {
  return 0;
}

int32_t nish_chacha20_xor(nish_array *state, const nish_array *src, int32_t src_at, int32_t len, nish_array *dst,
                          int32_t dst_at) {
  (void)state, (void)src, (void)src_at, (void)len, (void)dst, (void)dst_at;
  __builtin_trap();
}

#endif
