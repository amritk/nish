// Microkernel: the bcrypt cost loop's BF_body (521 blocks over the state),
// for W interleaved lanes, each lane a separate 1042-word state.
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#ifndef W
#define W 1
#endif
#define STW 1042
static uint32_t st[W][STW] __attribute__((aligned(64)));
#define F(S, x) ((((S)[18 + ((x) >> 24)] + (S)[274 + (((x) >> 16) & 0xff)]) ^ (S)[530 + (((x) >> 8) & 0xff)]) + (S)[786 + ((x) & 0xff)])
__attribute__((noinline)) static void body(void) {
  uint32_t l[W], r[W];
  for (int k = 0; k < W; k++) l[k] = r[k] = 0;
  for (int i = 0; i < STW; i += 2) {
    for (int k = 0; k < W; k++) l[k] ^= st[k][0];
    for (int n = 1; n < 17; n += 2) {
#pragma clang loop unroll(full)
      for (int k = 0; k < W; k++) r[k] ^= st[k][n] ^ F(st[k], l[k]);
#pragma clang loop unroll(full)
      for (int k = 0; k < W; k++) l[k] ^= st[k][n + 1] ^ F(st[k], r[k]);
    }
    for (int k = 0; k < W; k++) {
      uint32_t t = r[k]; r[k] = l[k]; l[k] = t ^ st[k][17];
      st[k][i] = l[k]; st[k][i + 1] = r[k];
    }
  }
}
int main(int argc, char **argv) {
  int cost = argc > 1 ? atoi(argv[1]) : 10;
  srand(1);
  for (int k = 0; k < W; k++) for (int i = 0; i < STW; i++) st[k][i] = rand() * 2654435761u;
  struct timespec a, b;
  clock_gettime(CLOCK_PROCESS_CPUTIME_ID, &a);
  long bodies = 2L << cost;
  for (long j = 0; j < bodies; j++) body();
  clock_gettime(CLOCK_PROCESS_CPUTIME_ID, &b);
  double ns = (b.tv_sec - a.tv_sec) * 1e9 + (b.tv_nsec - a.tv_nsec);
  // per hash: bodies x 521 blocks per lane ~= the 2^cost x 1042 blocks (+713 ignored)
  printf("W=%d %.3f ms/hash-equiv  %.2f ns/block/lane  chk=%08x\n", W, ns / 1e6 / W, ns / (bodies * 521.0 * W), st[0][5]);
  return 0;
}
