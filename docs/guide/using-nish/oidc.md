# Tokens from an OpenID Connect issuer

An identity provider that speaks OpenID Connect (Auth0, Okta, Keycloak,
Cognito, Google, Microsoft Entra) signs its tokens with keys it publishes
and rotates. `nish/net/oidc` finds those keys from the issuer's URL alone,
keeps them current as the provider rotates them, and verifies a token with
them. It is a library module
([`export` and `import`](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#export-and-import))
built on [authentication tokens (JWT)](auth.md), which does the signature
and claim checks, and on the [HTTP client](http-client.md), which fetches.

It does three things:

1. **Discovery.** `oidcDiscover(issuer, options)` reads
   `<issuer>/.well-known/openid-configuration` and answers the issuer's
   `jwks_uri`, the URL of its key set.
2. **The key set.** `OidcKeys.refresh(now)` fetches that key set (a JWK Set)
   and keeps it for as long as the response's `Cache-Control: max-age` says,
   within limits.
3. **Verification.** `oidcVerify(keys, token, audience, now)` picks the key
   the token's `kid` names and checks the token with it, without fetching.

## Verifying a provider's tokens

Discover once at start-up, make the `OidcKeys`, take the first key set, and
then verify each request's token:

<!-- allow-panics: divides by a value it does not test; calls `std/crypto/jwt.ts`, `std/net/oidc.ts`, `std/net/url.ts` code that keeps panic sites no proof removes yet -->
<!-- nish:ok --allow-panics -->
```ts
import {
  OIDC_ERR_STALE,
  OIDC_ERR_UNKNOWN_KID,
  OIDC_OK,
  OidcKeys,
  OidcMetadata,
  OidcOptions,
  oidcDiscover,
  oidcVerify,
} from "nish/net/oidc";

export const main = (): i32 => {
  const options: OidcOptions = new OidcOptions();
  const meta: OidcMetadata = oidcDiscover("https://auth.example", options);
  if (meta.error !== OIDC_OK) {
    console.log(`discovery failed: ${meta.error}`);
    return 1;
  }
  const keys: OidcKeys = new OidcKeys(meta, options);
  const now: i64 = toI64(Date.now()) / toI64(1000);
  if (keys.refresh(now) !== OIDC_OK) {
    console.log(`no key set: ${keys.lastError}`);
    return 1;
  }

  // For each request: the token from `Authorization: Bearer <token>`.
  const token: string = "eyJ...";
  const code: i32 = oidcVerify(keys, token, "orders-api", now);
  if (code === OIDC_OK) {
    console.log(keys.claimsText());
  } else if (code === OIDC_ERR_UNKNOWN_KID) {
    console.log("signed by a key we do not have yet");
  } else if (code === OIDC_ERR_STALE) {
    console.log("no current key set");
  } else {
    console.log(`refused: ${code}`);
  }
  return 0;
};
```

`audience` is your service's client ID, the value the provider puts in
`aud`. After `OIDC_OK`, `keys.claimsText()` is the payload's JSON; read
`sub`, scopes and your own claims from it. After a refusal it is `""`.

`oidcVerify` answers `OIDC_OK` (which is `JWT_OK`), one of the codes below
when no key could be chosen, or the `JWT_ERR_*` code `nish/crypto/jwt`
refused the token with: `JWT_ERR_ALG`, `JWT_ERR_SIGNATURE`,
`JWT_ERR_EXPIRED`, `JWT_ERR_ISSUER`, `JWT_ERR_AUDIENCE` and the rest
([Verifying a token](auth.md#verifying-a-token) lists them).

| Code | Meaning |
| --- | --- |
| `OIDC_ERR_UNKNOWN_KID` | The token's `kid` is not in the key set. The next `refresh` fetches the set early |
| `OIDC_ERR_KID_REQUIRED` | The token has no `kid`, or one that is not a string or is over `OIDC_MAX_KID` bytes, or its header cannot be read, and the set holds more than one key |
| `OIDC_ERR_STALE` | No key set has been taken yet, or the last one is past its hard expiry |

## What is checked

**The issuer is the one you name.** The discovery document must name the
same issuer, byte for byte: `https://auth.example/` and `https://auth.example`
are different issuers, so give the spelling your provider uses in its
tokens' `iss`. The key set is read only from the `jwks_uri` that document
gives. Both must be `https` (or loopback `http`, with the option
[below](#local-development)), with no user name or password in the URL, and
the issuer may not carry a query or a fragment; redirects are not followed.

**A key set on another origin is fetched as an outsider would.** Discovery,
and a `jwks_uri` on the issuer's own origin, are fetched as `nish/net/fetch`
fetches by default, through any proxy the environment names. A `jwks_uri` on
another origin (another scheme, host or port) is fetched under `options.jwksOutbound`, by default a
`new OutboundPolicy()` from `nish/net/outbound`: public addresses only, no
proxy. So a discovery document cannot point your program at an internal
address. Set `options.jwksOutbound = null` to fetch it like the issuer, if
your provider's keys live on a private host you trust.

**The key decides the algorithm, never the token.** Each key in the set is
bound to one algorithm by its type and its `alg`:

| Key | Algorithm |
| --- | --- |
| `"kty":"RSA"`, 2048 to 8192 bits | its `alg`, one of `RS256`, `RS384`, `RS512`; `RS256` when it has none |
| `"kty":"EC"`, `"crv":"P-256"` | `ES256` |
| `"kty":"EC"`, `"crv":"P-384"` | `ES384` |
| `"kty":"OKP"`, `"crv":"Ed25519"` | `EdDSA` |

A token whose header names any other algorithm is refused: `none`, any
`HS*` algorithm (so the public key can never be used as an HMAC secret),
and `RS256` on a key published for `RS384`.

**The key set is read strictly.** Keys with any `use` other than `"sig"`
(encryption keys, `"use":"enc"`, among them), and keys
with an algorithm this module does not have at all (`"alg":"PS256"`), are
skipped, and so is a key type or curve it does not know (X25519) when the
key has no `alg`. A set is refused whole when any key carries private
material (`d`, `p`, `q`, `dp`, `dq`, `qi`, `oth`) or is a symmetric `oct`
key with its secret `k`, even an encryption key; when a key's `kid` is empty,
longer than `OIDC_MAX_KID` (256) bytes or not printable ASCII, even an
encryption key's; when a key of an unknown type names any algorithm the
JWT module knows, `HS*` included; when a key's `alg` disagrees with its type, `HS256` on an RSA key
included; when two keys
share a `kid`; or when a key's material does not make a key, such as an RSA
modulus under 2048 bits. A provider that publishes such a set is
misconfigured, and no key from it is trusted. Two keys without a `kid` also
refuse the set: a key with no `kid` is usable only when it is the only key.

**The claims are checked by `nish/crypto/jwt`.** `iss` must be the issuer,
`aud` must be `audience` or an array holding it, and `exp` is required;
`exp`, `nbf` and `iat` are allowed `options.leeway` seconds of clock skew
(60 by default, held between 0 and 2^31-1). A refused token leaves no claims
behind: `keys.claimsText()` is empty and `exp`, `nbf` and `iat` are 0.

## Key rotation

A provider adds a new key to its set before it signs with it, and removes
the old one some time after. `OidcKeys` follows that:

- A key set is fresh for its response's `max-age`, held between
  `OIDC_MIN_LIFETIME` (5 minutes) and `OIDC_MAX_LIFETIME` (1 day), or
  `OIDC_DEFAULT_LIFETIME` (1 hour) when the response gives none.
- A token whose `kid` the set lacks makes the next `refresh` fetch at once,
  however fresh the set is, but never more than once per
  `OIDC_MIN_REFRESH_INTERVAL` (one minute). A flood of tokens with made-up
  `kid`s costs the provider one request a minute from each `OidcKeys`: N
  workers that each hold one make up to N requests a minute.
- A key the provider removed stops verifying once a set without it is
  taken. A token naming a key the set holds never makes a refresh due, so
  that happens when the set's lifetime ends: at most `OIDC_MAX_LIFETIME`
  after the last refresh, and up to `OIDC_STALE_GRACE` more while refreshes
  fail.
- When a refresh fails, or the provider serves a set that is refused, the
  last good set keeps verifying, for up to `OIDC_STALE_GRACE` (1 day) past
  its freshness. After that `oidcVerify` answers `OIDC_ERR_STALE` until a
  refresh succeeds. `keys.lastError` says why the last refresh failed, and
  `refresh` answers `OIDC_SKIPPED` without fetching until
  `OIDC_MIN_REFRESH_INTERVAL` has passed since the failed try. A failed
  fetch that an unknown `kid` called for is not tried again on its own once
  the interval passes: the next token with an unknown `kid`, or the end of
  the set's lifetime, makes it due again.
- That interval holds for every refresh, whatever made it due: one the
  set's lifetime ending calls for also waits until a minute has passed since
  the last fetch began.
- A token holding a character above 0x7F is refused with
  `JWT_ERR_FORMAT` before its `kid` is read: no token character is
  outside ASCII.
- After a refusal `keys.claimsText()` is empty, and `exp`, `nbf` and `iat`
  are unset. The bytes of `keys.verifier.claims` past `claimsLen` are not
  wiped, so read the claims only through `claimsText()`.
- A token whose `kid` is the empty string is refused as an unknown `kid`,
  even against a set of one key, and marks the set as wanted like any other
  unknown `kid`.

## Refreshing from a timer

`oidcDiscover` and `refresh` each make one blocking request, bounded by
`options.timeoutMs` (10 seconds by default; 0 or less also means 10
seconds, so no setting leaves a fetch unbounded, though the largest,
2^31-1 ms, waits about 24 days). `oidcVerify` and `keys.key`
never fetch. So call `refresh` where blocking is harmless: from your
server's own loop or timer, never inside a request. `refresh(now)` answers
`OIDC_SKIPPED` and does nothing while the set is fresh and no token has
asked for a new one, so calling it on every turn of the loop is cheap:

<!-- allow-panics: divides by a value it does not test; calls `std/net/oidc.ts` code that keeps panic sites no proof removes yet -->
<!-- nish:ok --allow-panics -->
```ts
import { OIDC_OK, OIDC_SKIPPED, OidcKeys } from "nish/net/oidc";

// Call once per turn of your server's loop, before or after serving.
export const tick = (keys: OidcKeys): void => {
  const now: i64 = toI64(Date.now()) / toI64(1000);
  const code: i32 = keys.refresh(now);
  if (code !== OIDC_OK && code !== OIDC_SKIPPED) {
    console.log(`key set refresh failed: ${code}; still using the last one`);
  }
};

export const main = (): i32 => 0;
```

`keys.due(now)` says whether the next `refresh` would fetch, if you would
rather run it on a worker. Discovery is read once: if your provider ever
moves its `jwks_uri`, restart the program, or call `oidcDiscover` again and
make new `OidcKeys`.

Every function that reads the clock takes it as a `now` parameter, in
seconds since 1970, so a test can drive the clock; `oidcDiscover` reads
none. `keys.refreshWith(doc, cacheControl, now)` takes a
key set you already hold, for a test or for a set you fetch yourself.

## Local development

A provider running on your own machine over plain http (Keycloak in a
container, say) is refused unless you allow it:

<!-- allow-panics: calls `std/net/url.ts` code that keeps panic sites no proof removes yet -->
<!-- nish:ok --allow-panics -->
```ts
import { OidcMetadata, OidcOptions, oidcDiscover } from "nish/net/oidc";

export const main = (): i32 => {
  const options: OidcOptions = new OidcOptions();
  options.allowLoopbackHttp = true; // http to 127.0.0.1, ::1 or localhost only
  const meta: OidcMetadata = oidcDiscover("http://localhost:8080/realms/dev", options);
  return meta.error;
};
```

http to any other host is refused even then, and so is an http `jwks_uri`
under an `https` issuer: the key set is never read over a weaker channel
than the issuer.

## Cost

An `OidcKeys` sizes its token buffer once, from `options.maxToken`
(`JWT_MAX_TOKEN`, 8 KiB, by default; `new OidcKeys` panics on a value
outside 16 bytes to 1 MiB), and a key set is at most
`OIDC_MAX_KEYS` (64) entries, skipped ones counted, from a document of at most `OIDC_MAX_JWKS_BYTES`
(64 KiB); the discovery document is at most `OIDC_MAX_DISCOVERY_BYTES`
(64 KiB). A larger body is cut off as it arrives, never buffered whole. Verifying allocates what the signature check needs, as in
[authentication tokens (JWT)](auth.md#cost). An `OidcKeys` holds working
state, so it is one thread's: give each worker its own.

What was checked and what is left open is in the module's
[security record](../../security/oidc.md).
