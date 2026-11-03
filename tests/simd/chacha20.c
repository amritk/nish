/* The agreement test for runtime/runtime-chacha20.c: the ChaCha20 keystream
 * kernel this machine has -- eight blocks at once on AVX2, four on NEON --
 * answers exactly as std/crypto/chacha20poly1305.ts's `chacha20XorInto` does,
 * `nish_chacha20_xor` refuses every call its guard refuses with nothing
 * written, and `nish_chacha20_hw` answers what `NISH_CHACHA20` and the CPU say
 * it should.
 *
 * The reference is RFC 8439 §2.3's block function and §2.4's xor, written as
 * the Nish function is: a block at a time, the counter moved one a block, the
 * last partial block taken byte by byte. It is first held to §2.4.2's vector
 * (the sunscreen text under key 00..1f, nonce 00:00:00:00:00:00:00:4a:00:00:00:00
 * and counter 1), and the kernel is then held to the same vector through a
 * buffer of four blocks, whose first 114 bytes are that text.
 *
 * Then every length from 256 to 4,096 and some around each width up to 64 KiB,
 * at source and destination offsets 0..17, both in place and into a second
 * buffer, each with a random state; then 20,000 fuzzed calls; each compares
 * the output, every byte past the window and the counter left behind. Then the
 * guard's edges -- a state of fifteen words, 255 bytes, a negative offset, a
 * window one past either array's end, windows that overlap by a byte or are
 * shifted by one -- each of which must answer 0 and leave both arrays and the
 * state untouched.
 *
 * The runtime file is included rather than linked, as tests/simd/sha256.c
 * includes runtime-sha256.c, so the resolver's stored answer can be reset and
 * asked again under each pin.
 *
 *   chacha20 [seed]   prints one summary line and exits 0, or names the first
 *                     case a path got wrong and exits 1
 */
#define _DEFAULT_SOURCE /* setenv under -std=c11 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "../../runtime/runtime-chacha20.c"

/* ---- The reference --------------------------------------------------------- */

static uint32_t rotl(uint32_t x, int n) {
  return (x << n) | (x >> (32 - n));
}

#define QR(a, b, c, d)                \
  a += b, d = rotl(d ^ a, 16);        \
  c += d, b = rotl(b ^ c, 12);        \
  a += b, d = rotl(d ^ a, 8);         \
  c += d, b = rotl(b ^ c, 7)

static void ref_block(const uint32_t s[16], uint8_t out[64]) {
  uint32_t x[16];
  memcpy(x, s, sizeof x);
  for (int r = 0; r < 10; r++) {
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
    for (int b = 0; b < 4; b++) out[4 * i + b] = (uint8_t)(w >> (8 * b));
  }
}

/* `chacha20XorInto` in C: in order, a block at a time, so it is right in place. */
static void ref_xor(uint32_t s[16], const uint8_t *src, uint8_t *dst, size_t len) {
  uint8_t ks[64];
  for (size_t done = 0; done < len; done += 64) {
    ref_block(s, ks);
    s[12] += 1;
    size_t take = len - done < 64 ? len - done : 64;
    for (size_t i = 0; i < take; i++) dst[done + i] = src[done + i] ^ ks[i];
  }
}

/* The kernel through the arrays the compiler hands it; its answer. */
static int32_t hw_xor(uint32_t s[16], uint64_t slen, uint8_t *src, uint64_t srclen, int32_t src_at, int32_t len,
                      uint8_t *dst, uint64_t dstlen, int32_t dst_at) {
  nish_array sa = {slen, 16, (char *)s};
  nish_array from = {srclen, srclen, (char *)src};
  nish_array to = {dstlen, dstlen, (char *)dst};
  return nish_chacha20_xor(&sa, &from, src_at, len, &to, dst_at);
}

static long cases;
static uint64_t rng_state;

static uint64_t rng(void) {
  rng_state ^= rng_state << 13;
  rng_state ^= rng_state >> 7;
  rng_state ^= rng_state << 17;
  return rng_state;
}

static void random_state(uint32_t s[16]) {
  for (int i = 0; i < 16; i++) s[i] = (uint32_t)rng();
  /* The counter near its top now and then, as the caller allows up to the wrap. */
  if (rng() % 8 == 0) s[12] = 0xffffffffu - (uint32_t)(rng() % 2048);
}

/* ---- RFC 8439 §2.4.2 --------------------------------------------------------- */

static const char sunscreen[] = "Ladies and Gentlemen of the class of '99: If I could offer you only one tip for "
                                "the future, sunscreen would be it.";
static const uint8_t first16[16] = {0x6e, 0x2e, 0x35, 0x9a, 0x25, 0x68, 0xf9, 0x80,
                                    0x41, 0xba, 0x07, 0x28, 0xdd, 0x0d, 0x69, 0x81};
static const uint8_t last16[16] = {0x0b, 0xbf, 0x74, 0xa3, 0x5b, 0xe6, 0xb4, 0x0b,
                                   0x8e, 0xed, 0xf2, 0x78, 0x5e, 0x42, 0x87, 0x4d};

