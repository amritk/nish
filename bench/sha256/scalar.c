/*
 * A scalar C twin of std/crypto/sha256.ts's portable path, for bench/sha256:
 * the yardstick its `sha256Compress` is measured against. Written from FIPS
 * 180-4 (§4.1.2's functions, §4.2.2's constants, §6.2.2's computation), not
 * copied. Its shape is the usual one for a fast scalar C SHA-256, the shape of
 * the Linux kernel's `sha256_transform` and of OpenSSL's C fallback: the 64
 * rounds unrolled by a macro that renames the eight working variables instead
 * of moving them, and the message schedule computed one word ahead of the
 * round that reads it, in a 16-word ring. No intrinsics: run.mjs compiles it
 * with `-march=native -mno-sha`, so the compiler can use BMI2's `rorx` but
 * not the SHA extensions.
 *
 * Kernels, under bench/crypto/README.md's contract and bench/sha256/main.ts's
 * inputs, so both print the same checksum:
 *
 *   sha256 <size>        the one-shot digest of a <size>-byte message
 *   hmac-sha256 <size>   HMAC-SHA256 (RFC 2104) of a <size>-byte message under
 *                        a 32-byte key
 */
#include <stdint.h>
#include <string.h>

#include "gen.h"

static const uint32_t K[64] = {
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
};

#define ROTR(x, n) (((x) >> (n)) | ((x) << (32 - (n))))
#define BSIG0(x) (ROTR(x, 2) ^ ROTR(x, 13) ^ ROTR(x, 22))
#define BSIG1(x) (ROTR(x, 6) ^ ROTR(x, 11) ^ ROTR(x, 25))
#define SSIG0(x) (ROTR(x, 7) ^ ROTR(x, 18) ^ ((x) >> 3))
#define SSIG1(x) (ROTR(x, 17) ^ ROTR(x, 19) ^ ((x) >> 10))
#define CH(x, y, z) ((z) ^ ((x) & ((y) ^ (z))))
#define MAJ(x, y, z) (((x) & (y)) ^ ((z) & ((x) ^ (y))))

static inline uint32_t load_be32(const uint8_t *p) {
  return (uint32_t)p[0] << 24 | (uint32_t)p[1] << 16 | (uint32_t)p[2] << 8 | (uint32_t)p[3];
}

static inline void store_be32(uint8_t *p, uint32_t v) {
  p[0] = (uint8_t)(v >> 24);
  p[1] = (uint8_t)(v >> 16);
  p[2] = (uint8_t)(v >> 8);
  p[3] = (uint8_t)v;
}

/* Round t on the working variables named in their round-t roles. */
#define ROUND(a, b, c, d, e, f, g, h, t)                    \
  do {                                                      \
    uint32_t t1 = h + BSIG1(e) + CH(e, f, g) + K[t] + W(t); \
    d += t1;                                                \
    h = t1 + BSIG0(a) + MAJ(a, b, c);                       \
  } while (0)

#define EIGHT(t)                          \
  ROUND(a, b, c, d, e, f, g, h, t);     \
  ROUND(h, a, b, c, d, e, f, g, t + 1); \
  ROUND(g, h, a, b, c, d, e, f, t + 2); \
  ROUND(f, g, h, a, b, c, d, e, t + 3); \
  ROUND(e, f, g, h, a, b, c, d, t + 4); \
  ROUND(d, e, f, g, h, a, b, c, t + 5); \
  ROUND(c, d, e, f, g, h, a, b, t + 6); \
  ROUND(b, c, d, e, f, g, h, a, t + 7)

/* FIPS 180-4 §6.2.2 steps 1 to 4 for one 64-byte block. */
static void compress(uint32_t state[8], const uint8_t *block) {
  uint32_t w[16];
  uint32_t a = state[0], b = state[1], c = state[2], d = state[3];
  uint32_t e = state[4], f = state[5], g = state[6], h = state[7];
#define W(t) w[t]
  for (int i = 0; i < 16; i++) {
    w[i] = load_be32(block + 4 * i);
  }
  EIGHT(0);
  EIGHT(8);
#undef W
#define W(t) (w[(t) & 15] += SSIG1(w[((t) - 2) & 15]) + w[((t) - 7) & 15] + SSIG0(w[((t) - 15) & 15]))
  EIGHT(16);
  EIGHT(24);
  EIGHT(32);
  EIGHT(40);
  EIGHT(48);
  EIGHT(56);
#undef W
  state[0] += a;
  state[1] += b;
  state[2] += c;
  state[3] += d;
  state[4] += e;
  state[5] += f;
  state[6] += g;
  state[7] += h;
}

