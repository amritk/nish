// WP38: ChaCha20 on vectors, the candidates beside the scalar Nish code
// (docs/wp38-simd.md §2.3, "S10: ChaCha20 on vectors, measured").
//
// bench/chacha20.mjs links this file into bench/chacha20/aead.ts, a copy of
// std/crypto/chacha20poly1305.ts whose `chacha20XorInto` hands the keystream
// to `bench_chacha20_xor` below, so the AEAD around the kernel is the Nish
// one: its checks, its Poly1305 and its wipes. Built with `-DCHACHA20_VERIFY`
// it is a program of its own instead, which holds every path to the scalar
// reference and to RFC 8439 §2.4.2's vector.
//
// The paths, picked by `BENCH_CHACHA20` (read on the first call):
//
//   scalar  one block at a time, the Nish code's shape in C
//   vec128  four blocks at once, a block a lane, in GCC/clang's portable
//           `vector_size(16)` u32x4: the LLVM vector IR `nish:simd` lowers to,
//           SSE2 on x86-64 and NEON on AArch64, no target attribute
//   avx2    eight blocks at once in `vector_size(32)`, compiled with
//           `target("avx2")` alone; the rest is still the baseline
//   neon    four blocks at once in <arm_neon.h> intrinsics, the rotates as
//           shift-and-insert (`vsriq_n_u32`) and the 16-bit one as `vrev32q_u16`;
//           AArch64 only
//
// Every path runs the vector width while at least that many blocks remain and
// finishes one block at a time on the scalar path, so the counter and the
// keystream are exactly the scalar path's. Every keystream buffer is zeroed
// through a volatile pointer before return. Nothing here branches on, or
// indexes by, a key or keystream word: the loop bounds are the length.
#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#if defined(__aarch64__) && defined(__ARM_NEON)
#include <arm_neon.h>
#define CHACHA20_HAVE_NEON 1
#else
#define CHACHA20_HAVE_NEON 0
#endif

typedef uint32_t u32x4 __attribute__((vector_size(16)));
typedef uint32_t u32x8 __attribute__((vector_size(32)));

/** Zeroes `n` bytes, a multiple of 8, by volatile 8-byte stores, as runtime-aes.c's wipe does. */
static void wipe(void *p, size_t n) {
  volatile uint64_t *v = (volatile uint64_t *)p;
  for (size_t i = 0; i < n / 8; i++) {
    v[i] = 0;
  }
}

static uint32_t rotl(uint32_t x, int n) { return (x << n) | (x >> (32 - n)); }

static uint32_t load32(const uint8_t *p) {
  return (uint32_t)p[0] | ((uint32_t)p[1] << 8) | ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24);
}

#define QR(a, b, c, d)                                                                                       \
  a += b;                                                                                                    \
  d = rotl(d ^ a, 16);                                                                                       \
  c += d;                                                                                                    \
  b = rotl(b ^ c, 12);                                                                                       \
  a += b;                                                                                                    \
  d = rotl(d ^ a, 8);                                                                                        \
  c += d;                                                                                                    \
  b = rotl(b ^ c, 7)

/** One keystream block of `s` (RFC 8439 §2.3), as 64 little-endian bytes. */
static void block_scalar(const uint32_t s[16], uint8_t out[64]) {
  uint32_t x[16];
  memcpy(x, s, sizeof x);
  for (int i = 0; i < 10; i++) {
    QR(x[0], x[4], x[8], x[12]);
    QR(x[1], x[5], x[9], x[13]);
    QR(x[2], x[6], x[10], x[14]);
    QR(x[3], x[7], x[11], x[15]);
    QR(x[0], x[5], x[10], x[15]);
    QR(x[1], x[6], x[11], x[12]);
    QR(x[2], x[7], x[8], x[13]);
    QR(x[3], x[4], x[9], x[14]);
  }
  for (int i = 0; i < 16; i++) {
    uint32_t w = x[i] + s[i];
    out[4 * i] = (uint8_t)w;
    out[4 * i + 1] = (uint8_t)(w >> 8);
    out[4 * i + 2] = (uint8_t)(w >> 16);
    out[4 * i + 3] = (uint8_t)(w >> 24);
  }
  wipe(x, sizeof x);
}

