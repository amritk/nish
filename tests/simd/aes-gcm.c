/* The agreement test for runtime/runtime-aes.c (WP38 S5): every path the file
 * has for this machine -- AES-NI with PCLMULQDQ on x86-64, the ARMv8 AES and
 * PMULL instructions on AArch64 -- answers exactly as a textbook reference
 * does, and `nish_aes_hw` answers what `NISH_AES` and the CPU say it should.
 *
 * The reference is test-only and is not constant time: AES with an S-box
 * table and xtime (FIPS 197 §5), the S-box itself computed from its definition
 * (the inverse in GF(2^8) and the affine map, §5.1.1) rather than typed in,
 * and GHASH one bit at a time (SP 800-38D §6.3, Algorithm 1). It is first held
 * to published vectors, so the kernels are compared with something known to
 * be right:
 *
 *   - FIPS 197 Appendix C.1 and C.3, one block of AES-128 and AES-256;
 *   - the GCM specification's test cases 1 to 4 and 13 to 16 (McGrew and
 *     Viega, "The Galois/Counter Mode of Operation", the vectors SP 800-38D
 *     points to), sealed with the kernels' four functions;
 *   - RFC 9001's header-protection samples, A.2's and A.3's (A.5's packet is
 *     ChaCha20's, so it has none for AES).
 *
 * Then a seeded, fuzzed corpus: every length 0..4,096 for GCTR (in place and
 * not) and GHASH under random keys of both sizes, a third of them with J0's
 * counter within a few hundred blocks of 2^32; the wrap pinned at counters
 * that cross it on and inside a four-block batch; then random lengths,
 * starting states and keys besides.
 *
 * The runtime file is included rather than linked, as tests/simd/index-of-any.c
 * includes runtime-simd.c, so the resolver's stored answer can be reset and
 * asked again under each pin.
 *
 *   aes-gcm [seed]   prints one summary line and exits 0, or names the first
 *                    case a path got wrong and exits 1
 */
#define _DEFAULT_SOURCE /* setenv under -std=c11 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "../../runtime/runtime-aes.c"

/* ---- The reference --------------------------------------------------------- */

static uint8_t sbox[256];

static uint8_t xtime(uint8_t b) {
  return (uint8_t)((b << 1) ^ ((b >> 7) * 0x1b));
}

static uint8_t gmul(uint8_t a, uint8_t b) {
  uint8_t p = 0;
  for (int i = 0; i < 8; i++) {
    if (b & 1) p ^= a;
    a = xtime(a);
    b >>= 1;
  }
  return p;
}

/* §5.1.1: the multiplicative inverse (0 for 0), then the affine map. */
static void sbox_init(void) {
  for (int x = 0; x < 256; x++) {
    uint8_t inv = 0;
    for (int y = 1; y < 256 && x != 0; y++) {
      if (gmul((uint8_t)x, (uint8_t)y) == 1) inv = (uint8_t)y;
    }
    uint8_t s = inv;
    for (int r = 1; r < 5; r++) s ^= (uint8_t)((inv << r) | (inv >> (8 - r)));
    sbox[x] = s ^ 0x63;
  }
}

/* §5.2: the schedule as `4 * (rounds + 1)` words of four bytes, in order. */
static void ref_expand(const uint8_t *key, int nk, uint8_t w[240]) {
  int rounds = nk + 6;
  memcpy(w, key, 4 * (size_t)nk);
  uint8_t rcon = 1;
  for (int i = nk; i < 4 * (rounds + 1); i++) {
    uint8_t t[4];
    memcpy(t, w + 4 * (i - 1), 4);
    if (i % nk == 0) {
      uint8_t t0 = t[0];
      t[0] = sbox[t[1]] ^ rcon;
      t[1] = sbox[t[2]];
      t[2] = sbox[t[3]];
      t[3] = sbox[t0];
      rcon = xtime(rcon);
    } else if (nk > 6 && i % nk == 4) {
      for (int j = 0; j < 4; j++) t[j] = sbox[t[j]];
    }
    for (int j = 0; j < 4; j++) w[4 * i + j] = w[4 * (i - nk) + j] ^ t[j];
  }
}

