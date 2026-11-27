// WP89 S3b: the C library `sys.ts` binds.
#include <stdlib.h>

typedef struct { int n; } Counter;

Counter *counter_new(int start) {
  Counter *c = malloc(sizeof *c);
  if (c != NULL) {
    c->n = start;
  }
  return c;
}

int counter_bump(Counter *c, int by) {
  c->n += by;
  return c->n;
}

void counter_free(Counter *c) { free(c); }
