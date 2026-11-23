# Security record: OpenID Connect discovery and the JWK Set

The record of `nish/net/oidc`: finding an OpenID Connect issuer's keys
through discovery (OpenID Connect Discovery 1.0), reading its JWK Set
(RFC 7517, RFC 7518 §6, RFC 8037), following its key rotation, and verifying
a token with `nish/crypto/jwt`. It sets down what the module refuses and
why, what it does not claim, and the test that pins each property. It is
written with the code rather than after an audit, so that the audit starts
from evidence.

Anchors are function names in `std/net/oidc.ts` on the head that merges this
record, which branches from `a779740`.

**Result.** The key never comes from the token. Every key in the set is bound
to one algorithm by its `kty`, `crv` and `alg`, a key whose `alg` disagrees
with its type refuses the whole set, and the verifier refuses a token whose
header names any other algorithm, so `alg: none`, an HS256 token signed with
the public key as its secret, and an RS256 token on an RS384 key all fail
(OIDC-P5). The discovery document must name the configured issuer byte for
byte, and the key set is read only from the https `jwks_uri` that document
gives (or, with `allowLoopbackHttp` and a loopback http issuer, a loopback
http one); a `jwks_uri` on another origin than the issuer's is fetched under an
outbound policy that refuses non-public addresses unless the caller opts out
with `jwksOutbound = null` (OIDC-P1, OIDC-P2). A set
that leaks a private or symmetric member, or lists two keys with one `kid`,
is refused whole (OIDC-P3). Rotation is bounded both ways: an attacker's
unknown `kid` buys at most one fetch per `OIDC_MIN_REFRESH_INTERVAL`, a key
the issuer removed verifies for at most `OIDC_MAX_LIFETIME` plus
`OIDC_STALE_GRACE`, and a failed or refused refresh keeps the last good set
only until its hard expiry (OIDC-P4).

Review fixed five faults, OIDC-5 to OIDC-9: a cross-origin `jwks_uri` reached
internal addresses, an http `jwks_uri` was taken under an https issuer, a
refusal left claims behind (the last token's, or the refused token's own `exp`,
`nbf` and `iat`), `refreshWith` took a set under a failed discovery, and a
token's characters were cut to their low byte. Four properties are
recorded rather than changed, OIDC-1 to OIDC-4, all Low and accepted: fetches
block, a body over the bound is stopped by the transport before a parser
sees it, discovery is read once, and the token is read before it is verified to choose a key.

## Scope

| File | Functions |
| --- | --- |
| `std/net/oidc.ts` | `oidcIssuerAllowed`, `oidcDiscoveryUrl`, `oidcParseDiscovery`, `oidcDiscover`, `oidcParseJwks`, `oidcLifetime`, `oidcVerify`, `OidcKeys` (`due`, `refreshWith`, `refresh`, `usable`, `key`, `claimsText`, `load`, `peekKid`, `check`, `begin`, `take`), `OidcKeySet` (`count`, `find`), `OidcOptions`, `OidcMetadata`, the internal records `OidcMember`, `OidcFetched` and `OidcEntry`, and everything they reach: `oidcRefused`, `oidcLoopback`, `oidcUrlAllowed`, `oidcDocument`, `oidcHttpOptions`, `oidcFetchError`, `oidcSameOrigin`, `oidcGet`, `oidcAlgByName`, `oidcIsRsa`, `oidcMember`, `oidcKidAllowed`, `oidcBytes`, `oidcPoint`, `oidcAlgOfType`, `oidcMakeKey`, `oidcEntry`, `oidcMaxAge`, `oidcPrivateMembers`, `oidcClearClaims`, `oidcPick` |

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
`OIDC_DEFAULT_TIMEOUT_MS`, so no setting makes a fetch unbounded, though the
largest, 2^31-1 ms, allows about 24 days), with
redirects not followed and the body capped. Discovery and a `jwks_uri` on the
issuer's own origin are fetched as the HTTP client's defaults fetch, through a
proxy the environment names; a `jwks_uri` on another origin is fetched under
`OidcOptions.jwksOutbound`, by default `new OutboundPolicy()`: public
addresses only, no proxy. Setting it to null
opts out and fetches that URL like the issuer. Every function that reads the
clock takes it as a `now` parameter; `oidcDiscover` reads none.

