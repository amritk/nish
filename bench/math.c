/* C twin of math.ts: the same tables, the same loops, the same lines. The
 * JavaScript semantics math.ts gets from its builtins are spelled out here:
 * `js_round` is round-half-up with the sign of the input (so -0.4 rounds to
 * -0), `js_min` and `js_max` answer NaN for a NaN operand and order -0 below
 * +0, and `js_sign` keeps NaN and -0. */
#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

#define N 20000000 /* bench:n */
#define SIZE 4096

static double special(int32_t k) {
  static const double values[16] = {
      NAN, 0.0, -0.0, 0.5, -0.5, 2.5, -2.5, INFINITY, -INFINITY, 0.49999999999999994, -0.49999999999999994,
      4503599627370497.0, 1e300, -1e-300, 3.0, -7.0,
  };
  return values[k];
}

static int32_t mix(int32_t h, int32_t b) { return (int32_t)((uint32_t)(h ^ b) * 16777619u); }

static int32_t f32_bits(float f) {
  int32_t b;
  memcpy(&b, &f, sizeof b);
  return b;
}

static int32_t bits(double r) { return r != r ? 2143289344 : f32_bits((float)r); }

static double js_round(double x) {
  double r = floor(x);
  if (x - r >= 0.5) {
    r = r + 1.0;
  }
  return copysign(r, x);
}

static double js_min(double a, double b) {
  if (a != a || b != b) {
    return NAN;
  }
  if (a == b) {
    return signbit(a) ? a : b;
  }
  return a < b ? a : b;
}

static double js_max(double a, double b) {
  if (a != a || b != b) {
    return NAN;
  }
  if (a == b) {
    return signbit(a) ? b : a;
  }
  return a > b ? a : b;
}

static double js_sign(double x) { return x > 0.0 ? 1.0 : x < 0.0 ? -1.0 : x; }

static int32_t int_sign(int32_t x) { return (x > 0) - (x < 0); }

static int32_t imul(int32_t a, int32_t b) { return (int32_t)((uint32_t)a * (uint32_t)b); }

static double xs[SIZE];
static int32_t is[SIZE];

static int wanted(const char *only, const char *name) { return only == NULL || strcmp(only, name) == 0; }

int main(int argc, char **argv) {
  const char *only = argc > 1 ? argv[1] : NULL;
  uint32_t s = 1013904223u;
  for (int32_t j = 0; j < SIZE; j++) {
    s = s ^ (s << 13);
    s = s ^ (s >> 17);
    s = s ^ (s << 5);
    is[j] = (int32_t)s;
    xs[j] = (j & 15) == 0 ? special((j >> 4) & 15) : (double)(int32_t)s / 65536.0;
  }

  if (wanted(only, "atan2")) {
    int32_t h = -2128831035;
    for (int32_t i = 0; i < N; i++) {
      h = mix(h, bits(atan2(xs[i & 4095], xs[(i + 1237) & 4095])));
    }
    printf("atan2 %d\n", h);
  }
  if (wanted(only, "tan")) {
    int32_t h = -2128831035;
    for (int32_t i = 0; i < N; i++) {
      h = mix(h, bits(tan(xs[i & 4095])));
    }
    printf("tan %d\n", h);
  }
  if (wanted(only, "hypot")) {
    int32_t h = -2128831035;
    for (int32_t i = 0; i < N; i++) {
      h = mix(h, bits(hypot(xs[i & 4095], xs[(i + 1237) & 4095])));
    }
    printf("hypot %d\n", h);
  }
  if (wanted(only, "sign-int")) {
    int32_t h = -2128831035;
    for (int32_t i = 0; i < 8 * N; i++) {
      h = mix(h, int_sign(is[i & 4095]));
    }
    printf("sign-int %d\n", h);
  }
  if (wanted(only, "sign-float")) {
    int32_t h = -2128831035;
    for (int32_t i = 0; i < 8 * N; i++) {
      h = mix(h, bits(js_sign(xs[i & 4095])));
    }
    printf("sign-float %d\n", h);
  }
  if (wanted(only, "imul")) {
    int32_t h = -2128831035;
    for (int32_t i = 0; i < 8 * N; i++) {
      h = mix(h, imul(is[i & 4095], is[(i + 1237) & 4095]));
    }
    printf("imul %d\n", h);
  }
  if (wanted(only, "round")) {
    int32_t h = -2128831035;
    for (int32_t i = 0; i < 8 * N; i++) {
      h = mix(h, bits(js_round(xs[i & 4095])));
    }
    printf("round %d\n", h);
  }
  if (wanted(only, "min")) {
    int32_t h = -2128831035;
    for (int32_t i = 0; i < 8 * N; i++) {
      h = mix(h, bits(js_min(xs[i & 4095], xs[(i + 1237) & 4095])));
    }
    printf("min %d\n", h);
  }
  if (wanted(only, "max")) {
    int32_t h = -2128831035;
    for (int32_t i = 0; i < 8 * N; i++) {
      h = mix(h, bits(js_max(xs[i & 4095], xs[(i + 1237) & 4095])));
    }
    printf("max %d\n", h);
  }
  if (wanted(only, "f32-to-bits")) {
    int32_t h = -2128831035;
    for (int32_t i = 0; i < 8 * N; i++) {
      h = mix(h, f32_bits((float)xs[i & 4095]));
    }
    printf("f32-to-bits %d\n", h);
  }
  return 0;
}
