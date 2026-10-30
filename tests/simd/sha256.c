/* The agreement test for runtime/runtime-sha256.c: the SHA-256 kernel this
 * machine has -- SHA-NI on x86-64, the ARMv8 SHA-256 instructions on AArch64 --
 * answers exactly as a textbook block function does, `nish_sha256_compress`
 * refuses every block `sha256Compress`'s guard refuses, and `nish_sha256_hw`
 * answers what `NISH_SHA256` and the CPU say it should.
 *
 * The reference is FIPS 180-4 §6.2.2 written out word by word. It is first held
 * to published digests, so the kernel is compared with something known to be
 * right: FIPS 180-4's examples (NIST's "SHA-256" example file: "abc" and the
 * 448-bit two-block message), the empty message, the 896-bit message and a
 * million 'a's (the NIST CAVP set's long messages). The same digests are then
 * computed with the kernel as the block function.
 *
 * Then a seeded corpus: 20,000 random states and blocks at random offsets in
 * a buffer, through both, with the state compared word for word; and the
 * guard's edges (`at` at -1, 0, the last offset that fits and one past it,
 * short `h` and `w`), each of which must leave the state untouched and answer
 * 0.
 *
 * The runtime file is included rather than linked, as tests/simd/aes-gcm.c
 * includes runtime-aes.c, so the resolver's stored answer can be reset and
 * asked again under each pin.
 *
 *   sha256 [seed]   prints one summary line and exits 0, or names the first
 *                   case a path got wrong and exits 1
 */
#define _DEFAULT_SOURCE /* setenv under -std=c11 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "../../runtime/runtime-sha256.c"

/* ---- The reference --------------------------------------------------------- */

static uint32_t rotr(uint32_t x, int n) {
  return (x >> n) | (x << (32 - n));
}

static void ref_block(uint32_t h[8], const uint8_t *in) {
  uint32_t w[64];
  for (int t = 0; t < 16; t++)
    w[t] = (uint32_t)in[4 * t] << 24 | (uint32_t)in[4 * t + 1] << 16 | (uint32_t)in[4 * t + 2] << 8 | in[4 * t + 3];
  for (int t = 16; t < 64; t++) {
    uint32_t s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >> 3);
    uint32_t s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >> 10);
    w[t] = s1 + w[t - 7] + s0 + w[t - 16];
  }
  uint32_t a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
  for (int t = 0; t < 64; t++) {
    uint32_t t1 = hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + nish_sha256_k[t] + w[t];
    uint32_t t2 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c));
    hh = g, g = f, f = e, e = d + t1, d = c, c = b, b = a, a = t1 + t2;
  }
  h[0] += a, h[1] += b, h[2] += c, h[3] += d, h[4] += e, h[5] += f, h[6] += g, h[7] += hh;
}

/* The kernel as a block function, through the arrays the compiler hands it. */
static uint32_t schedule[64];

static void hw_block(uint32_t h[8], const uint8_t *in) {
  nish_array ha = {8, 8, (char *)h};
  nish_array wa = {64, 64, (char *)schedule};
  nish_array src = {64, 64, (char *)in};
  if (nish_sha256_compress(&ha, &wa, &src, 0) != 1) {
    printf("FAIL kernel: refused a block inside its buffer\n");
    exit(1);
  }
}

typedef void (*block_fn)(uint32_t h[8], const uint8_t *in);

/* The whole hash of §5.1.1 and §6.2 over `len` bytes of `msg`, or of a million
   'a's when `msg` is NULL, with `block` as its block function. */
static void digest(block_fn block, const uint8_t *msg, size_t len, uint8_t out[32]) {
  uint32_t h[8] = {0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19};
  uint8_t buf[64];
  size_t fill = 0;
  for (size_t i = 0; i < len; i++) {
    buf[fill++] = msg ? msg[i] : 'a';
    if (fill == 64) block(h, buf), fill = 0;
  }
  buf[fill++] = 0x80;
  if (fill > 56) {
    while (fill < 64) buf[fill++] = 0;
    block(h, buf), fill = 0;
  }
  while (fill < 56) buf[fill++] = 0;
  uint64_t bits = (uint64_t)len * 8;
  for (int i = 0; i < 8; i++) buf[56 + i] = (uint8_t)(bits >> (56 - 8 * i));
  block(h, buf);
  for (int i = 0; i < 8; i++)
    for (int j = 0; j < 4; j++) out[4 * i + j] = (uint8_t)(h[i] >> (24 - 8 * j));
}

/* ---- The vectors ------------------------------------------------------------ */

static long cases;

static int vector(const char *name, const char *msg, size_t len, const char *want, int hw) {
  uint8_t out[32];
  char hex[65];
  for (int path = 0; path <= hw; path++) {
    digest(path ? hw_block : ref_block, (const uint8_t *)msg, len, out);
    for (int i = 0; i < 32; i++) snprintf(hex + 2 * i, 3, "%02x", out[i]);
    if (strcmp(hex, want) != 0) {
      printf("FAIL vector %s (%s): %s, not %s\n", name, path ? "kernel" : "reference", hex, want);
      return 0;
    }
    cases++;
  }
  return 1;
}

