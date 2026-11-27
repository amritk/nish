// WP89 S3b: the C library `sys.ts` binds. `Meter_read` is C's spelling of
// a getter, the identifier a header would also give the Nish method
// `Meter.read` of `main.ts`.
#include <stdlib.h>

typedef struct { int n; } CMeter;

CMeter *meter_new(int start) {
  CMeter *m = malloc(sizeof *m);
  if (m != NULL) {
    m->n = start;
  }
  return m;
}

int Meter_read(CMeter *m) { return m->n; }

void meter_free(CMeter *m) { free(m); }
