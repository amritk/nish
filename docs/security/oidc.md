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
gives; a `jwks_uri` on another origin than the issuer's is fetched under an
outbound policy that refuses non-public addresses (OIDC-P1, OIDC-P2). A set
that leaks a private or symmetric member, or lists two keys with one `kid`,
is refused whole (OIDC-P3). Rotation is bounded both ways: an attacker's
unknown `kid` buys at most one fetch per `OIDC_MIN_REFRESH_INTERVAL`, a key
the issuer removed verifies for at most `OIDC_MAX_LIFETIME` plus
`OIDC_STALE_GRACE`, and a failed or refused refresh keeps the last good set
only until its hard expiry (OIDC-P4).

Review fixed four faults, OIDC-5 to OIDC-8: a cross-origin `jwks_uri` reached
internal addresses, an http `jwks_uri` was taken under an https issuer, a
refusal decided before the verifier ran left the last token's claims behind,
and `refreshWith` took a set under a failed discovery. Four properties are
recorded rather than changed, OIDC-1 to OIDC-4, all Low and accepted: fetches
block, the transport's body cap is backed by the parser's own, discovery is
read once, and the token is read before it is verified to choose a key.

## Scope

| File | Functions |
| --- | --- |
| `std/net/oidc.ts` | `oidcIssuerAllowed`, `oidcDiscoveryUrl`, `oidcParseDiscovery`, `oidcDiscover`, `oidcParseJwks`, `oidcLifetime`, `oidcVerify`, `OidcKeys` (`due`, `refreshWith`, `refresh`, `usable`, `key`, `claimsText`, `load`, `peekKid`, `check`, `begin`, `take`), `OidcKeySet` (`count`, `find`), `OidcOptions`, `OidcMetadata`, and everything they reach: `oidcRefused`, `oidcLoopback`, `oidcUrlAllowed`, `oidcDocument`, `oidcHttpOptions`, `oidcFetchError`, `oidcSameOrigin`, `oidcGet`, `oidcAlgByName`, `oidcIsRsa`, `oidcMember`, `oidcKidAllowed`, `oidcBytes`, `oidcPoint`, `oidcAlgOfType`, `oidcMakeKey`, `oidcEntry`, `oidcMaxAge`, `oidcPrivateMembers` |

Out of scope: the token's signature and claim checks, `JwtVerifier` and the
key constructors `jwtRsaKeyParts`, `jwtEcKey` and `jwtEd25519Key`
([crypto-jwt.md](crypto-jwt.md)); the HTTP client, its TLS and certificate
validation, `FetchSyncClient` in `std/net/fetch.ts`; the outbound policy
`OutboundPolicy` ([outbound.md](outbound.md)); the URL parser `urlParse`
and `urlOrigin`; the JSON reader `JsonDocument` (`std/json-value.ts`); and the
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
- a discovery document that names a `jwks_uri` on an internal address,
  turning the program's refresh into a request the attacker aims (SSRF);
- a key set accepted that holds private or symmetric key material, or that is
  ambiguous about which key a `kid` names;
- unbounded fetches, memory or work driven by tokens or documents, or a
  refresh storm against the issuer;
- verification stopped for good by one bad response, or kept going for good
  on a set the issuer no longer publishes.

**Secrets.** The module holds no secret. The JWK Set is public and the HS
algorithms are refused. A set carrying a private member is refused when the
entry holding it is read: keys built from the entries before it are public
and are dropped with the set, and the private member itself is only found,
never decoded. Its bytes stay in the caller's document and the JSON reader's
buffers, which the module does not wipe; a publisher that leaks a private key
has leaked it already.

## Method

**Specifications.** OpenID Connect Discovery 1.0 §3, §4 and §4.3 (the issuer
compared exactly); RFC 8414 §3.3; RFC 7517 §4 and §5 (`kty`, `use`, `alg`,
`kid`, the set's `keys`); RFC 7518 §3.3, §3.4 and §6 (RSA of at least 2048
bits, taken here up to the 8192 bits `rsaParsePublicKey` allows, the EC
curves, which members are private); RFC 8037 §2 (OKP Ed25519);
RFC 8725 §3.1 and §3.2 (algorithm verification, the key decides the
algorithm); RFC 7519 §4.1 (the claims); RFC 9111 §5.2.2.1 (`max-age`).

