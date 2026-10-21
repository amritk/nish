/*
 * The hash family's OpenSSL twin, under the contract in
 * bench/crypto/README.md and the inputs in this family's README.md. Each
 * kernel goes through the OpenSSL 3 provider API with its algorithm fetched
 * once, before the clock starts: EVP_Digest for the digests, an EVP_MAC
 * context re-initialised per message for HMAC, and EVP_KDF_derive for HKDF.
 * The one-shot HMAC() and the EVP_PKEY HKDF route fetch the algorithm again
 * on every call, which would time OpenSSL's lookup rather than its hash.
 */
#include <openssl/core_names.h>
#include <openssl/evp.h>
#include <openssl/kdf.h>

#include "gen.h"

static void fail(const char *what) {
  fprintf(stderr, "openssl: %s failed\n", what);
  exit(1);
}

int main(int argc, char **argv) {
  const char *kernel;
  long size, iterations;
  parse_args(argc, argv, &kernel, &size, &iterations);
  int digest = strcmp(kernel, "sha256") == 0 || strcmp(kernel, "sha512") == 0;
  int hmac = strcmp(kernel, "hmac-sha256") == 0;
  int hkdf = strcmp(kernel, "hkdf-sha256") == 0;
  if (!digest && !hmac && !hkdf) {
    fprintf(stderr, "openssl: no kernel %s\n", kernel);
    return 2;
  }
  if (size < 4) {
    fprintf(stderr, "openssl: the size is at least 4 bytes\n");
    return 2;
  }
  inputs_t in = inputs(kernel, size, digest ? 0 : 32, 0, hkdf ? 10 : 0, (size_t)size);
  EVP_MD *md = EVP_MD_fetch(NULL, strcmp(kernel, "sha512") == 0 ? "SHA512" : "SHA256", NULL);
  EVP_MAC *mac = EVP_MAC_fetch(NULL, "HMAC", NULL);
  EVP_MAC_CTX *mctx = mac == NULL ? NULL : EVP_MAC_CTX_new(mac);
  EVP_KDF *kdf = EVP_KDF_fetch(NULL, "HKDF", NULL);
  EVP_KDF_CTX *kctx = kdf == NULL ? NULL : EVP_KDF_CTX_new(kdf);
  if (md == NULL || mctx == NULL || kctx == NULL) {
    fail("fetching the algorithms");
  }
  char sha256[] = "SHA256";
  OSSL_PARAM mac_params[] = {
      OSSL_PARAM_construct_utf8_string(OSSL_MAC_PARAM_DIGEST, sha256, 0),
      OSSL_PARAM_construct_end(),
  };
  OSSL_PARAM kdf_params[] = {
      OSSL_PARAM_construct_utf8_string(OSSL_KDF_PARAM_DIGEST, sha256, 0),
      OSSL_PARAM_construct_octet_string(OSSL_KDF_PARAM_SALT, in.key, 32),
      OSSL_PARAM_construct_octet_string(OSSL_KDF_PARAM_KEY, in.msg, (size_t)size),
      OSSL_PARAM_construct_octet_string(OSSL_KDF_PARAM_INFO, in.aad, 10),
      OSSL_PARAM_construct_end(),
  };
  uint8_t base[4];
  memcpy(base, in.msg, 4);
  uint8_t out[64];
  uint32_t sum = FOLD_START;
  int64_t started = now_ns();
  for (long i = 0; i < iterations; i++) {
    tweak(in.msg, base, (uint32_t)i);
    size_t n = 0;
    if (digest) {
      unsigned int len = 0;
      if (!EVP_Digest(in.msg, (size_t)size, out, &len, md, NULL)) {
        fail("EVP_Digest");
      }
      n = len;
    } else if (hmac) {
      if (!EVP_MAC_init(mctx, in.key, 32, mac_params) || !EVP_MAC_update(mctx, in.msg, (size_t)size) ||
          !EVP_MAC_final(mctx, out, &n, sizeof out)) {
        fail("HMAC");
      }
    } else {
      n = 42;
      if (EVP_KDF_derive(kctx, out, n, kdf_params) <= 0) {
        fail("HKDF");
      }
    }
    sum = fold(sum, out, n);
  }
  report(sum, started);
  return 0;
}