/* §5.1, the state as sixteen bytes in input order (column by column). */
static void ref_encrypt(const uint8_t *w, int rounds, const uint8_t in[16], uint8_t out[16]) {
  uint8_t s[16], t[16];
  for (int i = 0; i < 16; i++) s[i] = in[i] ^ w[i];
  for (int r = 1; r <= rounds; r++) {
    for (int i = 0; i < 16; i++) s[i] = sbox[s[i]];
    for (int c = 0; c < 4; c++)
      for (int row = 0; row < 4; row++) t[4 * c + row] = s[4 * ((c + row) % 4) + row];
    if (r < rounds) {
      for (int c = 0; c < 4; c++) {
        uint8_t *col = t + 4 * c, a0 = col[0], a1 = col[1], a2 = col[2], a3 = col[3];
        col[0] = gmul(a0, 2) ^ gmul(a1, 3) ^ a2 ^ a3;
        col[1] = a0 ^ gmul(a1, 2) ^ gmul(a2, 3) ^ a3;
        col[2] = a0 ^ a1 ^ gmul(a2, 2) ^ gmul(a3, 3);
        col[3] = gmul(a0, 3) ^ a1 ^ a2 ^ gmul(a3, 2);
      }
    }
    for (int i = 0; i < 16; i++) s[i] = t[i] ^ w[16 * r + i];
  }
  memcpy(out, s, 16);
}

static uint64_t be64(const uint8_t *p) {
  uint64_t v = 0;
  for (int i = 0; i < 8; i++) v = v << 8 | p[i];
  return v;
}

static void put_be64(uint8_t *p, uint64_t v) {
  for (int i = 7; i >= 0; i--, v >>= 8) p[i] = (uint8_t)v;
}

/* Algorithm 1: X·Y in GF(2^128), a bit at a time, both as two big-endian words. */
static void ref_gmul(uint64_t x[2], const uint64_t h[2]) {
  uint64_t z0 = 0, z1 = 0, v0 = h[0], v1 = h[1];
  for (int i = 0; i < 128; i++) {
    uint64_t bit = i < 64 ? x[0] >> (63 - i) & 1 : x[1] >> (127 - i) & 1;
    if (bit) {
      z0 ^= v0;
      z1 ^= v1;
    }
    uint64_t lsb = v1 & 1;
    v1 = v1 >> 1 | v0 << 63;
    v0 >>= 1;
    if (lsb) v0 ^= 0xe100000000000000ull;
  }
  x[0] = z0;
  x[1] = z1;
}

static void ref_ghash(uint64_t y[2], const uint64_t h[2], const uint8_t *data, size_t len) {
  for (size_t at = 0; at < len; at += 16) {
    uint8_t b[16] = {0};
    memcpy(b, data + at, len - at < 16 ? len - at : 16);
    y[0] ^= be64(b);
    y[1] ^= be64(b + 8);
    ref_gmul(y, h);
  }
}

static void ref_ctr(const uint8_t *w, int rounds, const uint8_t j0[16], const uint8_t *src, uint8_t *dst, size_t len) {
  uint8_t cb[16], ks[16];
  memcpy(cb, j0, 16);
  uint32_t c = (uint32_t)cb[12] << 24 | (uint32_t)cb[13] << 16 | (uint32_t)cb[14] << 8 | cb[15];
  for (size_t at = 0; at < len; at += 16) {
    c++;
    cb[12] = (uint8_t)(c >> 24), cb[13] = (uint8_t)(c >> 16), cb[14] = (uint8_t)(c >> 8), cb[15] = (uint8_t)c;
    ref_encrypt(w, rounds, cb, ks);
    for (size_t i = 0; i < 16 && at + i < len; i++) dst[at + i] = src[at + i] ^ ks[i];
  }
}

/* ---- The kernels, through their nish_array arguments ---------------------- */

static nish_array arr(void *p, uint64_t len) {
  return (nish_array){len, len, (char *)p};
}

/* A key's kernel schedule in an `8 * (rounds + 1)`-word array, as
   std/crypto/aes.ts allocates it, first filled with a pattern the schedule
   must overwrite. */
