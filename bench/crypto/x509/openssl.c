/*
 * The x509 family's OpenSSL twin: X509_new, X509_sign, d2i_X509 and
 * X509_verify, under the contract in bench/crypto/README.md and the inputs in
 * this family's README.md. The P-256 key comes in as a SEC1 ECPrivateKey whose
 * public key OpenSSL computes, before the clock starts.
 */
#include <openssl/core_names.h>
#include <openssl/evp.h>
#include <openssl/x509.h>
#include <openssl/x509v3.h>

#include "gen.h"

/* The subject's and issuer's common name. */
#define COMMON_NAME "bench.nish.dev"

/* notBefore: 2026-01-01T00:00:00Z, in seconds. */
#define NOT_BEFORE 1767225600

/* The validity, in days. */
#define DAYS 14

/*
 * The certificate x509-parse reads: Nish's x509-mint output for its first
 * iteration, so every twin parses the same bytes.
 */
static const char FIXED_CERT[] = "3082014e3081f6a003020102021057a8a60ac6cf332f0d105dba046fb40d300a06082a8648ce3d04030230193117301506035504030c0e62656e63682e6e6973682e646576301e170d3236303130313030303030305a170d3236303131353030303030305a30193117301506035504030c0e62656e63682e6e6973682e6465763059301306072a8648ce3d020106082a8648ce3d030107034200046773f52bac85b0278dbc1c6ab010e6a63ab5cb19673672f3a66e3b53e5fc31fa6881cfb754e458be32e5c105f96ac0dc83f02224f7c4f0f56ec4f165496b0e53a320301e300c0603551d130101ff04023000300e0603551d0f0101ff040403020780300a06082a8648ce3d04030203470030440220706060f8d5a0c763dafd8f5a9a7cfd6131b7eba82739420235dcd9f91b2371f102207d9f5543446e841cc9029d83741fd9ed9753120cd1eefa51f098e6f60dc74742";

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

/* Adds the extension `nid` with the value OpenSSL's config syntax gives it. */
static void add_extension(X509 *cert, int nid, const char *value) {
  X509V3_CTX ctx;
  X509V3_set_ctx_nodb(&ctx);
  X509V3_set_ctx(&ctx, cert, cert, NULL, NULL, 0);
  X509_EXTENSION *ext = X509V3_EXT_conf_nid(NULL, &ctx, nid, value);
  if (ext == NULL || !X509_add_ext(cert, ext, -1)) {
    fail("adding an extension");
  }
  X509_EXTENSION_free(ext);
}

/*
 * A self-signed certificate for `serial`, DER-encoded into `*out`, with the
 * extensions every twin writes: a critical basicConstraints CA:FALSE and a
 * critical keyUsage digitalSignature.
 */
static int mint(EVP_PKEY *key, const uint8_t *serial, size_t len, uint8_t **out) {
  X509 *cert = X509_new();
  X509_NAME *name = X509_NAME_new();
  BIGNUM *bn = BN_bin2bn(serial, (int)len, NULL);
  if (cert == NULL || name == NULL || bn == NULL || !X509_set_version(cert, X509_VERSION_3) ||
      BN_to_ASN1_INTEGER(bn, X509_get_serialNumber(cert)) == NULL ||
      !X509_NAME_add_entry_by_NID(name, NID_commonName, MBSTRING_UTF8, (const unsigned char *)COMMON_NAME, -1, -1,
                                  0) ||
      !X509_set_subject_name(cert, name) || !X509_set_issuer_name(cert, name) ||
      ASN1_TIME_set(X509_getm_notBefore(cert), NOT_BEFORE) == NULL ||
      ASN1_TIME_set(X509_getm_notAfter(cert), NOT_BEFORE + DAYS * 86400) == NULL || !X509_set_pubkey(cert, key)) {
    fail("building the certificate");
  }
  add_extension(cert, NID_basic_constraints, "critical,CA:FALSE");
  add_extension(cert, NID_key_usage, "critical,digitalSignature");
  if (X509_sign(cert, key, EVP_sha256()) <= 0) {
    fail("X509_sign");
  }
  *out = NULL;
  int n = i2d_X509(cert, out);
  if (n <= 0) {
    fail("i2d_X509");
  }
  BN_free(bn);
  X509_NAME_free(name);
  X509_free(cert);
  return n;
}

/* Folds `t` as seconds since 1970, eight big-endian bytes. */
static uint32_t fold_seconds(uint32_t sum, const ASN1_TIME *t) {
  static ASN1_TIME *epoch = NULL;
  int days = 0, secs = 0;
  if ((epoch == NULL && (epoch = ASN1_TIME_set(NULL, 0)) == NULL) || !ASN1_TIME_diff(&days, &secs, epoch, t)) {
    fail("ASN1_TIME_diff");
  }
  uint64_t s = (uint64_t)days * 86400 + (uint64_t)secs;
  uint8_t be[8];
  for (int k = 0; k < 8; k++) {
    be[k] = (uint8_t)(s >> (56 - 8 * k));
  }
  return fold(sum, be, 8);
}

