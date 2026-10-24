/* JSON-13: count the key compares a probe makes, and show the hash key.
 * `tests/run.js` links `map_hash_collide` with `-Wl,--wrap=nish_str_eq`, so
 * every call the compiled program makes to `nish_str_eq` arrives here first;
 * `mapKeyCompares` hands the count back, and `mapHashSeed` the key's first
 * word folded to 32 bits, which two runs of one program print differently. */
#include <stdbool.h>
#include <stdint.h>
#include "nish.h"

bool __real_nish_str_eq(const nish_str *a, const nish_str *b);

static int32_t compares = 0;

bool __wrap_nish_str_eq(const nish_str *a, const nish_str *b) {
  compares++;
  return __real_nish_str_eq(a, b);
}

int32_t mapKeyCompares(void) {
  return compares;
}

int32_t mapHashSeed(void) {
  return (int32_t)(nish_hash_key[0] ^ nish_hash_key[0] >> 32);
}