static int vectors(int hw) {
  static const char m448[] = "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq";
  static const char m896[] = "abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu";
  return vector("empty", "", 0, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", hw) &&
         vector("abc", "abc", 3, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", hw) &&
         vector("448 bits", m448, sizeof m448 - 1, "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1", hw) &&
         vector("896 bits", m896, sizeof m896 - 1, "cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1", hw) &&
         vector("a million a", NULL, 1000000, "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0", hw);
}

/* ---- The corpus ------------------------------------------------------------- */

static uint64_t rng_state;

static uint32_t rnd(void) {
  rng_state ^= rng_state << 13;
  rng_state ^= rng_state >> 7;
  rng_state ^= rng_state << 17;
  return (uint32_t)(rng_state >> 16);
}

#define BUF 320

static int fuzz_one(uint64_t seed, int trial) {
  uint8_t buf[BUF];
  uint32_t ref[8], got[8];
  for (int i = 0; i < BUF; i++) buf[i] = (uint8_t)rnd();
  for (int i = 0; i < 8; i++) ref[i] = got[i] = rnd();
  int32_t at = (int32_t)(rnd() % (BUF - 64 + 1));
  ref_block(ref, buf + at);
  nish_array ha = {8, 8, (char *)got};
  nish_array wa = {64, 64, (char *)schedule};
  nish_array src = {BUF, BUF, (char *)buf};
  if (nish_sha256_compress(&ha, &wa, &src, at) != 1 || memcmp(ref, got, sizeof ref) != 0) {
    printf("FAIL seed %llu: trial %d, the block at %d differs from the reference\n", (unsigned long long)seed, trial,
           at);
    return 0;
  }
  cases++;
  return 1;
}

/* One call the guard must refuse: the answer 0 and the state as it was. */
static int refuses(const char *what, uint64_t hlen, uint64_t wlen, uint64_t srclen, int32_t at) {
  uint8_t buf[BUF] = {0};
  uint32_t h[8] = {1, 2, 3, 4, 5, 6, 7, 8};
  nish_array ha = {hlen, 8, (char *)h};
  nish_array wa = {wlen, 64, (char *)schedule};
  nish_array src = {srclen, BUF, (char *)buf};
  int32_t r = nish_sha256_compress(&ha, &wa, &src, at);
  for (int i = 0; i < 8; i++)
    if (h[i] != (uint32_t)i + 1) r = -1;
  if (r != 0) {
    printf("FAIL guard: %s was not refused untouched (answered %d)\n", what, r);
    return 0;
  }
  cases++;
  return 1;
}

static int edges(void) {
  uint8_t buf[BUF] = {0};
  uint32_t h[8] = {0};
  nish_array ha = {8, 8, (char *)h};
  nish_array wa = {64, 64, (char *)schedule};
  nish_array src = {100, BUF, (char *)buf};
  if (nish_sha256_compress(&ha, &wa, &src, 36) != 1 || nish_sha256_compress(&ha, &wa, &src, 0) != 1) {
    printf("FAIL guard: a block that fits, at 0 or at the last offset, was refused\n");
    return 0;
  }
  cases += 2;
  return refuses("at -1", 8, 64, 100, -1) && refuses("one past the last offset", 8, 64, 100, 37) &&
         refuses("a source of 63 bytes", 8, 64, 63, 0) && refuses("an empty source", 8, 64, 0, 0) &&
         refuses("a state of seven words", 7, 64, 100, 0) && refuses("a schedule of 63 words", 8, 63, 100, 0) &&
         refuses("at INT32_MIN", 8, 64, 100, INT32_MIN);
}

/* ---- The resolver ----------------------------------------------------------- */

static int resolves(const char *pin, int want) {
  if (pin == NULL) {
    unsetenv("NISH_SHA256");
  } else {
    setenv("NISH_SHA256", pin, 1);
  }
  __atomic_store_n(&nish_sha256_answer, 0, __ATOMIC_RELAXED);
  int got = nish_sha256_hw();
  /* Fixed once answered: a later change of the environment is not read. */
  setenv("NISH_SHA256", want ? "soft" : "hw", 1);
  if (got != want || nish_sha256_hw() != want) {
    printf("FAIL resolver: NISH_SHA256=%s answered %d, not %d\n", pin ? pin : "<unset>", got, want);
    return 0;
  }
  return 1;
}

int main(int argc, char **argv) {
  uint64_t seed = argc > 1 ? strtoull(argv[1], NULL, 10) : 20261030;
  rng_state = seed | 1;

  const char *path;
  int hw = nish_sha256_cpu();
#if defined(NISH_SHA256_X86)
  /* No second detector to hold this one to: clang's `__builtin_cpu_supports`
     knows no "sha". tests/run.js holds the path this line names to the flags
     /proc/cpuinfo lists instead, so a detector that wrongly answered no fails
     there. */
  path = hw ? "sha-ni" : "the reference alone (sha-ni SKIPPED: this CPU has no SHA extensions)";
#else
  path = hw ? "armv8-sha2" : "the reference alone (armv8-sha2 SKIPPED: this CPU reports no SHA-256 instructions)";
#endif

  if (!vectors(hw)) return 1;
  if (hw) {
    for (int trial = 0; trial < 20000; trial++)
      if (!fuzz_one(seed, trial)) return 1;
    if (!edges()) return 1;
  }

  /* The pin, and the best this machine has for no pin, `hw`, and a value it
     does not know. */
  if (!resolves("soft", 0) || !resolves(NULL, hw) || !resolves("hw", hw) || !resolves("softer", hw)) return 1;

  printf("sha256: %ld cases agree across %s; the resolver picks every pin\n", cases, path);
  return 0;
}
