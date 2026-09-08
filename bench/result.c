/* C twin of result.ts: same shape, same checksum line. `Result` is the
 * eight-byte struct `statictsc --emit-header` declares for
 * `Result<number, number>`, which clang returns and passes in one register. */
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>

#define N 200000000 /* bench:n */

typedef struct {
  int32_t ok; /* 1 = value, 0 = error */
  union {
    int32_t value;
    int32_t error;
  } as;
} Result;

static Result half(int32_t n) {
  Result r;
  if (n % 2 != 0) {
    r.ok = 0;
    r.as.error = n;
    return r;
  }
  r.ok = 1;
  r.as.value = n / 2;
  return r;
}

static int32_t combine(Result r) {
  if (!r.ok) {
    return -1;
  }
  return r.as.value;
}

int main(void) {
  int32_t acc = 0;
  for (int32_t i = 0; i < N; i++) {
    acc = (acc + combine(half((i + acc) & 0xffff))) & 0xffff;
  }
  printf("%d\n", acc);
  return 0;
}
