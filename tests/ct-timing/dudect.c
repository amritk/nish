/*
 * A dudect-style timing test (O. Reparaz, J. Balasch and I. Verbauwhede,
 * "Dude, is my code constant time?", DATE 2017), written from the paper's
 * description: nothing here is taken from dudect's own source.
 *
 * For each function the generated table names, it times calls on two classes
 * of secret input, a fixed one (all zeros) and a fresh random one per call,
 * choosing the class of every measurement at random so that drift in the
 * machine lands on both alike. Then Welch's t-test asks whether the two
 * distributions of times differ. It asks it more than once, as the paper
 * does: on every measurement; on the measurements below each of 100
 * percentiles of a first batch (cropping, since the upper tail of a timing
 * distribution is mostly interrupts and is where a real difference drowns);
 * and on the squared distance from each class's mean (a second-order test,
 * for a difference in spread rather than in mean, once 10,000 measurements
 * of a class are in). The answer for a function
 * is the largest |t| of the tests that saw enough measurements. dudect reads
 * |t| above 4.5 as a leak, and tests/ct-timing.js applies that threshold; this
 * file only measures.
 *
 * A call to a small function is shorter than some timers tick, notably the
 * aarch64 generic timer, so each measurement times `batch` calls on the same
 * input, with `batch` the smallest power of two whose median measurement is
 * 64 ticks or more.
 *
 * Usage: <program> <samples> <seed>. One line per function on stdout:
 * name, batch, samples, max |t|, the test it came from, the smaller class
 * count of that test, and the uncropped t.
 */
#include "dudect.h"

#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#define CT_PERCENTILES 100
/* The uncropped test, one per percentile, and the second-order test. */
#define CT_TESTS (CT_PERCENTILES + 2)

static uint64_t ct_state = 0x9e3779b97f4a7c15u;

uint64_t ct_random(void) {
  ct_state ^= ct_state >> 12;
  ct_state ^= ct_state << 25;
  ct_state ^= ct_state >> 27;
  return ct_state * 0x2545f4914f6cdd1du;
}

/*
 * Both classes run exactly these instructions, the fixed one as well as the
 * random one: the same draws, the same stores of the same widths, with the
 * class only in the mask. A zero class written by `memset` measured |t| above
 * 10 on functions that are constant time, because the stores the timed call
 * then reads back had been written in other widths, and the processor forwards
 * the two differently.
 */
void ct_fill(void *p, size_t bytes, int secret_class) {
  unsigned char *out = p;
  uint64_t mask = (uint64_t)0 - (uint64_t)(secret_class & 1);
  for (size_t i = 0; i < bytes; i += 8) {
    uint64_t r = ct_random() & mask;
    size_t n = bytes - i < 8 ? bytes - i : 8;
    memcpy(out + i, &r, n);
  }
}

/* A cycle counter where the machine offers one to user space, else nanoseconds. */
static inline uint64_t ct_ticks(void) {
#if defined(__x86_64__)
  uint32_t lo, hi;
  __asm__ volatile("lfence\n\trdtsc" : "=a"(lo), "=d"(hi) : : "memory");
  return ((uint64_t)hi << 32) | lo;
#elif defined(__aarch64__)
  uint64_t v;
  __asm__ volatile("isb\n\tmrs %0, cntvct_el0" : "=r"(v) : : "memory");
  return v;
#else
  struct timespec ts;
  clock_gettime(CLOCK_MONOTONIC, &ts);
  return (uint64_t)ts.tv_sec * 1000000000u + (uint64_t)ts.tv_nsec;
#endif
}

/* Welford's running mean and variance, per class. */
typedef struct {
  double n[2];
  double mean[2];
  double m2[2];
} ct_ttest;

static void ct_push(ct_ttest *t, double x, int c) {
  t->n[c] += 1;
  double delta = x - t->mean[c];
  t->mean[c] += delta / t->n[c];
  t->m2[c] += delta * (x - t->mean[c]);
}

static double ct_t(const ct_ttest *t) {
  if (t->n[0] < 2 || t->n[1] < 2) {
    return 0;
  }
  double v0 = t->m2[0] / (t->n[0] - 1);
  double v1 = t->m2[1] / (t->n[1] - 1);
  double den = sqrt(v0 / t->n[0] + v1 / t->n[1]);
  return den == 0 ? 0 : (t->mean[0] - t->mean[1]) / den;
}

