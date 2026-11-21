---
name: WP75 — TLS client reach, client certificates, macOS Keychain roots and an opt-in TLS 1.2
overview: The TLS client behind nish/net/fetch speaks TLS 1.3 only, refuses a server's CertificateRequest, and on macOS trusts only the roots in /etc/ssl, so a Nish API client cannot reach a server that is TLS 1.2-only, one that requires a client certificate, or one signed by a root an administrator installed in the Keychain. Answer CertificateRequest with a P-256 client certificate (S1), read the Keychain's trusted roots on macOS (S2), and add a narrow opt-in TLS 1.2 profile, which the owner has approved as an exception to TLS-7 (S3 to S5).
priority: 120
labels: [ready]
issue: 2075
stages:
  - id: s1-client-certs
    title: WP75 S1 — client certificates in the TLS 1.3 client and both fetch clients
    goal: A TlsClientConfig given a certificate chain and a P-256 key answers a CertificateRequest with Certificate and an ecdsa_secp256r1_sha256 CertificateVerify, answers an empty Certificate when it has none or the server accepts no scheme it can sign, and fetch takes the pair from PEM files.
    verification: node tests/run.js net_tls_client && node tests/run.js net_http_fetch_tls && node scripts/security-scope.mjs && node scripts/gen-reference.mjs --check && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    issue: 2076
    todos:
      - id: s1-state-machine
        content: Accept CertificateRequest after EncryptedExtensions in std/net/tls/client.ts, keeping its context and signature_algorithms, and send Certificate, CertificateVerify and Finished in order — see WP75 S1
        status: pending
      - id: s1-signing
        content: Sign the client CertificateVerify content with p256SignSha256 inside expose, wiping every intermediate, and add the client context string to std/net/tls/codec.ts — see WP75 S1
        status: pending
      - id: s1-fetch-options
        content: Add HttpOptions.clientCertPemPath and clientKeyPemPath to std/net/fetch.ts, loaded through x509ParseChain and x509ParseP256PrivateKey, refusing an encrypted or non-P-256 key with a code — see WP75 S1
        status: pending
      - id: s1-tests
        content: Add sans-IO cases to tests/link/net_tls_client_handshake and an openssl s_server -Verify interop check in tests/run.js beside the existing tls-tcp one — see WP75 S1
        status: pending
      - id: s1-record
        content: Narrow TLS-7 in docs/security/tls.md to what stays refused, add the client-key handling to its scope, update the README row and docs/guide/using-nish/tls-client.md — see WP75 S1
        status: pending
  - id: s2-keychain-roots
    title: WP75 S2 — the macOS Keychain's trusted roots in pkiLoadSystemRoots
    goal: On macOS with SSL_CERT_FILE and SSL_CERT_DIR unset, pkiLoadSystemRoots adds the roots the system, admin and user trust-settings domains mark trusted for SSL and drops any they mark denied, closing PKI-R7.
    verification: node tests/run.js crypto_pki_roots && node tests/run.js c-symbols && node scripts/security-scope.mjs && node scripts/gen-reference.mjs --check && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    issue: 2077
    todos:
      - id: s2-reader
        content: Add a darwin-only builtin in a runtime C file that reads the system, admin and user trust-settings domains through Security.framework and answers DER certificates with a trust verdict each, reserved in src/c-symbols.ts — see WP75 S2
        status: pending
      - id: s2-link
        content: Link -framework Security and -framework CoreFoundation in scripts/build.sh on darwin only when the program reaches the builtin, and declare it in runtime/nish.d.ts with its capability — see WP75 S2
        status: pending
      - id: s2-merge
        content: Merge the Keychain's trusted roots into pkiLoadSystemRoots in std/crypto/pki-roots.ts after the bundle, honouring deny settings and the existing caps, and count skips in skipped — see WP75 S2
        status: pending
      - id: s2-ci-job
        content: Add a scoped macos-keychain job to .github/workflows/ci.yml with its scripts/ci-scope.mjs lane and a per-command test in node tests/run.js ci-scope, as sha256-macos is — see WP75 S2
        status: pending
      - id: s2-tests
        content: Add a check run by that job that a root installed with security add-trusted-cert into a throwaway keychain is trusted by fetchSync and a denied one is not — see WP75 S2
        status: pending
      - id: s2-record
        content: Close PKI-R7 in docs/security/crypto-pki.md with the before/after test, update the README rows and docs/guide/using-nish/tls-certificates.md — see WP75 S2
        status: pending
  - id: s3-tls12-design
    title: WP75 S3 — the opt-in TLS 1.2 profile, written down before any code
    goal: docs/wp75-tls-client-reach.md fixes the opt-in TLS 1.2 client profile (suites, groups, signatures, required and refused extensions, downgrade rules) that S4 and S5 build, and docs/security/tls.md records the owner's decision to allow it as an exception to TLS-7.
    verification: node docs/check-links.mjs && npm run lint
    issue: 2078
    todos:
      - id: s3-profile
        content: Write the profile into docs/wp75-tls-client-reach.md (ECDHE only, AEAD suites only, extended_master_secret required, no renegotiation or resumption, the downgrade sentinel still checked) — see WP75 S3
        status: pending
      - id: s3-record-decision
        content: Record in TLS-7 of docs/security/tls.md that an opt-in TLS 1.2 client profile is planned by the owner's decision, with the default unchanged — see WP75 S3
        status: pending
  - id: s4-tls12-primitives
    title: WP75 S4 — the TLS 1.2 PRF and AEAD record protection
    goal: std/net/tls gains the RFC 5246 PRF over HMAC-SHA256 and HMAC-SHA384, the extended master secret of RFC 7627, and TLS 1.2 AEAD record protection for AES-GCM and ChaCha20-Poly1305, each matching published vectors.
    verification: node tests/run.js net_tls12 && node scripts/security-scope.mjs && node scripts/gen-reference.mjs --check && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    issue: 2079
    todos:
      - id: s4-prf
        content: Add std/net/tls/prf12.ts with the P_SHA256 and P_SHA384 PRF, the extended master secret, key expansion and verify_data, secrets as Secret and wiped — see WP75 S4
        status: pending
      - id: s4-record
        content: Add TLS 1.2 AEAD sealing and opening (explicit nonce for AES-GCM, RFC 7905 nonce for ChaCha20-Poly1305, the 13-byte additional data) beside std/net/tls/record.ts — see WP75 S4
        status: pending
      - id: s4-vectors
        content: Add tests/link/net_tls12_prf and net_tls12_record against vectors from a reference implementation, recorded with the command that made them — see WP75 S4
        status: pending
  - id: s5-tls12-client
    title: WP75 S5 — the opt-in TLS 1.2 client handshake and HttpOptions.minTlsVersion
    goal: With HttpOptions.minTlsVersion set to TLS 1.2, fetch offers TLS 1.3 and the S3 profile of TLS 1.2, completes a TLS 1.2 handshake with a server that picks it, and refuses every shape the profile refuses; the default stays TLS 1.3 only.
    verification: node tests/run.js net_tls12 && node tests/run.js net_tls_client && node tests/run.js net_http_fetch_tls && node scripts/security-scope.mjs && node scripts/gen-reference.mjs --check && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    issue: 2080
    todos:
      - id: s5-handshake
        content: Add std/net/tls/client12.ts, the sans-IO TLS 1.2 client from ServerHello to Finished for the S3 profile, with ServerKeyExchange signatures checked by the existing verifiers and rsaVerifyPkcs1v15 — see WP75 S5
        status: pending
      - id: s5-version-select
        content: Offer TLS 1.2 in std/net/tls/client.ts only when the config allows it, hand a TLS 1.2 ServerHello to client12, and keep the downgrade sentinel check when it is not allowed — see WP75 S5
        status: pending
      - id: s5-fetch
        content: Add HttpOptions.minTlsVersion (TLS_VERSION_1_3 default, TLS_VERSION_1_2 opt-in) to std/net/fetch.ts and RequestInit — see WP75 S5
        status: pending
      - id: s5-tests
        content: Add refusal cases to tests/link/net_tls_client_refusals and openssl s_server -tls1_2 interop checks per suite in tests/run.js — see WP75 S5
        status: pending
      - id: s5-record
        content: Add the TLS 1.2 client to docs/security/tls.md (scope, findings, TLS-7 narrowed), its README row and docs/guide/using-nish/tls-client.md — see WP75 S5
        status: pending