**Design.** `oidcVerify` reads the token's `kid` only to choose a key, from a
set already in memory, and hands that key to `JwtVerifier`, which compares
the header's `alg` with the key's and checks the signature before reading the
claims. A key's algorithm is fixed when the set is parsed (`oidcEntry`):
`oidcAlgOfType` admits one algorithm per `kty`/`crv` pair (any of RS256/384/512
for RSA), and an `alg` present must agree with it. `oidcVerify` and
`OidcKeys.key` never fetch; `oidcDiscover` and `OidcKeys.refresh` each make
one GET, bounded by `OidcOptions.timeoutMs` (0 or less means
`OIDC_DEFAULT_TIMEOUT_MS`, so no setting makes a fetch unbounded), with
redirects not followed and the body capped. Discovery and a `jwks_uri` on the
issuer's own origin are fetched as the HTTP client's defaults fetch, through a
proxy the environment names; a `jwks_uri` on another origin is fetched under
`OidcOptions.jwksOutbound`, by default `new OutboundPolicy()`: public
addresses only, no proxy. Setting it to null
opts out and fetches that URL like the issuer. Every function that reads the
clock takes it as a `now` parameter; `oidcDiscover` reads none.

**Tests.** Two checks in `tests/run.js`, section `oidc`. The first runs a
Nish program of 145 named checks, in memory: the parsers fed documents
built in the test, and `OidcKeys.refreshWith` driven through rotation with
tokens signed by keys generated in the test (RSA 2048, P-256, P-384,
Ed25519). The second runs a program of 14 named checks against a loopback
http issuer the test serves, with the option that allows it, for the paths
that fetch. Its size checks ("discovery over the bound", "key set over the
bound") serve bodies over the bound and cannot tell the transport's cap from
the parser's (OIDC-2).

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
as `load` copies bytes losslessly and the JWT decoder refuses them. Review
then found the agreement check unpinned when an entry carries both types'
material, the private members `q`, `dp`, `dq`, `qi` and `oth` unpinned, and
the `max-age` saturation pinned only by a number that does not wrap; a check
was added for each.

## Findings

| ID | Severity | Where | Finding | Status |
| --- | --- | --- | --- | --- |
| OIDC-1 | Low | `oidcDiscover`, `OidcKeys.refresh`, `oidcGet` | Fetches are synchronous: each blocks the calling thread for up to `OidcOptions.timeoutMs` (10 s by default). A server that calls `refresh` from a request handler stalls that request, and every request behind it, while the issuer is slow. | Accepted: `key` and `oidcVerify` never fetch, so the blocking happens only where the caller puts it. The module comment and the guide say to call `refresh(now)` from the server's own timer, never from a request. |
| OIDC-2 | Low | `oidcHttpOptions`, `oidcParseDiscovery`, `oidcParseJwks` | The body cap is set twice: as the HTTP client's `maxBodyBytes`, and again by each parser before it reads. Removing the transport cap fails no test, because the parser's cap refuses the same documents. | Accepted: the parsers' caps are the ones pinned ("discovery over the bound", "set over the bound", and the loopback "key set over the bound"); the transport cap is defence in depth, so the client stops reading at the limit instead of buffering a larger body. |
| OIDC-3 | Low | `oidcDiscover`, `OidcKeys` | Discovery is read once. An issuer that moves its `jwks_uri` is followed only when the program discovers again; until then refreshes fail, and verification stops at the hard expiry. | Accepted: the `jwks_uri` is part of the issuer's configuration and moves rarely, and failing closed is the safe direction. The guide says to discover again at start-up. |
| OIDC-4 | Low | `OidcKeys.peekKid`, `OidcKeys.key` | The `kid` is read before any signature is checked, so its value is the attacker's, and an unknown one marks the set as wanted. A `kid` that is not a string, or is longer than `OIDC_MAX_KID`, counts as none, so with a one-key set the token is checked under that key. | Accepted: it only chooses a key; a `kid` naming a key the attacker does not hold fails the signature, and the refreshes it can cause are limited to one per `OIDC_MIN_REFRESH_INTERVAL` (OIDC-P4). |
| OIDC-5 | Medium | `OidcKeys.refresh`, `oidcGet`, `oidcHttpOptions` | A discovery document could name a `jwks_uri` on any host, internal ones included, and the refresh fetched it with the client's defaults: any address, through the environment's proxy. Whoever controls the document aims the program's requests. | Fixed: a `jwks_uri` on another origin than the issuer's is fetched under `OidcOptions.jwksOutbound`, by default an `OutboundPolicy` that allows public addresses only and no proxy. Before: a loopback issuer naming a `jwks_uri` on `localhost` was fetched and taken. After: "cross-origin jwks_uri refused by the default outbound policy" is `OIDC_ERR_FETCH`, and "cross-origin jwks_uri with jwksOutbound null" pins the opt-out. |
| OIDC-6 | Low | `oidcParseDiscovery` | With `allowLoopbackHttp`, an https issuer could name a loopback http `jwks_uri`, so the key set travelled over a weaker channel than the issuer's. | Fixed: an http `jwks_uri` is taken only for an http issuer. Before: "jwks_uri http under an https issuer refused even with the option" was `OIDC_OK`. After: it is `OIDC_ERR_SCHEME`, and "jwks_uri loopback http under a loopback http issuer" pins the case that stays allowed. |
| OIDC-7 | Low | `oidcVerify` | A refusal decided before the verifier ran (stale set, oversized token, `kid` required, unknown `kid`) left the claims of the last accepted token in `claimsText()`, so a caller that read them without checking the result read another token's claims. | Fixed: `oidcVerify` clears the claims first. Before: "no claims after oversize", "no claims after kid required", "no claims after unknown kid" and "no claims after stale" each read the previous token's claims. After: each is `""`. |
| OIDC-8 | Low | `OidcKeys.refreshWith` | Under a failed discovery, `refreshWith` took a set handed to it, though `refresh` answers the discovery's error. | Fixed: `refreshWith` answers `meta.error`, as `refresh` does. Before: "refreshWith after failed discovery" was `OIDC_OK`. After: it is `OIDC_ERR_ISSUER` and "failed discovery takes no set" holds. |

## Properties verified

| ID | Property | Tests |
| --- | --- | --- |
| OIDC-P1 | Discovery: the URL is the issuer plus `/.well-known/openid-configuration`; the document's `issuer` equals the configured one byte for byte (a trailing slash or a case change differs); the issuer is https with no query or fragment, loopback http only with `allowLoopbackHttp`; the issuer is checked before the document is read; the document is one JSON object within `OIDC_MAX_DISCOVERY_BYTES`. | "discovery url", "discovery url, trailing slash", "discovery ok", "discovery jwks_uri", "issuer: trailing slash differs", "issuer: case differs", "no jwks_uri", "issuer not a string", "discovery not an object", "discovery over the bound", "issuer http refused", "issuer loopback http refused by default", "issuer loopback http with the option", "issuer localhost http with the option", "issuer query refused", "issuer fragment refused", "issuer https", "issuer refused before parsing", "discover", "issuer mismatch", "discovery 404", "http refused without the option" |
| OIDC-P2 | The key set's URL: `jwks_uri` is https and carries no userinfo; http is taken only for a loopback host with the option and an http issuer, never for a remote host or under an https issuer; a `jwks_uri` on another origin than the issuer's is fetched under `jwksOutbound`, which by default refuses non-public addresses, and null opts out; redirects are not followed. | "jwks_uri http refused", "jwks_uri loopback http refused by default", "jwks_uri http under an https issuer refused even with the option", "jwks_uri loopback http under a loopback http issuer", "jwks_uri http to a remote host under an http issuer refused", "jwks_uri http to a remote host refused even with the option", "jwks_uri userinfo refused", "cross-origin discover", "cross-origin jwks_uri refused by the default outbound policy", "cross-origin jwks_uri with jwksOutbound null", "redirect not followed" |
| OIDC-P3 | The JWK Set, each entry read by the first rule that applies, in `oidcParseJwks`'s order: an entry that is not an object refuses the set; any private member (`d`, `p`, `q`, `dp`, `dq`, `qi`, `oth`, or an `oct` key's `k`) refuses it, whatever the entry's `use` or type; a missing `kty`, or a non-string `kty`, `use`, `alg`, `kid` or `crv`, refuses it; a `kid` that is not 1 to `OIDC_MAX_KID` bytes of printable ASCII refuses it, whatever the `use`; then a `use` other than `sig` is skipped, an `alg` the JWT module does not have is skipped, and an unknown `kty`/`crv` is skipped without an `alg` and refuses the set with one; an `alg` that disagrees with the type refuses the set, even when the entry also carries the other type's material; the material must make a key (RSA of 2048 to 8192 bits, coordinates of the curve's size, an Ed25519 `x` of 32 bytes). A duplicate `kid`, or two keys without one, refuses the set; `OIDC_MAX_KEYS` and `OIDC_MAX_KID` hold at their boundaries and `OIDC_MAX_JWKS_BYTES` refuses a larger set; a set with no key taken is refused. | "jwks all", "jwks all count", "jwks find p256", "jwks find is exact", "enc, unknown kty, PS256, unknown crv skipped", "only the signing key taken", "the signing key is ed", "oct without k skipped", "oct with k refused", "private EC key refused", "private RSA member refused", "private RSA member q refused", "private RSA member dp refused", "private RSA member dq refused", "private RSA member qi refused", "private RSA member oth refused", "RS256 on an EC key refused", "ES256 on an RSA key refused", "ES256 on an RSA key carrying P-256 coordinates refused", "RS256 on a P-256 key carrying an RSA modulus refused", "ES384 on a P-256 key refused", "EdDSA on a P-256 key refused", "HS256 on an RSA key refused", "EdDSA on X25519 refused", "X25519 without alg skipped", "duplicate kid refused", "two keys without kid refused", "a skipped key does not collide", "RSA-1024 refused", "short EC coordinate refused", "short Ed25519 key refused", "no kty", "alg not a string", "entry not an object", "keys not an array", "not JSON", "kid over OIDC_MAX_KID refused", "kid at OIDC_MAX_KID", "kid with a control byte refused", "empty set", "over OIDC_MAX_KEYS entries refused", "OIDC_MAX_KEYS entries", "set over the bound", "key set over the bound" |
| OIDC-P4 | Rotation: `max-age` sets the lifetime, clamped to `[OIDC_MIN_LIFETIME, OIDC_MAX_LIFETIME]` and saturating on a long number, one past 2^64 included, otherwise `OIDC_DEFAULT_LIFETIME`; an unknown `kid` makes a refresh due, at most once per `OIDC_MIN_REFRESH_INTERVAL`, and a clock stepped back does not block one; a rotated key verifies after the refresh and a removed key stops verifying once a set without it is taken. A known `kid` never makes a refresh due early, so a removed key verifies until the set's lifetime ends (at most `OIDC_MAX_LIFETIME`) and, while refreshes fail, until the hard expiry (at most `OIDC_STALE_GRACE` more). A refused set or a failed fetch keeps the last good set, which verifies until `OIDC_STALE_GRACE` past its freshness and not after; a failed discovery takes no set; `key` never fetches. | "no cache-control", "max-age taken", "max-age case", "max-age clamped low", "max-age clamped high", "max-age too long a number", "max-age that wraps 2^64 to a small number", "max-age not a number", "max-age empty", "s-maxage ignored", "no-store", "no set yet", "fresh after taking", "not due while fresh", "rotated token, unknown kid", "an unknown kid makes a refresh due", "but not inside the minimum interval", "refresh after an unknown kid", "rotated token verifies", "removed key stops verifying", "unknown kid again: one refresh per interval", "unknown kid after the interval", "a refused set keeps the last", "last good set still verifies", "a failed fetch keeps the last", "lastError", "usable just before the hard expiry", "not usable at the hard expiry", "stale past the hard expiry", "max-age sets the lifetime", "due at max-age", "a known kid does not make a refresh due", "an unknown kid inside the interval", "refreshWith after failed discovery", "failed discovery takes no set", "refresh after failed discovery", "failed discovery: rate-limited", "refresh", "max-age from the response" |
| OIDC-P5 | Verification: RS256, RS384, RS512, ES256, ES384 and EdDSA verify on their keys; `none`, an HS256 token keyed with the public key, and an RS256 token on an RS384 key are refused; a tampered or non-ASCII token is refused; `iss` must be the issuer and `aud` a string or array naming the audience; `exp` is required and `exp`/`nbf` are checked with the leeway at its boundary; a token without `kid` is refused when the set holds more than one key and taken when it holds one; an oversized token is refused; every refusal leaves no claims, the ones decided before the verifier runs included. | "RS256", "claims after OK", "RS384", "RS512", "ES256, alg from the key", "ES384", "EdDSA", "RS256 token on an RS384 key", "HS256 with the public key as secret", "alg none", "tampered", "a non-ASCII token refused", "wrong iss", "wrong aud", "aud array holds it", "aud array lacks it", "another audience", "expired past leeway", "expired within leeway", "nbf past leeway", "nbf within leeway", "no exp", "no kid, several keys", "unknown kid", "over maxToken", "claims cleared after a refusal", "no claims after oversize", "no claims after kid required", "no claims after unknown kid", "stale after an accept", "no claims after stale", "no kid, one key", "verify" |

## Tests

- `tests/run.js`, "std/net/oidc: discovery, the key set, rotation and
  verification, in memory": 145 named checks, every name cited above but
  those the next item lists.
- `tests/run.js`, "std/net/oidc: discovery, refresh and verify over loopback
  http": "discover", "refresh", "max-age from the response", "verify", "http
  refused without the option", "discovery over the bound", "discovery 404",
  "issuer mismatch", "redirect not followed", "key set over the bound",
  "cross-origin discover", "cross-origin jwks_uri refused by the default
  outbound policy", "cross-origin jwks_uri with jwksOutbound null" and
  "timeoutMs 0 takes the default", against an issuer the test serves on
  loopback.