/*
 * What both kernels fold for a certificate: the common name, the validity,
 * the point and whether its self-signature verifies.
 */
static uint32_t fold_certificate(uint32_t sum, X509 *cert) {
  X509_NAME *subject = X509_get_subject_name(cert);
  int at = X509_NAME_get_index_by_NID(subject, NID_commonName, -1);
  ASN1_STRING *cn = at < 0 ? NULL : X509_NAME_ENTRY_get_data(X509_NAME_get_entry(subject, at));
  EVP_PKEY *pub = X509_get0_pubkey(cert);
  uint8_t point[65];
  size_t n = sizeof point;
  if (cn == NULL || pub == NULL ||
      !EVP_PKEY_get_octet_string_param(pub, OSSL_PKEY_PARAM_ENCODED_PUBLIC_KEY, point, n, &n)) {
    fail("reading the certificate");
  }
  /* X509_verify checks the signature alone, as the other twins check it. */
  uint8_t ok = X509_verify(cert, pub) == 1;
  sum = fold(sum, ASN1_STRING_get0_data(cn), (size_t)ASN1_STRING_length(cn));
  sum = fold_seconds(fold_seconds(sum, X509_get0_notBefore(cert)), X509_get0_notAfter(cert));
  return fold(fold(sum, point, n), &ok, 1);
}

static X509 *parse(const uint8_t *der, long len) {
  const uint8_t *p = der;
  X509 *cert = d2i_X509(NULL, &p, len);
  if (cert == NULL || p != der + len) {
    fail("d2i_X509");
  }
  return cert;
}

int main(int argc, char **argv) {
  const char *kernel;
  long size, iterations;
  parse_args(argc, argv, &kernel, &size, &iterations);
  uint32_t sum = FOLD_START;

  if (strcmp(kernel, "x509-mint") == 0) {
    if (size < 4 || size > 20) {
      fprintf(stderr, "openssl: x509-mint's size is the serial's length, 4 to 20 bytes\n");
      return 2;
    }
    inputs_t in = inputs(kernel, size, 32, 0, 0, (size_t)size);
    uint8_t start[4];
    memcpy(start, in.msg, 4);
    EVP_PKEY *key = p256_key(in.key);
    uint8_t **certs = malloc((size_t)iterations * sizeof(uint8_t *) + 1);
    int *lens = malloc((size_t)iterations * sizeof(int) + 1);
    uint8_t serial[20];
    if (certs == NULL || lens == NULL) {
      fail("malloc");
    }
    int64_t started = now_ns();
    for (long i = 0; i < iterations; i++) {
      tweak(in.msg, start, (uint32_t)i);
      memcpy(serial, in.msg, (size_t)size);
      /* A positive INTEGER whose first octet is not zero, so it is encoded as it is. */
      serial[0] = (uint8_t)((serial[0] & 0x3f) | 0x40);
      lens[i] = mint(key, serial, (size_t)size, &certs[i]);
    }
    /*
     * ECDSA's signatures are randomised, so what is folded is what parsing
     * each certificate back gives, after the clock stops.
     */
    int64_t stopped = now_ns();
    for (long i = 0; i < iterations; i++) {
      X509 *cert = parse(certs[i], lens[i]);
      const ASN1_INTEGER *sn = X509_get0_serialNumber(cert);
      sum = fold_certificate(fold(sum, ASN1_STRING_get0_data(sn), (size_t)ASN1_STRING_length(sn)), cert);
      X509_free(cert);
    }
    report(sum, started + (now_ns() - stopped));
    return 0;
  }

  if (strcmp(kernel, "x509-parse") == 0) {
    long len = (long)(sizeof FIXED_CERT - 1) / 2;
    uint8_t *der = malloc((size_t)len);
    if (der == NULL) {
      fail("malloc");
    }
    for (long k = 0; k < len; k++) {
      unsigned int byte;
      if (sscanf(FIXED_CERT + 2 * k, "%2x", &byte) != 1) {
        fail("reading the hex");
      }
      der[k] = (uint8_t)byte;
    }
    if (size != len) {
      fprintf(stderr, "openssl: x509-parse's size is %ld, the fixed certificate's length\n", len);
      return 2;
    }
    int64_t started = now_ns();
    for (long i = 0; i < iterations; i++) {
      X509 *cert = parse(der, len);
      sum = fold_certificate(sum, cert);
      X509_free(cert);
    }
    report(sum, started);
    return 0;
  }

  fprintf(stderr, "openssl: no kernel %s\n", kernel);
  return 2;
}
