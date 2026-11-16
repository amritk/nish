# Security record: OpenID Connect discovery and the JWK Set

The record of `nish/net/oidc`: finding an OpenID Connect issuer's keys
through discovery (OpenID Connect Discovery 1.0), reading its JWK Set
(RFC 7517, RFC 7518 §6, RFC 8037), following its key rotation, and verifying
a token with `nish/crypto/jwt`. It sets down what the module refuses and
why, what it does not claim, and the test that pins each property. It is
written with the code rather than after an audit, so that the audit starts
from evidence.

Anchors are function names in `std/net/oidc.ts` on the head that merges this
record, which branches from `25b2c31`.

**Result.** The key never comes from the token. Every key in the set is bound
to one algorithm by its `kty`, `crv` and `alg`, a key whose `alg` disagrees
with its type refuses the whole set, and the verifier refuses a token whose
header names any other algorithm, so `alg: none`, an HS256 token signed with
the public key as its secret, and an RS256 token on an RS384 key all fail
(OIDC-P5). The discovery document must name the configured issuer byte for
byte, and the key set is read only from the https `jwks_uri` that document
gives (OIDC-P1, OIDC-P2). A set that leaks a private or symmetric member, or
lists two keys with one `kid`, is refused whole (OIDC-P3). Rotation is
bounded both ways: an attacker's unknown `kid` buys at most one fetch per
`OIDC_MIN_REFRESH_INTERVAL`, and a failed or refused refresh keeps the last
good set only until its hard expiry (OIDC-P4).

Review found no fault to fix. Four properties are recorded rather than
changed, OIDC-1 to OIDC-4, all Low and accepted: fetches block, the
transport's body cap is backed by the parser's own, discovery is read once,
and the token is read before it is verified to choose a key.

## Scope

| File | Functions |
| --- | --- |
| `std/net/oidc.ts` | `oidcIssuerAllowed`, `oidcDiscoveryUrl`, `oidcParseDiscovery`, `oidcDiscover`, `oidcParseJwks`, `oidcLifetime`, `oidcVerify`, `OidcKeys` (`due`, `refreshWith`, `refresh`, `usable`, `key`, `claimsText`, `load`, `peekKid`, `check`, `begin`, `take`), `OidcKeySet` (`count`, `find`), `OidcOptions`, `OidcMetadata`, and everything they reach: `oidcRefused`, `oidcLoopback`, `oidcUrlAllowed`, `oidcDocument`, `oidcHttpOptions`, `oidcGet`, `oidcAlgByName`, `oidcIsRsa`, `oidcMember`, `oidcKidAllowed`, `oidcBytes`, `oidcPoint`, `oidcAlgOfType`, `oidcMakeKey`, `oidcEntry`, `oidcMaxAge`, `oidcPrivateMembers` |

Out of scope: the token's signature and claim checks, `JwtVerifier` and the
key constructors `jwtRsaKeyParts`, `jwtEcKey` and `jwtEd25519Key`
([crypto-jwt.md](crypto-jwt.md)); the HTTP client, its TLS and certificate
validation, `FetchSyncClient` in `std/net/fetch.ts`, and the URL parser
`urlParse`; the JSON reader `JsonDocument` (`std/json-value.ts`); and the
caller's choice of issuer and audience.

## Threat model

The attacker controls every byte of the token. They may also serve or
tamper with the discovery document and the JWK Set, short of breaking TLS
to the issuer: a misconfigured or compromised mirror, a redirect, an http
URL, a document that is huge, malformed or lists hostile keys. They choose
when tokens arrive, so they can try to drive the key set's refreshes. They
know every public key and do not hold a private key. A win is any of:

- a token accepted that the issuer did not sign, including by persuading the
  verifier to take an algorithm other than the key's, a key from another
  issuer, or a key the issuer has removed;
- a token accepted for another issuer or audience, or outside its lifetime
  plus the leeway;
- the key set read from a URL the issuer's own discovery did not name, or
  over a channel other than https;
- a key set accepted that holds private or symmetric key material, or that is
  ambiguous about which key a `kid` names;
- unbounded fetches, memory or work driven by tokens or documents, or a
  refresh storm against the issuer;
- verification stopped for good by one bad response, or kept going for good
  on a set the issuer no longer publishes.

**Secrets.** The module holds no secret. The JWK Set is public, the HS
algorithms are refused, and a set carrying private material is refused
before any key is built, so there is nothing to wipe.

## Method

**Specifications.** OpenID Connect Discovery 1.0 §3, §4 and §4.3 (the issuer
compared exactly); RFC 8414 §3.3; RFC 7517 §4 and §5 (`kty`, `use`, `alg`,
`kid`, the set's `keys`); RFC 7518 §3.3, §3.4 and §6 (RSA of at least 2048
bits, the EC curves, which members are private); RFC 8037 §2 (OKP Ed25519);
RFC 8725 §3.1 and §3.2 (algorithm verification, the key decides the
algorithm); RFC 7519 §4.1 (the claims); RFC 9111 §5.2.2.1 (`max-age`).

