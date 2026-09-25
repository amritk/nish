/* WP32 acceptance criterion 4: count the key compares a probe makes.
 * `tests/run.js` links `map_fingerprint_miss` with `-Wl,--wrap=nish_str_eq`,
 * so every call the compiled program makes to `nish_str_eq` arrives here
 * first, and `mapKeyCompares` hands the count back to the program. */
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
