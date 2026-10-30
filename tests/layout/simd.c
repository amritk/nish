/* C twin of tests/layout/simd.ts: the object holds `nish:simd` vectors as
 * clang's `__attribute__((vector_size(16)))` types, each aligned to sixteen,
 * and the inline array of three `i32x4` as `struct { nish_array h; v4si
 * slots[3]; }`, whose slots therefore start at 32 and step by 16.
 * tests/run.js also checks that sizeof(struct Lanes) is the
 * `nish_alloc_struct(i64 N)` the IR allocates. The arena hands out objects
 * aligned to eight, and the compiler accesses a vector field with `align 8`,
 * so the C side copies the object out with memcpy before it reads a field:
 * clang may assume a `struct Lanes *` is aligned to sixteen. */
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

#include "nish.h"

typedef int32_t v4si __attribute__((vector_size(16)));
typedef double v2df __attribute__((vector_size(16)));
typedef uint8_t v16qu __attribute__((vector_size(16)));

struct Lanes {
  int32_t tag;
  v4si v;
  double d;
  v2df w;
  struct { nish_array h; v4si slots[3]; } vs;
  v16qu b;
};

_Static_assert(sizeof(v4si) == 16 && _Alignof(v4si) == 16, "i32x4 is sixteen bytes, aligned to sixteen");
_Static_assert(sizeof(v2df) == 16 && _Alignof(v2df) == 16, "f64x2");
_Static_assert(sizeof(v16qu) == 16 && _Alignof(v16qu) == 16, "u8x16");
_Static_assert(sizeof(v4si[3]) == 48, "an array of vectors has a sixteen-byte stride");
_Static_assert(offsetof(struct Lanes, v) == 16, "v rounds up to sixteen");
_Static_assert(offsetof(struct Lanes, d) == 32, "d");
_Static_assert(offsetof(struct Lanes, w) == 48, "w");
_Static_assert(offsetof(struct Lanes, vs) == 64, "vs");
_Static_assert(offsetof(struct Lanes, vs.slots) == 96, "the slots after the 24-byte header, rounded to sixteen");
_Static_assert(offsetof(struct Lanes, b) == 144, "b");
_Static_assert(sizeof(struct Lanes) == 160, "Lanes");

struct Lanes *makeLanes(void);
nish_array *storeBytes(void);

static int fail(const char *what) {
  printf("simd layout: %s\n", what);
  return 1;
}

int main(void) {
  const struct Lanes *p = makeLanes();
  struct Lanes copy;
  memcpy(&copy, p, sizeof copy);
  const struct Lanes *l = &copy;
  if (l->tag != 7) return fail("tag");
  for (int i = 0; i < 4; i++) {
    if (l->v[i] != i + 1) return fail("v");
  }
  if (l->d != 0.5) return fail("d");
  if (l->w[0] != 1.5 || l->w[1] != -2.5) return fail("w");
  if (l->vs.h.len != 3 || l->vs.h.data != (const char *)p + offsetof(struct Lanes, vs.slots)) return fail("vs header");
  for (int k = 0; k < 3; k++) {
    for (int i = 0; i < 4; i++) {
      if (l->vs.slots[k][i] != 10 * (k + 1) + i) return fail("vs slots");
    }
  }
  for (int i = 0; i < 16; i++) {
    if (l->b[i] != 9) return fail("b");
  }
  nish_array *xs = storeBytes();
  const uint8_t *bytes = (const uint8_t *)xs->data;
  if (xs->len != 20 || bytes[0] != 0 || bytes[1] != 0 || bytes[18] != 0 || bytes[19] != 0) return fail("store bounds");
  for (int i = 0; i < 16; i++) {
    if (bytes[2 + i] != i + 1) return fail("store lanes");
  }
  printf("simd layout ok\n");
  return 0;
}
