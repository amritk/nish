/* libFuzzer's entry point for a Nish fuzz target (tests/fuzz/README.md).

   A target is a library module, `tests/fuzz/targets/<name>.ts`, that exports
   `fuzzOne(data: u8[]): void`; an exported function is a plain C symbol and a
   `u8[]` is a `nish_array *`. Each input is copied into a heap block of exactly
   its length, so ASan sees a read past its end, and the block is freed after
   the call, so a target that kept it is a use after free. The arena is reset
   after every input: nothing a target allocates outlives the input that made
   it. scripts/fuzz.sh links this with the target's `.ll` and the runtime built
   with -DNISH_FUZZ_ABORT, where a panic, a failed check and out of memory
   abort() and so reach libFuzzer as a crash. */
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#include "nish.h"

void fuzzOne(nish_array *data);

int LLVMFuzzerTestOneInput(const uint8_t *data, size_t size) {
  /* libFuzzer may pass NULL at size 0; a zero-length block is still one byte so
     malloc never answers NULL for it. */
  char *copy = malloc(size > 0 ? size : 1);
  if (copy == NULL) abort();
  if (size > 0) memcpy(copy, data, size);
  nish_array input = {size, size, copy};
  fuzzOne(&input);
  free(copy);
  nish_reset_arena();
  return 0;
}