static void rfc_state(uint32_t s[16]) {
  static const uint32_t head[4] = {0x61707865, 0x3320646e, 0x79622d32, 0x6b206574};
  for (int i = 0; i < 4; i++) s[i] = head[i];
  for (int i = 0; i < 8; i++)
    s[4 + i] = (uint32_t)(4 * i) | (uint32_t)(4 * i + 1) << 8 | (uint32_t)(4 * i + 2) << 16 |
               (uint32_t)(4 * i + 3) << 24;
  s[12] = 1;
  s[13] = 0, s[14] = 0x4a000000, s[15] = 0;
}

static int vectors(int hw) {
  size_t n = sizeof sunscreen - 1;
  uint32_t s[16];
  uint8_t out[256];
  rfc_state(s);
  ref_xor(s, (const uint8_t *)sunscreen, out, n);
  if (memcmp(out, first16, 16) != 0 || memcmp(out + n - 16, last16, 16) != 0 || s[12] != 3) {
    printf("FAIL reference: RFC 8439 §2.4.2's vector misses\n");
    return 0;
  }
  cases++;
  if (!hw) return 1;
  uint8_t in[256] = {0};
  memcpy(in, sunscreen, n);
  rfc_state(s);
  if (hw_xor(s, 16, in, sizeof in, 0, 256, out, sizeof out, 0) != 1 || memcmp(out, first16, 16) != 0 ||
      memcmp(out + n - 16, last16, 16) != 0 || s[12] != 5) {
    printf("FAIL kernel: RFC 8439 §2.4.2's vector misses through four blocks\n");
    return 0;
  }
  cases++;
  return 1;
}

/* ---- The corpus -------------------------------------------------------------- */

#define PAD 64
#define BUF (65536 + 64 + 2 * PAD)
static uint8_t src_buf[BUF], want_buf[BUF], got_buf[BUF];

/* One call at `len` bytes from `src_at` to `dst_at`, in place or not, against
   the reference: the window, the bytes around it and the counter. */
static int one(size_t len, int32_t src_at, int32_t dst_at, int in_place, const char *what) {
  uint32_t s0[16], sw[16], sg[16];
  random_state(s0);
  memcpy(sw, s0, sizeof s0);
  memcpy(sg, s0, sizeof s0);
  /* Only the bytes a call can reach, and a pad past them, are filled and compared. */
  size_t end = (size_t)(src_at > dst_at ? src_at : dst_at) + len + PAD;
  for (size_t i = 0; i < end; i++) src_buf[i] = (uint8_t)rng();
  int32_t got;
  if (in_place) {
    memcpy(want_buf, src_buf, end);
    memcpy(got_buf, src_buf, end);
    ref_xor(sw, want_buf + src_at, want_buf + src_at, len);
    got = hw_xor(sg, 16, got_buf, BUF, src_at, (int32_t)len, got_buf, BUF, src_at);
  } else {
    memset(want_buf, 0xa5, end);
    memset(got_buf, 0xa5, end);
    ref_xor(sw, src_buf + src_at, want_buf + dst_at, len);
    got = hw_xor(sg, 16, src_buf, BUF, src_at, (int32_t)len, got_buf, BUF, dst_at);
  }
  if (got != 1 || memcmp(want_buf, got_buf, end) != 0 || memcmp(sw, sg, sizeof sw) != 0) {
    printf("FAIL kernel: %s, %zu bytes from %d to %d%s (answered %d)\n", what, len, src_at, dst_at,
           in_place ? " in place" : "", got);
    return 0;
  }
  cases++;
  return 1;
}

static int corpus(void) {
  static const size_t widths[] = {256, 512, 1024, 4096, 16384, 65536};
  for (size_t len = 256; len <= 4096; len++)
    if (!one(len, (int32_t)(len % 18), (int32_t)((len / 18) % 18), len % 3 == 0, "a length to 4 KiB")) return 0;
  for (size_t w = 0; w < sizeof widths / sizeof widths[0]; w++)
    for (size_t d = 0; d <= 130; d++)
      for (int at = 0; at < 18; at += 5)
        if (!one(widths[w] + d - (widths[w] > 256 ? 65 : 0), at, 17 - at, d & 1, "a width's edge")) return 0;
  return 1;
}

static int fuzz(void) {
  for (int trial = 0; trial < 20000; trial++) {
    size_t len = 256 + rng() % (trial % 10 == 0 ? 65536 - 256 : 2048);
    if (!one(len, (int32_t)(rng() % PAD), (int32_t)(rng() % PAD), (int)(rng() & 1), "a fuzzed call")) return 0;
  }
  return 1;
}

/* ---- The guard ---------------------------------------------------------------- */

/* One call the guard must refuse: the answer 0, and the state and both arrays
   as they were. `dst_off` is the destination's start in the same buffer as
   the source, or -1 for a buffer of its own. */