typedef struct {
  int rounds;
  uint64_t rk[120];
  nish_array a;
} kernel_key;

static void kernel_schedule(kernel_key *k, const uint8_t *key, int len) {
  k->rounds = len == 16 ? 10 : 14;
  uint64_t words = 8 * (uint64_t)(k->rounds + 1);
  memset(k->rk, 0xa5, sizeof k->rk);
  k->a = arr(k->rk, words);
  uint8_t kb[32];
  memcpy(kb, key, (size_t)len);
  nish_array ka = arr(kb, (uint64_t)len);
  nish_aes_schedule(&ka, k->rounds, &k->a);
}

static void kernel_ghash(kernel_key *k, uint64_t y[2], const uint64_t h[2], const uint8_t *data, size_t len) {
  nish_array ya = arr(y, 2), da = arr((void *)data, len);
  nish_aes_ghash(&ya, h[0], h[1], &k->a, &da, (int32_t)len);
}

/* A whole GCM seal with a 12-byte IV, from the kernels' four functions, as
   std/crypto/aes.ts composes its seams. */
static void kernel_seal(const uint8_t *key, int klen, const uint8_t iv[12], const uint8_t *aad, size_t alen,
                        const uint8_t *pt, size_t plen, uint8_t *ct, uint8_t tag[16]) {
  kernel_key k;
  kernel_schedule(&k, key, klen);
  uint8_t zero[16] = {0}, hb[16];
  nish_array za = arr(zero, 16), ha = arr(hb, 16);
  nish_aes_block(&k.a, k.rounds, &za, &ha);
  uint64_t h[2] = {be64(hb), be64(hb + 8)};
  uint8_t j0[16] = {0};
  memcpy(j0, iv, 12);
  j0[15] = 1;
  nish_array ja = arr(j0, 16), pa = arr((void *)pt, plen), ca = arr(ct, plen);
  nish_aes_ctr(&k.a, k.rounds, &ja, &pa, &ca, (int32_t)plen);
  uint64_t y[2] = {0, 0};
  kernel_ghash(&k, y, h, aad, alen);
  kernel_ghash(&k, y, h, ct, plen);
  uint8_t lens[16];
  put_be64(lens, (uint64_t)alen * 8);
  put_be64(lens + 8, (uint64_t)plen * 8);
  kernel_ghash(&k, y, h, lens, 16);
  uint8_t mask[16];
  nish_array ma = arr(mask, 16);
  nish_aes_block(&k.a, k.rounds, &ja, &ma);
  put_be64(tag, y[0] ^ be64(mask));
  put_be64(tag + 8, y[1] ^ be64(mask + 8));
}

/* The same seal, from the reference. */
static void ref_seal(const uint8_t *key, int klen, const uint8_t iv[12], const uint8_t *aad, size_t alen,
                     const uint8_t *pt, size_t plen, uint8_t *ct, uint8_t tag[16]) {
  uint8_t w[240], zero[16] = {0}, hb[16], j0[16] = {0}, mask[16], lens[16];
  int rounds = klen / 4 + 6;
  ref_expand(key, klen / 4, w);
  ref_encrypt(w, rounds, zero, hb);
  uint64_t h[2] = {be64(hb), be64(hb + 8)}, y[2] = {0, 0};
  memcpy(j0, iv, 12);
  j0[15] = 1;
  ref_ctr(w, rounds, j0, pt, ct, plen);
  ref_ghash(y, h, aad, alen);
  ref_ghash(y, h, ct, plen);
  put_be64(lens, (uint64_t)alen * 8);
  put_be64(lens + 8, (uint64_t)plen * 8);
  ref_ghash(y, h, lens, 16);
  ref_encrypt(w, rounds, j0, mask);
  put_be64(tag, y[0] ^ be64(mask));
  put_be64(tag + 8, y[1] ^ be64(mask + 8));
}

/* ---- Vectors ---------------------------------------------------------------- */

static size_t unhex(const char *hex, uint8_t *out) {
  size_t n = strlen(hex) / 2;
  for (size_t i = 0; i < n; i++) {
    unsigned v;
    sscanf(hex + 2 * i, "%2x", &v);
    out[i] = (uint8_t)v;
  }
  return n;
}

