/*
 * The interface between tests/ct-timing/dudect.c, which measures, and the C
 * file tests/ct-timing.js writes for each tests/cases/ct_asm_* fixture, which
 * knows how to call that fixture's functions.
 *
 * Nish passes an array as a pointer to its header (runtime/nish.h), so the
 * generated file builds headers of its own over static buffers: `ct_array` is
 * that layout, spelled here so the file needs nothing from the runtime.
 */
#ifndef NISH_CT_TIMING_DUDECT_H
#define NISH_CT_TIMING_DUDECT_H

#include <stddef.h>
#include <stdint.h>

typedef struct ct_array {
  int64_t len;
  int64_t cap;
  void *data;
} ct_array;

/*
 * One function to time. `prepare` lays out its arguments for a class, 0 for
 * the fixed secret and 1 for a random one, and is not timed; `call` calls the
 * function on them once, and is.
 */
typedef struct ct_function {
  const char *name;
  void (*prepare)(int secret_class);
  void (*call)(void);
} ct_function;

/* The generated file's table. */
extern const ct_function ct_functions[];
extern const int ct_function_count;

/*
 * `bytes` bytes at `p`: zero for class 0, random for class 1, from an
 * xorshift64* seeded on the command line so a run can be repeated.
 */
void ct_fill(void *p, size_t bytes, int secret_class);

/*
 * The `count` limbs at `limbs` narrowed to signed values of magnitude below
 * 2^bits: the low `bits` bits as the magnitude and the top bit as the sign.
 * Called on both classes after `ct_fill`, so both run it; zero stays zero.
 */
void ct_signed_limbs(int64_t *limbs, size_t count, int bits);

/*
 * The leaks a domain's controls time (tests/ct-timing.js, `domainControls`):
 * the index of the first non-zero limb, which stops as soon as it finds one,
 * and extra work exactly when `s` is non-zero.
 */
size_t ct_first_nonzero(const int64_t *limbs, size_t count);
uint64_t ct_work_if(int64_t s);

#endif