/** `len` bytes from `src` to `dst` under the keystream from `s`'s counter on, one block at a time. */
static void xor_scalar(uint32_t s[16], const uint8_t *src, uint8_t *dst, size_t len) {
  _Alignas(16) uint8_t ks[64];
  while (len > 0) {
    block_scalar(s, ks);
    s[12] += 1;
    size_t take = len < 64 ? len : 64;
    for (size_t i = 0; i < take; i++) {
      dst[i] = src[i] ^ ks[i];
    }
    src += take;
    dst += take;
    len -= take;
  }
  wipe(ks, sizeof ks);
}

// The portable rotate: `(x << n) | (x >> (32 - n))` lane by lane, which LLVM
// turns into a shuffle for 16 and 8 where the target has one.
#define VROTL(x, n) (((x) << (n)) | ((x) >> (32 - (n))))

#define VQR(a, b, c, d)                                                                                      \
  a += b;                                                                                                    \
  d = VROTL(d ^ a, 16);                                                                                      \
  c += d;                                                                                                    \
  b = VROTL(b ^ c, 12);                                                                                      \
  a += b;                                                                                                    \
  d = VROTL(d ^ a, 8);                                                                                       \
  c += d;                                                                                                    \
  b = VROTL(b ^ c, 7)

#define VROUNDS(x)                                                                                           \
  for (int r = 0; r < 10; r++) {                                                                             \
    VQR(x[0], x[4], x[8], x[12]);                                                                            \
    VQR(x[1], x[5], x[9], x[13]);                                                                            \
    VQR(x[2], x[6], x[10], x[14]);                                                                           \
    VQR(x[3], x[7], x[11], x[15]);                                                                           \
    VQR(x[0], x[5], x[10], x[15]);                                                                           \
    VQR(x[1], x[6], x[11], x[12]);                                                                           \
    VQR(x[2], x[7], x[8], x[13]);                                                                            \
    VQR(x[3], x[4], x[9], x[14]);                                                                            \
  }

/**
 * Four blocks at once: word `i` of block `b` is lane `b` of `x[i]`, so the
 * rounds are the scalar code on vectors. The blocks are then written out
 * word by word (lane `b` of `x[i]` to byte `64b + 4i`), which is the transpose
 * a store of 4-word rows would need, done by the compiler.
 */
static void xor_vec128(uint32_t s[16], const uint8_t *src, uint8_t *dst, size_t len) {
  u32x4 x[16];
  u32x4 in[16];
  _Alignas(16) uint8_t ks[256];
  const u32x4 lanes = {0, 1, 2, 3};
  int ran = len >= 256;
  while (len >= 256) {
    for (int i = 0; i < 16; i++) {
      in[i] = (u32x4){s[i], s[i], s[i], s[i]};
    }
    in[12] += lanes;
    memcpy(x, in, sizeof x);
    VROUNDS(x)
    for (int i = 0; i < 16; i++) {
      u32x4 w = x[i] + in[i];
      for (int b = 0; b < 4; b++) {
        memcpy(ks + 64 * b + 4 * i, (const uint8_t *)&w + 4 * b, 4);
      }
    }
    for (size_t i = 0; i < 256; i += 16) {
      u32x4 p;
      u32x4 k;
      memcpy(&p, src + i, 16);
      memcpy(&k, ks + i, 16);
      p ^= k;
      memcpy(dst + i, &p, 16);
    }
    s[12] += 4;
    src += 256;
    dst += 256;
    len -= 256;
  }
  if (ran) {
    wipe(x, sizeof x);
    wipe(in, sizeof in);
    wipe(ks, sizeof ks);
  }
  xor_scalar(s, src, dst, len);
}