static int same(const char *what, const uint8_t *got, const uint8_t *want, size_t n) {
  if (memcmp(got, want, n) == 0) return 1;
  printf("FAIL %s:\n  got ", what);
  for (size_t i = 0; i < n; i++) printf("%02x", got[i]);
  printf("\n  want ");
  for (size_t i = 0; i < n; i++) printf("%02x", want[i]);
  printf("\n");
  return 0;
}

static long cases;
static int hw;

/* One block under `key`: the reference, and the kernel when this machine has it. */
static int block_vector(const char *name, const char *key, const char *pt, const char *ct, size_t n) {
  uint8_t k[32], p[16], want[16], got[16], w[240];
  int klen = (int)unhex(key, k);
  unhex(pt, p);
  unhex(ct, want);
  ref_expand(k, klen / 4, w);
  ref_encrypt(w, klen / 4 + 6, p, got);
  char label[96];
  snprintf(label, sizeof label, "%s, the reference", name);
  if (!same(label, got, want, n)) return 0;
  if (hw) {
    kernel_key kk;
    kernel_schedule(&kk, k, klen);
    nish_array pa = arr(p, 16), ga = arr(got, 16);
    nish_aes_block(&kk.a, kk.rounds, &pa, &ga);
    snprintf(label, sizeof label, "%s, the kernel", name);
    if (!same(label, got, want, n)) return 0;
  }
  cases++;
  return 1;
}

static int gcm_vector(const char *name, const char *key, const char *pt, const char *aad, const char *iv,
                      const char *ct, const char *tag) {
  static uint8_t k[32], p[64], a[32], v[12], wc[64], wt[16], gc[64], gt[16];
  int klen = (int)unhex(key, k);
  size_t plen = unhex(pt, p), alen = unhex(aad, a);
  unhex(iv, v);
  unhex(ct, wc);
  unhex(tag, wt);
  char label[96];
  ref_seal(k, klen, v, a, alen, p, plen, gc, gt);
  snprintf(label, sizeof label, "%s ciphertext, the reference", name);
  if (!same(label, gc, wc, plen)) return 0;
  snprintf(label, sizeof label, "%s tag, the reference", name);
  if (!same(label, gt, wt, 16)) return 0;
  if (hw) {
    kernel_seal(k, klen, v, a, alen, p, plen, gc, gt);
    snprintf(label, sizeof label, "%s ciphertext, the kernel", name);
    if (!same(label, gc, wc, plen)) return 0;
    snprintf(label, sizeof label, "%s tag, the kernel", name);
    if (!same(label, gt, wt, 16)) return 0;
  }
  cases++;
  return 1;
}

