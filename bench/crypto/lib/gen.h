/*
 * The crypto twins' shared input generator and checksum fold, for C: the
 * same bytes and the same fold as lib/gen.ts, under the contract in
 * bench/crypto/README.md. Header-only, so a family's openssl.c includes it
 * with `#include "gen.h"` and the runner passes `-I bench/crypto/lib`.
 */
#ifndef BENCH_CRYPTO_GEN_H
#define BENCH_CRYPTO_GEN_H

#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

/* FNV-1a 32's offset basis: the fold's start. */
#define FOLD_START 2166136261u

/* FNV-1a 32 over `n` bytes, from `sum`. */
static inline uint32_t fold(uint32_t sum, const uint8_t *bytes, size_t n) {
  for (size_t i = 0; i < n; i++) {
    sum = (sum ^ bytes[i]) * 16777619u;
  }
  return sum;
}

/* One kernel's inputs, every buffer drawn from one stream in this order. */
typedef struct {
  uint8_t *key, *nonce, *aad, *msg;
} inputs_t;

static uint8_t *gen_draw(uint32_t *x, size_t length) {
  uint8_t *out = malloc(length ? length : 1);
  if (out == NULL) {
    exit(1);
  }
  for (size_t i = 0; i < length; i++) {
    *x ^= *x << 13;
    *x ^= *x >> 17;
    *x ^= *x << 5;
    out[i] = (uint8_t)*x;
  }
  return out;
}

/* The key, nonce, AAD and message of `kernel` at `size`, at the lengths given. */
static inline inputs_t inputs(const char *kernel, long size, size_t key_len, size_t nonce_len, size_t aad_len,
                              size_t msg_len) {
  char name[256];
  snprintf(name, sizeof name, "%s:%ld", kernel, size);
  uint32_t x = fold(FOLD_START, (const uint8_t *)name, strlen(name));
  if (x == 0) {
    x = 1;
  }
  inputs_t r;
  r.key = gen_draw(&x, key_len);
  r.nonce = gen_draw(&x, nonce_len);
  r.aad = gen_draw(&x, aad_len);
  r.msg = gen_draw(&x, msg_len);
  return r;
}

/* Iteration `i`'s input: `bytes[0..4)` set to `base` (the original four bytes) XOR `i`, little-endian. */
static inline void tweak(uint8_t *bytes, const uint8_t base[4], uint32_t i) {
  bytes[0] = base[0] ^ (uint8_t)i;
  bytes[1] = base[1] ^ (uint8_t)(i >> 8);
  bytes[2] = base[2] ^ (uint8_t)(i >> 16);
  bytes[3] = base[3] ^ (uint8_t)(i >> 24);
}

/* The monotonic clock the timed loop reads, in nanoseconds. */
static inline int64_t now_ns(void) {
  struct timespec t;
  clock_gettime(CLOCK_MONOTONIC, &t);
  return (int64_t)t.tv_sec * 1000000000 + t.tv_nsec;
}

/* The contract's two lines: the checksum on stdout, the timed loop's nanoseconds on stderr. */
static inline void report(uint32_t sum, int64_t started) {
  int64_t ns = now_ns() - started;
  printf("checksum %08x\n", sum);
  fprintf(stderr, "ns %lld\n", (long long)ns);
}

/* The command line, `<kernel> <size> <iterations>`; exit 2 with a usage line when it is not one. */
static inline void parse_args(int argc, char **argv, const char **kernel, long *size, long *iterations) {
  if (argc != 4 || (*size = strtol(argv[2], NULL, 10)) < 0 || (*iterations = strtol(argv[3], NULL, 10)) < 1) {
    fprintf(stderr, "usage: %s <kernel> <size> <iterations>\n", argv[0]);
    exit(2);
  }
  *kernel = argv[1];
}

#endif
