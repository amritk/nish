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
    verification: node tests/run.js tls && node tests/run.js rsa && node tests/run.js x509 && node tests/run.js ct_asm && node tests/run.js quic && node tests/nish-cmp.js && node scripts/security-scope.mjs && node scripts/gen-reference.mjs --check && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
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

**Owns:** `std/crypto/rsa.ts`, `std/crypto/rsa-*.ts` (new), `std/crypto/x509.ts`, `std/net/tls.ts`, `std/net/tls/**`, `std/net/tls-tcp.ts`, `std/net/quic.ts`, `std/net/quic-conn-params.ts`, `std/net/http3-server.ts`, `std/net/http1-server.ts`, `std/net/http2-tls.ts`, `std/net/http-server.ts`, `std/net/grpc.ts`, `std/README.md`, `tests/run.js`, `tests/nish-cmp.js`, `tests/ct-asm.js`, `tests/cases/ct_asm_rsa*` (new), `tests/link/*rsa*/**` (existing and new RSA cases on any listener), `tests/link/crypto_x509*/**`, `tests/link/net_tls_*/**`, `docs/security/crypto-rsa.md`, `docs/security/tls.md`, `docs/security/quic.md`, `docs/security/http3.md`, `docs/security/README.md`, `docs/guide/using-nish/tls-certificates.md`, `docs/guide/using-nish/http-server.md`, `THIRD_PARTY_NOTICES.md`

**Generated** (regenerated with the repo's tooling, never edited or hand-merged): `tests/self/goldens/checked/**`, `docs/reference/**`, `scalar.config.json`, `tests/differential/goldens/**`, `docs/IR_COOKBOOK.md`, `tests/wordings/*.err`, `tests/link/*/expected.caps.json`, `docs/reference/diagnostics/**`, `examples/break-web/help.ts`, `docs/site/break/**`

No `Model:` line: the stage designs a constant-time signing lane and touches secret handling.

**Merge:** every file this stage owns under `std/crypto/` and `std/net/tls*` is crypto, a sensitive path under the `/feature` merge gate. The PR is built and reviewed to convergence, then left for a human to merge (`sensitive paths: awaiting human merge`).

## Out of scope

- PKCS#1 v1.5 signing and the `rsa_pss_pss` schemes.
- RSA client certificates ([WP75](wp75-tls-client-reach.plan.md) keeps client certificates to P-256).
- TLS 1.2 on the server.

## Verification

```bash
node tests/run.js tls && node tests/run.js rsa && node tests/run.js x509 && node tests/run.js ct_asm && node tests/run.js quic && node tests/nish-cmp.js
```

```bash
node scripts/security-scope.mjs && node scripts/gen-reference.mjs --check && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
```

## Acceptance criteria

Derived from the plan's goal and #481's acceptance, not given separately.

1. A Nish TLS 1.3 server on TCP, configured with an RSA-2048 certificate (`sha256WithRSAEncryption`) and its PKCS#8 `PRIVATE KEY`, completes a handshake with `openssl s_client -tls1_3`, which reports the configured certificate as the one served, `TLSv1.3`, an AEAD suite, and an RSA-PSS peer signature.
2. `curl --tlsv1.3`, trusting that certificate, gets a response from the HTTP/1.1 TLS server and from the HTTP/2 TLS listener when both are configured with the RSA pair.
3. An HTTP/3 (QUIC) listener configured with the same RSA pair completes a handshake with a QUIC client that verifies its CertificateVerify.
4. A PKCS#1 `RSA PRIVATE KEY` loads and serves the same way, and an RSA key under 2048 bits is refused at configuration with an error, not a panic, so no server starts with it.
5. A server with a P-256 ECDSA certificate is still accepted by the same clients as before.
6. Signatures the new signer produces verify under OpenSSL, and the Wycheproof RSA-PSS vectors run and pass.
7. `node tests/run.js ct_asm` includes an RSA signing fixture and passes, and a `tests/run.js` check pins that the private key and the signing intermediates are wiped.
8. `node scripts/security-scope.mjs` passes with the new code in scope, and `docs/security/crypto-rsa.md`, `docs/security/tls.md` and their `docs/security/README.md` rows describe RSA signing on the server.
9. The TLS certificates guide page shows how to serve an RSA certificate and key.