**Design.** `oidcVerify` reads the token's `kid` only to choose a key, from a
set already in memory, and hands that key to `JwtVerifier`, which compares
the header's `alg` with the key's and checks the signature before reading the
claims. A key's algorithm is fixed when the set is parsed (`oidcEntry`):
`oidcAlgOfType` admits one algorithm per `kty`/`crv` pair (any of RS256/384/512
for RSA), and an `alg` present must agree with it. `oidcVerify` and
`OidcKeys.key` never fetch; `oidcDiscover` and `OidcKeys.refresh` each make
one GET, bounded by `OidcOptions.timeoutMs`, with redirects not followed and
the body capped. Time is a `now` parameter everywhere.

**Tests.** Two checks in `tests/run.js`, section `oidc`. The first runs a
Nish program of 122 named checks, in memory: the parsers fed documents
built in the test, and `OidcKeys.refreshWith` driven through rotation with
tokens signed by keys generated in the test (RSA 2048, P-256, P-384,
Ed25519). The second runs a program against a loopback http issuer the test
serves, with the option that allows it, for the paths that fetch.

**Mutation.** Each rule was broken in a copy of the module, one at a time,
and the in-memory program rerun: the issuer comparison, the https and
userinfo checks, the loopback option, the size re-checks, the private
members, each arm of the algorithm agreement, the duplicate-`kid` check, the
key-count and `kid` limits, the clamp and its saturation, the rate limit,
the hard expiry and the missing-`kid` rule. Every mutation failed a named
check except the transport body cap in `oidcHttpOptions` (OIDC-2). Two
survivors were acted on: an EC P-256 key labelled EdDSA was added, since
ES384 on a P-256 key is refused by key construction before the agreement
check decides it, and a branch refusing a token outside ASCII was removed,
as `load` copies bytes losslessly and the JWT decoder refuses them.

## Findings

| ID | Severity | Where | Finding | Status |
| --- | --- | --- | --- | --- |
| OIDC-1 | Low | `oidcDiscover`, `OidcKeys.refresh`, `oidcGet` | Fetches are synchronous: each blocks the calling thread for up to `OidcOptions.timeoutMs` (10 s by default). A server that calls `refresh` from a request handler stalls that request, and every request behind it, while the issuer is slow. | Accepted: `key` and `oidcVerify` never fetch, so the blocking happens only where the caller puts it. The module comment and the guide say to call `refresh(now)` from the server's own timer, never from a request. |
| OIDC-2 | Low | `oidcHttpOptions`, `oidcParseDiscovery`, `oidcParseJwks` | The body cap is set twice: as the HTTP client's `maxBodyBytes`, and again by each parser before it reads. Removing the transport cap fails no test, because the parser's cap refuses the same documents. | Accepted: the parsers' caps are the ones pinned ("discovery over the bound", "set over the bound", and the loopback "key set over the bound"); the transport cap is defence in depth, so the client stops reading at the limit instead of buffering a larger body. |
| OIDC-3 | Low | `oidcDiscover`, `OidcKeys` | Discovery is read once. An issuer that moves its `jwks_uri` is followed only when the program discovers again; until then refreshes fail, and verification stops at the hard expiry. | Accepted: the `jwks_uri` is part of the issuer's configuration and moves rarely, and failing closed is the safe direction. The guide says to discover again at start-up. |
| OIDC-4 | Low | `OidcKeys.peekKid`, `OidcKeys.key` | The `kid` is read before any signature is checked, so its value is the attacker's, and an unknown one marks the set as wanted. | Accepted: it only chooses a key; a `kid` naming a key the attacker does not hold fails the signature, and the refreshes it can cause are limited to one per `OIDC_MIN_REFRESH_INTERVAL` (OIDC-P4). |

## Properties verified

