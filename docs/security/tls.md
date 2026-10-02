# Security record: the TLS 1.3 server handshake

The record of `nish/net/tls`, WP34's lane T1: what the handshake refuses, what
it keeps secret and how, which secrets it leaves in memory, and the test that
pins each property. It is written with the code rather than after an audit,
so that the audit of the protocol stack (and T2's record layer, which adds to
this file) starts from evidence.

**Result.** Every refusal is an alert and none is a panic; the client's
Finished and the ECDHE secret are compared in constant time; RFC 8448 §3 is
reproduced byte for byte. One Low finding is open, as CLAUDE.md §Security
requires: the handshake's secrets are not wiped, because the runtime has no
wipe the optimiser cannot drop (#385).

## Scope

| File | Functions |
| --- | --- |
| `std/net/tls.ts` | `TlsServer` (`receive`, `handleMessage`, `handleClientHello`, `chooseSuite`, `chooseAlpn`, `signatureInput`, `sign`, `handleFinished`, `takeOutput`, `readSecret`, `writeSecret`), `tlsSignEcdsaP256`, `tlsEcdsaDerSignature` |
| `std/net/tls/codec.ts` | `tlsParseClientHello` and its readers (`tlsRead*`, `tlsReadServerName`, `tlsReadKeyShare`, `tlsReadAlpn`, `tlsReadExtension`), the six `tlsEncode*` writers and `tlsCertificateVerifyContent` |
| `std/net/tls/schedule.ts` | the key schedule (`tlsEarlySecret`, `tlsHandshakeSecret`, `tlsMasterSecret`, `tlsDeriveSecret`, `tlsExpandLabel`, `tlsExtract`, `tlsFinishedVerifyData`, `tlsTrafficKey`, `tlsTrafficIv`) and `TlsTranscript` |

Out of scope: the primitives underneath (`nish/crypto/*`, each with its own
record in this directory), the record layer and the TCP carrier (T2), and
QUIC (Q2). The signature over CertificateVerify is the caller's: the server
hands the input out and writes back what it is given.

## Threat model

The attacker is the client, or anyone on the path before the handshake keys
exist: every byte handed to `receive` is theirs, split anywhere and sent at
any level. A win is a panic, an unbounded allocation, a handshake completed
without the server's key or with a secret the attacker can compute, a
negotiation the server did not agree to (a version, suite, group or protocol
outside its configuration), or a secret learned from timing. The caller — the
configuration, the randomness and the signature — is trusted, but its
mistakes still answer an alert rather than a panic.

## Findings

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| TLS-1 | Low | `std/net/tls.ts` (`TlsServer`: the constructor's `ephemeralPrivate`, `handleClientHello`, `sign`, `handleFinished`; `tlsSignEcdsaP256`), `std/net/tls/schedule.ts` (`tlsEarlySecret`, `tlsHandshakeSecret`, `tlsMasterSecret`, `tlsDeriveSecret`, `tlsExpandLabel`, `tlsExtract`, `tlsFinishedVerifyData`, `tlsTrafficKey`, `tlsTrafficIv`, `TlsTranscript`) | Secret material is not wiped. The ephemeral x25519 private key and the ECDHE secret; the early, handshake and master secrets and the two "derived" salts; both handshake traffic secrets, both application traffic secrets and the exporter secret; both `finished_key`s and the expected client `verify_data`; every traffic key and IV `tlsTrafficKey` and `tlsTrafficIv` answer; and the P-256 private key `tlsSignEcdsaP256` passes to `p256SignSha256` (ECC-2) all stay in arena memory after the call or the handshake that held them, until that memory is reused. `handleFinished` drops the server's reference to the handshake secret, which shortens how long it is reachable and wipes nothing. A later memory disclosure could read any of them. | **Open.** Needs the wipe primitive of #385, in `runtime/` and `src/`, outside this stage. Once a release ships it, each function above wipes before it returns (the server's fields when the handshake ends or fails), and a test pins that the wipe survives `-O2`. |

## Properties verified

Each property below is pinned by a test that fails if it stops holding.

**RFC 8448 §3, byte for byte** (`tests/link/net_tls_rfc8448`, and in `f64`
mode `net_tls_rfc8448_f64`): every secret the trace prints — early, both
"derived" salts, handshake, both handshake traffic secrets, master, both
application traffic secrets and the exporter secret — and every traffic key
and IV; the ServerHello, EncryptedExtensions, Certificate, CertificateVerify
and Finished the server writes; the CertificateVerify input; and acceptance
of the trace's client Finished, fed whole and a byte at a time. The trace
signs with RSA-PSS, which the stack does not have and which is randomised, so
its signature is injected through the hand-off and every byte after it is
checked.

**A production handshake signs with P-256** (`net_tls_ecdsa`, `_f64`): under
each of the three suites a client verifies the CertificateVerify with
`p256VerifySha256` under the certificate's key, verifies the server's
Finished, and is accepted with its own.

**Every refusal is an alert** (`net_tls_ext_refusals`, and every case again
under `f64` in `net_tls_ext_f64`):

- *Malformed input is `decode_error`:* a message announcing more than
  `TLS_MAX_HANDSHAKE_MESSAGE` (64 KiB) bytes, refused from its header before
  the bytes are buffered; a body cut short so that a vector runs past it; a
  session id over 32 bytes; an empty or odd-length `cipher_suites`; an empty
  `supported_versions`; a key share whose length runs past its extension;
  an empty ALPN name; an empty host name or name list; a byte after the
  extensions block; a byte after the contents of a known extension
  (`supported_versions`, `key_share`, ALPN, `server_name`); a Finished of the
  wrong length; and a window outside the parser's buffer.
- *A duplicate is `illegal_parameter`* (RFC 8446 §4.2): an extension sent
  twice, two shares for one group, two host names.
- *Out of turn is `unexpected_message`:* a message at a level the state does
  not expect, a byte after a message that ends the client's flight (RFC 8446
  §5.1), a message of the wrong type, anything while the server waits for its
  own signature, and anything after the handshake.
- *A failed negotiation:* no TLS 1.3 offered (`protocol_version`, including a
  hello with no extensions and a legacy version below 0x0303); a legacy
  version above 0x0303 or a compression method other than null
  (`illegal_parameter`); no common suite, no x25519 in `supported_groups`,
  or the server's signature scheme not offered (`handshake_failure`); no
  `signature_algorithms`, `supported_groups` or `key_share`, or no transport
  parameters over QUIC (`missing_extension`); no ALPN protocol in common, or
  none at all over QUIC (`no_application_protocol`, `net_tls_ext_alpn`,
  `net_tls_ext_quic`).
- *The caller's mistakes are `internal_error`:* a random or key of the wrong
  length, an empty certificate chain, a receive window outside its buffer, and
  a signature that is empty, over 65,535 bytes or handed over at the wrong
  time.
- A failed server stays failed and answers the same alert to every call.

**No weak key exchange is completed.** A low-order x25519 share, whose shared
secret is all zeros, is `illegal_parameter` before any ServerHello is written
(RFC 8446 §7.4.2, RFC 7748 §6.1); a share of the wrong length is
`illegal_parameter`. The all-zero test reads all 32 bytes with
`timingSafeEqual`, since the secret is secret.

**One HelloRetryRequest, and its transcript** (`net_tls_ext_hrr`): RFC 8448
§5's `message_hash` transcript and the schedule over it, a constructed retry
whose HelloRetryRequest, ServerHello and handshake traffic secrets match an
independent Python model, a second ClientHello still without the share
(`illegal_parameter`, with no second HelloRetryRequest), and one whose suites
no longer allow the chosen suite (`illegal_parameter`).

**The client Finished is compared in constant time.** `handleFinished` checks
the length (public) and then compares all HashLen bytes with
`timingSafeEqualAt`; a single flipped bit is `decrypt_error`.

**Bounded memory.** The input buffer holds at most one message of at most
`TLS_MAX_HANDSHAKE_MESSAGE` bytes plus its header, because a message longer
than that is refused from its header, and a byte past the end of a message is
refused rather than kept.

## What is not checked here

- The caller's signature. A wrong one is the caller's bug, and the client's
  verification catches it; the server does not hold the public key's
  algorithm to check it with.
- The certificate chain. It is sent as configured; nothing here parses it.
- Constant-time properties of the primitives, which their own records cover.
  The handshake branches only on public values: lengths, types, the offered
  lists and the state.
