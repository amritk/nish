/* The negative case for tests/ct-asm-runtime.js: two functions shaped like
 * runtime/runtime-aes.c's kernels -- array headers in, a loop over a public
 * length -- each with one leak the check must refuse. Never linked; only
 * compiled to assembly.
 *
 *   nish_aes_leaky_table    a table AES's SubBytes: a load from a table at
 *                           an address a data byte picks, which is how a
 *                           cache-timing attack reads the key
 *   nish_aes_leaky_branch   a loop that stops at the first zero byte of the
 *                           data: a branch on a secret
 */
#include <stdint.h>

#include "../../runtime/nish.h"

static const uint8_t leaky_sbox[256] = {
    0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
};

void nish_aes_leaky_table(const nish_array *rk, int32_t rounds, const nish_array *src, nish_array *dst,
                          int32_t length) {
  (void)rk;
  (void)rounds;
  for (int32_t i = 0; i < length; i++) dst->data[i] = (char)leaky_sbox[(uint8_t)src->data[i]];
}

void nish_aes_leaky_branch(const nish_array *rk, int32_t rounds, const nish_array *src, nish_array *dst,
                           int32_t length) {
  (void)rk;
  (void)rounds;
  for (int32_t i = 0; i < length && src->data[i] != 0; i++) dst->data[i] = src->data[i];
}
