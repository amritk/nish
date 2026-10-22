/*
 * The curves family's OpenSSL twin, under the contract in
 * bench/crypto/README.md and the inputs in this family's README.md. Every
 * kernel goes through the EVP_PKEY API, the one an application calls: X25519
 * and Ed25519 keys come in raw, the P-256 key as a SEC1 ECPrivateKey whose
 * public key OpenSSL computes. A key a kernel holds fixed is built before the
 * clock starts; X25519 of the base point and of a new peer builds the key it
 * is given on every iteration, because that is the only way in.
 */
#include <openssl/core_names.h>
#include <openssl/evp.h>
#include <openssl/x509.h>

#include "gen.h"

/* Messages the verify kernels cycle through, signed before the clock starts. */
#define RING 16

/* The ring entry changed after it was signed, so its verify must answer false. */
#define TAMPERED 1

static void fail(const char *what) {
  fprintf(stderr, "openssl: %s failed\n", what);
  exit(1);
}

/* The P-256 key whose private scalar is `d`, from a SEC1 ECPrivateKey naming prime256v1. */
static EVP_PKEY *p256_key(const uint8_t d[32]) {
  uint8_t der[51] = {0x30, 0x31, 0x02, 0x01, 0x01, 0x04, 0x20};
  memcpy(der + 7, d, 32);
  const uint8_t curve[] = {0xa0, 0x0a, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07};
  memcpy(der + 39, curve, sizeof curve);
  const uint8_t *p = der;
  EVP_PKEY *key = d2i_PrivateKey(EVP_PKEY_EC, NULL, &p, sizeof der);
  if (key == NULL) {
    fail("d2i_PrivateKey");
  }
  return key;
}

/* Folds the public key: P-256's 65-byte uncompressed point, or Ed25519's 32 bytes. */
static uint32_t fold_public(uint32_t sum, EVP_PKEY *key, int ec) {
  uint8_t pub[65];
  size_t n = sizeof pub;
  int ok = ec ? EVP_PKEY_get_octet_string_param(key, OSSL_PKEY_PARAM_ENCODED_PUBLIC_KEY, pub, n, &n)
              : EVP_PKEY_get_raw_public_key(key, pub, &n);
  if (!ok) {
    fail("reading the public key");
  }
  return fold(sum, pub, n);
}

/* The ECDSA signature of SHA-256(msg), DER-encoded, into `sig`. */
static size_t p256_sign(EVP_PKEY_CTX *ctx, const EVP_MD *md, const uint8_t *msg, size_t len, uint8_t *sig,
                        uint8_t digest[32]) {
  unsigned int dlen = 0;
  size_t n = 72;
  if (!EVP_Digest(msg, len, digest, &dlen, md, NULL) || EVP_PKEY_sign(ctx, sig, &n, digest, dlen) <= 0) {
    fail("EVP_PKEY_sign");
  }
  return n;
}

/* Whether `sig` is msg's signature: SHA-256 then ECDSA for P-256, Ed25519 otherwise. */
static int verify(EVP_PKEY *key, EVP_PKEY_CTX *ctx, EVP_MD_CTX *mctx, const EVP_MD *md, const uint8_t *msg,
                  size_t len, const uint8_t *sig, size_t n) {
  int r;
  if (ctx != NULL) {
    uint8_t digest[32];
    unsigned int dlen = 0;
    if (!EVP_Digest(msg, len, digest, &dlen, md, NULL)) {
      fail("EVP_Digest");
    }
    r = EVP_PKEY_verify(ctx, sig, n, digest, dlen);
  } else {
    if (!EVP_DigestVerifyInit(mctx, NULL, NULL, NULL, key)) {
      fail("EVP_DigestVerifyInit");
    }
    r = EVP_DigestVerify(mctx, sig, n, msg, len);
  }
  if (r < 0) {
    fail("verifying");
  }
  return r == 1;
}

