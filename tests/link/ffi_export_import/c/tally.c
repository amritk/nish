// WP66: the C library a `nish c-import` module binds; main.ts calls it
// through tally.ts's exports.
#include <stdint.h>
#include <stdlib.h>

struct tally { int64_t sum; };
struct TallyOut { int64_t value; };

struct tally *tally_new(int32_t start) {
  struct tally *t = malloc(sizeof *t);
  if (t != NULL) {
    t->sum = start;
  }
  return t;
}

void tally_add(struct tally *t, int64_t k) { t->sum += k; }

int32_t tally_get(struct tally *t, struct TallyOut *out) {
  out->value = t->sum;
  return 0;
}

void tally_free(struct tally *t) { free(t); }
