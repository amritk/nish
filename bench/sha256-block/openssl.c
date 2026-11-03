/*
 * The OpenSSL twin of bench/sha256-block/main.ts, under the contract in
 * bench/crypto/README.md, for its `block` and `hmac` kernels.
 *
 *   block <size>   SHA256_Init / SHA256_Update / SHA256_Final over the
 *                  message: the low-level API, which calls
 *                  sha256_block_data_order on whole blocks with nothing of
 *                  the provider layer in between. Which body that runs is
 *                  OPENSSL_ia32cap's to say, so run.mjs runs this one
 *                  binary as several columns under several masks.
 *   hmac <size>    HMAC() with EVP_sha256(), the one-shot that keys each call
 *
 * The low-level SHA256_* calls are deprecated in OpenSSL 3 and still
 * exported; they are the only way to reach the block function without
 * EVP's per-call fetch and context costs, which a 64-byte block would time.
 */
#define OPENSSL_SUPPRESS_DEPRECATED
#include <openssl/evp.h>
#include <openssl/hmac.h>
#include <openssl/sha.h>

#include "gen.h"

int main(int argc, char **argv) {
  const char *kernel;
  long size, iterations;
  parse_args(argc, argv, &kernel, &size, &iterations);
  int block = strcmp(kernel, "block") == 0;
  int hmac = strcmp(kernel, "hmac") == 0;
  if (!block && !hmac) {
    fprintf(stderr, "openssl: no kernel %s\n", kernel);
    return 2;
  }
  if (size < 4) {
    fprintf(stderr, "openssl: the size is at least 4 bytes\n");
    return 2;
  }
  inputs_t in = inputs(kernel, size, block ? 0 : 32, 0, 0, (size_t)size);
  uint8_t base[4];
  memcpy(base, in.msg, 4);
  uint8_t out[SHA256_DIGEST_LENGTH];
  uint32_t sum = FOLD_START;
  int64_t started = now_ns();
  for (long i = 0; i < iterations; i++) {
    tweak(in.msg, base, (uint32_t)i);
    if (block) {
      SHA256_CTX ctx;
      SHA256_Init(&ctx);
      SHA256_Update(&ctx, in.msg, (size_t)size);
      SHA256_Final(out, &ctx);
    } else {
      unsigned int n = 0;
      if (HMAC(EVP_sha256(), in.key, 32, in.msg, (size_t)size, out, &n) == NULL) {
        fprintf(stderr, "openssl: HMAC failed\n");
        return 1;
      }
    }
    sum = fold(sum, out, sizeof out);
  }
  report(sum, started);
  return 0;
}
