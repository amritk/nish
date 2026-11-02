# Authentication tokens (JWT)

`nish/crypto/jwt` reads and writes JSON Web Tokens, the three-part
`header.payload.signature` strings that identity providers (Auth0, Okta,
Keycloak, Cognito, Google, Microsoft) hand to APIs in an
`Authorization: Bearer` header. It verifies a token's signature and then checks its
claims: when it expires, whom it was issued to, and by whom. It can also mint
tokens of its own.

It reads the compact form of RFC 7515 (JWS) under RFC 7519 (JWT), with the
algorithms of RFC 7518 and RFC 8037:

| Algorithm | Verify | Sign | Key |
| --- | --- | --- | --- |
| `HS256`, `HS384`, `HS512` | yes | yes | a shared secret, at least as long as the hash |
| `RS256`, `RS384`, `RS512` | yes | no | an RSA public key of 2048 bits or more |
| `ES256` | yes | yes | a P-256 key |
| `ES384` | yes | no | a P-384 public key |
| `EdDSA` | yes | yes | an Ed25519 key |

A shared secret and a private key are `Secret<u8[]>` values
([Secrets](../../LANGUAGE.md#secrets-nishsecret)), so the compiler keeps them
out of logs and templates. A key copies what you hand it, so you wipe your own
copy as soon as the key is made, and `key.wipe()` zeroes the key's copy when
you are done with it. A wiped key signs and verifies nothing.

## Verifying a token

Make the key and a `JwtVerifier` once, at startup, then call `verifyString`
for each request. It answers `JWT_OK` or one `JWT_ERR_*` code, and after
`JWT_OK` the payload's JSON is `v.claims[0 .. v.claimsLen)` and its times are
`v.exp`, `v.nbf` and `v.iat`.

```ts nish:ok
import {
  JWT_ALG_HS256,
  JWT_ERR_EXPIRED,
  JWT_MAX_TOKEN,
  JWT_OK,
  JwtKey,
  JwtVerifier,
  jwtHmacKey,
  jwtSignString,
} from "nish/crypto/jwt";
import { Secret, secret, wipe } from "nish:secret";

export const main = (): i32 => {
  // At startup: a 32-byte secret, the key, and one verifier.
  const raw: u8[] = new Array<u8>(32);
  crypto.getRandomValues(raw);
  const shared: Secret<u8[]> = secret(raw);
  const key: JwtKey | null = jwtHmacKey(JWT_ALG_HS256, shared);
  wipe(shared);
  if (key === null) {
    return 1; // a secret shorter than 32 bytes
  }
  const v: JwtVerifier = new JwtVerifier(JWT_MAX_TOKEN);
  v.issuer = "https://auth.example";
  v.audience = "orders-api";
  v.leeway = toI64(30); // seconds of clock skew allowed

  // A token this program minted, for the example.
  const token: string | null = jwtSignString(
    key,
    '{"iss":"https://auth.example","aud":"orders-api","sub":"ana","exp":4102444800}',
  );
  if (token === null) {
    return 1;
  }

  // Per request.
  const now: i64 = toI64(Date.now()) / toI64(1000);
  const code: i32 = v.verifyString(key, token, now);
  if (code === JWT_OK) {
    console.log(`signed in, ${v.claimsLen} bytes of claims`);
  } else if (code === JWT_ERR_EXPIRED) {
    console.log("expired: ask for a new token");
  } else {
    console.log(`refused: ${code}`);
  }
  key.wipe();
  return 0;
};
```

`verify(key, bytes, off, len, now)` is the same check over a window of a byte
array, such as the header value in a request buffer, without copying it into
a string first.

## What is refused

**The key decides the algorithm.** A key is made for one algorithm, and a
token verifies only when its header's `alg` names exactly that one. So a token
whose header says `none` is refused (`JWT_ERR_ALG`), and a token that says
`HS256` is refused by an RSA key without the key ever being used as an HMAC
secret. These are the two classic JWT forgeries, and with this module
neither depends on how you call it. A header that holds `alg` twice, or
names an extension in `crit`, is refused too (`JWT_ERR_HEADER`).

**The signature comes first.** Nothing in the payload is read until the
signature holds. Then the claims are checked, and the first failure is the
answer:

| Claim | Rule | Refused with |
| --- | --- | --- |
| `exp` | good while `now - leeway < exp`; required unless `v.requireExp = false` | `JWT_ERR_EXPIRED` |
| `nbf` | good once `nbf <= now + leeway` | `JWT_ERR_NOT_YET` |
| `iat` | not later than `now + leeway` | `JWT_ERR_IAT` |
| `iss` | equal to `v.issuer`, when it is set | `JWT_ERR_ISSUER` |
| `aud` | one string or an array of strings, one of which is `v.audience`. With `v.audience` unset, a token that carries an `aud` is refused, since it was meant for someone | `JWT_ERR_AUDIENCE` |
| `sub` | equal to `v.subject`, when it is set | `JWT_ERR_SUBJECT` |

Each of these claims may appear once. The times are whole seconds since 1970,
and a time claim given twice, as a string or with a fraction is
`JWT_ERR_CLAIMS`. Set `v.typ = "JWT"` (or your issuer's type, such as
`at+jwt`) to require a header `typ` as well (`JWT_ERR_TYPE`). It is compared
exactly, so give the spelling your issuer sends.

**Each token has one spelling.** Base64url padding, whitespace, `+` and `/`,
and a stray bit in a part's last character are refused (`JWT_ERR_FORMAT`).
A token longer than the verifier's limit is refused before any of it is
decoded (`JWT_ERR_SIZE`). The limit is `JWT_MAX_TOKEN` (8 KiB), or the size
you pass to `new JwtVerifier`.

**Your own claims are yours to read.** The verifier checks the registered
claims above and leaves the rest of the JSON in `v.claims`. It does not
refuse a private claim that appears twice, so read your own claims with a
parser that refuses duplicates or takes the first, never the last.

## Keys from a provider

A provider publishes its public keys as a JWK set. Decode each JWK's fields
with `base64urlDecode` from `nish/crypto/base64url` and build the key:

| JWK | Key |
| --- | --- |
| `"kty":"RSA"`, `n`, `e` | `jwtRsaKeyParts(JWT_ALG_RS256, n, e)` |
| `"kty":"EC"`, `"crv":"P-256"`, `x`, `y` | `jwtEcKey(JWT_ALG_ES256, point)`, where `point` is the byte `4`, then `x`, then `y` |
| `"kty":"EC"`, `"crv":"P-384"`, `x`, `y` | `jwtEcKey(JWT_ALG_ES384, point)` |
| `"kty":"OKP"`, `"crv":"Ed25519"`, `x` | `jwtEd25519Key(x)` |

`jwtRsaKey(alg, der)` takes a PKCS#1 `RSAPublicKey` in DER instead. Each answers
`null` for a key it will not use: an RSA modulus below 2048 bits, a point of
the wrong length, an HMAC secret shorter than its hash.

When a provider has several keys, its tokens name one in the header's `kid`.
`v.peekKid(bytes, off, len, out)` copies it into `out` and answers its length,
or -1 when there is none. Use it only to choose the key: the `kid` is read
before any signature is checked, so it proves nothing until `verify` answers
`JWT_OK` under the key it chose.

## Signing a token

`jwtSignString(key, claims)` signs a JSON object with an HS, ES256 or EdDSA
key and answers the token, or `null` when the key cannot sign (an RS or
ES384 key, or one made from a public key) or the claims are not one JSON
object. Claims outside ASCII are refused too: escape such text in the JSON
(`\u00e9`) or pass its UTF-8 bytes to `jwtSign(key, bytes)`. The header is
`{"alg":"…","typ":"JWT"}`.
`jwtSignKid(key, kid, bytes)` adds a `kid`. The claims are signed as given,
so put the `exp` in yourself.

```ts nish:ok
import { JWT_OK, JWT_MAX_TOKEN, JwtKey, JwtVerifier, jwtEd25519SigningKey, jwtSignKid } from "nish/crypto/jwt";
import { Secret, secret, wipe } from "nish:secret";

const bytesOf = (text: string): u8[] => {
  const out: u8[] = [];
  for (let i: i32 = 0; i < toI32(text.length); i++) {
    out.push(toU8(text.charCodeAt(i)));
  }
  return out;
};

export const main = (): i32 => {
  // An Ed25519 key from a 32-byte seed you keep secret.
  const raw: u8[] = new Array<u8>(32);
  crypto.getRandomValues(raw);
  const seed: Secret<u8[]> = secret(raw);
  const key: JwtKey | null = jwtEd25519SigningKey(seed);
  wipe(seed);
  if (key === null) {
    return 1;
  }
  const now: i64 = toI64(Date.now()) / toI64(1000);
  const claims: string = `{"sub":"ana","iat":${now},"exp":${now + toI64(900)}}`;
  const token: string | null = jwtSignKid(key, "2026-10", bytesOf(claims));
  if (token === null) {
    return 1;
  }
  const ok: boolean = new JwtVerifier(JWT_MAX_TOKEN).verifyString(key, token, now) === JWT_OK;
  console.log(ok ? "minted and verified" : "refused");
  key.wipe();
  return 0;
};
```

## Cost

A `JwtVerifier` sizes its buffers once, from its limit. An HS verify then
allocates nothing past the arena block it runs in: the secret's HMAC state is
computed once, when the key is made, and copied per token, and the tag is
compared in constant time. An RS, ES or EdDSA verify allocates the arithmetic
its signature check needs, which `using a = arena()` around the request
releases. A verifier and an HS key are one thread's, since both hold working
state: give each worker its own.

What was checked and what is left open is in the module's
[security record](../../security/crypto-jwt.md).
