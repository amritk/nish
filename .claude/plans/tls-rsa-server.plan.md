---
name: RSA certificates on the TLS server, for HttpArena's mounted RSA-2048 pair
overview: The TLS server signs CertificateVerify only with ECDSA P-256, and std/crypto/rsa.ts only verifies. HttpArena mounts an RSA-2048 certificate and key at /certs/, and its validate.sh fails any TLS listener that does not serve that certificate, so every TLS profile WP71 wants (baseline-h2, static-h2, baseline-h3, static-h3, json-tls, 8gbit, unary-grpc-tls, connections-1m-tls) waits on this. Split out of WP34 S26 (#481), unchanged in scope, and placed after WP71 on the Roadmap.
priority: 90
labels: [ready]
issue: 2311
stages:
  - id: s1-rsa-server
    title: TLS RSA S1 — RSA-PSS CertificateVerify under an RSA certificate on the TLS and QUIC servers
    goal: The TLS server, on TCP and under QUIC, loads an RSA certificate and its PKCS#8 key and signs CertificateVerify with RSA-PSS (rsa_pss_rsae_sha256) under constant-time big-number arithmetic with the key held as a Secret, so curl, Chrome and HttpArena's openssl s_client probe accept HttpArena's mounted RSA-2048 pair over TLS 1.3, with Wycheproof vectors and its security record.
    verification: node tests/run.js tls && node tests/run.js ct_asm && node tests/run.js quic && node scripts/security-scope.mjs && node scripts/gen-reference.mjs --check && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    status: pending
    issue: 481
    todos:
      - id: s1-confirm-rest
        content: Confirm P-256 key shares, session tickets and record_size_limit are done in std/net/tls and close those items on the issue — see TLS RSA S1
        status: pending
      - id: s1-rsa-sign
        content: Add RSA-PSS signing with constant-time big-number arithmetic and a Secret private key to std/crypto/rsa.ts, which today only verifies — see TLS RSA S1
        status: pending
      - id: s1-key-parse
        content: Parse an RSA private key (PKCS#8 and PKCS#1) and certificate in std/crypto/x509.ts and offer rsa_pss_rsae_sha256 in the server's signature algorithms in std/net/tls.ts and std/net/quic.ts — see TLS RSA S1
        status: pending
      - id: s1-interop
        content: Add a tests/run.js check that serves an RSA-2048 leaf over TLS 1.3 on TCP and on QUIC and is accepted by openssl s_client and curl, and fails when the RSA scheme is removed — see TLS RSA S1
        status: pending
      - id: s1-record
        content: Add Wycheproof signing vectors, a ct_asm fixture, and update docs/security/crypto-rsa.md and docs/security/tls.md with their README rows — see TLS RSA S1
        status: pending
---

# RSA certificates on the TLS server

## Context

[`std/net/tls.ts`](../../std/net/tls.ts) signs CertificateVerify only with ECDSA P-256 (`tlsSignEcdsaP256`, `TlsP256Signer`), and [`std/crypto/rsa.ts`](../../std/crypto/rsa.ts) exports only `rsaVerifyPkcs1v15` and `rsaVerifyPss`. A server with an RSA certificate cannot be run.

That blocks [WP71](../../docs/wp71-httparena.md)'s HttpArena entry on every TLS listener. HttpArena mounts an RSA-2048 pair (`/certs/server.crt`, a PKCS#8 `/certs/server.key`, `sha256WithRSAEncryption`) for HTTP/1.1 on 8081 and HTTP/2, HTTP/3 and gRPC on 8443. Its `validate.sh` (`tls_posture_probe`, at HttpArena 3388e458) fails a listener whose certificate is not the mounted one ("a self-generated one -- an EC key above all -- makes handshakes cheaper than they are for every other entry") or that settles on anything but TLS 1.3. Eight of the 21 profiles on HttpArena's overall board, and the reference-only `static-tls`, are over TLS.

This was WP34 S26 (#481), filed as a WP34 network-stack follow-up. It is split into its own plan so it can be placed on the Roadmap beside WP71 rather than with WP34's other follow-ups. The scope is unchanged, apart from naming QUIC's CertificateVerify and the HttpArena pair in the acceptance.

## TLS RSA S1 — RSA-PSS CertificateVerify under an RSA certificate on the TLS and QUIC servers

#481 lists four server gaps. On main three look done: secp256r1 key shares (roadmap T1 row, #1449), session tickets (`std/net/tls/ticket.ts`, `docs/security/tls.md` resumption) and `record_size_limit` (WP39 G3). What stays: the server signs only with P-256 ECDSA, and `std/crypto/rsa.ts` says it is verification only.

That needs RSA-PSS signing with constant-time big numbers, a new crypto lane with its own vectors and audit. The private key is a `Secret<u8[]>` (`nish:secret`). Every intermediate is computed inside `expose` and wiped before return, as `CLAUDE.md` requires of `std/crypto`. The scheme is `rsa_pss_rsae_sha256`, the RSA scheme TLS 1.3 servers offer for an `rsaEncryption` key (RFC 8446 §4.2.3). The `rsa_pss_pss` schemes and PKCS#1 v1.5 signing stay out.

- **Keys.** The PKCS#8 `PRIVATE KEY` HttpArena mounts, and PKCS#1 `RSA PRIVATE KEY`, at 2048 to 4096 bits. A key under 2048 bits is refused, as the client side refuses one (`docs/security/tls.md`).
- **Both servers.** The TCP server (`std/net/tls.ts`, behind `Http1TlsServer`, `listenHttp2Tls` and the gRPC listener) and QUIC's handshake (`std/net/quic.ts`, behind `listenHttp3`) both sign CertificateVerify, and both take the RSA key.
- **Acceptance from the issue:** an RSA-certificate server accepted by `curl` and Chrome, plus Wycheproof vectors and a `docs/security/` record. The interop check also runs `openssl s_client` as HttpArena's posture probe does: it reads back the served certificate, TLS 1.3 and an AEAD suite.
- Client authentication stays out of scope.

Reads: `docs/security/crypto-rsa.md`, `docs/security/tls.md`, `docs/wp71-httparena.md` §2.
Likely files: `std/crypto/rsa.ts`, `std/crypto/x509.ts`, `std/net/tls.ts`, `std/net/quic.ts`, `tests/run.js`, `docs/security/crypto-rsa.md`, `docs/security/tls.md`, `docs/security/README.md`.

## Out of scope

- PKCS#1 v1.5 signing and the `rsa_pss_pss` schemes.
- RSA client certificates ([WP75](wp75-tls-client-reach.plan.md) keeps client certificates to P-256).
- TLS 1.2 on the server.

## Verification

```bash
node tests/run.js tls && node tests/run.js ct_asm && node tests/run.js quic
```

```bash
node scripts/security-scope.mjs && node scripts/gen-reference.mjs --check && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
```