**Tests.** Two checks in `tests/run.js`, section `oidc`. The first runs a
Nish program of 294 named checks, in memory: the parsers fed documents
built in the test, and `OidcKeys.refreshWith` driven through rotation with
tokens signed by keys generated in the test (RSA 2048, P-256, P-384,
Ed25519). The second runs a program of 22 named checks against a loopback
http issuer the test serves, with the option that allows it, for the paths
that fetch. Its size checks
("discovery over the bound", "key set over the bound") serve bodies over the bound, which the transport's cap stops before
any parser runs; the parsers' own caps are pinned in memory (OIDC-2).

**Mutation.** Each rule was broken in a copy of the module, one at a time,
and the in-memory program rerun: the issuer comparison, the https and
userinfo checks, the loopback option, the size re-checks, the private
members, each arm of the algorithm agreement, the duplicate-`kid` check, the
key-count and `kid` limits, the clamp and its saturation, the rate limit,
the hard expiry and the missing-`kid` rule. Every mutation failed a named
check except, before review round 2, the transport body cap and the timeouts
in `oidcHttpOptions`; the checks on the options it builds
("connect timeout", "read timeout", "total timeout", "body bounded") and
"a silent server fails the fetch" now pin both. Two
survivors were acted on: an EC P-256 key labelled EdDSA was added, since
ES384 on a P-256 key is refused by key construction before the agreement
check decides it, and a branch refusing a token outside ASCII was removed,
as `load` copies bytes losslessly and the JWT decoder refuses them. Review
then found the agreement check unpinned when an entry carries both types'
material, the private members `q`, `dp`, `dq`, `qi` and `oth` unpinned, and
the `max-age` saturation pinned only by a number that does not wrap; a check
was added for each.

## Limits

| Limit | Value | What it bounds |
| --- | --- | --- |
| `OIDC_MAX_DISCOVERY_BYTES` | 65536 | the discovery document, at the transport and in `oidcParseDiscovery` |
| `OIDC_MAX_JWKS_BYTES` | 65536 | the JWK Set, at the transport and in `oidcParseJwks` |
| `OIDC_MAX_KEYS` | 64 | entries in `keys`, counted before any is read, so skipped entries count too |
| `OIDC_MAX_KID` | 256 | bytes in a `kid`, each 0x20 to 0x7e (`OIDC_KID_LOW`, `OIDC_KID_HIGH`) |
| `OidcOptions.maxToken` | `JWT_MAX_TOKEN` (8192) | bytes of a token `oidcVerify` reads; `new OidcKeys` panics on a value outside 16 to `JWT_MAX_TOKEN_LIMIT` (1 MiB), as `JwtVerifier` does |
| `OIDC_MIN_LIFETIME`, `OIDC_MAX_LIFETIME` | 300, 86400 | a set's freshness, from `max-age`; `OIDC_DEFAULT_LIFETIME` (3600) without one |
| `OIDC_MIN_REFRESH_INTERVAL` | 60 | seconds between the starts of two refreshes of one `OidcKeys`, whatever made the second due: an unknown `kid`, a failure, or the set's lifetime ending. The limit is per instance: N workers that each hold an `OidcKeys` make up to N fetches an interval. A fetch clears the unknown-`kid` mark as it begins, so a failed one is not retried once the interval passes until another unknown `kid` arrives or the set's lifetime ends |
| `OIDC_STALE_GRACE` | 86400 | seconds a set past its freshness still verifies while refreshes fail |
| `OIDC_DEFAULT_LEEWAY` | 60 | clock skew allowed on `exp`, `nbf` and `iat`; `JwtVerifier` clamps `OidcOptions.leeway` to 0 to 2^31-1 |
| `OIDC_DEFAULT_TIMEOUT_MS` | 10000 | the connect, each read and the whole fetch, when `timeoutMs` is 0 or less |