static int vectors(void) {
  static const char *p64 =
      "d9313225f88406e5a55909c5aff5269a86a7a9531534f7da2e4c303d8a318a72"
      "1c3c0c95956809532fcf0e2449a6b525b16aedf5aa0de657ba637b391aafd255";
  static const char *p60 =
      "d9313225f88406e5a55909c5aff5269a86a7a9531534f7da2e4c303d8a318a72"
      "1c3c0c95956809532fcf0e2449a6b525b16aedf5aa0de657ba637b39";
  static const char *aad = "feedfacedeadbeeffeedfacedeadbeefabaddad2";
  static const char *k3 = "feffe9928665731c6d6a8f9467308308";
  static const char *k15 = "feffe9928665731c6d6a8f9467308308feffe9928665731c6d6a8f9467308308";
  static const char *iv = "cafebabefacedbaddecaf888";
  static const char *z12 = "000000000000000000000000";
  static const char *z16 = "00000000000000000000000000000000";
  static const char *z32 = "0000000000000000000000000000000000000000000000000000000000000000";
  return block_vector("FIPS 197 C.1", "000102030405060708090a0b0c0d0e0f", "00112233445566778899aabbccddeeff",
                      "69c4e0d86a7b0430d8cdb78070b4c55a", 16) &&
         block_vector("FIPS 197 C.3", "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
                      "00112233445566778899aabbccddeeff", "8ea2b7ca516745bfeafc49904b496089", 16) &&
         block_vector("RFC 9001 A.2's header mask", "9f50449e04a0e810283a1e9933adedd2",
                      "d1b1c98dd7689fb8ec11d242b123dc9b", "437b9aec36", 5) &&
         block_vector("RFC 9001 A.3's header mask", "c206b8d9b9f0f37644430b490eeaa314",
                      "2cd0991cd25b0aac406a5816b6394100", "2ec0d8356a", 5) &&
         gcm_vector("GCM test case 1", z16, "", "", z12, "", "58e2fccefa7e3061367f1d57a4e7455a") &&
         gcm_vector("GCM test case 2", z16, z16, "", z12, "0388dace60b6a392f328c2b971b2fe78",
                    "ab6e47d42cec13bdf53a67b21257bddf") &&
         gcm_vector("GCM test case 3", k3, p64, "", iv,
                    "42831ec2217774244b7221b784d0d49ce3aa212f2c02a4e035c17e2329aca12e"
                    "21d514b25466931c7d8f6a5aac84aa051ba30b396a0aac973d58e091473f5985",
                    "4d5c2af327cd64a62cf35abd2ba6fab4") &&
         gcm_vector("GCM test case 4", k3, p60, aad, iv,
                    "42831ec2217774244b7221b784d0d49ce3aa212f2c02a4e035c17e2329aca12e"
                    "21d514b25466931c7d8f6a5aac84aa051ba30b396a0aac973d58e091",
                    "5bc94fbc3221a5db94fae95ae7121a47") &&
         gcm_vector("GCM test case 13", z32, "", "", z12, "", "530f8afbc74536b9a963b4f1c4cb738b") &&
         gcm_vector("GCM test case 14", z32, z16, "", z12, "cea7403d4d606b6e074ec5d3baf39d18",
                    "d0d1c8a799996bf0265b98b5d48ab919") &&
         gcm_vector("GCM test case 15", k15, p64, "", iv,
                    "522dc1f099567d07f47f37a32a84427d643a8cdcbfe5c0c97598a2bd2555d1aa"
                    "8cb08e48590dbb3da7b08b1056828838c5f61e6393ba7a0abcc9f662898015ad",
                    "b094dac5d93471bdec1a502270e3cc6c") &&
         gcm_vector("GCM test case 16", k15, p60, aad, iv,
                    "522dc1f099567d07f47f37a32a84427d643a8cdcbfe5c0c97598a2bd2555d1aa"
                    "8cb08e48590dbb3da7b08b1056828838c5f61e6393ba7a0abcc9f662",
                    "76fc6ece0f4e1768cddf8853bb2d551b");
}

/* ---- The fuzzed corpus ------------------------------------------------------ */

static uint64_t rng_state;

/* xorshift64*: the corpus is a function of the seed, so a failure printed with
   its seed is a failure anyone can rerun. */
static uint64_t rnd(void) {
  rng_state ^= rng_state >> 12;
  rng_state ^= rng_state << 25;
  rng_state ^= rng_state >> 27;
  return rng_state * 2685821657736338717ull;
}

static void fill(uint8_t *p, size_t n) {
  for (size_t i = 0; i < n; i++) p[i] = (uint8_t)rnd();
}

#define MAX_LEN 4096

/* What `fuzz_one` puts in J0's counter: random, within 300 of 2^32, or pinned. */
#define COUNTER_RANDOM (-1)
#define COUNTER_NEAR_WRAP (-2)

/* One key, one J0, one length: the schedule's standard part and its zeroed
   tail, GCTR out of place and in place, and GHASH from a random state, each
   against the reference. `src` and `dst` are as long as `len` and no longer,
   so a kernel that wrote past the length writes past an allocation. `counter`
   is J0's last four bytes, or one of the two kinds above. */
