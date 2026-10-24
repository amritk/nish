/* JSON-13: a known answer for the string hash. `tests/run.js` links
 * `map_hash_kat` with `-Wl,--wrap=nish_str_eq`, so every key compare the
 * compiled program makes arrives here first and `mapKeyCompares` hands the
 * count back. `useTestKey` sets the hash key to the bytes 00..0f and answers 1
 * when the reference below reproduces SipHash-2-4's published vector for that
 * key (the 15 bytes 00..0e, a129ca6149be45e5), so the reference is checked
 * before its 1-3 answers are trusted; `referenceHash` is SipHash-1-3 of a
 * string under that key, folded to 32 bits as the emitter folds it. SipHash is
 * Aumasson and Bernstein's; this is written from the paper, not copied. */
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <string.h>
#include "nish.h"

bool __real_nish_str_eq(const nish_str *a, const nish_str *b);

static int32_t compares = 0;

bool __wrap_nish_str_eq(const nish_str *a, const nish_str *b) {
  compares++;
  return __real_nish_str_eq(a, b);
}

int32_t mapKeyCompares(void) {
  return compares;
}

#define K0 0x0706050403020100ULL
#define K1 0x0f0e0d0c0b0a0908ULL

static uint64_t rotl(uint64_t x, int by) {
  return x << by | x >> (64 - by);
}

static void sip_rounds(uint64_t v[4], int rounds) {
  for (int r = 0; r < rounds; r++) {
    v[0] += v[1], v[1] = rotl(v[1], 13) ^ v[0], v[0] = rotl(v[0], 32);
    v[2] += v[3], v[3] = rotl(v[3], 16) ^ v[2];
    v[0] += v[3], v[3] = rotl(v[3], 21) ^ v[0];
    v[2] += v[1], v[1] = rotl(v[1], 17) ^ v[2], v[2] = rotl(v[2], 32);
  }
}

static uint64_t siphash(const uint8_t *m, size_t n, int c, int d) {
  uint64_t v[4] = {K0 ^ 0x736f6d6570736575ULL, K1 ^ 0x646f72616e646f6dULL, K0 ^ 0x6c7967656e657261ULL,
                   K1 ^ 0x7465646279746573ULL};
  size_t words = n & ~(size_t)7;
  for (size_t i = 0; i < words; i += 8) {
    uint64_t x;
    memcpy(&x, m + i, 8);
    v[3] ^= x, sip_rounds(v, c), v[0] ^= x;
  }
  uint64_t b = (uint64_t)n << 56;
  for (size_t i = words; i < n; i++) {
    b |= (uint64_t)m[i] << (8 * (i - words));
  }
  v[3] ^= b, sip_rounds(v, c), v[0] ^= b;
  v[2] ^= 0xff, sip_rounds(v, d);
  return v[0] ^ v[1] ^ v[2] ^ v[3];
}

int32_t useTestKey(void) {
  nish_hash_key[0] = K0;
  nish_hash_key[1] = K1;
  uint8_t m[15];
  for (int i = 0; i < 15; i++) {
    m[i] = (uint8_t)i;
  }
  return siphash(m, sizeof m, 2, 4) == 0xa129ca6149be45e5ULL;
}

uint32_t referenceHash(const char *s) {
  uint64_t x = siphash((const uint8_t *)s, strlen(s), 1, 3);
  return (uint32_t)x ^ (uint32_t)(x >> 32);
}