**Edges.**

- `Cache-Control` is read by `oidcMaxAge`: the first `max-age` of plain
  digits wins, saturating on a long number; `no-store`, `no-cache` and
  `s-maxage` are not read, so the `OIDC_MIN_LIFETIME` floor holds whatever
  the response says.
- `iat` is checked by `JwtVerifier`, which refuses one later than `now` plus
  the leeway ([crypto-jwt.md](crypto-jwt.md)); this module adds no rule.
- Same origin is `urlOrigin` of both URLs compared as strings: scheme, host
  and port as the URL parser normalizes them. A `jwks_uri` that differs in
  any of them is cross-origin and runs under `jwksOutbound`.
- A cross-origin fetch runs under the policy's own limits as well, so its
  total time may be capped below `timeoutMs` (30 s by default); a fetch the
  policy refuses shows in `lastError` only as `OIDC_ERR_FETCH`.
- An `OidcMetadata` the caller builds by hand skips discovery's rules: the
  issuer and `jwks_uri` checks of OIDC-P1 and OIDC-P2 apply only to a
  document `oidcParseDiscovery` read. The cross-origin policy still applies
  at the fetch.
- A token `kid` that is not a string, or longer than `OIDC_MAX_KID`, reads as
  no `kid` (OIDC-4), and so does a header that does not decode or parse: with one key in the set that key is tried, with several
  the token is `OIDC_ERR_KID_REQUIRED`.
- A token `kid` of `""` is a string within the bound, so it is not read as
  none: no key has an empty `kid` (the set refuses one), so it is
  `OIDC_ERR_UNKNOWN_KID` even against a one-key set, and like any unknown
  `kid` it marks the set as wanted (OIDC-P5).

- After a refusal, "no claims" means `claimsLen` is 0 and `claimsText()` is
  empty: the bytes of `verifier.claims` past it still hold the refused
  token's payload and are not wiped. Claims are not secret material, and
  every reader in the module goes through `claimsLen`.
- No byte a discovery document, a JWK Set or a token carries reaches a
  panic site: every index and length the module reads from them is checked
  against its array first. Five sites are left, all reached only through the
  program's own values: `now - triedAt` in `due` is the difference of two
  of the program's clock readings in seconds, and the two freshness sums in
  `take` add at most `OIDC_MAX_LIFETIME` plus `OIDC_STALE_GRACE` (two days)
  to one, so each overflows only for readings near 2^63 seconds; and
  `claimsText` and `peekKid` slice
  `verifier.claims` and `kidBytes` by a length the verifier wrote into
  them. A new site fails
  `std-panics: no std/ module has more panic sites of a kind than tests/std-panics.json allows`.

## Findings

