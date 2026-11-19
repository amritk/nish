/* Driver for ffi_array_field: the same struct as the `declare class`, shaped
 * like OpenSSL's SHA_CTX, so an array element or a scalar after one that the
 * two sides place differently reads back wrong. */
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>

struct ShaCtx {
  uint8_t tag;
  uint32_t h[5];
  uint64_t total;
  uint16_t num;
  uint8_t data[3];
  double last;
};

void fillCtx(struct ShaCtx *c) {
  c->tag = 3;
  c->h[0] = 0x01010101;
  c->h[1] = 0x02020202;
  c->h[2] = 0x03030303;
  c->h[3] = 0x04040404;
  c->h[4] = 0xf5f5f5f5;
  c->total = 1000;
  c->num = 20;
  c->data[0] = 0x11;
  c->data[1] = 0x22;
  c->data[2] = 0xf3;
  c->last = 0.25;
}

/* One bit per field or element: set when it holds what `written` stores. A
 * zeroed instance sets none. */
int32_t checkCtx(const struct ShaCtx *c) {
  int32_t bits = 0;
  bits |= (c->tag == 1) << 0;
  bits |= (c->h[0] == 0x67452301u) << 1;
  bits |= (c->h[1] == 0xefcdab89u) << 2;
  bits |= (c->h[2] == 0x98badcfeu) << 3;
  bits |= (c->h[3] == 0x10325476u) << 4;
  bits |= (c->h[4] == 0xc3d2e1f0u) << 5;
  bits |= (c->total == 64) << 6;
  bits |= (c->num == 7) << 7;
  bits |= (c->data[0] == 0xaa) << 8;
  bits |= (c->data[1] == 0xbb) << 9;
  bits |= (c->data[2] == 0xcc) << 10;
  bits |= (c->last == 0.5) << 11;
  return bits;
}

uint32_t readH(int32_t i);
uint8_t readData(int32_t i);
double readScalars(void);
int32_t zeroed(void);
int32_t written(void);

int main(void) {
  printf("sizeof ShaCtx %zu: tag %zu, h %zu, total %zu, num %zu, data %zu, last %zu\n", sizeof(struct ShaCtx),
         offsetof(struct ShaCtx, tag), offsetof(struct ShaCtx, h), offsetof(struct ShaCtx, total),
         offsetof(struct ShaCtx, num), offsetof(struct ShaCtx, data), offsetof(struct ShaCtx, last));
  for (int32_t i = 0; i < 5; i++) {
    printf("h[%d] %x\n", i, (unsigned)readH(i));
  }
  for (int32_t i = 0; i < 3; i++) {
    printf("data[%d] %x\n", i, (unsigned)readData(i));
  }
  printf("scalars %g\n", readScalars());
  printf("zeroed %x\n", zeroed());
  printf("written %x\n", written());
  return 0;
}