#if defined(__x86_64__)
/** Eight blocks at once, as `xor_vec128` does four, in AVX2's 256-bit registers. */
__attribute__((target("avx2"))) static void xor_avx2(uint32_t s[16], const uint8_t *src, uint8_t *dst,
                                                      size_t len) {
  u32x8 x[16];
  u32x8 in[16];
  _Alignas(16) uint8_t ks[512];
  const u32x8 lanes = {0, 1, 2, 3, 4, 5, 6, 7};
  int ran = len >= 512;
  while (len >= 512) {
    for (int i = 0; i < 16; i++) {
      in[i] = (u32x8){s[i], s[i], s[i], s[i], s[i], s[i], s[i], s[i]};
    }
    in[12] += lanes;
    memcpy(x, in, sizeof x);
    VROUNDS(x)
    for (int i = 0; i < 16; i++) {
      u32x8 w = x[i] + in[i];
      for (int b = 0; b < 8; b++) {
        memcpy(ks + 64 * b + 4 * i, (const uint8_t *)&w + 4 * b, 4);
      }
    }
    for (size_t i = 0; i < 512; i += 32) {
      u32x8 p;
      u32x8 k;
      memcpy(&p, src + i, 32);
      memcpy(&k, ks + i, 32);
      p ^= k;
      memcpy(dst + i, &p, 32);
    }
    s[12] += 8;
    src += 512;
    dst += 512;
    len -= 512;
  }
  if (ran) {
    wipe(x, sizeof x);
    wipe(in, sizeof in);
    wipe(ks, sizeof ks);
  }
  xor_vec128(s, src, dst, len);
}

/** Whether the CPU and the OS give AVX2: CPUID.7.0:EBX bit 5, with OSXSAVE and XCR0's SSE and AVX state. */
static int have_avx2(void) {
  uint32_t a, b, c, d;
  __asm__("cpuid" : "=a"(a), "=b"(b), "=c"(c), "=d"(d) : "a"(0), "c"(0));
  if (a < 7) {
    return 0;
  }
  __asm__("cpuid" : "=a"(a), "=b"(b), "=c"(c), "=d"(d) : "a"(1), "c"(0));
  if (!(c & (1u << 27))) {
    return 0;
  }
  uint32_t lo, hi;
  __asm__("xgetbv" : "=a"(lo), "=d"(hi) : "c"(0));
  if ((lo & 6) != 6) {
    return 0;
  }
  __asm__("cpuid" : "=a"(a), "=b"(b), "=c"(c), "=d"(d) : "a"(7), "c"(0));
  return (b >> 5) & 1;
}
#endif

#if CHACHA20_HAVE_NEON
#define NROTL(x, n) vsriq_n_u32(vshlq_n_u32((x), (n)), (x), 32 - (n))
#define NROT16(x) vreinterpretq_u32_u16(vrev32q_u16(vreinterpretq_u16_u32(x)))
#define NQR(a, b, c, d)                                                                                      \
  a = vaddq_u32(a, b);                                                                                       \
  d = NROT16(veorq_u32(d, a));                                                                               \
  c = vaddq_u32(c, d);                                                                                       \
  b = NROTL(veorq_u32(b, c), 12);                                                                            \
  a = vaddq_u32(a, b);                                                                                       \
  d = NROTL(veorq_u32(d, a), 8);                                                                             \
  c = vaddq_u32(c, d);                                                                                       \
  b = NROTL(veorq_u32(b, c), 7)