| ID | Severity | Where | Finding | Status |
| --- | --- | --- | --- | --- |
| OIDC-1 | Low | `oidcDiscover`, `OidcKeys.refresh`, `oidcGet` | Fetches are synchronous: each blocks the calling thread for up to `OidcOptions.timeoutMs` (10 s by default). A server that calls `refresh` from a request handler stalls that request, and every request behind it, while the issuer is slow. | Accepted: `key` and `oidcVerify` never fetch, so the blocking happens only where the caller puts it. The module comment and the guide say to call `refresh(now)` from the server's own timer, never from a request. |
| OIDC-2 | Low | `oidcHttpOptions`, `oidcGet`, `oidcParseDiscovery`, `oidcParseJwks` | The body is bounded three times. The HTTP client's `maxBodyBytes`, set by `oidcHttpOptions`, stops reading at the limit and fails the fetch with `HTTP_E_BODY_TOO_LARGE`, which `oidcFetchError` maps to `OIDC_ERR_SIZE`; `oidcGet` reads the body with `readAll(limit)`; and each parser refuses a document over its bound before it reads. On the fetch path no body over the bound reaches a parser, so the parsers' caps guard only a document the caller hands in. | Accepted: each cap is pinned where it acts. The loopback "discovery over the bound" and "key set over the bound" serve bodies over the bound and pin the transport cap (with `readAll` behind it); "body bounded" pins the `maxBodyBytes` the client is given. The in-memory "discovery over the bound" and "set over the bound" pin the parsers' caps. |
| OIDC-3 | Low | `oidcDiscover`, `OidcKeys` | Discovery is read once. An issuer that moves its `jwks_uri` is followed only when the program discovers again; until then refreshes fail, and verification stops at the hard expiry. | Accepted: the `jwks_uri` is part of the issuer's configuration and moves rarely, and failing closed is the safe direction. The guide says to discover again at start-up. |
| OIDC-4 | Low | `OidcKeys.peekKid`, `OidcKeys.key` | The `kid` is read before any signature is checked, so its value is the attacker's, and an unknown one marks the set as wanted. A `kid` that is not a string, or is longer than `OIDC_MAX_KID`, counts as none, so with a one-key set the token is checked under that key. | Accepted: it only chooses a key; a `kid` naming a key the attacker does not hold fails the signature, and the refreshes it can cause are limited to one per `OIDC_MIN_REFRESH_INTERVAL` (OIDC-P4). |
| OIDC-5 | Medium | `OidcKeys.refresh`, `oidcGet`, `oidcHttpOptions` | A discovery document could name a `jwks_uri` on any host, internal ones included, and the refresh fetched it with the client's defaults: any address, through the environment's proxy. Whoever controls the document aims the program's requests. | Fixed: a `jwks_uri` on another origin than the issuer's is fetched under `OidcOptions.jwksOutbound`, by default an `OutboundPolicy` that allows public addresses only and no proxy. Before: a loopback issuer naming a `jwks_uri` on `localhost` was fetched and taken. After: "cross-origin jwks_uri refused by the default outbound policy" is `OIDC_ERR_FETCH`, and "cross-origin jwks_uri with jwksOutbound null" pins the opt-out. |
| OIDC-6 | Low | `oidcParseDiscovery` | With `allowLoopbackHttp`, an https issuer could name a loopback http `jwks_uri`, so the key set travelled over a weaker channel than the issuer's. | Fixed: an http `jwks_uri` is taken only for an http issuer. Before: "jwks_uri http under an https issuer refused even with the option" was `OIDC_OK`. After: it is `OIDC_ERR_SCHEME`, and "jwks_uri loopback http under a loopback http issuer" pins the case that stays allowed. |
| OIDC-7 | Low | `oidcVerify` | A refusal decided before the verifier ran (stale set, oversized token, `kid` required, unknown `kid`) left the claims of the last accepted token in `claimsText()`, so a caller that read them without checking the result read another token's claims. A refusal decided inside the verifier (wrong `aud`, wrong `iss`, expired) left the refused token's own `exp`, `nbf` and `iat` set, since `JwtVerifier` parses them before it refuses. | Fixed: `oidcVerify` clears the claims and `exp`, `nbf`, `iat` and their flags before it chooses a key (`oidcClearClaims`), and again after any refusal; the first clear is a guard for a verifier that does not reset itself, and no check can fail without it (see the mutation sweep). Before: `` `no claims after ${name}` `` read the previous token's claims for `name` each of oversize, kid required, unknown kid and stale, and `` `no exp after ${name}` `` and `` `exp 0 after ${name}` `` read the refused token's `exp` for wrong aud, wrong iss and expired. After: every one of the seven holds. |
| OIDC-9 | Low | `OidcKeys.load` | `load` copied each of the token's code units to a byte with `toU8`, keeping the low byte. Where a code unit is wider than a byte, as under a UTF-16 target, a token whose `A` is replaced by U+0141 read as the signed token and verified, so one signed token verified under many spellings. Natively a string is UTF-8 bytes, so the cut drops nothing, but a non-ASCII header read as no `kid` and was refused as `OIDC_ERR_KID_REQUIRED`, after the `kid` was looked at. | Fixed: `load` refuses a code unit above 0x7F with `JWT_ERR_FORMAT` before anything is read, as `JwtVerifier.verifyString` does. Before: "a code unit above 0x7f whose low byte is base64url refused" (each header unit the signed one plus 0x100) was `OIDC_ERR_KID_REQUIRED`. After: it is `JWT_ERR_FORMAT`, and `` `a code unit above 0x7f after an accept` `` leaves no claims. |
| OIDC-8 | Low | `OidcKeys.refreshWith` | Under a failed discovery, `refreshWith` took a set handed to it, though `refresh` answers the discovery's error. | Fixed: `refreshWith` answers `meta.error`, as `refresh` does. Before: "refreshWith after failed discovery" was `OIDC_OK`. After: it is `OIDC_ERR_ISSUER` and "failed discovery takes no set" holds. |

