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
typedef uint16_t v8hu __attribute__((vector_size(16)));
typedef uint32_t v4su __attribute__((vector_size(16)));
typedef float v4sf __attribute__((vector_size(16)));

struct Lanes {
  int32_t tag;
  v4si v;
  double d;
  v2df w;
  struct { nish_array h; v4si slots[3]; } vs;
  v16qu b;
  v8hu h;
  v4su u;
  v4sf f;
};

/* An inline array of vectors after a lone int32_t: the 24-byte header starts
 * at sixteen, not eight, because the slots after it are aligned to sixteen. */
struct Mid {
  int32_t n;
  struct { nish_array h; v4su slots[2]; } vs;
  int32_t k;
};

/* The same as the last field: the object's size rounds up to sixteen. */
struct Tail {
  int32_t n;
  struct { nish_array h; v4sf slots[3]; } vs;
};

_Static_assert(sizeof(v4si) == 16 && _Alignof(v4si) == 16, "i32x4 is sixteen bytes, aligned to sixteen");
_Static_assert(sizeof(v2df) == 16 && _Alignof(v2df) == 16, "f64x2");
_Static_assert(sizeof(v16qu) == 16 && _Alignof(v16qu) == 16, "u8x16");
_Static_assert(sizeof(v8hu) == 16 && _Alignof(v8hu) == 16, "u16x8");
_Static_assert(sizeof(v4su) == 16 && _Alignof(v4su) == 16, "u32x4");
_Static_assert(sizeof(v4sf) == 16 && _Alignof(v4sf) == 16, "f32x4");
_Static_assert(sizeof(v4si[3]) == 48, "an array of vectors has a sixteen-byte stride");
_Static_assert(offsetof(struct Lanes, v) == 16, "v rounds up to sixteen");
_Static_assert(offsetof(struct Lanes, d) == 32, "d");
_Static_assert(offsetof(struct Lanes, w) == 48, "w");
_Static_assert(offsetof(struct Lanes, vs) == 64, "vs");
_Static_assert(offsetof(struct Lanes, vs.slots) == 96, "the slots after the 24-byte header, rounded to sixteen");
_Static_assert(offsetof(struct Lanes, b) == 144, "b");
_Static_assert(offsetof(struct Lanes, h) == 160, "h");
_Static_assert(offsetof(struct Lanes, u) == 176, "u");
_Static_assert(offsetof(struct Lanes, f) == 192, "f");
_Static_assert(sizeof(struct Lanes) == 208, "Lanes");
_Static_assert(offsetof(struct Mid, vs) == 16, "Mid.vs rounds up to sixteen after the i32");
_Static_assert(offsetof(struct Mid, vs.slots) == 48, "Mid.vs.slots");
_Static_assert(offsetof(struct Mid, k) == 80, "Mid.k");
_Static_assert(sizeof(struct Mid) == 96, "Mid");
_Static_assert(offsetof(struct Tail, vs) == 16, "Tail.vs");
_Static_assert(offsetof(struct Tail, vs.slots) == 48, "Tail.vs.slots");
_Static_assert(sizeof(struct Tail) == 96, "Tail");

struct Lanes *makeLanes(void);
struct Mid *makeMid(void);
struct Tail *makeTail(void);
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
  const uint16_t hs[8] = {1, 2, 3, 4, 5, 6, 7, 65535};
  for (int i = 0; i < 8; i++) {
    if (l->h[i] != hs[i]) return fail("h");
  }
  if (l->u[0] != 1 || l->u[1] != 2 || l->u[2] != 3 || l->u[3] != 4294967295u) return fail("u");
  if (l->f[0] != 0.5f || l->f[1] != -1.5f || l->f[2] != 2.25f || l->f[3] != 0.1f) return fail("f");

  const struct Mid *mp = makeMid();
  struct Mid mid;
  memcpy(&mid, mp, sizeof mid);
  if (mid.n != 3 || mid.k != 9) return fail("Mid scalars");
  if (mid.vs.h.len != 2 || mid.vs.h.data != (const char *)mp + offsetof(struct Mid, vs.slots)) return fail("Mid header");
  for (int k = 0; k < 2; k++) {
    for (int i = 0; i < 4; i++) {
      if (mid.vs.slots[k][i] != (uint32_t)(4 * k + i + 1)) return fail("Mid slots");
    }
  }
  const struct Tail *tp = makeTail();
  struct Tail tail;
  memcpy(&tail, tp, sizeof tail);
  if (tail.n != 5) return fail("Tail scalar");
  if (tail.vs.h.len != 3 || tail.vs.h.data != (const char *)tp + offsetof(struct Tail, vs.slots)) return fail("Tail header");
  for (int k = 0; k < 3; k++) {
    for (int i = 0; i < 4; i++) {
      if (tail.vs.slots[k][i] != (float)(4 * k + i + 1)) return fail("Tail slots");
    }
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
