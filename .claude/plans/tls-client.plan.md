---
name: TLS 1.3 client role (WP34 N13, issue 480)
overview: Add the TLS 1.3 client — a sans-IO TlsClient beside TlsServer, a TCP carrier and a blocking connect helper — together with the RSA and P-384 verifiers, RFC 5280 path validation, hostname checks and a system trust store it needs, each with its security record and guide text.
stages:
  - id: pubkey-verify
    title: "feat(crypto): RSA PKCS#1 v1.5 and PSS verification, ECDSA P-384 verification"
    goal: Public-key signature verification for the web PKI — RSA (PKCS#1 v1.5 and PSS, SHA-256/384/512) and ECDSA P-384 with SHA-384 — in pure Nish, verify-only
    verification: npm run check && npm run lint && node scripts/security-scope.mjs && node tests/run.js crypto_rsa && node tests/run.js crypto_p384
    todos:
      - id: rsa-bignum
        content: Add the verify-only bignum (Montgomery modexp over u32 limbs, 2048 to 8192-bit moduli) in std/crypto/rsa.ts — see Stage pubkey-verify
      - id: rsa-pkcs1
        content: Add rsaParsePublicKey and rsaVerifyPkcs1v15 that rebuilds EM byte for byte, never parses it — see Stage pubkey-verify
      - id: rsa-pss
        content: Add rsaVerifyPss (MGF1, salt length = hash length, all padding checks) — see Stage pubkey-verify
      - id: p384-verify
        content: Add std/crypto/p384.ts with p384Verify and p384VerifySha384, verify-only — see Stage pubkey-verify
      - id: verify-vectors
        content: Add Wycheproof RSA PKCS#1, RSA-PSS and ECDSA P-384 vectors plus the issue's DigestInfo negatives as tests/link/crypto_rsa_* and crypto_p384_* programs — see Tests
      - id: verify-record
        content: Write docs/security/crypto-rsa.md, extend crypto-ecc.md for P-384, add the Areas row and the shared registry rows — see Shared registries
      - id: verify-guide
        content: Document nish/crypto/rsa and nish/crypto/p384 in the guide standard-library page and std/README.md — see Stage pubkey-verify
  - id: x509-path
    title: "feat(crypto): RFC 5280 path validation, hostname verification and a system trust store"
    goal: Validate a server's certificate chain against a trust store and a host name, refusing every bad-certificate class the issue and its comment list
    verification: npm run check && npm run lint && node scripts/security-scope.mjs && node tests/run.js x509
    todos:
      - id: x509-extensions
        content: Parse version, basicConstraints, keyUsage, extendedKeyUsage, subjectAltName, nameConstraints and critical flags into X509Certificate in std/crypto/x509.ts — see Stage x509-path
      - id: x509-keys
        content: Record each certificate's key algorithm (P-256, P-384, RSA) and signature algorithm (ECDSA-SHA256/384, RSA PKCS#1 and PSS) — see Stage x509-path
      - id: x509-trust
        content: Add X509TrustStore, x509TrustStoreFromPem and x509SystemTrustStore in std/crypto/x509-path.ts — see Stage x509-path
      - id: x509-walk
        content: Add x509ValidatePath gating every hop on CA, pathLen, keyCertSign, validity and name chaining before its signature check — see Stage x509-path
      - id: x509-hostname
        content: Add RFC 6125 hostname matching against subjectAltName (DNS and IP, single left-most wildcard, no CN fallback) — see Stage x509-path
      - id: x509-wire-verifiers
        content: After pubkey-verify merges, merge main and dispatch RSA and P-384 hop signatures to rsa.ts and p384.ts — see Stage x509-path
      - id: x509-vectors
        content: Add x509-limbo-style positive and negative chains, including every vector from the issue comment, as tests/link/crypto_x509_path_* — see Tests
      - id: x509-record
        content: Extend docs/security/crypto-x509.md (scope, findings, properties), the guide and std/README.md — see Shared registries
  - id: tls-client-core
    title: "feat(net): the sans-IO TLS 1.3 client handshake and record layer"
    goal: A TlsClient beside TlsServer that runs the TLS 1.3 client handshake sans-IO, with authentication of the server injected by its caller
    verification: npm run check && npm run lint && node scripts/security-scope.mjs && node tests/run.js net_tls
    todos:
      - id: codec-client
        content: Add the ClientHello writer and ServerHello, HelloRetryRequest, EncryptedExtensions, Certificate, CertificateVerify, Finished, NewSessionTicket and KeyUpdate readers in std/net/tls/codec.ts — see Stage tls-client-core
      - id: client-state
        content: Add TlsClient in std/net/tls/client.ts, re-exported from std/net/tls.ts — see Stage tls-client-core
      - id: client-hrr
        content: Handle one HelloRetryRequest (cookie, group switch, transcript rewrite) and refuse a second — see Stage tls-client-core
      - id: client-auth
        content: Add the WAIT_AUTH state with peerCertificates, verifyScheme, verifyContent, verifySignature and authenticate — see Stage tls-client-core
      - id: client-refuse-12
        content: Refuse TLS 1.2 and below, and the downgrade sentinel, with protocol_version or illegal_parameter — see Stage tls-client-core
      - id: record-client
        content: Add TlsRecordClient in std/net/tls/record-client.ts with read, write, keyUpdate, close (close_notify) and interest bits — see Stage tls-client-core
      - id: client-secrets
        content: Hold every ephemeral key and traffic secret as Secret and wipe it, pinned in tests/wipes/tls.js — see Stage tls-client-core
      - id: client-tests
        content: Add the TlsServer round trips and the malformed-handshake cases as tests/link/net_tls_client_* plus a fuzz target — see Tests
      - id: client-record
        content: Extend docs/security/tls.md with the client half, its threat model and the TLS 1.2 open finding, and start docs/guide/using-nish/tls-client.md — see Shared registries
  - id: tls-client-tcp
    title: "feat(net): the TLS client over TCP, server authentication and a blocking connect"
    goal: The default client API — a poll-loop carrier and a blocking connect helper over tcpConnect that always authenticate the server against a trust store and a host name
    verification: npm run check && npm run lint && node scripts/security-scope.mjs && node tests/run.js net_tls_client && node tests/run.js net_tls_tcp
    todos:
      - id: tcp-authenticate
        content: Add tlsClientAuthenticate in std/net/tls/verify.ts running x509ValidatePath and the CertificateVerify signature check by scheme — see Stage tls-client-tcp
      - id: tcp-carrier
        content: Add TlsTcpClient in std/net/tls-tcp.ts on tcpConnect and the poll loop, authenticating on every connection — see Stage tls-client-tcp
      - id: tcp-blocking
        content: Add tlsConnect, the blocking connect and handshake helper with a timeout, and its read, write and close — see Stage tls-client-tcp
      - id: tcp-openssl
        content: Add the openssl s_server interop block in tests/run.js covering suites, groups, HRR, ALPN, SNI, KeyUpdate, RSA and ECDSA chains, bad certificates and TLS 1.2 refusal — see Tests
      - id: tcp-loopback
        content: Add the TlsServer loopback round trip through TlsTcpClient and tlsConnect — see Tests
      - id: tcp-record
        content: Extend docs/security/tls.md for the client carrier and finish docs/guide/using-nish/tls-client.md and networking.md — see Shared registries
---

# TLS 1.3 client role — issue #480

## Context

`nish/net/tls` is server-only. [`std/net/tls.ts`](../../std/net/tls.ts) `TlsServer` (line 881) is sans-IO: randomness and the ephemeral key are injected, the caller signs, `receive(level, …)` takes bytes and `takeOutput(level)` gives them. [`schedule.ts`](../../std/net/tls/schedule.ts) and [`record.ts`](../../std/net/tls/record.ts) are direction-neutral and reused as they are; [`codec.ts`](../../std/net/tls/codec.ts) reads only ClientHello and writes only server messages. A test-only client exists at [`tests/link/net_loopback/tls-client.ts`](../../tests/link/net_loopback/tls-client.ts) (ChaCha20, X25519, P-256 only); it is a model, not a dependency.

Missing beneath the client, and therefore part of this plan: RSA verification of any kind, ECDSA P-384, path validation (x509.ts has no extensions, and `x509VerifySignature` says it is "not path validation"), hostname matching, and any trust store. DNS does not exist (`netAddress` takes numeric hosts; `docs/wp45-name-resolution.md` is the separate proposal).

## Approach

- **Authentication is injected into the sans-IO core and mandatory in the default API.** `TlsClient` stops in `WAIT_AUTH` after CertificateVerify and goes no further — no Finished, no application keys — until its caller calls `authenticate(ok)`. That mirrors `TlsServer`'s injected `sign`, keeps the core free of files and clocks (the trust store reads `/etc/ssl`, validity reads `Date.now`), and lets the core be built and tested in parallel with the PKI. The default API — `TlsTcpClient` and `tlsConnect` — always calls `tlsClientAuthenticate`, which runs the path validator against a trust store (the system's unless the program names another) and the host name, and checks CertificateVerify. Neither has a skip switch. A direct user of the sans-IO core must call it too; `tls.md` records that as the core's contract.
- **P-384 is in scope** although the issue does not name it: Let's Encrypt's ECDSA intermediates sign with P-384, so a client without it fails on a large share of the web PKI. Verify-only, over the RSA bignum (nothing secret, so no constant-time requirement on that path).
- **The fixed interfaces between stages** (consumers code to these names; a stage may add, not rename):