static int fuzz_one(uint64_t seed, int klen, size_t len, int64_t counter) {
  uint8_t key[32], w[240], j0[16];
  fill(key, (size_t)klen);
  fill(j0, 16);
  if (counter != COUNTER_RANDOM) {
    uint32_t c = counter == COUNTER_NEAR_WRAP ? 0xffffffffu - (uint32_t)(rnd() % 300) : (uint32_t)counter;
    j0[12] = (uint8_t)(c >> 24), j0[13] = (uint8_t)(c >> 16), j0[14] = (uint8_t)(c >> 8), j0[15] = (uint8_t)c;
  }
  int rounds = klen / 4 + 6;
  ref_expand(key, klen / 4, w);
  kernel_key k;
  kernel_schedule(&k, key, klen);
  const uint8_t *kb = (const uint8_t *)k.rk;
  for (size_t i = 16 * (size_t)(rounds + 1); i < 8 * k.a.len; i++) {
    if ((i < NISH_AES_HPOW || i >= NISH_AES_HEND) && kb[i] != 0) {
      printf("FAIL seed %llu: the schedule left byte %zu of rk nonzero (key %d bytes)\n", (unsigned long long)seed, i,
             klen);
      return 0;
    }
  }
  if (memcmp(kb, w, 16 * (size_t)(rounds + 1)) != 0) {
    printf("FAIL seed %llu: the kernel's key schedule differs from FIPS 197's (key %d bytes)\n",
           (unsigned long long)seed, klen);
    return 0;
  }

  uint8_t *src = malloc(len + 1), *want = malloc(len + 1), *got = malloc(len + 1);
  fill(src, len);
  ref_ctr(w, rounds, j0, src, want, len);
  nish_array ja = arr(j0, 16), sa = arr(src, len), ga = arr(got, len);
  nish_aes_ctr(&k.a, rounds, &ja, &sa, &ga, (int32_t)len);
  int ok = memcmp(got, want, len) == 0;
  /* In place: dst is src. */
  memcpy(got, src, len);
  nish_aes_ctr(&k.a, rounds, &ja, &ga, &ga, (int32_t)len);
  ok = ok && memcmp(got, want, len) == 0;
  if (!ok) {
    printf("FAIL seed %llu: GCTR of %zu bytes differs (key %d bytes, J0 counter %02x%02x%02x%02x)\n",
           (unsigned long long)seed, len, klen, j0[12], j0[13], j0[14], j0[15]);
    return 0;
  }

  uint8_t zero[16] = {0}, hb[16];
  ref_encrypt(w, rounds, zero, hb);
  uint64_t h[2] = {be64(hb), be64(hb + 8)};
  uint64_t y0 = rnd(), y1 = rnd();
  uint64_t ry[2] = {y0, y1}, ky[2] = {y0, y1};
  ref_ghash(ry, h, src, len);
  kernel_ghash(&k, ky, h, src, len);
  if (ry[0] != ky[0] || ry[1] != ky[1]) {
    printf("FAIL seed %llu: GHASH of %zu bytes differs (key %d bytes): %016llx%016llx, the reference %016llx%016llx\n",
           (unsigned long long)seed, len, klen, (unsigned long long)ky[0], (unsigned long long)ky[1],
           (unsigned long long)ry[0], (unsigned long long)ry[1]);
    return 0;
  }
  free(src);
  free(want);
  free(got);
  cases++;
  return 1;
}

/* A whole seal with random AAD and plaintext, the kernels against the reference. */
static int fuzz_seal(uint64_t seed) {
  static uint8_t key[32], iv[12], aad[300], pt[2000], c1[2000], c2[2000];
  uint8_t t1[16], t2[16];
  int klen = rnd() & 1 ? 32 : 16;
  size_t alen = rnd() % sizeof aad, plen = rnd() % sizeof pt;
  fill(key, sizeof key);
  fill(iv, sizeof iv);
  fill(aad, alen);
  fill(pt, plen);
  ref_seal(key, klen, iv, aad, alen, pt, plen, c1, t1);
  kernel_seal(key, klen, iv, aad, alen, pt, plen, c2, t2);
  if (memcmp(c1, c2, plen) != 0 || memcmp(t1, t2, 16) != 0) {
    printf("FAIL seed %llu: a seal of %zu bytes with %zu of AAD differs (key %d bytes)\n", (unsigned long long)seed,
           plen, alen, klen);
    return 0;
  }
  cases++;
  return 1;
}

/* ---- The resolver ----------------------------------------------------------- */