int main(int argc, char **argv) {
  const char *kernel;
  long size, iterations;
  parse_args(argc, argv, &kernel, &size, &iterations);
  int base = strcmp(kernel, "x25519-base") == 0;
  int ladder = strcmp(kernel, "x25519") == 0;
  int ec = strncmp(kernel, "p256-", 5) == 0;
  int signing = strcmp(kernel, "p256-sign") == 0 || strcmp(kernel, "ed25519-sign") == 0;
  if (!base && !ladder && strcmp(kernel, "p256-sign") != 0 && strcmp(kernel, "p256-verify") != 0 &&
      strcmp(kernel, "ed25519-sign") != 0 && strcmp(kernel, "ed25519-verify") != 0) {
    fprintf(stderr, "openssl: no kernel %s\n", kernel);
    return 2;
  }
  if ((base || ladder) ? size != 32 : size < 4) {
    fprintf(stderr, "openssl: %s\n", (base || ladder) ? "an X25519 kernel's size is 32" : "the size is at least 4 bytes");
    return 2;
  }
  inputs_t in = inputs(kernel, size, base ? 0 : 32, 0, 0, (size_t)size);
  uint8_t start[4];
  memcpy(start, in.msg, 4);
  uint32_t sum = FOLD_START;
  uint8_t out[72];
  size_t n = 32;

  if (base) {
    int64_t started = now_ns();
    for (long i = 0; i < iterations; i++) {
      tweak(in.msg, start, (uint32_t)i);
      EVP_PKEY *key = EVP_PKEY_new_raw_private_key(EVP_PKEY_X25519, NULL, in.msg, 32);
      n = 32;
      if (key == NULL || !EVP_PKEY_get_raw_public_key(key, out, &n)) {
        fail("X25519 of the base point");
      }
      EVP_PKEY_free(key);
      sum = fold(sum, out, n);
    }
    report(sum, started);
    return 0;
  }

  if (ladder) {
    EVP_PKEY *key = EVP_PKEY_new_raw_private_key(EVP_PKEY_X25519, NULL, in.key, 32);
    EVP_PKEY_CTX *ctx = key == NULL ? NULL : EVP_PKEY_CTX_new(key, NULL);
    if (ctx == NULL || EVP_PKEY_derive_init(ctx) <= 0) {
      fail("the X25519 key");
    }
    uint8_t u[32];
    memcpy(u, in.msg, 32);
    int64_t started = now_ns();
    for (long i = 0; i < iterations; i++) {
      EVP_PKEY *peer = EVP_PKEY_new_raw_public_key(EVP_PKEY_X25519, NULL, u, 32);
      n = 32;
      if (peer == NULL || EVP_PKEY_derive_set_peer(ctx, peer) <= 0 || EVP_PKEY_derive(ctx, u, &n) <= 0) {
        fail("X25519");
      }
      EVP_PKEY_free(peer);
      sum = fold(sum, u, 32);
    }
    report(sum, started);
    return 0;
  }

  EVP_PKEY *key = ec ? p256_key(in.key) : EVP_PKEY_new_raw_private_key(EVP_PKEY_ED25519, NULL, in.key, 32);
  EVP_MD *md = EVP_MD_fetch(NULL, "SHA256", NULL);
  EVP_PKEY_CTX *ctx = ec ? EVP_PKEY_CTX_new(key, NULL) : NULL;
  EVP_MD_CTX *mctx = EVP_MD_CTX_new();
  if (key == NULL || md == NULL || mctx == NULL || (ec && ctx == NULL)) {
    fail("the key");
  }
  sum = fold_public(sum, key, ec);

  if (signing) {
    if (ec && EVP_PKEY_sign_init(ctx) <= 0) {
      fail("EVP_PKEY_sign_init");
    }
    uint8_t(*digests)[32] = malloc((size_t)iterations * 32 + 1);
    uint8_t(*sigs)[72] = ec ? malloc((size_t)iterations * 72 + 1) : NULL;
    size_t *lens = ec ? malloc((size_t)iterations * sizeof(size_t) + 1) : NULL;
    if (digests == NULL || (ec && (sigs == NULL || lens == NULL))) {
      fail("malloc");
    }
    int64_t started = now_ns();
    for (long i = 0; i < iterations; i++) {
      tweak(in.msg, start, (uint32_t)i);
      if (ec) {
        lens[i] = p256_sign(ctx, md, in.msg, (size_t)size, sigs[i], digests[i]);
      } else {
        n = 64;
        if (!EVP_DigestSignInit(mctx, NULL, NULL, NULL, key) ||
            !EVP_DigestSign(mctx, out, &n, in.msg, (size_t)size)) {
          fail("Ed25519 signing");
        }
        sum = fold(sum, out, n);
      }
    }
    if (ec) {
      // ECDSA's signatures are randomised, so what is folded is each digest
      // and whether its signature verifies, checked after the clock stops.
      int64_t stopped = now_ns();
      if (EVP_PKEY_verify_init(ctx) <= 0) {
        fail("EVP_PKEY_verify_init");
      }
      for (long i = 0; i < iterations; i++) {
        uint8_t ok = EVP_PKEY_verify(ctx, sigs[i], lens[i], digests[i], 32) == 1;
        sum = fold(fold(sum, digests[i], 32), &ok, 1);
      }
      started += now_ns() - stopped;
    }
    report(sum, started);
    return 0;
  }

  uint8_t *msgs[RING];
  uint8_t sigs[RING][72];
  size_t lens[RING];
  if (ec && EVP_PKEY_sign_init(ctx) <= 0) {
    fail("EVP_PKEY_sign_init");
  }
  for (uint32_t j = 0; j < RING; j++) {
    msgs[j] = malloc((size_t)size);
    if (msgs[j] == NULL) {
      fail("malloc");
    }
    memcpy(msgs[j], in.msg, (size_t)size);
    tweak(msgs[j], start, j);
    if (ec) {
      uint8_t digest[32];
      lens[j] = p256_sign(ctx, md, msgs[j], (size_t)size, sigs[j], digest);
    } else {
      lens[j] = 64;
      if (!EVP_DigestSignInit(mctx, NULL, NULL, NULL, key) ||
          !EVP_DigestSign(mctx, sigs[j], &lens[j], msgs[j], (size_t)size)) {
        fail("Ed25519 signing");
      }
    }
  }
  msgs[TAMPERED][size - 1] ^= 1;
  if (ec && EVP_PKEY_verify_init(ctx) <= 0) {
    fail("EVP_PKEY_verify_init");
  }
  int64_t started = now_ns();
  for (long i = 0; i < iterations; i++) {
    long j = i % RING;
    uint8_t ok = (uint8_t)verify(key, ctx, mctx, md, msgs[j], (size_t)size, sigs[j], lens[j]);
    if (ok != (j != TAMPERED)) {
      fprintf(stderr, "openssl: %s gave the wrong answer\n", kernel);
      return 1;
    }
    sum = fold(sum, &ok, 1);
  }
  report(sum, started);
  return 0;
}
