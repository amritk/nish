/*
 * The ceiling harness: a bcrypt cost-loop body on W lanes, checked against a
 * plain C reference and then timed. Built with -DW=<lanes> and either a
 * kernel from gen.mjs (which defines body_hand) or -DC_BODY, which compiles
 * the same interleave in C (the lanes' half-rounds side by side, as
 * bcryptBodyN has them) for what a C compiler makes of it.
 *
 *   harness check             3 bodies on a random state, compared word for
 *                             word with the reference; prints "ok", or the
 *                             first differing word and exits 1
 *   harness time <cost> <n>   the bodies of n hashes at <cost> on each of the
 *                             W lanes, then a checksum of the state
 *
 * A hash's bodies are its 2^(cost+1) + 1 key expansions of 521 blocks; the
 * 192 blocks that encrypt the magic string and the key mixing between bodies
 * are left out, under 0.1% of a hash at cost 10. The state is random words,
 * not pi: a body's time does not depend on the values.
 */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#ifndef W
#error "build with -DW=<lanes>"
#endif
#define WORDS 1042

static uint32_t st[W * WORDS] __attribute__((aligned(64)));
static uint32_t ref[W * WORDS];

#define F(S, x) \
  ((((S)[18 + ((x) >> 24)] + (S)[274 + (((x) >> 16) & 0xff)]) ^ (S)[530 + (((x) >> 8) & 0xff)]) + (S)[786 + ((x) & 0xff)])

/* One lane, one block at a time: Blowfish's 16 rounds over the block. */
static void body_ref(uint32_t *s) {
  uint32_t l = 0, r = 0;
  for (int i = 0; i < WORDS; i += 2) {
    l ^= s[0];
    for (int n = 1; n < 17; n += 2) {
      r ^= s[n] ^ F(s, l);
      l ^= s[n + 1] ^ F(s, r);
    }
    uint32_t t = r;
    r = l;
    l = t ^ s[17];
    s[i] = l;
    s[i + 1] = r;
  }
}

#ifdef C_BODY
__attribute__((noinline)) static void body_hand(uint32_t *s) {
  uint32_t l[W] = {0}, r[W] = {0};
  for (int i = 0; i < WORDS; i += 2) {
    for (int k = 0; k < W; k++) l[k] ^= s[WORDS * k];
    for (int n = 1; n < 17; n += 2) {
#pragma clang loop unroll(full)
#pragma GCC unroll 6
      for (int k = 0; k < W; k++) r[k] ^= s[WORDS * k + n] ^ F(s + WORDS * k, l[k]);
#pragma clang loop unroll(full)
#pragma GCC unroll 6
      for (int k = 0; k < W; k++) l[k] ^= s[WORDS * k + n + 1] ^ F(s + WORDS * k, r[k]);
    }
    for (int k = 0; k < W; k++) {
      uint32_t t = r[k];
      r[k] = l[k];
      l[k] = t ^ s[WORDS * k + 17];
      s[WORDS * k + i] = l[k];
      s[WORDS * k + i + 1] = r[k];
    }
  }
}
#else
void body_hand(uint32_t *s);
#endif

int main(int argc, char **argv) {
  srand(1);
  for (int i = 0; i < W * WORDS; i++) st[i] = (uint32_t)rand() * 2654435761u + (uint32_t)i;
  if (argc == 2 && strcmp(argv[1], "check") == 0) {
    memcpy(ref, st, sizeof st);
    for (int j = 0; j < 3; j++) {
      body_hand(st);
      for (int k = 0; k < W; k++) body_ref(ref + WORDS * k);
    }
    for (int i = 0; i < W * WORDS; i++) {
      if (st[i] != ref[i]) {
        printf("lane %d word %d: %08x, the reference %08x\n", i / WORDS, i % WORDS, st[i], ref[i]);
        return 1;
      }
    }
    puts("ok");
    return 0;
  }
  if (argc != 4 || strcmp(argv[1], "time") != 0) {
    fputs("usage: harness check | harness time <cost> <hashes>\n", stderr);
    return 2;
  }
  long bodies = ((2L << atoi(argv[2])) + 1) * atol(argv[3]);
  for (long j = 0; j < bodies; j++) body_hand(st);
  uint32_t sum = 0;
  for (int i = 0; i < W * WORDS; i++) sum = sum * 31 + st[i];
  printf("%08x\n", sum);
  return 0;
}
