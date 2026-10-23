/*
 * The AEAD family's OpenSSL twin, under the contract in
 * bench/crypto/README.md and the inputs in this family's README.md. Each
 * cipher is fetched once and keyed once, before the clock starts; every
 * iteration then sets only the nonce with EVP_EncryptInit_ex or
 * EVP_DecryptInit_ex, as a TLS stack does per record, and runs the AAD, the
 * message and the tag through the one context.
 */
#include <openssl/evp.h>

#include "gen.h"

#define NONCE 12
#define NONCE_TWEAK 8
#define AAD 13
#define TAG 16
#define RING 16

static void fail(const char *what) {
  fprintf(stderr, "openssl: %s failed\n", what);
  exit(1);
}

/* Seals `msg` into `out` (ciphertext, then tag); the context holds the key. */
static void seal(EVP_CIPHER_CTX *ctx, const uint8_t *nonce, const uint8_t *aad, const uint8_t *msg, size_t n,
                 uint8_t *out) {
  int len = 0;
  if (!EVP_EncryptInit_ex(ctx, NULL, NULL, NULL, nonce) || !EVP_EncryptUpdate(ctx, NULL, &len, aad, AAD) ||
      !EVP_EncryptUpdate(ctx, out, &len, msg, (int)n) || !EVP_EncryptFinal_ex(ctx, out + len, &len) ||
      !EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_AEAD_GET_TAG, TAG, out + n)) {
    fail("seal");
  }
}

/* Opens `sealed` (ciphertext, then tag) into `out`; exits 1 when it does not authenticate. */
static void open_(EVP_CIPHER_CTX *ctx, const uint8_t *nonce, const uint8_t *aad, uint8_t *sealed, size_t n,
                  uint8_t *out) {
  int len = 0;
  if (!EVP_DecryptInit_ex(ctx, NULL, NULL, NULL, nonce) || !EVP_DecryptUpdate(ctx, NULL, &len, aad, AAD) ||
      !EVP_DecryptUpdate(ctx, out, &len, sealed, (int)n) ||
      !EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_AEAD_SET_TAG, TAG, sealed + n) ||
      EVP_DecryptFinal_ex(ctx, out + len, &len) <= 0) {
    fail("open");
  }
}

int main(int argc, char **argv) {
  const char *kernel;
  long size, iterations;
  parse_args(argc, argv, &kernel, &size, &iterations);
  /* `<cipher>-seal` or `<cipher>-open`. */
  size_t klen = strlen(kernel);
  const char *op = klen > 5 ? kernel + klen - 5 : "";
  int is_open = strcmp(op, "-open") == 0;
  char cipher_name[32];
  snprintf(cipher_name, sizeof cipher_name, "%.*s", (int)(klen > 5 ? klen - 5 : 0), kernel);
  const char *name = NULL;
  size_t key_len = 32;
  if (strcmp(cipher_name, "aes128gcm") == 0) {
    name = "AES-128-GCM";
    key_len = 16;
  } else if (strcmp(cipher_name, "aes256gcm") == 0) {
    name = "AES-256-GCM";
  } else if (strcmp(cipher_name, "chacha20poly1305") == 0) {
    name = "ChaCha20-Poly1305";
  }
  if (name == NULL || (!is_open && strcmp(op, "-seal") != 0)) {
    fprintf(stderr, "openssl: no kernel %s\n", kernel);
    return 2;
  }
  if (size < 4) {
    fprintf(stderr, "openssl: the size is at least 4 bytes\n");
    return 2;
  }
  size_t n = (size_t)size;
  inputs_t in = inputs(kernel, size, key_len, NONCE, AAD, n);
  EVP_CIPHER *cipher = EVP_CIPHER_fetch(NULL, name, NULL);
  EVP_CIPHER_CTX *ctx = EVP_CIPHER_CTX_new();
  if (cipher == NULL || ctx == NULL) {
    fail("fetching the cipher");
  }
  if (is_open ? !EVP_DecryptInit_ex(ctx, cipher, NULL, in.key, NULL)
              : !EVP_EncryptInit_ex(ctx, cipher, NULL, in.key, NULL)) {
    fail("keying the cipher");
  }
  uint8_t msg_base[4], nonce_base[4];
  memcpy(msg_base, in.msg, 4);
  memcpy(nonce_base, in.nonce + NONCE_TWEAK, 4);
  uint8_t *out = malloc(n + TAG);
  uint32_t sum = FOLD_START;
  if (!is_open) {
    int64_t started = now_ns();
    for (long i = 0; i < iterations; i++) {
      tweak(in.msg, msg_base, (uint32_t)i);
      tweak(in.nonce + NONCE_TWEAK, nonce_base, (uint32_t)i);
      seal(ctx, in.nonce, in.aad, in.msg, n, out);
      sum = fold(sum, out, n + TAG);
    }
    report(sum, started);
    return 0;
  }
  /* The ring: entry r is the seal of the message and nonce tweaked with r, made by a second, sealing context. */
  EVP_CIPHER_CTX *sealer = EVP_CIPHER_CTX_new();
  if (sealer == NULL || !EVP_EncryptInit_ex(sealer, cipher, NULL, in.key, NULL)) {
    fail("keying the sealer");
  }
  uint8_t *ring[RING];
  for (uint32_t r = 0; r < RING; r++) {
    ring[r] = malloc(n + TAG);
    tweak(in.msg, msg_base, r);
    tweak(in.nonce + NONCE_TWEAK, nonce_base, r);
    seal(sealer, in.nonce, in.aad, in.msg, n, ring[r]);
  }
  int64_t started = now_ns();
  for (long i = 0; i < iterations; i++) {
    uint32_t r = (uint32_t)(i % RING);
    tweak(in.nonce + NONCE_TWEAK, nonce_base, r);
    open_(ctx, in.nonce, in.aad, ring[r], n, out);
    sum = fold(sum, out, n);
  }
  report(sum, started);
  return 0;
}
