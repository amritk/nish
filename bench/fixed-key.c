/* A fixed `getentropy`, preloaded into every program `--instructions` counts.
 *
 *   cc -O2 -shared -fPIC fixed-key.c -o fixed-key.so
 *
 * A program with a string-keyed `Map` or `Set` seeds its hash key from
 * `getentropy` before `main` (`seedHashKey`, src/emit-map.ts), so every run
 * places its keys differently, and the probe chains, and with them the
 * instruction count, move from one run to the next: map-presize spread by
 * 0.35% under cachegrind, past the 0.1% tolerance. Under `LD_PRELOAD` this
 * answers that one call with the same bytes every time, so the count is
 * exact again.
 *
 * It is bench-only: the shipped runtime and the emitted seed are unchanged,
 * and nothing a release binary reads selects it. A process whose environment
 * an attacker sets is already the attacker's. */
#include <stddef.h>
#include <string.h>

int getentropy(void *buf, size_t len) {
  memset(buf, 0x5a, len);
  return 0;
}