---

# WP75 — TLS client reach

## Context

[`nish/net/fetch`](../../std/net/fetch.ts) runs TLS through the sans-IO client in [`std/net/tls/client.ts`](../../std/net/tls/client.ts) and [`record-client.ts`](../../std/net/tls/record-client.ts), with trust from [`pkiLoadSystemRoots`](../../std/crypto/pki-roots.ts) or `HttpOptions.rootsPemPath` (fetch.ts:1715–1727). What it refuses today:

| Gap | Where | Record |
| --- | --- | --- |
| TLS 1.2 and below | `checkHello`, client.ts:745–775 (`protocol_version`, or `illegal_parameter` for the downgrade sentinel) | TLS-7, [`docs/security/tls.md`](../../docs/security/tls.md):198, **open by design** ("refusing the older protocol is the point", #480) |
| Client certificates | a CertificateRequest in `WAIT_CERTIFICATE` is `unexpected_message`, client.ts:722–740 | TLS-7 |
| Roots an administrator added to the macOS Keychain | `pkiLoadSystemRoots` reads `SSL_CERT_FILE`/`SSL_CERT_DIR`, then Go's bundle paths and `/etc/ssl/certs` | PKI-R7, [`docs/security/crypto-pki.md`](../../docs/security/crypto-pki.md):290, accepted |

A generated API client or CLI meets all three: enterprise and banking APIs require mutual TLS, some still terminate on TLS 1.2-only load balancers, and corporate machines trust a proxy root that lives only in the Keychain.

What exists to build on: `p256SignSha256` and `ed25519Sign`; `x509ParseP256PrivateKey` (SEC1 or PKCS#8, P-256 only, x509.ts:1429); `tlsWriteCertificate` and `tlsWriteCertificateVerify` in [`codec.ts`](../../std/net/tls/codec.ts):1522–1546 (written for the server, direction-neutral); `rsaVerifyPkcs1v15` and `rsaVerifyPss`; `hmacSha256`/`hmacSha384`; `aesGcmSeal`/`Open` and `chacha20Poly1305Seal`/`Open`; and `tests/run.js`'s existing `openssl s_server` interop harness (around line 4756). Missing: P-384 and RSA signing, any private-key parser beyond P-256, and a TLS 1.2 PRF.

S1 and S2 are independent. S4 and S5 wait on S3's written profile.

## Approach

- **Client certificates on TLS 1.3 only**, with P-256 keys: the only key type the repository can both parse and sign with. RSA and P-384 client keys need signing code that does not exist; Ed25519 needs a key parser. Both are out of scope here.
- **No platform verifier.** S2 only adds roots to the set the existing `pkiVerifyServer` checks against, so the chain-building policy stays the one `crypto-pki.md` records.
- **TLS 1.2 is opt-in and narrow, by the owner's decision.** TLS-7 refused it on purpose. The owner has approved an opt-in client profile as an exception, so S3 writes the profile down before any code, and the default stays TLS 1.3 only.

## WP75 S1 — client certificates in the TLS 1.3 client and both fetch clients

- **State machine** (RFC 8446 §4.3.2, §4.4.2). After EncryptedExtensions, accept an optional CertificateRequest: keep its `certificate_request_context` and its `signature_algorithms`. After the server's Finished, send Certificate (echoing the context) and, when the chain is not empty, CertificateVerify, then Finished. With no configured chain, or when the request does not list `ecdsa_secp256r1_sha256` (0x0403), send an empty Certificate and no CertificateVerify, as §4.4.2 requires, and let the server decide.
- **Signing.** The content is 64 spaces, `"TLS 1.3, client CertificateVerify"`, a zero byte and the transcript hash (§4.4.3), beside the server's in codec.ts. The key is a `Secret<u8[]>`; signing runs inside `expose`, and every intermediate is wiped (CLAUDE.md, Security).
- **Config.** `TlsClientConfig` gains `clientChain: u8[][] | null` and `clientKey: Secret<u8[]> | null`. `HttpOptions.clientCertPemPath` and `clientKeyPemPath` (both or neither) load them once per client. A missing file, an encrypted key, a non-P-256 key or a key that does not match the leaf's public key is a new `HTTP_E_CLIENT_CERT` code, before any connection.
- **Tests.** Sans-IO in `tests/link/net_tls_client_handshake`: a request answered with a chain, with an empty Certificate, and with a scheme list lacking 0x0403. Interop in `tests/run.js`: `openssl s_server -Verify 1 -CAfile <ca>` accepts the client, and `-Verify 1` without a client cert refuses it.
- **Record.** TLS-7 in [`docs/security/tls.md`](../../docs/security/tls.md) is narrowed to what stays refused (TLS 1.2, 0-RTT, client resumption); the client key's handling is added to the scope with its wipe test; the README row's counts move. [`docs/guide/using-nish/tls-client.md`](../../docs/guide/using-nish/tls-client.md) gains a "Client certificates" section.

## WP75 S2 — the macOS Keychain's trusted roots in pkiLoadSystemRoots

When `SSL_CERT_FILE` and `SSL_CERT_DIR` are unset on darwin, `pkiLoadSystemRoots` reads the bundle it reads today, then adds the certificates the system, admin and user trust-settings domains mark as trusted roots for SSL, and drops any certificate a domain marks as denied. Linux is unchanged. The existing caps (`PKI_ROOTS_MAX_ROOTS` and the others) still apply, and what they drop is counted in `skipped`.

### Decided: Security.framework from the runtime

The owner chose the in-process reader. A darwin-only function in a `runtime/*.c` file calls `SecTrustSettingsCopyCertificates` and `SecTrustSettingsCopyTrustSettings` for the system, admin and user domains. It answers each certificate's DER and a verdict: trusted as a root for SSL, denied, or unspecified (unspecified roots in the system domain count as trusted, as macOS treats them). It runs with no child process and honours per-certificate trust settings. What it costs:

- a new builtin, declared in [`runtime/nish.d.ts`](../../runtime/nish.d.ts) with its capability and doc comment, and refused on other targets at compile time;
- `-framework Security -framework CoreFoundation` on darwin links in `scripts/build.sh`, only when the program reaches the builtin;
- a [`src/c-symbols.ts`](../../src/c-symbols.ts) reservation for every new C call (`node tests/run.js c-symbols`);
- the runtime file's scope in a `docs/security/` record (`node scripts/security-scope.mjs`).

Spawning `/usr/bin/security` was rejected because it ignores trust settings and would give `fetch` the `process.spawn` capability.

The main `test` job runs on ubuntu only, so the tests need a macOS lane: a `macos-keychain` job in [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml), scoped by `scripts/ci-scope.mjs` the way `sha256-macos` is, with a per-command test in `node tests/run.js ci-scope` (CLAUDE.md, "A CI lane reads what its commands read"). WP77 S2 runs its Keychain checks in the same job. A throwaway keychain gets a test root through `security add-trusted-cert`; `fetchSync` to a local server signed by it succeeds, and a root marked deny fails with `HTTP_E_CERTIFICATE`. PKI-R7 closes in [`docs/security/crypto-pki.md`](../../docs/security/crypto-pki.md) with that test, and [`docs/guide/using-nish/tls-certificates.md`](../../docs/guide/using-nish/tls-certificates.md) says where roots come from on each OS.

## WP75 S3 — the opt-in TLS 1.2 profile, written down before any code

### Decided: yes, opt-in only

TLS-7 says the client refuses TLS 1.2 by design. The owner has decided to allow an **opt-in** client profile. `HttpOptions.minTlsVersion` defaults to TLS 1.3, and only a caller that sets TLS 1.2 gets the narrow profile below. TLS-7 is narrowed rather than closed: the default, the server and everything outside the profile stay refused.

The profile to write into `docs/wp75-tls-client-reach.md`:

| Area | Profile |
| --- | --- |
| Key exchange | ECDHE only, x25519 and secp256r1; no RSA key transport, no finite-field DHE |
| Suites | `ECDHE_ECDSA` and `ECDHE_RSA` with `AES_128_GCM_SHA256`, `AES_256_GCM_SHA384` and `CHACHA20_POLY1305_SHA256`; no CBC, no RC4, no NULL |
| Server signatures | ECDSA P-256/P-384, RSA-PSS, RSA PKCS#1 v1.5 with SHA-256 or above; no SHA-1 |
| Required | `extended_master_secret` (RFC 7627), secure renegotiation's empty `renegotiation_info` (RFC 5746) |
| Refused | renegotiation (a HelloRequest is ignored, a second handshake is a fatal alert), session resumption, compression, a server that omits extended master secret |
| Version | TLS 1.3 offered first; the TLS 1.2 sentinel in `server_random` is still refused when 1.2 is not allowed |

## WP75 S4 — the TLS 1.2 PRF and AEAD record protection

- `std/net/tls/prf12.ts`: `P_hash` over `hmacSha256` and `hmacSha384` (RFC 5246 §5), the extended master secret over the session hash (RFC 7627 §4), key expansion into client and server write keys and IVs, and 12-byte `verify_data`. Secrets are `Secret<u8[]>`, wiped.
- AEAD records beside [`record.ts`](../../std/net/tls/record.ts): AES-GCM with the 4-byte implicit and 8-byte explicit nonce (RFC 5288), ChaCha20-Poly1305 with the sequence XOR-ed into the IV (RFC 7905), the 13-byte additional data (sequence, type, version, length).
- Vectors are generated by a reference implementation (OpenSSL or Python's `cryptography`) and checked in with the command that made them.

## WP75 S5 — the opt-in TLS 1.2 client handshake and HttpOptions.minTlsVersion

- `std/net/tls/client12.ts`, sans-IO, from ServerHello through Certificate, ServerKeyExchange (signature checked by the existing verifiers, plus `rsaVerifyPkcs1v15` for PKCS#1 v1.5), ServerHelloDone, ClientKeyExchange, ChangeCipherSpec and Finished, for S3's profile only.
- [`client.ts`](../../std/net/tls/client.ts) offers `0x0303` in `supported_versions` and the TLS 1.2 suites only when the config allows it, and hands a ServerHello that selects TLS 1.2 to `client12`. Certificate chain checking is the same `pkiVerifyServer` call.
- `HttpOptions.minTlsVersion` and `RequestInit`'s options: `TLS_VERSION_1_3` (default) or `TLS_VERSION_1_2`.
- Tests: one refusal case per "Refused" row in `tests/link/net_tls_client_refusals`, and `openssl s_server -tls1_2 -cipher <suite>` interop per suite in `tests/run.js`. A server that picks TLS 1.2 without the opt-in is still `protocol_version`.
- Record: the TLS 1.2 client in [`docs/security/tls.md`](../../docs/security/tls.md) (scope, findings, TLS-7 narrowed to what stays refused), its README row, and a "TLS 1.2" section in the tls-client guide page.

## Out of scope

- RSA, P-384 and Ed25519 client keys (no signing code or key parser yet), and encrypted private keys.
- TLS 1.2 on the server (`std/net/tls.ts`).
- 0-RTT and client session resumption on either version.
- A platform verifier (`SecTrustEvaluateWithError`) replacing `pkiVerifyServer` on macOS.
- Windows certificate stores (WP79).

## Tests

| Stage | Cases | Mirror |
| --- | --- | --- |
| S1 | request answered with a chain, with empty Certificate, with no shared scheme; openssl `-Verify` interop; key wiped | `tests/link/net_tls_client_handshake`, the tls-tcp openssl check in `tests/run.js` |
| S2 | trusted and denied Keychain roots on a macOS runner; Linux unchanged | `tests/link/crypto_pki_roots` |
| S4 | PRF, extended master secret and record vectors | the `tests/link/net_tls_client_record` cases |
| S5 | every refusal; openssl interop per suite; no opt-in still refuses 1.2 | `tests/link/net_tls_client_refusals` |

## Verification

Per stage, its `verification:` line, plus CLAUDE.md's definition of done: `npm run check`, `npm run lint`, `npm run lint:dead`, `node docs/check-links.mjs`, `node scripts/gen-reference.mjs --check`, `node scripts/security-scope.mjs`, `node tests/run.js c-symbols` for any `runtime/*.c` change, the goldens regenerated with `node tests/self/goldens.js --update` for any `std/` change, and every CI test shard green on the PR head.