```ts
// std/crypto/rsa.ts (pubkey-verify)
export const RSA_HASH_SHA256: i32 = 1, RSA_HASH_SHA384: i32 = 2, RSA_HASH_SHA512: i32 = 3
export class RsaPublicKey { /* n limbs, e */ }
export const rsaParsePublicKey = (rsaPublicKeyDer: u8[]): RsaPublicKey | null   // PKCS#1 RSAPublicKey; < 2048 bits refused
export const rsaVerifyPkcs1v15 = (key: RsaPublicKey, hash: i32, msg: u8[], sig: u8[]): boolean
export const rsaVerifyPss = (key: RsaPublicKey, hash: i32, msg: u8[], sig: u8[]): boolean   // salt length = hash length
// std/crypto/p384.ts (pubkey-verify)
export const p384Verify = (pub: u8[], digest: u8[], sig: u8[]): boolean   // 97-byte SEC1 point, 96-byte r||s
export const p384VerifySha384 = (pub: u8[], msg: u8[], sig: u8[]): boolean

// std/crypto/x509-path.ts (x509-path)
export class X509TrustStore { /* anchors */ }
export const x509TrustStoreFromPem = (pem: string): X509TrustStore | null
export const x509SystemTrustStore = (): X509TrustStore | null   // first readable of the known bundle paths
export const x509ValidatePath = (chainDer: u8[][], trust: X509TrustStore, host: string, nowSeconds: i64): i32   // X509_PATH_OK or an X509_PATH_* reason
export const x509PathReason = (code: i32): string

// std/net/tls/client.ts (tls-client-core), re-exported by std/net/tls.ts
export class TlsClientConfig { serverName: string; alpn: string[]; /* suites, groups, first key share */ }
export class TlsClient {
  constructor(config: TlsClientConfig, clientRandom: u8[], x25519Private: u8[], p256Private: u8[])
  start(): i32; receive(level: i32, data: u8[], off: i32, len: i32): i32; takeOutput(level: i32): u8[]
  peerCertificates(): u8[][]; verifyScheme(): i32; verifyContent(): u8[]; verifySignature(): u8[]
  authenticate(ok: boolean): i32; alpn(): string; state: i32
}

// std/net/tls/verify.ts (tls-client-tcp)
export const tlsClientAuthenticate = (client: TlsClient, trust: X509TrustStore, nowSeconds: i64): i32   // calls client.authenticate
```