static uint64_t ct_measure(const ct_function *f, int c, int batch) {
  f->prepare(c);
  uint64_t start = ct_ticks();
  for (int k = 0; k < batch; k++) {
    f->call();
  }
  return ct_ticks() - start;
}

static int ct_compare(const void *a, const void *b) {
  uint64_t x = *(const uint64_t *)a;
  uint64_t y = *(const uint64_t *)b;
  return x < y ? -1 : x > y;
}

/* `count` measurements in random class order, sorted. */
static void ct_sample(const ct_function *f, int batch, uint64_t *out, long count) {
  for (long i = 0; i < count; i++) {
    out[i] = ct_measure(f, (int)(ct_random() & 1), batch);
  }
  qsort(out, (size_t)count, sizeof *out, ct_compare);
}

static void ct_run(const ct_function *f, long samples) {
  long first = samples / 10;
  if (first < 1000) {
    first = 1000;
  }
  if (first > 100000) {
    first = 100000;
  }
  uint64_t *batch_of = malloc(sizeof(uint64_t) * (size_t)first);
  if (batch_of == NULL) {
    fprintf(stderr, "ct-timing: out of memory\n");
    exit(2);
  }
  int batch = 1;
  for (;;) {
    ct_sample(f, batch, batch_of, 1001);
    if (batch_of[500] >= 64 || batch >= 4096) {
      break;
    }
    batch *= 2;
  }

  // The first batch sets the crop points and is not counted. The schedule is
  // the one dudect uses, 1 - 0.5^(10 (i + 1) / 100): from about the 7th
  // percentile up to the 99.9th, packed closer together towards the top.
  ct_sample(f, batch, batch_of, first);
  double crop[CT_PERCENTILES];
  for (int i = 0; i < CT_PERCENTILES; i++) {
    double p = 1 - pow(0.5, 10.0 * (i + 1) / CT_PERCENTILES);
    crop[i] = (double)batch_of[(long)(p * (double)(first - 1))];
  }
  free(batch_of);

  ct_ttest tests[CT_TESTS];
  memset(tests, 0, sizeof tests);
  for (long i = 0; i < samples; i++) {
    int c = (int)(ct_random() & 1);
    double x = (double)ct_measure(f, c, batch);
    ct_push(&tests[0], x, c);
    for (int k = 0; k < CT_PERCENTILES; k++) {
      if (x < crop[k]) {
        ct_push(&tests[k + 1], x, c);
      }
    }
    // dudect's rule for the second-order test: only once the uncropped mean
    // has 10,000 measurements behind it. It is also kept below the top crop
    // point here, because one preemption squared outweighs a thousand calls,
    // and measured |t| of 30 to 47 on functions whose other tests read 1.
    if (tests[0].n[c] > 10000 && x < crop[CT_PERCENTILES - 1]) {
      double centred = x - tests[0].mean[c];
      ct_push(&tests[CT_TESTS - 1], centred * centred, c);
    }
  }

  // A test that saw too few measurements has a |t| that means nothing.
  double enough = samples / 50 < 10000 ? samples / 50 : 10000;
  if (enough < 100) {
    enough = 100;
  }
  double max = 0;
  int which = 0;
  double used = 0;
  for (int k = 0; k < CT_TESTS; k++) {
    double n = tests[k].n[0] < tests[k].n[1] ? tests[k].n[0] : tests[k].n[1];
    double t = fabs(ct_t(&tests[k]));
    if (n >= enough && t > max) {
      max = t;
      which = k;
      used = n;
    }
  }
  printf("%s\t%d\t%ld\t%.3f\t%d\t%.0f\t%.3f\n", f->name, batch, samples, max, which, used, ct_t(&tests[0]));
  fflush(stdout);
}

int main(int argc, char **argv) {
  if (argc != 3) {
    fprintf(stderr, "usage: %s <samples> <seed>\n", argv[0]);
    return 2;
  }
  long samples = atol(argv[1]);
  uint64_t seed = strtoull(argv[2], NULL, 10);
  ct_state = seed == 0 ? ct_state : seed;
  for (int i = 0; i < ct_function_count; i++) {
    ct_run(&ct_functions[i], samples);
  }
  return 0;
}
