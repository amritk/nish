/* The f64 formatter's oracle: prints `nish_f64_format` for a seeded stream of
   doubles, one `<16 hex digits of the bits> <string>` line each, for
   tests/run.js `f64_format_oracle` to hold against Node's `String(x)`.

       f64-format-oracle [random-count [seed]]

   The stream is every edge class first, then `random-count` (default two
   million) xorshift64* bit patterns, so a failure names a value anyone can
   reproduce from the seed. The edge classes are the ones a shortest-digits
   algorithm gets wrong when it is wrong: every power of two and its
   neighbours (the irregular branch), the subnormals, the layout boundaries at
   1e21 and 1e-7, integers, short decimals and the values whose next digit is
   an exact tie. NaN payloads and ±Infinity are in it too.

   It includes runtime/nish.h rather than restating the declaration, so the
   header's `NISH_F64_MAX` and `nish_f64_format` are what it compiles against. */
#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "nish.h"

_Static_assert(NISH_F64_MAX == 32, "nish.h and runtime.c state one formatter buffer size");

static void emit_bits(uint64_t bits) {
  char out[NISH_F64_MAX + 1];
  double v;
  memcpy(&v, &bits, 8);
  /* A sentinel past the end the formatter may use: a write beyond the
     returned length, or past the buffer's 25 used bytes, shows up here. */
  memset(out, '#', sizeof out);
  int n = nish_f64_format(v, out);
  if (n < 1 || n > 25) {
    fprintf(stderr, "f64-format-oracle: %016llx: length %d is outside 1..25\n", (unsigned long long)bits, n);
    exit(2);
  }
  for (int i = n; i < (int)sizeof out; i++) {
    if (out[i] != '#') {
      fprintf(stderr, "f64-format-oracle: %016llx: byte %d written past length %d\n", (unsigned long long)bits, i, n);
      exit(2);
    }
  }
  printf("%016llx %.*s\n", (unsigned long long)bits, n, out);
}

static uint64_t bits_of(double v) {
  uint64_t bits;
  memcpy(&bits, &v, 8);
  return bits;
}

static void emit(double v) { emit_bits(bits_of(v)); }

/* `v`, both neighbours and the same three negated. */
static void emit_around(uint64_t bits) {
  bits &= ~(1ull << 63);
  for (int d = -1; d <= 1; d++) {
    uint64_t b = bits + (uint64_t)(int64_t)d;
    if (b >> 52 >= 0x7ff) continue; /* stepping off DBL_MAX or below zero */
    emit_bits(b);
    emit_bits(b | 1ull << 63);
  }
}

static uint64_t state;
static uint64_t next(void) {
  state ^= state >> 12;
  state ^= state << 25;
  state ^= state >> 27;
  return state * 0x2545F4914F6CDD1Dull;
}

int main(int argc, char **argv) {
  long count = argc > 1 ? atol(argv[1]) : 2000000;
  state = argc > 2 ? strtoull(argv[2], NULL, 0) : 0x9E3779B97F4A7C15ull;
  if (state == 0) state = 1;
  char buf[64];

  /* Zero, NaN with a few payloads, the infinities. */
  emit_bits(0);
  emit_bits(1ull << 63);
  emit_bits(0x7ff8000000000000ull);
  emit_bits(0xfff8000000000001ull);
  emit_bits(0x7ff0000000000001ull);
  emit_bits(0x7ff0000000000000ull);
  emit_bits(0xfff0000000000000ull);

  /* Every power of two, 2^-1074 to 2^1023, and its neighbours; with them
     every raw exponent's smallest and largest significand. */
  for (int e = -1074; e <= 1023; e++) emit_around(bits_of(ldexp(1, e)));
  for (uint64_t raw = 1; raw < 0x7ff; raw++) emit_around(raw << 52 | ((1ull << 52) - 1));

  /* The subnormals: the smallest few hundred, the largest few hundred, and
     the boundary into the normals. */
  for (uint64_t b = 1; b < 400; b++) emit_bits(b);
  for (uint64_t b = (1ull << 52) - 400; b < (1ull << 52) + 400; b++) emit_bits(b);

  /* The extremes. */
  emit_around(0x7fefffffffffffffull); /* DBL_MAX */
  emit_around(1);                     /* 5e-324 */

  /* Every power of ten a double can be near, and its neighbours: these sit on
     the layout boundaries (1e21, 1e-7) and on the digit count's table. */
  for (int k = -325; k <= 309; k++) {
    snprintf(buf, sizeof buf, "1e%d", k);
    emit_around(bits_of(strtod(buf, NULL)));
  }

  /* Integers: the small ones, then a band either side of every power of two
     up to 2^64, where the spacing grows past 1 and the digits stop being the
     integer's own. */
  for (int64_t i = 0; i <= 100000; i++) emit((double)i);
  for (int e = 1; e <= 64; e++) {
    uint64_t b = bits_of(ldexp(1, e));
    for (int64_t d = -200; d <= 200; d++) emit_bits(b + (uint64_t)d);
  }

  /* Exact ties: doubles whose fraction past the shorter candidate is exactly
     a quarter, so the next digit is an exact .5 that rounds half to even --
     1125899906842624.25 prints as ...624.2. From 2^50 up an ulp is a quarter
     and sixteen integer digits leave room for one fractional one, so they
     are dense there: sweep the first doubles past 2^49 and 2^50 (the run
     these were chosen with hit the tie 75,278 times). */
  for (uint64_t b = 0x4300000000000000ull; b < 0x4300000000000000ull + 200000; b++) emit_bits(b);
  for (uint64_t b = 0x4310000000000000ull; b < 0x4310000000000000ull + 200000; b++) emit_bits(b);

  /* Short decimals: up to seventeen random digits at a random exponent, read
     back by strtod, which is where the shortest answer is the short one. */
  for (int i = 0; i < 200000; i++) {
    uint64_t r = next();
    int digits = 1 + (int)(r % 17);
    uint64_t m = next() % 100000000000000000ull;
    uint64_t lim = 1;
    for (int j = 0; j < digits; j++) lim *= 10;
    m %= lim;
    int e = (int)((r >> 8) % 640) - 330;
    snprintf(buf, sizeof buf, "%llue%d", (unsigned long long)m, e);
    emit(strtod(buf, NULL));
  }

  /* And the random bit patterns. */
  for (long i = 0; i < count; i++) emit_bits(next());
  return 0;
}
