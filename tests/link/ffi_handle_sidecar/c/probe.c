// WP89 S5a: includes the header `nish --emit-header` wrote for this program
// and declares, with types it would contradict, every name the header must
// leave out: the handle class `Stack`, its method and the library module's
// functions that take or give one. If the header declared any of them, this
// file would not compile. `twice` names no handle, so the header declares it.
//
// `args` writes the header as `nish.h`, alone in its directory: the header's
// own `#include "nish.h"` then names itself, which its include guard has
// already closed, so it compiles with no `-I` for the runtime's header, which
// a package's C sources are not given. A header that declared a handle
// function would need the runtime's types too, and fail here either way.
#include <stdlib.h>
#include "../../../../build/test/link/ffi_handle_sidecar-h/nish.h"

typedef int Stack;
long Stack_depth(char, char, char);
long openStack(char, char, char);
long depth(char, char, char);

typedef struct { int n; } Cell;

Cell *cell_open(int n) {
  Cell *c = malloc(sizeof *c);
  if (c != NULL) {
    c->n = n;
  }
  return c;
}

int cell_read(Cell *c) { return c->n; }

void cell_close(Cell *c) { free(c); }

int probe(int n) { return twice(n) + 1; }