/** Four blocks at once in NEON intrinsics, a block a lane as `xor_vec128` does. */
static void xor_neon(uint32_t s[16], const uint8_t *src, uint8_t *dst, size_t len) {
  uint32x4_t x[16];
  uint32x4_t in[16];
  _Alignas(16) uint8_t ks[256];
  const uint32_t lane_init[4] = {0, 1, 2, 3};
  const uint32x4_t lanes = vld1q_u32(lane_init);
  int ran = len >= 256;
  while (len >= 256) {
    for (int i = 0; i < 16; i++) {
      in[i] = vdupq_n_u32(s[i]);
    }
    in[12] = vaddq_u32(in[12], lanes);
    for (int i = 0; i < 16; i++) {
      x[i] = in[i];
    }
    for (int r = 0; r < 10; r++) {
      NQR(x[0], x[4], x[8], x[12]);
      NQR(x[1], x[5], x[9], x[13]);
      NQR(x[2], x[6], x[10], x[14]);
      NQR(x[3], x[7], x[11], x[15]);
      NQR(x[0], x[5], x[10], x[15]);
      NQR(x[1], x[6], x[11], x[12]);
      NQR(x[2], x[7], x[8], x[13]);
      NQR(x[3], x[4], x[9], x[14]);
    }
    for (int i = 0; i < 16; i += 4) {
      uint32x4x4_t w;
      w.val[0] = vaddq_u32(x[i], in[i]);
      w.val[1] = vaddq_u32(x[i + 1], in[i + 1]);
      w.val[2] = vaddq_u32(x[i + 2], in[i + 2]);
      w.val[3] = vaddq_u32(x[i + 3], in[i + 3]);
      // vst4q interleaves the four words, so each 16-byte store is one row of one block.
      uint32_t rows[16];
      vst4q_u32(rows, w);
      for (int b = 0; b < 4; b++) {
        memcpy(ks + 64 * b + 4 * i, rows + 4 * b, 16);
      }
      wipe(rows, sizeof rows);
    }
    for (size_t i = 0; i < 256; i += 16) {
      vst1q_u8(dst + i, veorq_u8(vld1q_u8(src + i), vld1q_u8(ks + i)));
    }
    s[12] += 4;
    src += 256;
    dst += 256;
    len -= 256;
  }
  if (ran) {
    wipe(x, sizeof x);
    wipe(in, sizeof in);
    wipe(ks, sizeof ks);
  }
  xor_scalar(s, src, dst, len);
}
#endif

typedef void (*xor_fn)(uint32_t s[16], const uint8_t *src, uint8_t *dst, size_t len);

/** The path `name` names, or null when this build or this CPU has none. */
static xor_fn path_named(const char *name) {
  if (strcmp(name, "scalar") == 0) {
    return xor_scalar;
  }
  if (strcmp(name, "vec128") == 0) {
    return xor_vec128;
  }
#if defined(__x86_64__)
  if (strcmp(name, "avx2") == 0) {
    return have_avx2() ? xor_avx2 : NULL;
  }
#endif
#if CHACHA20_HAVE_NEON
  if (strcmp(name, "neon") == 0) {
    return xor_neon;
  }
#endif
  return NULL;
}

#if !defined(CHACHA20_VERIFY)
static xor_fn chosen;

/**
 * The prototype's seam: `len` bytes of `src` to `dst` under the keystream of
 * `state`, sixteen little-endian words in 64 bytes, from its counter on.
 * Answers the counter one past the last block used, which the caller writes
 * back. `nState` and `len` are the counts of the two buffer runs the Nish
 * declaration pairs them with.
 */
uint32_t bench_chacha20_xor(const uint8_t *state, uint64_t nState, const uint8_t *src, uint8_t *dst,
                            uint64_t len) {
  if (chosen == NULL) {
    const char *name = getenv("BENCH_CHACHA20");
    chosen = path_named(name == NULL ? "vec128" : name);
    if (chosen == NULL) {
      abort();
    }
  }
  if (nState < 64) {
    abort();
  }
  uint32_t s[16];
  for (int i = 0; i < 16; i++) {
    s[i] = load32(state + 4 * i);
  }
  chosen(s, src, dst, (size_t)len);
  uint32_t counter = s[12];
  wipe(s, sizeof s);
  return counter;
}
#else
#include <stdio.h>