| ID | Property | Tests |
| --- | --- | --- |
| OIDC-P1 | Discovery: the URL is the issuer plus `/.well-known/openid-configuration`; the document's `issuer` equals the configured one byte for byte (a trailing slash or a case change differs); the issuer is https with no query or fragment, loopback http only with `allowLoopbackHttp`; the issuer is checked before the document is read; the document is one JSON object within `OIDC_MAX_DISCOVERY_BYTES`. | "discovery url", "discovery url, trailing slash", "discovery ok", "discovery jwks_uri", "issuer: trailing slash differs", "issuer: case differs", "no jwks_uri", "issuer not a string", "discovery not an object", "discovery over the bound", "issuer http refused", "issuer loopback http refused by default", "issuer loopback http with the option", "issuer localhost http with the option", "issuer query refused", "issuer fragment refused", "issuer https", "issuer refused before parsing", "discover", "issuer mismatch", "discovery 404", "http refused without the option" |
| OIDC-P2 | The key set's URL: `jwks_uri` is https and carries no userinfo; http is taken only for a loopback host with the option, never for a remote one; redirects are not followed. | "jwks_uri http refused", "jwks_uri loopback http refused by default", "jwks_uri loopback http with the option", "jwks_uri http to a remote host refused even with the option", "jwks_uri userinfo refused", "redirect not followed" |
| OIDC-P3 | The JWK Set: a key's algorithm comes from the key, and an `alg` that disagrees with its `kty`/`crv` refuses the set; `enc`, an unknown `kty`, an unknown `alg` and an unknown curve are skipped; a private member or an `oct` key's `k` refuses the set; a duplicate `kid`, or two keys without one, refuses it; RSA under 2048 bits and short coordinates are refused; `OIDC_MAX_KEYS`, `OIDC_MAX_KID` and `OIDC_MAX_JWKS_BYTES` hold at their boundaries; a set with no key taken is refused. | "jwks all", "jwks all count", "jwks find p256", "jwks find is exact", "enc, unknown kty, PS256, unknown crv skipped", "only the signing key taken", "the signing key is ed", "oct without k skipped", "oct with k refused", "private EC key refused", "private RSA member refused", "RS256 on an EC key refused", "ES256 on an RSA key refused", "ES384 on a P-256 key refused", "EdDSA on a P-256 key refused", "HS256 on an RSA key refused", "EdDSA on X25519 refused", "X25519 without alg skipped", "duplicate kid refused", "two keys without kid refused", "a skipped key does not collide", "RSA-1024 refused", "short EC coordinate refused", "short Ed25519 key refused", "no kty", "alg not a string", "entry not an object", "keys not an array", "not JSON", "kid over OIDC_MAX_KID refused", "kid at OIDC_MAX_KID", "kid with a control byte refused", "empty set", "over OIDC_MAX_KEYS entries refused", "OIDC_MAX_KEYS entries", "set over the bound", "key set over the bound" |
| OIDC-P4 | Rotation: `max-age` sets the lifetime, clamped to `[OIDC_MIN_LIFETIME, OIDC_MAX_LIFETIME]` and saturating on a long number, otherwise `OIDC_DEFAULT_LIFETIME`; an unknown `kid` makes a refresh due, at most once per `OIDC_MIN_REFRESH_INTERVAL`, and a clock stepped back does not block one; a rotated key verifies after the refresh and a removed key stops verifying; a refused set or a failed fetch keeps the last good set, which verifies until `OIDC_STALE_GRACE` past its freshness and not after; `key` never fetches. | "no cache-control", "max-age taken", "max-age case", "max-age clamped low", "max-age clamped high", "max-age too long a number", "max-age not a number", "max-age empty", "s-maxage ignored", "no-store", "no set yet", "fresh after taking", "not due while fresh", "rotated token, unknown kid", "an unknown kid makes a refresh due", "but not inside the minimum interval", "refresh after an unknown kid", "rotated token verifies", "removed key stops verifying", "unknown kid again: one refresh per interval", "unknown kid after the interval", "a refused set keeps the last", "last good set still verifies", "a failed fetch keeps the last", "lastError", "usable just before the hard expiry", "not usable at the hard expiry", "stale past the hard expiry", "max-age sets the lifetime", "due at max-age", "a known kid does not make a refresh due", "an unknown kid inside the interval", "refresh after failed discovery", "failed discovery: rate-limited", "refresh", "max-age from the response" |
| OIDC-P5 | Verification: RS256, RS384, RS512, ES256, ES384 and EdDSA verify on their keys; `none`, an HS256 token keyed with the public key, and an RS256 token on an RS384 key are refused; a tampered or non-ASCII token is refused; `iss` must be the issuer and `aud` a string or array naming the audience; `exp` is required and `exp`/`nbf` are checked with the leeway at its boundary; a token without `kid` is refused when the set holds more than one key and taken when it holds one; an oversized token is refused; a refusal leaves no claims. | "RS256", "claims after OK", "RS384", "RS512", "ES256, alg from the key", "ES384", "EdDSA", "RS256 token on an RS384 key", "HS256 with the public key as secret", "alg none", "tampered", "a non-ASCII token refused", "wrong iss", "wrong aud", "aud array holds it", "aud array lacks it", "another audience", "expired past leeway", "expired within leeway", "nbf past leeway", "nbf within leeway", "no exp", "no kid, several keys", "unknown kid", "not ASCII", "over maxToken", "claims cleared after a refusal", "no kid, one key", "verify" |

## Tests

- `tests/run.js`, "std/net/oidc: discovery, the key set, rotation and
  verification, in memory": the 122 named checks cited above that do not
  fetch.
- `tests/run.js`, "std/net/oidc: discovery, refresh and verify over loopback
  http": "discover", "refresh", "max-age from the response", "verify", "http
  refused without the option", "discovery over the bound", "discovery 404",
  "issuer mismatch", "redirect not followed" and "key set over the bound",
  against an issuer the test serves on loopback.
