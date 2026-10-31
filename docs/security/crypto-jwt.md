# Security record: JSON Web Tokens

The record of `nish/crypto/jwt` (#1114): verifying and signing JSON Web
Tokens in the JWS compact serialization (RFC 7519, RFC 7515), over the
algorithms of RFC 7518 and RFC 8037, with the checks RFC 8725 recommends. It
also covers the keyed-state API this module added to `nish/crypto/hmac`
(`HmacKey`). It sets down what the module refuses and why, what it does not
claim, and the test that pins each property. It is written with the code
rather than after an audit, so that the audit starts from evidence.

Anchors are function names in `std/crypto/jwt.ts` and `std/crypto/hmac.ts` on
the head that merges this record, which branches from `73e4282`.

**Result.** RFC 7515 A.1 (HS256), A.2 (RS256) and A.3 (ES256) and RFC 8037
A.4 (EdDSA) verify, and a flipped signature or payload byte in each fails.
The two classic JWT forgeries are closed by construction: a key is made for
one algorithm and the header's `alg` must name it exactly, so `alg: none`
(JWT-P1) and an HS256 header in front of an RSA key (JWT-P2) are refused
before any signature is computed. A duplicate `alg`, spelled plainly or with
a JSON escape, `crit` and `b64` are refused (JWT-P3). The claims are read only
after the signature holds, and `exp`, `nbf`, `iat` (with a bounded leeway),
`iss`, `aud` and `sub` are checked as RFC 7519 §4.1 says (JWT-P5, JWT-P6).
The HMAC tag is compared in constant time (JWT-P7), and base64url is strict,
so each token has one spelling (JWT-P4). Nothing was found to fix. Five
properties are recorded rather than changed, JWT-1 to JWT-5, all Low and
accepted: public-key verifies allocate, the token is processed in variable
time, unregistered members may repeat, `peekKid` is unauthenticated, and
what the wipes cannot reach.

## Scope

| File | Functions |
| --- | --- |
| `std/crypto/jwt.ts` | `JwtVerifier` (`verify`, `verifyString`, `checkHeader`, `checkClaims`, `peekKid`), `JwtKey` and its `wipe`, the key constructors `jwtHmacKey`, `jwtRsaKey`, `jwtRsaKeyParts`, `jwtEcKey`, `jwtEd25519Key`, `jwtEs256SigningKey`, `jwtEd25519SigningKey`, the signers `jwtSignKid`, `jwtSign`, `jwtSignString`, and everything they reach: `jwtAlgName`, `jwtSignatureSize`, `jwtDecode`, `jwtSextet`, `jwtVerifyPublic`, `jwtPublicKey`, `jwtDerLength`, `jwtDerInteger`, `jwtClamp`, `jwtSlice`, `jwtCopy`, `jwtIsObject`, `jwtKidFits`, `jwtBytesOf` |
| `std/crypto/hmac.ts` | The "A key held keyed" section: `HmacKey` (constructor, `size`, `wipe`), `hmacTagSize`, `hmacMidstates`, `hmacMidstates512`, `hmacCopyWords`, `hmacResume256`, `hmacResume512`, `hmacKeyedTag`, `hmacKeyedInto`, `hmacKeyedVerify` |

Out of scope: the rest of `hmac.ts`, `sha256.ts`, `sha512.ts`, `ct.ts` and
`base64url.ts` ([crypto-k1.md](crypto-k1.md)); the signature checks this
module calls, `rsaVerifyPkcs1v15` and `rsaParsePublicKey`
([crypto-rsa.md](crypto-rsa.md)), `p256VerifySha256`, `p256SignSha256` and the
Ed25519 functions ([crypto-ecc.md](crypto-ecc.md)), and `p384VerifySha384`
([crypto-p384.md](crypto-p384.md)); `std/json-tokenizer.ts`
([json.md](json.md)), which reads the header and the claims; and fetching or
caching a provider's JWK set, which the caller does.

## Threat model

The attacker controls every byte of the token, its length, and the window of
the caller's array it sits in. They may also hold valid tokens from the same
issuer for other audiences, subjects or times, and they know every public
key. They do not hold an HMAC secret or a private key. A win is any of:

- a token accepted that the key's holder did not sign (forgery), including by
  persuading the verifier to use another algorithm than the key's;
- a token accepted outside its lifetime, for another audience, issuer or
  subject than the verifier requires;
- two readings of one token, where this verifier checks one value of a
  registered claim and the caller reads another;
- a panic, an unbounded loop, or work or memory growing with anything but
  the verifier's fixed limit;
- the secret, or a keyed HMAC state, which forges tags as well as the secret
  does, left readable in memory after the key is wiped.

**Secrets.** An HMAC secret, an ES256 private scalar and an Ed25519 seed are
`Secret<u8[]>` (`nish:secret`). `JwtKey` copies the one it is handed inside
`expose` and holds the copy as a `Secret`; the caller still owns and wipes its
own. `HmacKey` keys the inner and outer pads once and holds the four
midstates as one `Secret<u64[]>`. Every intermediate a keyed tag makes (the
copied midstate, the inner digest, the tag before it is written out, the
hashers' blocks and schedules) is wiped before the function returns, and
`JwtKey.wipe()` zeroes the key's copy and its pads (JWT-P8).

## Method

**Specifications.** RFC 7515 §4.1, §5.2, §7.1 and Appendix A; RFC 7519 §4.1,
§7.2; RFC 7518 §3.2 to §3.5 (key sizes, the HS, RS and ES algorithms);
RFC 8037 §2, §3.1 and A.4; RFC 8725 §2.1, §2.2, §3.1, §3.2, §3.9, §3.11.

**Design.** The verifier reads in the order RFC 7515 §5.2 gives, and refuses
at the first step that fails: the window and the size limit, exactly two
dots, the header decoded and checked, the signature decoded and its length
compared with the key's, the signature checked, and only then the claims
decoded and checked. The header's `alg` is compared with `jwtAlgName` of the
key's algorithm; the token never selects a code path. JSON is read with
`std/json-tokenizer.ts`, whose keys compare decoded, so an escaped member
name is the member it spells. HMAC goes through `HmacKey`, whose keyed
midstates are copied per token rather than recomputed from the secret, so an
HS verify touches the secret's derived state only through SHA-2's
compression and a constant-time compare.

**Tests.** `tests/link/crypto_jwt` (100 checks), and the same checks under
`--number-mode f64` in `tests/link/crypto_jwt_f64`. Each refusal has a check
that the refusal answers its own code; the known-bad tokens were minted with
an independent HMAC implementation under RFC 7515 A.1's key, so they reach
the step under test with a valid MAC.

**Wipes.** `tests/wipes/crypto.js` counts, after `opt -O2`, the volatile
wipes reached from each `HmacKey` and `JwtKey` root. The counts are exact, so
deleting one wipe, or making it an ordinary store, fails the group; wipes
in `hmac.ts`'s keyed section were deleted to show it.

**Fuzzing.** `tests/fuzz/targets/jwt.ts`, from 14 seeds in
`tests/fuzz/corpus/jwt/`, verifies each input twice under one of three keys
and several verifier settings, reads its `kid`, and signs the input as
claims, then verifies what it signed. It checks that every answer is a code,
that two verifies agree, and that a token `jwtSign` minted never fails on its
form, header, algorithm or signature. libFuzzer was not available where the
target was written, so it was run under a replay-and-mutate driver linked to
the same `LLVMFuzzerTestOneInput`: one million mutations of the corpus, with
no panic and no disagreement. CI replays the corpus on every PR and runs the
target under libFuzzer weekly.

## Findings

| ID | Severity | Where | Finding | Status |
| --- | --- | --- | --- | --- |
| JWT-1 | Low | `jwtVerifyPublic` | Only an HS verify is allocation-free past its arena block. An RS, ES or EdDSA verify copies the signed input and allocates what the RSA, P-256, P-384 or Ed25519 check allocates (bignums, points), so a flood of large tokens costs arena memory per token until the caller's scope releases it. The amount is bounded by the verifier's `maxToken` and the key's size, and each check is the size the RFC fixes. | Accepted: the public-key modules allocate by design, and making them allocation-free is their records' work. The guide tells callers to verify inside `using a = arena()` per request. |
| JWT-2 | Low | `JwtVerifier.verify`, `jwtDecode`, `checkHeader`, `checkClaims` | The token is decoded and parsed in variable time: the base64url decoder, the JSON tokenizer and the claim checks branch on its bytes, and the RS, ES and EdDSA checks run in variable time over the public key and signature. | Accepted: every one of those values is public, sent by the attacker or published by the key's owner. The value derived from a secret, the HMAC tag, is compared with `timingSafeEqualAt` (JWT-P7). |
| JWT-3 | Low | `checkHeader`, `checkClaims` | A header member other than `alg`, `typ`, `kid`, `crit` and `b64`, and a claim other than the seven registered ones, may appear more than once: they are skipped, not refused. A caller that reads its own claims from `claims` with a last-wins parser could read a different value than another reader of the same token would. | Accepted: RFC 7519 §4 lets a parser either refuse duplicates or keep the last, and every member this verifier decides on is refused when repeated, plainly or escaped. The guide tells the caller to read private claims first-wins or refusing duplicates. |
| JWT-4 | Low | `JwtVerifier.peekKid` | `peekKid` reads the header's `kid` before any signature is checked, so its answer is the attacker's. | Accepted: it is documented as choosing the key only. A `kid` naming a key the attacker does not hold fails `verify`; one naming a key of another algorithm fails on `alg` (JWT-P1, JWT-P2). |
| JWT-5 | Low | `JwtKey`, `HmacKey`, `jwtSignKid` | What the wipes cannot reach: the caller's own `Secret` (the key copies it, and the caller wipes theirs); a `JwtKey` or `HmacKey` the program never wipes; the compression functions' working variables in registers and spill slots; and the scalar and nonce arithmetic inside `p256SignSha256` and `ed25519Sign`, which is those modules' and is recorded in [crypto-ecc.md](crypto-ecc.md). A minted token and the HS tag in it are public and are not wiped. | Accepted: recorded rather than claimed. |

## Properties verified

| ID | Property | Tests |
| --- | --- | --- |
| JWT-P1 | `alg` must equal the key's algorithm's name exactly; `none`, a lower-case spelling, a missing `alg` and a non-string `alg` are refused (`JWT_ERR_ALG`), even when a valid MAC follows. | "none: an unsigned token is refused", "none: alg none with a valid MAC is refused", "alg is spelled exactly: hs256 is refused", "a header without alg is refused", "an alg that is not a string is refused" |
| JWT-P2 | No algorithm confusion: an RS256 token under an HS256 key, an HS256 token under an RSA key (the RSA key is never used as an HMAC secret), an ES256 token under an EdDSA key, and an RS256 header over an HS256 MAC are refused by `alg` before any signature is computed. | "confusion: an RS256 token under an HS256 key is refused by alg", "confusion: an HS256 token under an RSA key is refused by alg", "confusion: an ES256 token under an EdDSA key is refused by alg", "alg RS256 over an HS256 MAC is refused" |
| JWT-P3 | The header holds `alg` exactly once, including when the second is spelled with a JSON escape, and no `crit` or `b64`; a header that is not one JSON object, or has trailing JSON, is refused (`JWT_ERR_HEADER`). | "alg twice is refused, even agreeing", "alg twice, the second none, is refused", "alg twice, the second spelled with an escape, is refused", "crit is refused", "b64 is refused", "a typ that is not a string is refused", "a header that is an array is refused", "a header with trailing JSON is refused" |
| JWT-P4 | One spelling per token: exactly three parts, strict base64url (no padding, no `+`, no byte outside ASCII, no stray bits), a signature of exactly the key's size, a size cap applied before decoding, and only the given window read. | "two parts are refused", "four parts are refused", "a + in the header is refused", "a character outside ASCII is refused", "padding is refused", "a stray bit in the signature's last character is refused", "an empty header is refused", "a short signature is refused", "an empty signature is refused", "a token over maxToken is refused before decoding", "a window outside its array is refused", "verify reads only its window" |
| JWT-P5 | The time claims: each registered claim at most once (an escaped duplicate too), the times integers, `exp` required by default, `nbf` and `iat` checked, leeway applied at its boundary, a negative leeway read as 0 and a huge one clamped so `now - leeway` cannot overflow. | "claims: every registered claim checked and passed", "claims: nbf and iat are read", "claims: expired", "claims: not yet valid", "claims: issued in the future", "claims: no exp", "claims: exp twice", "claims: exp twice, the second spelled with an escape", "claims: exp as a string", "claims: exp with a fraction", "claims: no exp, with requireExp cleared", "leeway 0: one second before exp", "leeway 0: at exp", "leeway 30: 29 seconds after exp", "leeway 30: 30 seconds after exp", "leeway 1000: nbf 1000 seconds ahead", "leeway 1000: nbf 1001 seconds ahead", "a negative leeway is read as 0", "a huge leeway is held, and now - leeway cannot overflow", "RFC 7515 A.1: after exp it has expired" |
| JWT-P6 | `iss`, `aud`, `sub` and `typ`: each compared exactly when the verifier names one; `aud` one string or an array of strings; a token with `aud` refused by a verifier that names no audience (RFC 7519 §4.1.3); a payload that is not one JSON object refused; and a refused token leaves no claims. | "claims: the wrong issuer", "claims: no issuer when one is required", "claims: aud as one string", "claims: the wrong audience", "claims: no audience when one is required", "claims: an aud the verifier names none for (RFC 7519 4.1.3)", "claims: an aud array holding a number", "claims: the wrong subject", "claims: a payload that is an array", "claims: a payload that is not JSON", "claims: a refused token leaves claimsLen 0", "typ: the required typ", "typ: no typ when one is required" |
| JWT-P7 | Signatures: the RFC vectors verify, a flipped byte fails under every algorithm, the HMAC tag from `HmacKey`'s copied midstates equals `hmacSha256`/`384`/`512`'s at every block boundary, and `hmacKeyedVerify` compares in constant time and refuses a tag window that does not fit. | "RFC 7515 A.1: HS256 verifies", "RFC 7515 A.2: RS256 verifies", "RFC 7515 A.3: ES256 verifies", "RFC 8037 A.4: a flipped signature byte fails", "RFC 7515 A.2: a flipped signature byte fails", "RFC 7515 A.3: a flipped signature byte fails", "RFC 7515 A.1: a flipped signature byte fails", "RFC 7515 A.1: a flipped payload byte fails", "HmacKey: the keyed tag is hmacSha256/384/512's, at every block boundary", "HmacKey: hmacKeyedVerify accepts the tag it made", "HmacKey: hmacKeyedVerify refuses a flipped bit and a tag window that does not fit", "one verifier answers the same over 200 tokens" |
| JWT-P8 | Keys: an HMAC secret shorter than its hash (RFC 7518 §3.2) and an RSA modulus below 2048 bits (§3.3) are refused, as are a key for the wrong family and malformed key bytes; a verify-only key and an RS key cannot sign; the signer refuses claims that are not one object and a `kid` needing an escape; and a wiped key verifies nothing. The wipes survive `opt -O2`. | "jwtHmacKey: a key shorter than the hash is refused (RFC 7518 3.2)", "jwtHmacKey: an alg that is not HS is refused", "jwtRsaKeyParts: an alg that is not RS is refused", "jwtRsaKeyParts: a 1024-bit modulus is refused (RFC 7518 3.3)", "jwtRsaKey: DER that does not parse is refused", "jwtEcKey: a P-256 point under ES384 is refused", "jwtEd25519Key: 31 bytes are refused", "jwtSign: an RS key cannot sign", "jwtSign: a verify-only EdDSA key cannot sign", "jwtSign: claims that are not one object are refused", "jwtSignKid: a kid needing an escape is refused", "a wiped key verifies nothing", "crypto_jwt: the wipes survive opt -O2 (HmacKey's keyed pads, midstate copy, inner digest, tag and hashers; JwtKey's private copy)" |

## Tests

- `tests/link/crypto_jwt` and `tests/link/crypto_jwt_f64`: the 100 checks
  named above, plus "jwtAlgName names RFC 7518's algorithms", "jwtHmacKey
  takes RFC 7515 A.1's 64-byte key", "the RFC 7515 A.2, A.3 and RFC 8037 A.2
  keys load", "RFC 7515 A.1: exp is read", "RFC 7515 A.1: the claims are left
  in the buffer", "jwtSignString: HS256", "jwtSignKid: HS256 with a kid",
  "peekKid reads the kid", "peekKid: no kid answers -1", "jwtSignString:
  HS384", "jwtSignString: HS512", "HS512 verifies its own token",
  "jwtSignString: EdDSA under RFC 8037 A.1's key", "EdDSA: the verify-only key
  takes the signed token" and "ES256: RFC 7515 A.3's key signs, and its
  public key verifies".
- `tests/wipes/crypto.js`: "crypto_jwt: the wipes survive opt -O2 (HmacKey's
  keyed pads, midstate copy, inner digest, tag and hashers; JwtKey's private
  copy)".
- `tests/fuzz/targets/jwt.ts`, corpus `tests/fuzz/corpus/jwt/`.