/** RFC 8439 §2.4.2: the sunscreen plaintext under its key, nonce and counter 1, first and last 16 bytes. */
static int rfc_vector(xor_fn f) {
  static const char text[] = "Ladies and Gentlemen of the class of '99: If I could offer you only one tip for "
                             "the future, sunscreen would be it.";
  static const uint8_t first[16] = {0x6e, 0x2e, 0x35, 0x9a, 0x25, 0x68, 0xf9, 0x80,
                                    0x41, 0xba, 0x07, 0x28, 0xdd, 0x0d, 0x69, 0x81};
  static const uint8_t last[16] = {0x0b, 0xbf, 0x74, 0xa3, 0x5b, 0xe6, 0xb4, 0x0b,
                                   0x8e, 0xed, 0xf2, 0x78, 0x5e, 0x42, 0x87, 0x4d};
  uint8_t key[32];
  for (int i = 0; i < 32; i++) {
    key[i] = (uint8_t)i;
  }
  static const uint8_t nonce[12] = {0, 0, 0, 0, 0, 0, 0, 0x4a, 0, 0, 0, 0};
  uint32_t s[16] = {0x61707865, 0x3320646e, 0x79622d32, 0x6b206574};
  for (int i = 0; i < 8; i++) {
    s[4 + i] = load32(key + 4 * i);
  }
  s[12] = 1;
  for (int i = 0; i < 3; i++) {
    s[13 + i] = load32(nonce + 4 * i);
  }
  size_t n = sizeof text - 1;
  uint8_t out[sizeof text];
  f(s, (const uint8_t *)text, out, n);
  return memcmp(out, first, 16) == 0 && memcmp(out + n - 16, last, 16) == 0 && s[12] == 3;
}

/**
 * Every path against `xor_scalar`: every length to 4 KiB plus a few blocks
 * around each width boundary up to 64 KiB, at every source and destination
 * offset mod 4 on a cycle of them, from a counter that changes per length.
 * Prints `chacha20 <paths>: <cases> cases agree` or names the first miss.
 */
int main(void) {
  static const char *names[] = {"vec128", "avx2", "neon"};
  enum { MAX = 65536 + 1024 };
  uint8_t *src = malloc(MAX + 8);
  uint8_t *want = malloc(MAX + 8);
  uint8_t *got = malloc(MAX + 8);
  uint32_t x = 20261103;
  for (size_t i = 0; i < MAX + 8; i++) {
    x = x * 1103515245u + 12345u;
    src[i] = (uint8_t)(x >> 24);
  }
  if (!rfc_vector(xor_scalar)) {
    printf("chacha20 scalar: RFC 8439 §2.4.2 vector misses\n");
    return 1;
  }
  char ran[64] = "scalar";
  long cases = 0;
  for (size_t p = 0; p < sizeof names / sizeof names[0]; p++) {
    xor_fn f = path_named(names[p]);
    if (f == NULL) {
      continue;
    }
    strcat(ran, ", ");
    strcat(ran, names[p]);
    if (!rfc_vector(f)) {
      printf("chacha20 %s: RFC 8439 §2.4.2 vector misses\n", names[p]);
      return 1;
    }
    for (size_t len = 0; len <= MAX; len += (len < 4096 ? 1 : (len % 512 < 4 || len % 512 > 508 ? 1 : 251))) {
      uint32_t s1[16];
      uint32_t s2[16];
      for (int i = 0; i < 16; i++) {
        s1[i] = s2[i] = 0x9e3779b9u * (uint32_t)(i + 1) ^ (uint32_t)len;
      }
      size_t so = len % 4;
      size_t dob = (len / 4) % 4;
      xor_scalar(s1, src + so, want + dob, len);
      f(s2, src + so, got + dob, len);
      cases++;
      if (memcmp(want + dob, got + dob, len) != 0 || s1[12] != s2[12]) {
        printf("chacha20 %s: length %zu misses\n", names[p], len);
        return 1;
      }
    }
  }
  printf("chacha20 %s: %ld cases agree\n", ran, cases);
  return 0;
}
#endif