typedef struct {
  uint32_t state[8];
  uint8_t buf[64];
  size_t fill;
  uint64_t total;
} sha256_ctx;

static void sha256_init(sha256_ctx *s) {
  static const uint32_t H0[8] = {0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
                                 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19};
  memcpy(s->state, H0, sizeof H0);
  s->fill = 0;
  s->total = 0;
}

static void sha256_update(sha256_ctx *s, const uint8_t *p, size_t n) {
  s->total += n;
  if (s->fill > 0) {
    size_t take = 64 - s->fill < n ? 64 - s->fill : n;
    memcpy(s->buf + s->fill, p, take);
    s->fill += take;
    p += take;
    n -= take;
    if (s->fill < 64) {
      return;
    }
    compress(s->state, s->buf);
    s->fill = 0;
  }
  for (; n >= 64; p += 64, n -= 64) {
    compress(s->state, p);
  }
  memcpy(s->buf, p, n);
  s->fill = n;
}

/* §5.1.1's padding, then the hash value as §6.2.2 step 4 leaves it, big-endian. */
static void sha256_final(sha256_ctx *s, uint8_t out[32]) {
  uint64_t bits = s->total * 8;
  s->buf[s->fill++] = 0x80;
  if (s->fill > 56) {
    memset(s->buf + s->fill, 0, 64 - s->fill);
    compress(s->state, s->buf);
    s->fill = 0;
  }
  memset(s->buf + s->fill, 0, 56 - s->fill);
  store_be32(s->buf + 56, (uint32_t)(bits >> 32));
  store_be32(s->buf + 60, (uint32_t)bits);
  compress(s->state, s->buf);
  for (int i = 0; i < 8; i++) {
    store_be32(out + 4 * i, s->state[i]);
  }
}

/* RFC 2104 with a key no longer than a block, as both kernels pass. */
static void hmac_sha256(const uint8_t *key, size_t key_len, const uint8_t *msg, size_t n, uint8_t out[32]) {
  uint8_t pad[64];
  uint8_t inner[32];
  sha256_ctx s;
  memset(pad, 0x36, 64);
  for (size_t i = 0; i < key_len; i++) {
    pad[i] ^= key[i];
  }
  sha256_init(&s);
  sha256_update(&s, pad, 64);
  sha256_update(&s, msg, n);
  sha256_final(&s, inner);
  for (int i = 0; i < 64; i++) {
    pad[i] ^= 0x36 ^ 0x5c;
  }
  sha256_init(&s);
  sha256_update(&s, pad, 64);
  sha256_update(&s, inner, 32);
  sha256_final(&s, out);
}

int main(int argc, char **argv) {
  const char *kernel;
  long size, iterations;
  parse_args(argc, argv, &kernel, &size, &iterations);
  int hmac = strcmp(kernel, "hmac-sha256") == 0;
  if (!hmac && strcmp(kernel, "sha256") != 0) {
    fprintf(stderr, "scalar: no kernel %s\n", kernel);
    return 2;
  }
  inputs_t in = inputs(kernel, size, hmac ? 32 : 0, 0, 0, (size_t)size);
  uint8_t base[4] = {0};
  memcpy(base, in.msg, size < 4 ? (size_t)size : 4);
  uint8_t digest[32];
  uint32_t sum = FOLD_START;
  int64_t started = now_ns();
  for (long i = 0; i < iterations; i++) {
    tweak(in.msg, base, (uint32_t)i);
    if (hmac) {
      hmac_sha256(in.key, 32, in.msg, (size_t)size, digest);
    } else {
      sha256_ctx s;
      sha256_init(&s);
      sha256_update(&s, in.msg, (size_t)size);
      sha256_final(&s, digest);
    }
    sum = fold(sum, digest, 32);
  }
  report(sum, started);
  return 0;
}
