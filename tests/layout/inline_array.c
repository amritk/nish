/* C twin of tests/layout/inline_array.ts: one class with three inline array
 * fields, laid out the way the compiler lays `{ %struct.nish_array, [K x T] }`
 * out as one member. The nested struct is what keeps `count` at 32 rather than
 * in the slots' tail: C, like LLVM, never places a following member inside a
 * nested struct's padding. tests/run.js also checks that sizeof(struct Rows)
 * is the `nish_alloc_struct(i64 N)` the IR allocates. */
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

#include "nish.h"

struct Rows {
  struct { nish_array h; bool slots[3]; } flags;
  int32_t count;
  struct { nish_array h; int32_t slots[5]; } ids;
  double tail;
  struct { nish_array h; const nish_str *slots[2]; } names;
};

_Static_assert(sizeof(nish_array) == 24, "the header self/runtime.ts calls { i64, i64, i8* }");
_Static_assert(offsetof(struct Rows, flags) == 0, "flags");
_Static_assert(offsetof(struct Rows, count) == 32, "count after 24 + 3 slots, rounded to 8");
_Static_assert(offsetof(struct Rows, ids) == 40, "ids");
_Static_assert(offsetof(struct Rows, tail) == 88, "tail after 24 + 20 slots, rounded to 8");
_Static_assert(offsetof(struct Rows, names) == 96, "names");
_Static_assert(sizeof(struct Rows) == 136, "Rows");

struct Rows *makeRows(void);

static int fail(const char *what) {
  printf("inline layout: %s\n", what);
  return 1;
}

int main(void) {
  struct Rows *r = makeRows();
  if (r->flags.h.len != 3 || r->flags.h.cap != 3 || r->flags.h.data != (char *)r->flags.slots) return fail("flags header");
  if (r->flags.slots[0] || !r->flags.slots[1] || r->flags.slots[2]) return fail("flags slots");
  if (r->count != 7) return fail("count");
  if (r->ids.h.len != 5 || r->ids.h.cap != 5 || r->ids.h.data != (char *)r->ids.slots) return fail("ids header");
  if (r->ids.slots[0] != 0 || r->ids.slots[4] != 44) return fail("ids slots");
  if (r->tail != 0.5) return fail("tail");
  if (r->names.h.len != 2 || r->names.h.data != (char *)r->names.slots) return fail("names header");
  if (r->names.slots[1]->len != 2 || memcmp(r->names.slots[1]->data, "bc", 2) != 0) return fail("names slots");
  printf("inline layout ok\n");
  return 0;
}