## Properties verified

| ID | Property | Tests |
| --- | --- | --- |
| OIDC-P1 | Discovery: the URL is the issuer plus `/.well-known/openid-configuration`; the document's `issuer` equals the configured one byte for byte (a trailing slash or a case change differs); the issuer is https (the scheme read without case) with no userinfo, query or fragment, loopback http (`127.0.0.1`, `localhost`, `::1`) only with `allowLoopbackHttp`, and no other scheme even with it; the issuer is checked before the document is read; the document is one JSON object within `OIDC_MAX_DISCOVERY_BYTES`. | "discovery url", "discovery url, trailing slash", "discovery ok", "discovery jwks_uri", "issuer: trailing slash differs", "issuer: case differs", "no jwks_uri", "issuer not a string", "discovery not an object", "discovery over the bound", "issuer http refused", "issuer loopback http refused by default", "issuer loopback http with the option", "issuer localhost http with the option", "issuer query refused", "issuer fragment refused", "issuer https", "issuer refused before parsing", "discover", "issuer mismatch", "discovery 404", "http refused without the option", "discovery at the bound is read", "issuer ::1 http with the option", "issuer ::1 http refused by default", "issuer remote http refused with the option", "issuer userinfo refused", "issuer uppercase scheme", "issuer of another scheme refused with the option", "discover refuses the issuer before fetching" |
| OIDC-P2 | The key set's URL: `jwks_uri` is https and carries no userinfo, a user or a password alone included; http is taken only for a loopback host with the option and an http issuer, never for a remote host or under an https issuer; a `jwks_uri` on another origin than the issuer's is fetched under `jwksOutbound`, which by default refuses non-public addresses, and null opts out; redirects are not followed. | "jwks_uri http refused", "jwks_uri loopback http refused by default", "jwks_uri http under an https issuer refused even with the option", "jwks_uri loopback http under a loopback http issuer", "jwks_uri http to a remote host under an http issuer refused", "jwks_uri http to a remote host refused even with the option", "jwks_uri userinfo refused", "cross-origin discover", "cross-origin jwks_uri refused by the default outbound policy", "cross-origin jwks_uri with jwksOutbound null", "redirect not followed", "jwks_uri user without password refused", "jwks_uri password without user refused", "jwks_uri empty host refused", "jwks_uri not a URL refused", "jwks_uri loopback http under an uppercase HTTP issuer" |
| OIDC-P3 | The JWK Set, each entry read by the first rule that applies, in `oidcParseJwks`'s order: an entry that is not an object refuses the set; any private member (`d`, `p`, `q`, `dp`, `dq`, `qi`, `oth`, or an `oct` key's `k`) refuses it, whatever the entry's `use` or type; a missing `kty`, or a non-string `kty`, `use`, `alg`, `kid` or `crv`, refuses it; a `kid` that is not 1 to `OIDC_MAX_KID` bytes of printable ASCII refuses it, whatever the `use`; then a `use` other than `sig` is skipped, an `alg` the JWT module does not have is skipped, and an unknown `kty`/`crv`, a `crv` under the wrong `kty` among them, is skipped without an `alg` and refuses the set with one; an `alg` that disagrees with the type refuses the set, even when the entry also carries the other type's material; the material must make a key (RSA of 2048 to 8192 bits, coordinates of the curve's size, an Ed25519 `x` of 32 bytes). A duplicate `kid`, or two keys without one, refuses the set; `OIDC_MAX_KEYS` and `OIDC_MAX_KID` hold at their boundaries and `OIDC_MAX_JWKS_BYTES` refuses a larger set; a set with no key taken is refused. | "jwks all", "jwks all count", "jwks find p256", "jwks find is exact", "enc, unknown kty, PS256, unknown crv skipped", "only the signing key taken", "the signing key is ed", "oct without k skipped", "oct with k refused", "private EC key refused", "private RSA member refused", "private RSA member q refused", "private RSA member dp refused", "private RSA member dq refused", "private RSA member qi refused", "private RSA member oth refused", "RS256 on an EC key refused", "ES256 on an RSA key refused", "ES256 on an RSA key carrying P-256 coordinates refused", "RS256 on a P-256 key carrying an RSA modulus refused", "ES384 on a P-256 key refused", "EdDSA on a P-256 key refused", "HS256 on an RSA key refused", "EdDSA on X25519 refused", "X25519 without alg skipped", "duplicate kid refused", "two keys without kid refused", "a skipped key does not collide", "RSA-1024 refused", "short EC coordinate refused", "short Ed25519 key refused", "no kty", "alg not a string", "entry not an object", "keys not an array", "not JSON", "kid over OIDC_MAX_KID refused", "kid at OIDC_MAX_KID", "kid with a control byte refused", "empty set", "over OIDC_MAX_KEYS entries refused", "OIDC_MAX_KEYS entries", "set over the bound", "key set over the bound", "empty kid refused", "kid with 0x1f refused", "kid with 0x7f refused", "kid with a non-ASCII byte refused", "kid of a space (0x20)", "kid of a tilde (0x7e)", "enc entry with a private member refused", "enc entry with a bad kid refused", "kty not a string refused", "use not a string refused", "kid not a string refused", "crv not a string refused", "HS384 on an RSA key refused", "HS512 on an RSA key refused", "a crv under the wrong kty: set taken", "a crv under the wrong kty: key skipped", "P-256 without x refused", "P-256 x not a string refused", "P-256 without y refused", "P-256 short y refused", "P-256 x short and y long by one byte refused", "P-384 short x refused", "P-384 without y refused", "P-384 short y refused", "P-256 coordinates named P-384 refused", "Ed25519 without x refused", "RSA without n refused", "RSA without e refused", "RSA n not a string refused", "RSA-8192 taken", "RSA-8193 refused", "an empty kid finds no key", "set at the bound is read" |
| OIDC-P4 | Rotation: `max-age` sets the lifetime, clamped to `[OIDC_MIN_LIFETIME, OIDC_MAX_LIFETIME]` and saturating on a long number, one past 2^64 included, otherwise `OIDC_DEFAULT_LIFETIME`; an unknown `kid` makes a refresh due, and a taken set is no longer wanted; no refresh, whatever made it due, starts within `OIDC_MIN_REFRESH_INTERVAL` of the last, and a clock stepped back does not block one; a rotated key verifies after the refresh and a removed key stops verifying once a set without it is taken. A known `kid` does not mark the set as wanted, asked one second past the minimum interval, so it never makes a refresh due early, so a removed key verifies until the set's lifetime ends (at most `OIDC_MAX_LIFETIME`) and, while refreshes fail, until the hard expiry (at most `OIDC_STALE_GRACE` more). A refused set or a failed fetch keeps the last good set, which verifies until `OIDC_STALE_GRACE` past its freshness and not after; a failed discovery takes no set; `key` never fetches. | "no cache-control", "max-age taken", "max-age case", "max-age clamped low", "max-age clamped high", "max-age too long a number", "max-age that wraps 2^64 to a small number", "max-age not a number", "max-age empty", "s-maxage ignored", "no-store", "no set yet", "fresh after taking", "not due while fresh", "rotated token, unknown kid", "an unknown kid makes a refresh due", "but not inside the minimum interval", "refresh after an unknown kid", "rotated token verifies", "removed key stops verifying", "unknown kid again: one refresh per interval", "unknown kid after the interval", "a refused set keeps the last", "last good set still verifies", "a failed fetch keeps the last", "lastError", "usable just before the hard expiry", "not usable at the hard expiry", "stale past the hard expiry", "max-age sets the lifetime", "due at max-age", "a known kid does not make a refresh due", "an unknown kid inside the interval", "refreshWith after failed discovery", "failed discovery takes no set", "refresh after failed discovery", "failed discovery: rate-limited", "refresh", "max-age from the response", "max-age, space before =", "max-age, space after =", "max-age with a sign", "max-age with a byte below 0 after the digits", "never tried: due", "never tried: due near 0", "never tried: due at any time", "no set: not usable", "the refreshed set is no longer wanted", "a refused set after a good one", "a refused set: lastError", "a set taken after a failure", "a set taken after a failure: lastError", "no key at the hard expiry", "a clock stepped back does not block a refresh", "refreshWith after failed discovery: lastError", "refresh after failed discovery: lastError", "flaky: no retry inside the interval", "max-age with a byte above 9 after the digits", "a known kid verifies", "a known kid does not mark the set as wanted" |
| OIDC-P5 | Verification: RS256, RS384, RS512, ES256, ES384 and EdDSA verify on their keys; `none`, an HS256 token keyed with the public key, and an RS256 token on an RS384 key are refused; a tampered or non-ASCII token is refused, one whose code units' low bytes spell the signed token included, before its `kid` is read; `iss` must be the issuer and `aud` a string or array naming the audience; `exp` is required and `exp`/`nbf` are checked with the leeway at its boundary; a token without `kid` is refused when the set holds more than one key and taken when it holds one; an oversized token is refused; a `kid` of `""` is an unknown `kid` even against one key; a token `kid` of `OIDC_MAX_KID` bytes is read and one of `OIDC_MAX_KID` + 1 reads as none; every refusal, decided before the verifier runs (oversize, kid required, unknown kid, stale) or inside it (wrong aud, wrong iss, expired, not yet, `iat` in the future, a code unit above 0x7F), leaves no claims and no `exp`, `nbf` or `iat` (each flag false, each value 0), each after an accepted token that set all three; an accepted token without `nbf`, after one with it, leaves no `nbf`. | "RS256", "claims after OK", "RS384", "RS512", "ES256, alg from the key", "ES384", "EdDSA", "RS256 token on an RS384 key", "HS256 with the public key as secret", "alg none", "tampered", "a non-ASCII token refused", "wrong iss", "wrong aud", "aud array holds it", "aud array lacks it", "another audience", "expired past leeway", "expired within leeway", "nbf past leeway", "nbf within leeway", "no exp", "no kid, several keys", "unknown kid", "over maxToken", "claims cleared after a refusal", "no kid, one key", "verify", "an empty kid is unknown, even against one key", "an empty kid marks the set as wanted", "a token of maxToken bytes", "a token one byte over maxToken", "leeway 0 is taken", "a kid over OIDC_MAX_KID reads as none", "a kid that is not a string reads as none", "a kid of OIDC_MAX_KID bytes is read", "a kid of OIDC_MAX_KID + 1 bytes reads as none", "a code unit above 0x7f whose low byte is base64url refused", "accept with nbf", "accept without nbf after one with it", "no nbf left from the token before", and, for `name` each of "oversize", "kid required", "unknown kid", "stale", "wrong aud", "wrong iss", "expired", "not yet", "iat in the future" and "a code unit above 0x7f": `` `accept before ${name}` ``, `` `exp, nbf and iat set before ${name}` ``, `` `${name} after an accept` ``, `` `no claims after ${name}` ``, `` `no exp after ${name}` ``, `` `no nbf after ${name}` ``, `` `no iat after ${name}` ``, `` `exp 0 after ${name}` ``, `` `nbf 0 after ${name}` ``, `` `iat 0 after ${name}` `` |

## Tests

- `tests/run.js`, "std/net/oidc: discovery, the key set, rotation and verification, in memory": 328 named checks, every name cited above but those the next item lists.
- `tests/run.js`, "std/net/oidc: discovery, refresh and verify over loopback http": 22 named checks against an issuer the test serves on loopback: "discover", "refresh", "max-age from the response", "verify", "http refused without the option", "discovery over the bound", "discovery 404", "issuer mismatch", "redirect not followed", "key set over the bound", "cross-origin discover", "cross-origin jwks_uri refused by the default outbound policy", "cross-origin jwks_uri with jwksOutbound null", "timeoutMs 0 takes the default", "a silent server fails the fetch", "the silent server is given up within 5 s" and "the silent server held the fetch until near timeoutMs" (a `timeoutMs` of 300 against a server that never answers), and "flaky: first refresh", "flaky: a failed refresh", "flaky: lastError", "flaky: the last set is kept" and "flaky: no retry inside the interval" (a failed fetch through `refresh()`).
- The in-memory program pins `oidcHttpOptions`: "connect timeout", "read timeout", "total timeout", "no redirect followed", "body bounded", "no outbound policy when none is given", "timeoutMs default", and, for `ms` each of 0 and -5, `` `connect timeout default for ${ms}` ``, `` `read timeout default for ${ms}` `` and `` `total timeout default for ${ms}` ``.

### Mutation sweep

Each condition, member check and assignment in `std/net/oidc.ts` was
deleted or inverted in turn and both programs above run against it; every
mutant the compiler takes fails a named check, except these, which cannot
change behaviour:

| Mutant | Why no check can fail |
| --- | --- |
| drop the empty-host check on a parsed URL | `urlParse` never yields an empty host |
| drop the total or per-string bound in the document read | the 65536-byte precheck answers first, and the JSON reader's own defaults are larger |
| drop the root-is-an-object check (discovery, key set) | `json.get` on a non-object gives -1, so the next member check refuses with `OIDC_ERR_JSON` |
| drop the null check after the bounded read | `readAll` already surfaces an over-bound body as an error |
| drop the `readAll` length check | the transport's `maxBodyBytes` already equals the limit |
| drop the present/kind check on a base64url member | an absent or wrong member decodes to empty, and the length check refuses it |
| drop the object check on a key entry | a non-object reads as absent, so "no kty" refuses it with `OIDC_ERR_JSON` |
| drop `root < 0 ||` before the root's kind check (discovery, key set) | `json.kind(-1)` is `JSON_VALUE_NONE`, so the kind check refuses it |
| drop `eq < 1 ||` in `oidcMaxAge` | with no `=` (`eq` is -1) or a leading one (0), the slice before it is not `max-age`, so the name check refuses it |
| drop `client.close()` in `oidcGet` | it releases the client's connection, which no check can observe; it is kept so a long-running refresher does not hold sockets |
| drop the first `oidcClearClaims` in `oidcVerify`, before the key is chosen | every refusal is cleared after it, and `JwtVerifier.verify` resets the claims itself before it accepts; "no nbf left from the token before" pins that reset |
| drop one EC coordinate's null or length check | the other coordinate's check plus `jwtEcKey`'s total-length check pins it; "P-256 x short and y long by one byte refused" pins dropping both; `jwtEd25519Key` checks 32 bytes itself |

The oidc section has no entry in `tests/shard-costs.json`: they run
inside the `runCache` group, which is costed and dealt as one.
