/*
 * The handshake family's OpenSSL twin, under the contract in
 * bench/crypto/README.md and the inputs in this family's README.md. Each
 * iteration runs one full TLS 1.3 handshake between a client SSL and a server
 * SSL joined by a BIO pair, in memory, then sends the message and reads it
 * back. The contexts, the certificate and the key are loaded once, before the
 * clock starts; the SSL objects are new every iteration, so no session is
 * resumed. OpenSSL 3.0 has no QUIC server, so the quic kernel is absent.
 */
#include <openssl/err.h>
#include <openssl/obj_mac.h>
#include <openssl/ssl.h>
#include <openssl/x509.h>

#include "gen.h"

/* The certificate and key every twin serves: tests/link/net_tls_common/server.ts's leaf. */
static const char LEAF_CERTIFICATE[] =
    "308201133081bba003020102020101300a06082a8648ce3d04030230143112301006035504030c096c6f63616c686f7374301e"
    "170d3236303130313030303030305a170d3236303130323030303030305a30143112301006035504030c096c6f63616c686f"
    "73743059301306072a8648ce3d020106082a8648ce3d0301070342000460fed4ba255a9d31c961eb74c6356d68c049b8923b"
    "61fa6ce669622e60f29fb67903fe1008b8bc99a41ae9e95628bc64f2f1b20c2d7e9f5177a3c294d4462299300a06082a8648"
    "ce3d040302034700304402200c0b8258087e44f6428624ddfd22cc752379dd41ca39ecfb138a13c8a47193e102200d00e6e9"
    "e36e4d0b5caa1cc1c6feea59eb10c1b010c9edff71a38b182cb8631d";
static const char LEAF_PKCS8[] =
    "308187020100301306072a8648ce3d020106082a8648ce3d030107046d306b0201010420c9afa9d845ba75166b5c215767b1"
    "d6934e50c3db36e89b127b8a622b120f6721a1440342000460fed4ba255a9d31c961eb74c6356d68c049b8923b61fa6ce669"
    "622e60f29fb67903fe1008b8bc99a41ae9e95628bc64f2f1b20c2d7e9f5177a3c294d4462299";

static void fail(const char *what) {
  fprintf(stderr, "openssl: %s failed\n", what);
  ERR_print_errors_fp(stderr);
  exit(1);
}

static size_t unhex(const char *hex, uint8_t *out) {
  size_t n = strlen(hex) / 2;
  for (size_t i = 0; i < n; i++) {
    unsigned v;
    sscanf(hex + 2 * i, "%2x", &v);
    out[i] = (uint8_t)v;
  }
  return n;
}

/* A context for one side, pinned to TLS 1.3, TLS_AES_128_GCM_SHA256 and X25519. */
static SSL_CTX *context(const SSL_METHOD *method) {
  SSL_CTX *ctx = SSL_CTX_new(method);
  if (ctx == NULL || !SSL_CTX_set_min_proto_version(ctx, TLS1_3_VERSION) ||
      !SSL_CTX_set_max_proto_version(ctx, TLS1_3_VERSION) ||
      !SSL_CTX_set_ciphersuites(ctx, "TLS_AES_128_GCM_SHA256") || !SSL_CTX_set1_groups_list(ctx, "X25519")) {
    fail("configuring a context");
  }
  SSL_CTX_set_session_cache_mode(ctx, SSL_SESS_CACHE_OFF);
  return ctx;
}

/* Runs both handshakes over the pair until each side is done. */
static void handshake(SSL *client, SSL *server) {
  int cdone = 0, sdone = 0;
  for (int turns = 0; !(cdone && sdone); turns++) {
    if (turns > 16) {
      fail("the handshake");
    }
    if (!cdone) {
      int r = SSL_do_handshake(client);
      if (r == 1) {
        cdone = 1;
      } else if (SSL_get_error(client, r) != SSL_ERROR_WANT_READ) {
        fail("the client handshake");
      }
    }
    if (!sdone) {
      int r = SSL_do_handshake(server);
      if (r == 1) {
        sdone = 1;
      } else if (SSL_get_error(server, r) != SSL_ERROR_WANT_READ) {
        fail("the server handshake");
      }
    }
  }
}

int main(int argc, char **argv) {
  const char *kernel;
  long size, iterations;
  parse_args(argc, argv, &kernel, &size, &iterations);
  if (strcmp(kernel, "tls13") != 0) {
    fprintf(stderr, "openssl: no kernel %s\n", kernel);
    return 2;
  }
  if (size < 4) {
    fprintf(stderr, "openssl: the size is at least 4 bytes\n");
    return 2;
  }
  inputs_t in = inputs(kernel, size, 0, 0, 0, (size_t)size);
  uint8_t der[512];
  const uint8_t *p = der;
  size_t n = unhex(LEAF_CERTIFICATE, der);
  X509 *leaf = d2i_X509(NULL, &p, (long)n);
  p = der;
  n = unhex(LEAF_PKCS8, der);
  EVP_PKEY *key = d2i_AutoPrivateKey(NULL, &p, (long)n);
  SSL_CTX *sctx = context(TLS_server_method());
  SSL_CTX *cctx = context(TLS_client_method());
  // No tickets: each handshake is a full one, and none is offered for resumption.
  if (leaf == NULL || key == NULL || SSL_CTX_use_certificate(sctx, leaf) != 1 ||
      SSL_CTX_use_PrivateKey(sctx, key) != 1 || !SSL_CTX_set_num_tickets(sctx, 0)) {
    fail("loading the leaf");
  }
  // The leaf's validity ended in 2026 and it names no trust anchor, so the
  // client checks the server's CertificateVerify signature but not the chain,
  // as every twin does.
  SSL_CTX_set_verify(cctx, SSL_VERIFY_NONE, NULL);
  uint8_t base[4];
  memcpy(base, in.msg, 4);
  uint8_t *out = malloc((size_t)size + 4);
  uint8_t *echo = malloc((size_t)size);
  uint32_t sum = FOLD_START;
  int64_t started = now_ns();
  for (long i = 0; i < iterations; i++) {
    tweak(in.msg, base, (uint32_t)i);
    SSL *client = SSL_new(cctx);
    SSL *server = SSL_new(sctx);
    BIO *cbio = NULL, *sbio = NULL;
    if (client == NULL || server == NULL || !BIO_new_bio_pair(&cbio, 0, &sbio, 0)) {
      fail("a new connection");
    }
    SSL_set_bio(client, cbio, cbio);
    SSL_set_bio(server, sbio, sbio);
    SSL_set_connect_state(client);
    SSL_set_accept_state(server);
    handshake(client, server);
    if (SSL_write(client, in.msg, (int)size) != size || SSL_read(server, echo, (int)size) != size ||
        SSL_write(server, echo, (int)size) != size || SSL_read(client, out + 4, (int)size) != size) {
      fail("the echo");
    }
    uint16_t suite = SSL_CIPHER_get_protocol_id(SSL_get_current_cipher(client));
    int group = SSL_get_negotiated_group(client);
    uint16_t id = group == NID_X25519 ? 0x001d : 0xffff;
    out[0] = (uint8_t)(suite >> 8);
    out[1] = (uint8_t)suite;
    out[2] = (uint8_t)(id >> 8);
    out[3] = (uint8_t)id;
    sum = fold(sum, out, (size_t)size + 4);
    SSL_free(client);
    SSL_free(server);
  }
  report(sum, started);
  return 0;
}