## Shared registries

Adding a module or a record touches files every stage appends one row to. Each is **append-only, one row per stage**, and owned by every stage for that row alone. Merge order (pubkey-verify → x509-path → tls-client-core → tls-client-tcp) serialises them: the worker told it is next merges `main`, resolves the row conflict, regenerates the goldens and pushes. No other conflict is acceptable.

| File | The row |
| --- | --- |
| [`src/std-modules.ts`](../../src/std-modules.ts) `stdModuleNames` | each new module name, sorted (a `src/` edit: run `wasi` and `performance`) |
| [`.github/workflows/release.yml`](../../.github/workflows/release.yml) tarball list | each new std file (this line only; the count in the echo too) |
| [`std/README.md`](../../std/README.md) module table | each new module |
| [`docs/security/README.md`](../../docs/security/README.md) | the Areas row (new or its counts), Open findings rows |
| [`docs/guide/using-nish/standard-library.md`](../../docs/guide/using-nish/standard-library.md) | the stage's module section |
| [`tests/run.js`](../../tests/run.js), [`tests/nish-cmp.js`](../../tests/nish-cmp.js) | the stage's sections and entries |
| `tests/self/goldens/checked/**` | generated — regenerate with `node tests/self/goldens.js --update`, never hand-merge |

## Stage pubkey-verify

