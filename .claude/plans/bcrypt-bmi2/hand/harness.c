#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#define STW 1042
static uint32_t st[W][STW] __attribute__((aligned(64))), ref[W][STW];
void body_hand(uint32_t *s);
#define F(S, x) ((((S)[18 + ((x) >> 24)] + (S)[274 + (((x) >> 16) & 0xff)]) ^ (S)[530 + (((x) >> 8) & 0xff)]) + (S)[786 + ((x) & 0xff)])
static void body_ref(uint32_t *S) {
  uint32_t l = 0, r = 0;
  for (int i = 0; i < STW; i += 2) {
    l ^= S[0];
    for (int n = 1; n < 17; n += 2) { r ^= S[n] ^ F(S, l); l ^= S[n + 1] ^ F(S, r); }
    uint32_t t = r; r = l; l = t ^ S[17]; S[i] = l; S[i + 1] = r;
  }
}
int main(int argc, char **argv) {
  int cost = argc > 1 ? atoi(argv[1]) : 10;
  srand(1);
  for (int k = 0; k < W; k++) for (int i = 0; i < STW; i++) st[k][i] = rand() * 2654435761u + k;
  memcpy(ref, st, sizeof st);
  for (int j = 0; j < 3; j++) { body_hand(&st[0][0]); for (int k = 0; k < W; k++) body_ref(ref[k]); }
  if (memcmp(ref, st, sizeof st)) { puts("MISMATCH"); return 1; }
  struct timespec a, b;
  clock_gettime(CLOCK_PROCESS_CPUTIME_ID, &a);
  long bodies = 2L << cost;
  for (long j = 0; j < bodies; j++) body_hand(&st[0][0]);
  clock_gettime(CLOCK_PROCESS_CPUTIME_ID, &b);
  double ns = (b.tv_sec - a.tv_sec) * 1e9 + (b.tv_nsec - a.tv_nsec);
  printf("W=%d ok %.3f ms/hash-equiv/lane %.2f ns/block/lane\n", W, ns / 1e6 / W, ns / (bodies * 521.0 * W));
  return 0;
}
