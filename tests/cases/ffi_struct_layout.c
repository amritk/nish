/* Driver for ffi_struct_layout: the same structs as the `declare class`es, so
 * any field the two sides place differently reads back wrong. */
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>

struct Inner {
  uint16_t tag;
  void *link;
};

struct Mixed {
  uint8_t a;
  uint64_t b;
  int32_t c;
  double d;
  uint16_t e;
  void *p;
  struct Inner inner;
  uint8_t z;
};

static int sentinel;

void fillMixed(struct Mixed *m) {
  m->a = 0xab;
  m->b = 0x1122334455667788ULL;
  m->c = -123456;
  m->d = 0.375;
  m->e = 0x1234;
  m->p = &sentinel;
  m->inner.tag = 0xcafe;
  m->inner.link = &sentinel;
  m->z = 0x7f;
}

int32_t isSentinel(void *p) {
  return p == &sentinel;
}

/* One bit per field: set when it holds what `writtenFields` stores. A zeroed
 * instance sets none. */
int32_t checkMixed(const struct Mixed *m) {
  int32_t bits = 0;
  bits |= (m->a == 200) << 0;
  bits |= (m->b == 0x0102030405060708ULL) << 1;
  bits |= (m->c == -5) << 2;
  bits |= (m->d == 2.5) << 3;
  bits |= (m->e == 65535) << 4;
  bits |= (m->inner.tag == 0xbeef) << 5;
  bits |= (m->z == 9) << 6;
  bits |= (m->p != NULL) << 7;
  bits |= (m->inner.link != NULL) << 8;
  return bits;
}

uint8_t readA(void);
uint64_t readB(void);
int32_t readC(void);
double readD(void);
uint16_t readE(void);
uint16_t readTag(void);
uint8_t readZ(void);
int32_t readPointers(void);
int32_t zeroFields(void);
int32_t writtenFields(void);

int main(void) {
  printf("sizeof Inner %zu, tag %zu, link %zu\n", sizeof(struct Inner), offsetof(struct Inner, tag),
         offsetof(struct Inner, link));
  printf("sizeof Mixed %zu: a %zu, b %zu, c %zu, d %zu, e %zu, p %zu, inner %zu, z %zu\n", sizeof(struct Mixed),
         offsetof(struct Mixed, a), offsetof(struct Mixed, b), offsetof(struct Mixed, c), offsetof(struct Mixed, d),
         offsetof(struct Mixed, e), offsetof(struct Mixed, p), offsetof(struct Mixed, inner),
         offsetof(struct Mixed, z));
  printf("a %u\n", (unsigned)readA());
  printf("b %llx\n", (unsigned long long)readB());
  printf("c %d\n", readC());
  printf("d %g\n", readD());
  printf("e %x\n", (unsigned)readE());
  printf("tag %x\n", (unsigned)readTag());
  printf("z %x\n", (unsigned)readZ());
  printf("pointers %d\n", readPointers());
  printf("zeroed %x\n", zeroFields());
  printf("written %x\n", writtenFields());
  return 0;
}