static int resolves(const char *pin, int want) {
  if (pin == NULL) {
    unsetenv("NISH_AES");
  } else {
    setenv("NISH_AES", pin, 1);
  }
  __atomic_store_n(&nish_aes_answer, 0, __ATOMIC_RELAXED);
  int got = nish_aes_hw();
  /* Fixed once answered: a later change of the environment is not read. */
  setenv("NISH_AES", want ? "soft" : "hw", 1);
  if (got != want || nish_aes_hw() != want) {
    printf("FAIL resolver: NISH_AES=%s answered %d, not %d\n", pin ? pin : "<unset>", got, want);
    return 0;
  }
  return 1;
}

int main(int argc, char **argv) {
  uint64_t seed = argc > 1 ? strtoull(argv[1], NULL, 10) : 20261011;
  rng_state = seed | 1;
  sbox_init();

  const char *path;
  hw = nish_aes_cpu();
#if defined(NISH_AES_X86)
  /* The runtime's detector against libgcc's, which the runtime avoids only for
     its start-up constructor and which costs nothing here. A detector that
     wrongly answered no would otherwise drop the kernels from this run
     without a failure. */
  __builtin_cpu_init();
  int libgcc = __builtin_cpu_supports("aes") && __builtin_cpu_supports("pclmul") && __builtin_cpu_supports("ssse3");
  if (hw != libgcc) {
    printf("FAIL detector: nish_aes_cpu says %d, __builtin_cpu_supports says %d\n", hw, libgcc);
    return 1;
  }
  path = hw ? "aesni-pclmul" : "the reference alone (aesni-pclmul SKIPPED: this CPU has no AES-NI and PCLMULQDQ)";
#else
  path = hw ? "armv8-aes-pmull"
            : "the reference alone (armv8-aes-pmull SKIPPED: this CPU reports no AES and PMULL)";
#endif

  if (!vectors()) return 1;
  if (hw) {
    /* Every length up to 4,096 once, with the key size alternating and every
       third J0 near the wrap; then random lengths, keys and states. */
    for (size_t len = 0; len <= MAX_LEN; len++)
      for (int klen = 16; klen <= 32; klen += 16)
        if (!fuzz_one(seed, klen, len, len % 3 == 0 ? COUNTER_NEAR_WRAP : COUNTER_RANDOM)) return 1;
    /* The wrap pinned rather than left to the draw: GCTR's block n takes the
       counter J0 + n + 1, so these counters wrap at blocks 0, 1, 2, 4 and 6 --
       on a four-block batch's first block, inside one, and inside the second --
       over lengths of one block to many, partial last blocks among them. */
    static const uint32_t wraps[] = {0xffffffffu, 0xfffffffeu, 0xfffffffdu, 0xfffffffbu, 0xfffffff9u};
    static const size_t wrap_lengths[] = {16, 33, 64, 100, 128, 200, 1000};
    for (size_t w = 0; w < sizeof wraps / sizeof wraps[0]; w++)
      for (size_t l = 0; l < sizeof wrap_lengths / sizeof wrap_lengths[0]; l++)
        for (int klen = 16; klen <= 32; klen += 16)
          if (!fuzz_one(seed, klen, wrap_lengths[l], wraps[w])) return 1;
    /* Each draw in a statement of its own: the order arguments are evaluated
       in is unspecified, and the corpus must be a function of the seed alone. */
    for (int trial = 0; trial < 2000; trial++) {
      int klen = rnd() & 1 ? 32 : 16;
      size_t len = rnd() % (MAX_LEN + 1);
      int64_t counter = rnd() & 1 ? COUNTER_NEAR_WRAP : COUNTER_RANDOM;
      if (!fuzz_one(seed, klen, len, counter)) return 1;
    }
    for (int trial = 0; trial < 500; trial++)
      if (!fuzz_seal(seed)) return 1;
  }

  /* The pin, and the best this machine has for no pin, `hw`, and a value it
     does not know. */
  if (!resolves("soft", 0) || !resolves(NULL, hw) || !resolves("hw", hw) || !resolves("softer", hw)) return 1;

  printf("aes-gcm: %ld cases agree across %s; the resolver picks every pin\n", cases, path);
  return 0;
}
