/* WP32 acceptance criterion 4: count the key compares a probe makes.
 * `tests/run.js` links `map_fingerprint_miss` with `-Wl,--wrap=nish_str_eq`,
 * so every call the compiled program makes to `nish_str_eq` arrives here
 * first, and `mapKeyCompares` hands the count back to the program.
 *
 * The hash key is fixed on purpose. A probe compares keys only on a full
 * 32-bit hash match, so under the per-process random key an absent key or a
 * second present one matches a stored hash in about 3% of runs and the count
 * is off by one or two. `useFixedKey` writes the bytes 00..0f, the key
 * `map_hash_kat` uses, under which no absent key here hashes like a present one
 * and no two present keys share a hash. The emitted seed leaves a key whose
 * first word is nonzero alone, so the key is the same whichever constructor
 * runs first, and both run before `main`. That the random key is filled
 * differently in two runs stays covered by `map_hash_collide`. */
#include <stdbool.h>
#include <stdint.h>
#include "nish.h"

bool __real_nish_str_eq(const nish_str *a, const nish_str *b);

static int32_t compares = 0;

__attribute__((constructor)) static void useFixedKey(void) {
  nish_hash_key[0] = 0x0706050403020100ULL;
  nish_hash_key[1] = 0x0f0e0d0c0b0a0908ULL;
}

bool __wrap_nish_str_eq(const nish_str *a, const nish_str *b) {
  compares++;
  return __real_nish_str_eq(a, b);
}

int32_t mapKeyCompares(void) {
  return compares;
}