**Owns:** `std/crypto/rsa.ts`, `std/crypto/p384.ts`, `std/crypto/LICENSE-*` (only if code is ported), `docs/security/crypto-rsa.md`, `docs/security/crypto-ecc.md`, `tests/link/crypto_rsa*/**`, `tests/link/crypto_p384*/**`, `tests/fuzz/targets/rsa-*.ts`, plus its rows in the shared registries.

- Bignum: fixed-width u32 limbs, Montgomery multiplication, modexp for public exponents only; moduli 2048–8192 bits; `e` odd and ≥ 3. Nothing here is secret.
- PKCS#1 v1.5: rebuild `00 01 FF… 00 || DigestInfo(alg, hash)` for the declared hash and compare the whole block byte for byte (issue comment, MikroTik CVE-2026-67278). Never parse the decrypted block.
- PSS: RFC 8017 §9.1.2 with MGF1 over the same hash; salt length must equal the hash length (TLS 1.3 `rsa_pss_rsae_*`; x509-path checks the certificate's PSS parameters against it).
- P-384: affine/Jacobian verify on the bignum's modular arithmetic; reject the point at infinity, off-curve points, `r` or `s` outside `[1, n-1]`.
- Record `crypto-rsa.md` in the house format ([`docs/security/README.md`](../../docs/security/README.md#writing-a-record)): scope table naming both functions sets, threat model (attacker chooses signature and, for x509, key), findings, properties with the test that pins each. P-384 goes into `crypto-ecc.md`'s scope.

## Stage x509-path

**Owns:** `std/crypto/x509.ts`, `std/crypto/x509-path.ts`, `docs/security/crypto-x509.md`, `tests/link/crypto_x509*/**`, `tests/fuzz/targets/x509-*.ts`, plus its rows in the shared registries. **Merge-order edge:** merges after pubkey-verify; its `x509-wire-verifiers` todo is done after the lead says pubkey-verify merged. Everything else, and the P-256 half of every test, does not wait.

- Extensions: a v1 or v2 certificate, or a v3 one with absent or malformed basicConstraints, is never a CA. An unknown critical extension rejects the certificate. keyUsage `keyCertSign` on every issuer; EKU `serverAuth` (or anyExtendedKeyUsage) on the leaf when EKU is present; pathLenConstraint; nameConstraints (DNS and IP permitted/excluded subtrees).
- Walk: leaf first; for each hop, check name chaining, validity against `nowSeconds`, CA, pathLen and keyCertSign **before** calling the signature check (issue comment, third bullet). Anchor = a trust-store certificate whose subject and key match; path length capped (e.g. 8). Signature dispatch by algorithm: ECDSA P-256/SHA-256 (existing), ECDSA P-384/SHA-384, RSA PKCS#1 SHA-256/384/512, RSA-PSS; anything else is `X509_PATH_UNSUPPORTED_ALGORITHM`.
- Hostname: RFC 6125 against SAN dNSName and iPAddress only; one wildcard, left-most label only, never matching a public suffix-like single label; no Common Name fallback; case-insensitive ASCII; IDNA is the caller's (A-labels compared as given).
- Trust store: `x509TrustStoreFromPem` parses a bundle and skips (and counts) certificates it cannot parse; `x509SystemTrustStore` reads the first of `/etc/ssl/certs/ca-certificates.crt`, `/etc/pki/tls/certs/ca-bundle.crt`, `/etc/ssl/cert.pem` via `readFileSyncOrNull`.
- Reasons are distinct `X509_PATH_*` codes with `x509PathReason` text, so a failure says which check refused.

## Stage tls-client-core

**Owns:** `std/net/tls.ts`, `std/net/tls/codec.ts`, `std/net/tls/client.ts`, `std/net/tls/record-client.ts`, `docs/security/tls.md`, `docs/guide/using-nish/tls-client.md`, `scalar.config.json`, `tests/link/net_tls_client*/**`, `tests/link/net_tls_common/**`, `tests/wipes/tls.js`, `tests/fuzz/targets/tls-server-flight.ts`, plus its rows in the shared registries. Independent of the other two stages: it authenticates nothing itself.

- ClientHello: `supported_versions` = TLS 1.3 only; suites AES-128-GCM, AES-256-GCM, ChaCha20-Poly1305; `supported_groups` x25519, secp256r1; one key share (configurable, default x25519); `signature_algorithms` ecdsa_secp256r1_sha256, ecdsa_secp384r1_sha384, rsa_pss_rsae_sha256/384/512 (and `_pss_pss_` if x509-path's PSS keys allow); SNI from `serverName` (omitted for an IP literal); ALPN from `alpn` (e.g. `h2`, `http/1.1`); legacy_session_id for middlebox compatibility.
- Server flight checks: the server's choices must be ones offered (suite, group, ALPN protocol, extensions); a selected ALPN not offered is `illegal_parameter`. Duplicate, unsolicited or out-of-place extensions and messages are refused with the RFC 8446 alert.
- HelloRetryRequest: once; the new group must be offered and differ from the share sent; echo the cookie; replace the transcript with `message_hash`. A second HRR is `unexpected_message`.
- TLS 1.2 and below: a ServerHello without `supported_versions` 0x0304 is refused with `protocol_version`; the RFC 8446 §4.1.3 downgrade sentinel in `server_random` is `illegal_parameter`. Recorded as an open finding (by design) in `tls.md`.
- `WAIT_AUTH`: after CertificateVerify the client exposes the chain, the scheme, the signed content (client-side context string over the transcript hash) and the signature, and waits; `authenticate(false)` sends `bad_certificate` (or the alert the caller names) and fails. Only `authenticate(true)` verifies the server Finished and sends the client's.
- `TlsRecordClient` mirrors `TlsRecordServer`: interest bits including a want-auth bit, KeyUpdate both ways with the same cap, close_notify on `close`, middlebox CCS tolerated. NewSessionTicket is read and discarded (no client resumption).
- Secrets: both ephemeral privates, the shared secret and every handshake and traffic secret are `Secret<u8[]>`; the unused key share is wiped as soon as the server picks a group; everything is wiped on failure and on close. `tests/wipes/tls.js` pins the client like the server.

## Stage tls-client-tcp

**Owns:** `std/net/tls-tcp.ts`, `std/net/tls/verify.ts`, `docs/security/tls.md`, `docs/guide/using-nish/tls-client.md`, `docs/guide/using-nish/networking.md`, `tests/link/net_tls_client_tcp*/**`, `tests/link/net_loopback/**`, plus its rows in the shared registries. **Starts after** x509-path and tls-client-core merge (it consumes both interfaces; pubkey-verify is already in by then).

- `tlsClientAuthenticate`: `x509ValidatePath(peerCertificates, trust, serverName, now)`, then the CertificateVerify signature with the leaf key by scheme (P-256, P-384, RSA-PSS rsae; anything else refused), then `client.authenticate(...)` with the right alert (`bad_certificate`, `certificate_expired`, `unknown_ca`, `decrypt_error`).
- `TlsTcpClient`: `connect(addr, config, trust)` on `tcpConnect` + `connectResult`, readable/writable/flush/interest/read/write/keyUpdate/shutdown/close shaped like `TlsTcpServer`; randomness from the runtime's CSPRNG; authentication always runs, with the system store unless a store is passed.
- `tlsConnect(addr, serverName, alpn, timeoutMs)`: blocking connect and handshake for a program without a loop, with its own small poll loop and a timeout (TLS-4 is the server's missing timeout; the client does not repeat it). Numeric addresses only until name resolution lands; say so in the guide.

## Tests

| Stage | Programs and checks |
| --- | --- |
| pubkey-verify | `tests/link/crypto_rsa_wycheproof*` (PKCS#1 2048/3072/4096, PSS SHA-256/384/512), `crypto_rsa_digestinfo` (trailing garbage, NULL dropped, wrong hash OID, short modulus), `crypto_p384_wycheproof`; mirror [`docs/security/crypto-ecc.md`](../../docs/security/crypto-ecc.md)'s vector accounting |
| x509-path | `tests/link/crypto_x509_path_*`: good chains (ECDSA, RSA, mixed, PSS); expired, not yet valid, wrong host, wildcard abuse, untrusted root, v1 intermediate, v3 intermediate without or with malformed basicConstraints, unknown critical extension, leaf signed by a leaf, pathLen exceeded, no keyCertSign, wrong EKU, nameConstraints excluded; system store loads on the runner |
| tls-client-core | `tests/link/net_tls_client_*`: TlsServer round trip per suite, HRR, ALPN, SNI, KeyUpdate both ways, close_notify; tlsfuzzer-style malformed server flights (truncated and oversized messages, duplicate extensions, unoffered suite/group/ALPN, missing supported_versions, downgrade sentinel, second HRR, bad Finished, message out of order) each refused with its alert; P-256 key share against a scripted server; fuzz target `tls-server-flight.ts`; wipes |
| tls-client-tcp | `tests/link/net_tls_client_tcp*` against TlsServer over loopback; a `tests/run.js` block like `net_tls_tcp` (line 2899) against `openssl s_server -tls1_3` with a test CA generated at run time: each suite, `-groups P-256` and X25519, HRR (client shares x25519, server P-256 only), ALPN h2 and http/1.1, SNI, `k`/`K` KeyUpdate, RSA-PSS leaf under an RSA intermediate, ECDSA P-384 intermediate, wrong host, expired, untrusted root, `-tls1_2` refused with protocol_version |

Every new link program gets its `expected.out` and its `tests/nish-cmp.js` entry; openssl is on CI's runners (as `net_tls_tcp` already assumes).

## Out of scope

- TLS 1.2 (refused; open finding), 0-RTT, client certificates, client-side resumption, `record_size_limit`.
- DNS (`docs/wp45-name-resolution.md`); hence no test against public hosts such as curl's in CI — recorded as not exercised.
- Revocation (OCSP, CRL), Certificate Transparency, Ed25519 certificates.
- Postgres over TLS and outbound HTTP clients built on this.
- Server P-256 key exchange and RSA server certificates (#481).

## Verification

Per stage, its `verification` line, then `node tests/self/goldens.js --update` (read the diff) and, because every stage edits `src/std-modules.ts`, `WASI_SYSROOT=/usr node tests/run.js wasi` and `node tests/run.js performance`. The full suite is CI's four shards on the PR head, each shard's skip count read. There is no line-coverage tool for Nish code: coverage is each todo's tests plus `tests/diagnostic-coverage.js`, run by the suite.