static int refuses(const char *what, uint64_t slen, uint64_t srclen, int32_t src_at, int32_t len, uint64_t dstlen,
                   int32_t dst_at, int shared) {
  static uint8_t a[1024], b[1024], a0[1024], b0[1024];
  uint32_t s[16], s0[16];
  random_state(s);
  memcpy(s0, s, sizeof s);
  for (int i = 0; i < 1024; i++) a[i] = (uint8_t)rng(), b[i] = (uint8_t)rng();
  memcpy(a0, a, sizeof a);
  memcpy(b0, b, sizeof b);
  int32_t r = hw_xor(s, slen, a, srclen, src_at, len, shared ? a : b, dstlen, dst_at);
  if (memcmp(s, s0, sizeof s) != 0 || memcmp(a, a0, sizeof a) != 0 || memcmp(b, b0, sizeof b) != 0) r = -1;
  if (r != 0) {
    printf("FAIL guard: %s was not refused untouched (answered %d)\n", what, r);
    return 0;
  }
  cases++;
  return 1;
}

static int edges(void) {
  static uint8_t a[1024], b[1024];
  uint32_t s[16] = {0};
  if (hw_xor(s, 16, a, 1024, 768, 256, b, 1024, 768) != 1 || hw_xor(s, 16, a, 1024, 0, 1024, a, 1024, 0) != 1 ||
      hw_xor(s, 16, a, 1024, 0, 256, a, 1024, 256) != 1) {
    printf("FAIL guard: a window that fits, at the last offset, the whole array or just past the other, was refused\n");
    return 0;
  }
  cases += 3;
  return refuses("a state of fifteen words", 15, 1024, 0, 256, 1024, 0, 0) &&
         refuses("255 bytes", 16, 1024, 0, 255, 1024, 0, 0) && refuses("no bytes", 16, 1024, 0, 0, 1024, 0, 0) &&
         refuses("a negative length", 16, 1024, 0, -256, 1024, 0, 0) &&
         refuses("a source offset of -1", 16, 1024, -1, 256, 1024, 0, 0) &&
         refuses("a destination offset of -1", 16, 1024, 0, 256, 1024, -1, 0) &&
         refuses("a source window one past its end", 16, 1024, 769, 256, 1024, 0, 0) &&
         refuses("a destination window one past its end", 16, 1024, 0, 256, 1024, 769, 0) &&
         refuses("a source of 255 bytes", 16, 255, 0, 256, 1024, 0, 0) &&
         refuses("at INT32_MIN", 16, 1024, INT32_MIN, 256, 1024, 0, 0) &&
         refuses("windows shifted by one byte", 16, 1024, 0, 256, 1024, 1, 1) &&
         refuses("windows shifted back by one byte", 16, 1024, 1, 256, 1024, 0, 1) &&
         refuses("windows overlapping by one byte", 16, 1024, 0, 256, 1024, 255, 1);
}

/* ---- The resolver ------------------------------------------------------------- */

static int resolves(const char *pin, int want) {
  if (pin == NULL) {
    unsetenv("NISH_CHACHA20");
  } else {
    setenv("NISH_CHACHA20", pin, 1);
  }
  __atomic_store_n(&nish_chacha20_answer, 0, __ATOMIC_RELAXED);
  int got = nish_chacha20_hw();
  /* Fixed once answered: a later change of the environment is not read. */
  setenv("NISH_CHACHA20", want ? "soft" : "hw", 1);
  if (got != want || nish_chacha20_hw() != want) {
    printf("FAIL resolver: NISH_CHACHA20=%s answered %d, not %d\n", pin ? pin : "<unset>", got, want);
    return 0;
  }
  return 1;
}

int main(int argc, char **argv) {
  uint64_t seed = argc > 1 ? strtoull(argv[1], NULL, 10) : 20261103;
  rng_state = seed | 1;

  const char *path;
  int hw = nish_chacha20_cpu();
#if defined(NISH_CHACHA20_X86)
  /* A second detector to hold this one to: clang's own. */
  if (hw != (__builtin_cpu_supports("avx2") != 0)) {
    printf("FAIL detector: the CPU check answered %d and __builtin_cpu_supports(\"avx2\") disagrees\n", hw);
    return 1;
  }
  path = hw ? "avx2" : "the reference alone (avx2 SKIPPED: this CPU has no AVX2)";
#else
  path = hw ? "neon" : "the reference alone (neon SKIPPED: NISH_CHACHA20_ARM_ON is 0)";
#endif

  if (!vectors(hw)) return 1;
  if (hw && (!corpus() || !fuzz() || !edges())) return 1;

  /* The pin, and the best this machine has for no pin, `hw`, and a value it
     does not know. */
  if (!resolves("soft", 0) || !resolves(NULL, hw) || !resolves("hw", hw) || !resolves("softer", hw)) return 1;

  printf("chacha20: %ld cases agree across %s; the resolver picks every pin\n", cases, path);
  return 0;
}
