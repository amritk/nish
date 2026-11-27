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
      - id: s1-spec-rerun
        content: After S2's spec is on main, merge main, run vector's check (--nish-root .) and mutate on S2's contract against std/crypto/rsa-sign.ts, kill what survives, and register every RFC the diff's std/ files cite so node scripts/rfc-specs.mjs passes — see TLS RSA S1, "Spec rerun"
        status: pending
      - id: s1-vector-specs
        content: Write vector specs, contracts and emitted tests for the two other new exports a vector interface can call, x509ParseRsaPrivateKey (RFC 5958 / RFC 5208 / RFC 8017 §A.1.2) and rsaVerifyPssDer (RFC 8017 §8.1.2) — see TLS RSA S1, "Vector specs for the other new exports"
        status: pending
  - id: s2-rsa-pss-spec
    title: TLS RSA S2 — vector spec for RSASSA-PSS with SHA-256 (RFC 8017) as TLS 1.3's rsa_pss_rsae_sha256 (RFC 8446 §4.2.3)
    goal: The spec, contract and emitted Nish test for nish/crypto/rsa-sign land on main before the module does, as the spec-first rule requires, profiling RSASSA-PSS signing with SHA-256, MGF1-SHA-256 and a hash-length salt (RFC 8017 §8.1.1, §9.1.1, §B.2.1) as TLS 1.3's rsa_pss_rsae_sha256 (RFC 8446 §4.2.3), with vector's check and mutate already run against #2335's module.
    verification: bash scripts/build-spec.sh --check specs/rfc8017-*.md && node tests/run.js spec && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs (plus vector's extract --check, check --run-sources and stale, by hand, as contracts/README.md lists)
    status: pending
    issue: 2354
    todos:
      - id: s2-spec
        content: Write specs/rfc8017-<name>.md and build it to specs/rfc8017-<name>.xml; every BCP 14 sentence it profiles has a test or a stated exclusion — see TLS RSA S2
        status: pending
      - id: s2-contract
        content: Extract contracts/rfc8017-<name>.json, emit test/spec/rfc8017-<name>.ts, and pass vector spec check --run-sources and node tests/run.js spec — see TLS RSA S2
        status: pending
      - id: s2-against-2335
        content: Run vector's check --nish-root . and mutate on the contract against #2335's std/crypto/rsa-sign.ts in a scratch checkout, and record the results (mutants killed, survivors by name) in the PR body without changing std/ — see TLS RSA S2
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

**Owns:** `std/crypto/rsa.ts`, `std/crypto/rsa-*.ts` (new), `std/crypto/x509.ts`, `std/net/tls.ts`, `std/net/tls/**`, `std/net/tls-tcp.ts`, `std/net/quic.ts`, `std/net/quic-conn-params.ts`, `std/net/http3-server.ts`, `std/net/http1-server.ts`, `std/net/http2-tls.ts`, `std/net/http-server.ts`, `std/net/grpc.ts`, `std/README.md`, `tests/run.js`, `tests/nish-cmp.js`, `tests/ct-asm.js`, `tests/cases/ct_asm_rsa*` (new), `tests/link/*rsa*/**` (existing and new RSA cases on any listener), `tests/link/crypto_x509*/**`, `tests/link/net_tls_*/**`, `docs/security/crypto-rsa.md`, `docs/security/tls.md`, `docs/security/quic.md`, `docs/security/http3.md`, `docs/security/README.md`, `docs/guide/using-nish/tls-certificates.md`, `docs/guide/using-nish/http-server.md`, `THIRD_PARTY_NOTICES.md`, and, from the run's Owns amendments, `src/std-modules.ts`, `tests/speed-link.txt`, `docs/guide/using-nish/standard-library.md` (amendment 1) and `scripts/rfc-unspecified.txt` (amendment 2, for the spec rerun), and `specs/rfc5958-*`, `contracts/rfc5958-*`, `test/spec/rfc5958-*`, `specs/rfc8017-rsa-pss-verify*`, `contracts/rfc8017-rsa-pss-verify*`, `test/spec/rfc8017-rsa-pss-verify*`, `rfcs/rfc5958.txt`, `rfcs/rfc5208.txt`, `.refcache/**` (amendment 3, for the vector specs)

**Generated** (regenerated with the repo's tooling, never edited or hand-merged): `tests/self/goldens/checked/**`, `docs/reference/**`, `scalar.config.json`, `tests/differential/goldens/**`, `docs/IR_COOKBOOK.md`, `tests/wordings/*.err`, `tests/link/*/expected.caps.json`, `docs/reference/diagnostics/**`, `examples/break-web/help.ts`, `docs/site/break/**`

No `Model:` line: the stage designs a constant-time signing lane and touches secret handling.

**Spec rerun.** #2335 was written before the Roadmap's spec-first rule, and `std/crypto/rsa-sign.ts` cites RFC 8017. The owner decided on #481 (2026-11-26): S2's spec lands first, then `check`/`mutate` are rerun against #2335, then #2335 merges. Once S2 is on main, this stage merges main into #2335 and runs:

- `vector spec check contracts/rfc8017-<name>.json --run-sources --nish-root .`;
- `vector spec mutate` on that contract against `std/crypto/rsa-sign.ts`. A surviving mutant is killed by a test in the module's own tests (`tests/link/crypto_rsa_sign`), or, if the spec is what misses it, reported to the lead for S2's owner. It is never killed by weakening the module;
- `node tests/run.js spec`, where the emitted test now builds and runs;
- `node scripts/rfc-specs.mjs`. Every RFC the diff's `std/` files newly cite is covered by S2's contract or gets a `cites:` line in `scripts/rfc-unspecified.txt` with its reason. `rsa-sign.ts`'s RFC 6979 is a pointer, not an implementation. The pre-rule lines are never edited by hand.

**Vector specs for the other new exports.** The owner asked on 2026-11-27 for vector tests wherever vector can hold them. #2335 adds two more exports that a vector `ts-interface` block can call:

- `x509ParseRsaPrivateKey(pem: string): Secret<u8[]> | null` in `std/crypto/x509.ts` reads PKCS#1 (RFC 8017 §A.1.2) and unencrypted PKCS#8 (RFC 5208 §5, RFC 5958 §2) PEM.
- `rsaVerifyPssDer(der, hash, saltLen, msg, sig): boolean` in `std/crypto/rsa.ts` implements RFC 8017 §8.1.2. It takes no class argument, so it can hold the verification that S2's spec could not test through `rsaVerifyPss`.

Both modules are already on main. Their specs therefore land in this PR, with the exports: an emitted test that calls an export main lacks would fail there. For each export, follow `contracts/README.md`'s steps: write the spec, build it, extract the contract, check it with `--run-sources --nish-root .`, emit the test, and run `mutate`.

- `specs/rfc5958-rsa-private-key.md` targets `nish/crypto/x509`, with sources RFC 5958, RFC 5208 and RFC 8017.
- `specs/rfc8017-rsa-pss-verify.md` targets `nish/crypto/rsa`. S2's known answers are its accepting vectors. A signature, message or salt length off by one bit or one octet is rejected.

Prefer a vector row, or a `command` source, to a property wherever a section or a rerunnable command prints the value. Every other export of each module that no clause tests is declared `Out of scope:` with its reason. A pre-rule pair a contract now covers (`std/crypto/x509.ts RFC5958`, `RFC5208`, `std/crypto/rsa.ts RFC8017`) leaves `scripts/rfc-unspecified.txt` through `node scripts/rfc-specs.mjs --update-baseline`, never by hand. If vector refuses an export, quote the refusal to the lead, and that export stays covered by `tests/link` alone. These files are tests and lint registrations, so they are within the owner decision's limit below. If a spec forces a change to `std/` code, that change goes back to the owner.

**Merge:** every file this stage owns under `std/crypto/` and `std/net/tls*` is crypto, a sensitive path under the `/feature` merge gate. Round 2 converged at `0a7c4ad8` and was escalated for a human. The owner's decision on #481 is that human call: "Spec PR first, then merge … rerun check/mutate against #2335, then merge #2335." The run therefore merges #2335 on the other eight gate conditions once the rerun is reviewed, provided the rerun changes only tests, lint registrations and what a merge of main regenerates. A rerun that changes the signing arithmetic, the key parsing or the wipes goes back to the owner instead.

## TLS RSA S2 — vector spec for RSASSA-PSS with SHA-256 (RFC 8017) as TLS 1.3's rsa_pss_rsae_sha256 (RFC 8446 §4.2.3)

The spec-first half of the module S1 adds (`contracts/README.md`, `.claude/orientation.md` → spec-first). This stage adds three files, plus what building them needs:

- `specs/rfc8017-<name>.md` (kramdown-rfc), built to `specs/rfc8017-<name>.xml` by `scripts/build-spec.sh`;
- the contract `contracts/rfc8017-<name>.json`, extracted by vector;
- the Nish test `test/spec/rfc8017-<name>.ts`, emitted by vector, with its `// vector-contract-sha256:` pin.

The contract's `target.module` is `nish/crypto/rsa-sign`, and its `sources` are RFC 8017 and RFC 8446.

- **What it profiles.** RSASSA-PSS-SIGN with SHA-256, MGF1-SHA-256 and `sLen = hLen = 32` (RFC 8017 §8.1.1, EMSA-PSS-ENCODE §9.1.1, MGF1 §B.2.1, RSASP1 §5.2.1), for moduli of 2048 to 4096 bits. It also profiles RFC 8446 §4.2.3's `rsa_pss_rsae_sha256` requirements: the salt length equals the digest length, and the key is an `rsaEncryption` key.
- **The signatures.** It uses #2335's exports, read from `std/crypto/rsa-sign.ts` on `feature/tls-rsa-server/s1-rsa-server`, so the emitted test calls the module as it will land. Vectors come from what the cited sections print. Where a section prints none, a property derives the result: a signature verifies under `rsaVerifyPss` (`std/crypto/rsa.ts`, on main), the encoded message has the trailer `0xbc`, and a signature from a salted call is reproducible. An export the spec does not test is declared `Out of scope:` with its reason.
- **Vectors where vector can hold them** (owner, 2026-11-27). A known answer is a vector row whose Source is a `command` source, so `spec check --run-sources` reruns it. The independent implementation it runs is committed under `specs/rfc8017-*` and runs under `python3 -I` with the standard library only. Results a fixed answer cannot pin stay properties. The PR body gives one line for each property or out-of-scope item, saying why no vector holds it.
- **Against #2335.** Before the PR opens, check out #2335's branch in a scratch directory outside the checkout. Run `vector spec check --nish-root .` and `vector spec mutate` there, and record in the PR body the mutants killed and each survivor by name. This stage changes no `std/` file. The survivors are S1's rerun.
- An RFC the contract pins as a source is kept byte-identical in `rfcs/` and listed in `THIRD_PARTY_NOTICES.md` ("IETF RFCs"). A new reference's cache entries are committed under `.refcache/`.

Reads: `contracts/README.md`, `.claude/orientation.md` (spec-first), vector's `docs/guide/guides/writing-a-spec.md` (in `build/vector/` after `bash scripts/fetch-vector.sh`), and the spec `specs/rfc6979-p256-ecdsa.md` with its contract, the nearest existing signature spec.

**Owns:** `specs/rfc8017-*`, `contracts/rfc8017-*`, `test/spec/rfc8017-*`, `.refcache/**`, `rfcs/rfc8017.txt`, `rfcs/rfc8446.txt`, `THIRD_PARTY_NOTICES.md`

**Generated** (regenerated, never edited by hand): `specs/rfc8017-*.xml`, `contracts/rfc8017-*.json`, `test/spec/rfc8017-*.ts` (from the `.md`), and the same generated globs as S1.

No `Model:` line: the stage decides which of a signature scheme's requirements a test can hold.

**Merge order:** S2 merges before S1. It adds no code, so the gate's crypto condition does not apply to it, and the owner's decision on #481 asks for it first.

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

Derived from the plan's goal and #481's acceptance, not given separately. Criterion 10 is from the owner's decision on #481.

1. A Nish TLS 1.3 server on TCP, configured with an RSA-2048 certificate (`sha256WithRSAEncryption`) and its PKCS#8 `PRIVATE KEY`, completes a handshake with `openssl s_client -tls1_3`, which reports the configured certificate as the one served, `TLSv1.3`, an AEAD suite, and an RSA-PSS peer signature.
2. `curl --tlsv1.3`, trusting that certificate, gets a response from the HTTP/1.1 TLS server and from the HTTP/2 TLS listener when both are configured with the RSA pair.
3. An HTTP/3 (QUIC) listener configured with the same RSA pair completes a handshake with a QUIC client that verifies its CertificateVerify.
4. A PKCS#1 `RSA PRIVATE KEY` loads and serves the same way, and an RSA key under 2048 bits is refused at configuration with an error, not a panic, so no server starts with it.
5. A server with a P-256 ECDSA certificate is still accepted by the same clients as before.
6. Signatures the new signer produces verify under OpenSSL, and the Wycheproof RSA-PSS vectors run and pass.
7. `node tests/run.js ct_asm` includes an RSA signing fixture and passes, and a `tests/run.js` check pins that the private key and the signing intermediates are wiped.
8. `node scripts/security-scope.mjs` passes with the new code in scope, and `docs/security/crypto-rsa.md`, `docs/security/tls.md` and their `docs/security/README.md` rows describe RSA signing on the server.
9. The TLS certificates guide page shows how to serve an RSA certificate and key.
10. `contracts/rfc8017-*.json`, its spec and its pinned test are on main before `std/crypto/rsa-sign.ts`. On merged main, `node tests/run.js spec` builds and passes that test, `node scripts/rfc-specs.mjs` passes, and the PR that merges the module records vector `mutate`'s result against it.
