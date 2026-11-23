/**
 * `nish/net/oidc` — verify a JWT from an OpenID Connect issuer: find the
 * issuer's keys through discovery (OpenID Connect Discovery 1.0), read its
 * JWK Set (RFC 7517, RFC 7518 §6, RFC 8037), follow its key rotation, and
 * check a token's signature and claims with `nish/crypto/jwt`.
 *
 *     import { OIDC_OK, OidcKeys, OidcMetadata, OidcOptions, oidcDiscover, oidcVerify } from "nish/net/oidc"
 *
 *     const options = new OidcOptions()
 *     const meta: OidcMetadata = oidcDiscover("https://issuer.example", options) // once, at start-up
 *     const keys = new OidcKeys(meta, options)
 *     keys.refresh(now) // fetch the key set; then call refresh(now) from the server's own timer
 *     if (oidcVerify(keys, token, "my-api", now) === OIDC_OK) {
 *       const claims: string = keys.claimsText()
 *     }
 *
 * **Nothing is guessed about the issuer.** The issuer is named by the caller,
 * and the discovery document must name the same issuer, byte for byte; the key
 * set is read only from the `jwks_uri` that document gives, and both must be
 * https (loopback http, with `allowLoopbackHttp`, for an http issuer only). A
 * `jwks_uri` on another origin than the issuer's was chosen by the document,
 * not the program, so it is fetched under an `OutboundPolicy`
 * (`OidcOptions.jwksOutbound`): public addresses only, no proxy. Every key in
 * the set is bound to exactly one algorithm, which comes
 * from the key — its `kty`, its `crv` and its `alg` — and never from a token's
 * header: a key whose `alg` disagrees with its type refuses the whole set, and
 * the verifier refuses a token whose header names any other algorithm.
 *
 * **Fetches are synchronous and happen only where the caller asks.**
 * `oidcDiscover` and `OidcKeys.refresh` each make one blocking GET, bounded by
 * `OidcOptions.timeoutMs`; `OidcKeys.key` and `oidcVerify` never fetch. A
 * token with a `kid` the set does not hold marks the set as wanted, so the
 * next `refresh` fetches it early, at most once per
 * `OIDC_MIN_REFRESH_INTERVAL`. A server calls `refresh(now)` from its own
 * loop or timer, where blocking is harmless, and never from a request.
 *
 * Every function that reads the clock takes it as a `now` parameter, in
 * seconds since 1970, so a test drives the clock; `oidcDiscover` reads none. The security record is `docs/security/oidc.md`.
 *
 * @module
 */
import {
  JWT_ALG_EDDSA,
  JWT_ALG_ES256,
  JWT_ALG_ES384,
  JWT_ALG_HS256,
  JWT_ALG_HS384,
  JWT_ALG_HS512,
  JWT_ALG_RS256,
  JWT_ALG_RS384,
  JWT_ALG_RS512,
  JWT_ERR_FORMAT,
  JWT_ERR_SIZE,
  JWT_MAX_TOKEN,
  JwtKey,
  JwtVerifier,
  jwtAlgName,
  jwtEcKey,
  jwtEd25519Key,
  jwtRsaKeyParts,
} from "nish/crypto/jwt"
import { base64urlDecode } from "nish/crypto/base64url"
import {
  FetchSyncClient,
  HTTP_E_BODY_TOO_LARGE,
  HttpOptions,
  HttpRequest,
  HttpResponse,
} from "nish/net/fetch"
import { OutboundPolicy } from "nish/net/outbound"
import { Url, urlOrigin, urlParse } from "nish/net/url"
import {
  JSON_VALUE_ARRAY,
  JSON_VALUE_OBJECT,
  JSON_VALUE_STRING,
  JsonDocument,
  JsonValue,
} from "nish/json-value"
import { JsonLimits } from "nish/json-tokenizer"
import { asciiLower, trim } from "nish/text"

/** Success. */
export const OIDC_OK: i32 = 0
/** `OidcKeys.refresh` did nothing: the set is fresh and wanted by no token, or the last attempt was too recent. */
export const OIDC_SKIPPED: i32 = 1
/** No response, a status other than 200, or a transport error. */
export const OIDC_ERR_FETCH: i32 = -40
/** The document is larger than its limit (`OIDC_MAX_DISCOVERY_BYTES`, `OIDC_MAX_JWKS_BYTES`). */
export const OIDC_ERR_SIZE: i32 = -41
/** The document is not JSON, not an object, or a member is missing or of the wrong type. */
export const OIDC_ERR_JSON: i32 = -42
/** The discovery document's `issuer` is not the configured issuer, byte for byte. */
export const OIDC_ERR_ISSUER: i32 = -43
/** The issuer or `jwks_uri` is not an https URL (or loopback http, when allowed; an http `jwks_uri` only for an http issuer), or has a form refused. */
export const OIDC_ERR_SCHEME: i32 = -44
/** A key's `alg` disagrees with its `kty` or `crv`, its material does not make a key, or its `kid` is refused. */
export const OIDC_ERR_KEY: i32 = -45
/** A key carries a private or symmetric member (`d`, `p`, `q`, `dp`, `dq`, `qi`, `oth` or `k`). */
export const OIDC_ERR_PRIVATE: i32 = -46
/** Two keys taken into the set share a `kid` (two without one count as sharing it). */
export const OIDC_ERR_DUPLICATE_KID: i32 = -47
/** The set lists more than `OIDC_MAX_KEYS` keys. */
export const OIDC_ERR_TOO_MANY_KEYS: i32 = -48
/** The set holds no key this module takes. */
export const OIDC_ERR_NO_KEYS: i32 = -49
/** The token's `kid` is not in the set. */
export const OIDC_ERR_UNKNOWN_KID: i32 = -50
/** The token names no `kid` and the set holds more than one key. */
export const OIDC_ERR_KID_REQUIRED: i32 = -51
/** No key set has been taken yet, or the last one is past its hard expiry. */
export const OIDC_ERR_STALE: i32 = -52

/** The largest discovery document read, in bytes. */
export const OIDC_MAX_DISCOVERY_BYTES: i32 = 65536
/** The largest JWK Set read, in bytes. */
export const OIDC_MAX_JWKS_BYTES: i32 = 65536
/** The most entries a JWK Set's `keys` may list, taken or skipped. */
export const OIDC_MAX_KEYS: i32 = 64
/** The longest `kid`, in bytes. */
export const OIDC_MAX_KID: i32 = 256
/** The shortest a key set is fresh, in seconds, whatever `max-age` says. */
export const OIDC_MIN_LIFETIME: i64 = 300
/** The longest a key set is fresh, in seconds, whatever `max-age` says. */
export const OIDC_MAX_LIFETIME: i64 = 86400
/** How long a key set is fresh when its response has no usable `max-age`, in seconds. */
export const OIDC_DEFAULT_LIFETIME: i64 = 3600
/**
 * The least time between two fetches of the key set, in seconds. A fetch
 * clears the unknown-`kid` mark as it begins, so one that fails is tried
 * again only when another unknown `kid` arrives or the set's lifetime ends,
 * not merely once this interval has passed.
 */
export const OIDC_MIN_REFRESH_INTERVAL: i64 = 60
/** How long past its freshness a key set still verifies while refreshes fail, in seconds. */
export const OIDC_STALE_GRACE: i64 = 86400
/** The default clock skew allowed on `exp`, `nbf` and `iat`, in seconds. */
export const OIDC_DEFAULT_LEEWAY: i64 = 60
/** The default bound on one fetch, connect to last byte, in milliseconds. */
export const OIDC_DEFAULT_TIMEOUT_MS: i32 = 10000

/** The path discovery appends to the issuer (OpenID Connect Discovery 1.0 §4). */
const OIDC_WELL_KNOWN: string = "/.well-known/openid-configuration"
/** The bytes a `kid` may hold: printable ASCII, space to tilde. */
const OIDC_KID_LOW: i32 = 32
const OIDC_KID_HIGH: i32 = 126
const OIDC_CH_0: i32 = 48
const OIDC_CH_9: i32 = 57
const OIDC_CH_EQUALS: i32 = 61
const OIDC_CH_COMMA: i32 = 44
const OIDC_HTTP_OK: i32 = 200
/** The uncompressed-point marker `jwtEcKey` takes in front of `x‖y`. */
const OIDC_EC_UNCOMPRESSED: i32 = 4
const OIDC_P256_COORD: i32 = 32
const OIDC_P384_COORD: i32 = 48
const OIDC_ED25519_KEY: i32 = 32
/** Members that make a JWK private or symmetric (RFC 7518 §6.2.2, §6.3.2, §6.4.1; RFC 8037 §2). */
const oidcPrivateMembers = (): string[] => ["d", "p", "q", "dp", "dq", "qi", "oth", "k"]

/** How discovery and the key set fetch, and how tokens are checked. */
export class OidcOptions {
  /** Allow `http://` to `127.0.0.1`, `localhost` or `::1` for the issuer and `jwks_uri`; off by default, for tests. */
  allowLoopbackHttp: boolean = false
  /** The bound on one fetch, connect to last byte, in milliseconds; 0 or less means `OIDC_DEFAULT_TIMEOUT_MS`. */
  timeoutMs: i32
  /** The clock skew allowed on `exp`, `nbf` and `iat`, in seconds. */
  leeway: i64
  /** The longest token verified, in bytes. */
  maxToken: i32
  /**
   * The policy a `jwks_uri` on another origin than the issuer's is fetched
   * under, since the discovery document chose it and the program did not: by
   * default `new OutboundPolicy()`, public addresses only and no proxy. Null
   * fetches it like the issuer, through any proxy the environment names.
   */
  jwksOutbound: OutboundPolicy | null

  /**
   * The defaults: `OIDC_DEFAULT_TIMEOUT_MS`, `OIDC_DEFAULT_LEEWAY`,
   * `JWT_MAX_TOKEN`, no loopback http, and a default `OutboundPolicy` for a
   * `jwks_uri` on another origin.
   */
  constructor() {
    this.timeoutMs = OIDC_DEFAULT_TIMEOUT_MS
    this.leeway = OIDC_DEFAULT_LEEWAY
    this.maxToken = JWT_MAX_TOKEN
    this.jwksOutbound = new OutboundPolicy()
  }
}

/** What discovery found: the issuer as configured and the URL of its key set, or why it failed. */
export class OidcMetadata {
  /** `OIDC_OK`, or the reason discovery failed; the other fields are empty unless it is `OIDC_OK`. */
  error: i32
  /** The issuer, as configured and as the document named it. */
  issuer: string
  /** The document's `jwks_uri`. */
  jwksUri: string

  /**
   * Metadata from its parts, checked for nothing; `oidcDiscover` and
   * `oidcParseDiscovery` are the way to make one.
   *
   * @param error `OIDC_OK`, or the reason discovery failed.
   * @param issuer The issuer.
   * @param jwksUri The URL of the issuer's JWK Set.
   */
  constructor(error: i32, issuer: string, jwksUri: string) {
    this.error = error
    this.issuer = issuer
    this.jwksUri = jwksUri
  }
}

/** A JWK Set as taken: each key bound to one algorithm, with its `kid`, or why the set was refused. */
export class OidcKeySet {
  /** `OIDC_OK`, or the reason the set was refused; a refused set holds no key. */
  error: i32 = 0
  /** The keys taken, in the set's order. */
  keys: JwtKey[]
  /** Each key's `kid`; `""` for a key with none. */
  kids: string[]

  /** An empty set, `OIDC_OK`; `oidcParseJwks` is the way to fill one. */
  constructor() {
    this.keys = []
    this.kids = []
  }

  /**
   * The number of keys taken.
   *
   * @returns How many keys the set holds.
   */
  count(): i32 {
    return toI32(this.keys.length)
  }

  /**
   * The key whose `kid` is `kid`, spelled exactly.
   *
   * @param kid The `kid` to look for.
   * @returns The key, or null when no key has that `kid`.
   */
  find(kid: string): JwtKey | null {
    const keys: JwtKey[] = this.keys
    const kids: string[] = this.kids
    for (let i: i32 = 0; i < toI32(keys.length) && i < toI32(kids.length); i += 1) {
      if (kid !== "" && kids[i] === kid) {
        return keys[i]
      }
    }
    return null
  }
}

/** A failed set: no key, and the reason. */
const oidcRefused = (error: i32): OidcKeySet => {
  const set: OidcKeySet = new OidcKeySet()
  set.error = error
  return set
}

/** Whether `host` names this machine, as `allowLoopbackHttp` allows. */
const oidcLoopback = (host: string): boolean => host === "127.0.0.1" || host === "localhost" || host === "::1"

/** Whether `u` may be fetched: https with a host and no userinfo, or loopback http when allowed. */
const oidcUrlAllowed = (u: Url, options: OidcOptions): boolean => {
  if (u.host === "" || u.username !== "" || u.password !== "") {
    return false
  }
  if (u.scheme === "https") {
    return true
  }
  return u.scheme === "http" && options.allowLoopbackHttp && oidcLoopback(u.host)
}

/**
 * Whether `issuer` is a form this module takes: an https URL with a host and
 * no userinfo, query or fragment (OpenID Connect Discovery 1.0 §2), or loopback
 * http when `options.allowLoopbackHttp` is set.
 *
 * @param issuer The issuer identifier.
 * @param options The options; only `allowLoopbackHttp` is read.
 * @returns True when the issuer may be asked.
 */
export const oidcIssuerAllowed = (issuer: string, options: OidcOptions): boolean => {
  const u: Url | null = urlParse(issuer)
  if (u === null) {
    return false
  }
  return u.query === null && u.fragment === null && oidcUrlAllowed(u, options)
}

/**
 * Where discovery asks: the issuer, less one trailing `/`, with
 * `/.well-known/openid-configuration` appended (OpenID Connect Discovery 1.0
 * §4.1).
 *
 * @param issuer The issuer identifier.
 * @returns The discovery URL.
 */
export const oidcDiscoveryUrl = (issuer: string): string => {
  const base: string = issuer.endsWith("/") ? issuer.substring(0, toI32(issuer.length) - 1) : issuer
  return `${base}${OIDC_WELL_KNOWN}`
}

/** A JSON document sized to `limit` bytes. */
const oidcDocument = (limit: i32): JsonDocument => {
  const limits: JsonLimits = new JsonLimits()
  limits.maxTotalBytes = limit
  limits.maxStringBytes = limit
  return new JsonDocument(limits)
}

/**
 * The discovery document `doc`, already fetched, checked against `issuer`:
 * an object whose `issuer` is `issuer` byte for byte and whose `jwks_uri` is
 * a URL `oidcDiscover` would fetch, and http only when the issuer is (so an
 * https issuer never names an http key set). Fetches nothing.
 *
 * @param issuer The issuer, as configured.
 * @param doc The document's bytes.
 * @param options The options; only `allowLoopbackHttp` is read.
 * @returns The metadata; its `error` is `OIDC_OK` or the reason it was refused.
 */
export const oidcParseDiscovery = (issuer: string, doc: u8[], options: OidcOptions): OidcMetadata => {
  if (!oidcIssuerAllowed(issuer, options)) {
    return new OidcMetadata(OIDC_ERR_SCHEME, "", "")
  }
  if (toI32(doc.length) > OIDC_MAX_DISCOVERY_BYTES) {
    return new OidcMetadata(OIDC_ERR_SIZE, "", "")
  }
  const json: JsonDocument = oidcDocument(OIDC_MAX_DISCOVERY_BYTES)
  const root: JsonValue = json.parse(doc, toI32(0), toI32(doc.length))
  if (root < 0 || json.kind(root) !== JSON_VALUE_OBJECT) {
    return new OidcMetadata(OIDC_ERR_JSON, "", "")
  }
  const named: JsonValue = json.get(root, "issuer")
  const jwks: JsonValue = json.get(root, "jwks_uri")
  if (json.kind(named) !== JSON_VALUE_STRING || json.kind(jwks) !== JSON_VALUE_STRING) {
    return new OidcMetadata(OIDC_ERR_JSON, "", "")
  }
  if (!json.stringEquals(named, issuer)) {
    return new OidcMetadata(OIDC_ERR_ISSUER, "", "")
  }
  const jwksUri: string = json.string(jwks)
  const u: Url | null = urlParse(jwksUri)
  if (
    u === null ||
    !oidcUrlAllowed(u, options) ||
    (u.scheme === "http" && !asciiLower(issuer).startsWith("http:"))
  ) {
    return new OidcMetadata(OIDC_ERR_SCHEME, "", "")
  }
  return new OidcMetadata(OIDC_OK, issuer, jwksUri)
}

/**
 * The fetch options discovery and a refresh use: no redirect followed, the
 * connect, each read and the whole fetch bounded by `options.timeoutMs` (by
 * `OIDC_DEFAULT_TIMEOUT_MS` when it is 0 or less), the body bounded at
 * `limit`, and `outbound` applied when it is not null.
 *
 * @param options The options.
 * @param limit The largest body taken, in bytes.
 * @param outbound The outbound policy the fetch runs under, or null for none.
 * @returns The fetch options.
 */
export const oidcHttpOptions = (
  options: OidcOptions,
  limit: i32,
  outbound: OutboundPolicy | null
): HttpOptions => {
  const http: HttpOptions = new HttpOptions()
  const timeout: i32 = options.timeoutMs > 0 ? options.timeoutMs : OIDC_DEFAULT_TIMEOUT_MS
  http.followRedirects = false
  http.connectTimeoutMs = timeout
  http.readTimeoutMs = timeout
  http.totalTimeoutMs = timeout
  http.maxBodyBytes = toI64(limit)
  http.outbound = outbound
  return http
}

/** What one GET answered: the body, the `Cache-Control` header, or why there is no body. */
class OidcFetched {
  error: i32 = 0
  body: u8[]
  cacheControl: string | null = null

  constructor() {
    this.body = []
  }
}

/** Why `client`'s fetch failed: `OIDC_ERR_SIZE` past the bound, else `OIDC_ERR_FETCH`. */
const oidcFetchError = (client: FetchSyncClient): i32 =>
  client.error === HTTP_E_BODY_TOO_LARGE ? OIDC_ERR_SIZE : OIDC_ERR_FETCH

/** Whether `a` and `b` parse to the same origin (scheme, host and port); false when either does not. */
const oidcSameOrigin = (a: string, b: string): boolean => {
  const ua: Url | null = urlParse(a)
  const ub: Url | null = urlParse(b)
  if (ua === null || ub === null) {
    return false
  }
  const oa: string | null = urlOrigin(ua)
  const ob: string | null = urlOrigin(ub)
  return oa !== null && ob !== null && oa === ob
}

/** One blocking GET of `url`, its body bounded at `limit` bytes, under `outbound` when not null; only a 200 is taken. */
const oidcGet = (
  url: string,
  options: OidcOptions,
  limit: i32,
  outbound: OutboundPolicy | null
): OidcFetched => {
  const out: OidcFetched = new OidcFetched()
  const client: FetchSyncClient = new FetchSyncClient(oidcHttpOptions(options, limit, outbound))
  const res: HttpResponse | null = client.fetch(new HttpRequest("GET", url))
  if (res === null) {
    out.error = oidcFetchError(client)
  } else if (res.status !== OIDC_HTTP_OK) {
    out.error = OIDC_ERR_FETCH
  } else {
    const body: u8[] | null = res.body.readAll(limit)
    if (body === null) {
      out.error = oidcFetchError(client)
    } else {
      out.body = body
      out.cacheControl = res.header("cache-control")
    }
  }
  client.close()
  return out
}

/**
 * Discovery: one blocking GET of `oidcDiscoveryUrl(issuer)`, no redirect
 * followed, bounded by `options.timeoutMs` and `OIDC_MAX_DISCOVERY_BYTES`,
 * then `oidcParseDiscovery`. Only a 200 is taken.
 *
 * @param issuer The issuer, as configured: https, or loopback http when allowed.
 * @param options The options.
 * @returns The metadata; its `error` is `OIDC_OK` or the reason discovery failed.
 */
export const oidcDiscover = (issuer: string, options: OidcOptions): OidcMetadata => {
  if (!oidcIssuerAllowed(issuer, options)) {
    return new OidcMetadata(OIDC_ERR_SCHEME, "", "")
  }
  const got: OidcFetched = oidcGet(oidcDiscoveryUrl(issuer), options, OIDC_MAX_DISCOVERY_BYTES, null)
  if (got.error !== OIDC_OK) {
    return new OidcMetadata(got.error, "", "")
  }
  return oidcParseDiscovery(issuer, got.body, options)
}

/** The `JWT_ALG_*` an `alg` member names, 0 for a name `nish/crypto/jwt` does not know. */
const oidcAlgByName = (name: string): i32 => {
  const algs: i32[] = [
    JWT_ALG_HS256,
    JWT_ALG_HS384,
    JWT_ALG_HS512,
    JWT_ALG_RS256,
    JWT_ALG_RS384,
    JWT_ALG_RS512,
    JWT_ALG_ES256,
    JWT_ALG_ES384,
    JWT_ALG_EDDSA,
  ]
  for (const alg of algs) {
    if (jwtAlgName(alg) === name) {
      return alg
    }
  }
  return 0
}

/** Whether `alg` is one of the RS algorithms. */
const oidcIsRsa = (alg: i32): boolean =>
  alg === JWT_ALG_RS256 || alg === JWT_ALG_RS384 || alg === JWT_ALG_RS512

/** One member of a JWK as `oidcMember` read it: whether it is present, whether it is not a string, and its text. */
class OidcMember {
  present: boolean = false
  wrong: boolean = false
  text: string = ""
}

/** Read member `name` of object `o`. */
const oidcMember = (json: JsonDocument, o: JsonValue, name: string): OidcMember => {
  const m: OidcMember = new OidcMember()
  const v: JsonValue = json.get(o, name)
  if (v < 0) {
    return m
  }
  m.present = true
  if (json.kind(v) !== JSON_VALUE_STRING) {
    m.wrong = true
    return m
  }
  m.text = json.string(v)
  return m
}

/** Whether `kid` is 1 to `OIDC_MAX_KID` bytes of printable ASCII. */
const oidcKidAllowed = (kid: string): boolean => {
  const n: i32 = toI32(kid.length)
  if (n < 1 || n > OIDC_MAX_KID) {
    return false
  }
  for (let i: i32 = 0; i < n; i += 1) {
    const c: i32 = toI32(kid.charCodeAt(i))
    if (c < OIDC_KID_LOW || c > OIDC_KID_HIGH) {
      return false
    }
  }
  return true
}

/** The bytes of a base64url member, or null when it is absent, not a string, or not base64url. */
const oidcBytes = (json: JsonDocument, o: JsonValue, name: string): u8[] | null => {
  const m: OidcMember = oidcMember(json, o, name)
  if (!m.present || m.wrong) {
    return null
  }
  return base64urlDecode(m.text)
}

/** An EC or OKP key's point: `x‖y` behind the uncompressed marker for EC, `x` alone for OKP; null when a coordinate is not `size` bytes. */
const oidcPoint = (json: JsonDocument, o: JsonValue, size: i32, withY: boolean): u8[] | null => {
  const x: u8[] | null = oidcBytes(json, o, "x")
  if (x === null || toI32(x.length) !== size) {
    return null
  }
  if (!withY) {
    return x
  }
  const y: u8[] | null = oidcBytes(json, o, "y")
  if (y === null || toI32(y.length) !== size) {
    return null
  }
  const point: u8[] = [toU8(OIDC_EC_UNCOMPRESSED)]
  for (const b of x) {
    point.push(b)
  }
  for (const b of y) {
    point.push(b)
  }
  return point
}

/** The algorithm a key's `kty` and `crv` admit; 0 for a pair this module does not take. */
const oidcAlgOfType = (kty: string, crv: string): i32 => {
  if (kty === "RSA") {
    return JWT_ALG_RS256
  }
  if (kty === "EC" && crv === "P-256") {
    return JWT_ALG_ES256
  }
  if (kty === "EC" && crv === "P-384") {
    return JWT_ALG_ES384
  }
  if (kty === "OKP" && crv === "Ed25519") {
    return JWT_ALG_EDDSA
  }
  return 0
}

/** The key one JWK makes under `alg`, or null when its material does not make one. */
const oidcMakeKey = (json: JsonDocument, o: JsonValue, alg: i32): JwtKey | null => {
  if (oidcIsRsa(alg)) {
    const n: u8[] | null = oidcBytes(json, o, "n")
    const e: u8[] | null = oidcBytes(json, o, "e")
    if (n === null || e === null) {
      return null
    }
    return jwtRsaKeyParts(alg, n, e)
  }
  if (alg === JWT_ALG_EDDSA) {
    const pub: u8[] | null = oidcPoint(json, o, OIDC_ED25519_KEY, false)
    return pub === null ? null : jwtEd25519Key(pub)
  }
  const size: i32 = alg === JWT_ALG_ES256 ? OIDC_P256_COORD : OIDC_P384_COORD
  const point: u8[] | null = oidcPoint(json, o, size, true)
  return point === null ? null : jwtEcKey(alg, point)
}

/** What one JWK came to: a key, a skip, or the reason the whole set is refused. */
class OidcEntry {
  key: JwtKey | null = null
  kid: string = ""
  error: i32 = 0
}

/** One entry of `keys`, read under the rules `oidcParseJwks` states. */
const oidcEntry = (json: JsonDocument, o: JsonValue): OidcEntry => {
  const out: OidcEntry = new OidcEntry()
  if (json.kind(o) !== JSON_VALUE_OBJECT) {
    out.error = OIDC_ERR_JSON
    return out
  }
  for (const name of oidcPrivateMembers()) {
    if (json.get(o, name) >= 0) {
      out.error = OIDC_ERR_PRIVATE
      return out
    }
  }
  const kty: OidcMember = oidcMember(json, o, "kty")
  const use: OidcMember = oidcMember(json, o, "use")
  const algName: OidcMember = oidcMember(json, o, "alg")
  const kid: OidcMember = oidcMember(json, o, "kid")
  const crv: OidcMember = oidcMember(json, o, "crv")
  if (!kty.present || kty.wrong || use.wrong || algName.wrong || kid.wrong || crv.wrong) {
    out.error = OIDC_ERR_JSON
    return out
  }
  if (kid.present && !oidcKidAllowed(kid.text)) {
    out.error = OIDC_ERR_KEY
    return out
  }
  if (use.present && use.text !== "sig") {
    return out
  }
  const named: i32 = algName.present ? oidcAlgByName(algName.text) : 0
  if (algName.present && named === 0) {
    return out
  }
  const typed: i32 = oidcAlgOfType(kty.text, crv.text)
  if (typed === 0) {
    out.error = algName.present ? OIDC_ERR_KEY : OIDC_OK
    return out
  }
  let alg: i32 = typed
  if (named !== 0) {
    const agrees: boolean = oidcIsRsa(typed) ? oidcIsRsa(named) : named === typed
    if (!agrees) {
      out.error = OIDC_ERR_KEY
      return out
    }
    alg = named
  }
  const key: JwtKey | null = oidcMakeKey(json, o, alg)
  if (key === null) {
    out.error = OIDC_ERR_KEY
    return out
  }
  out.key = key
  out.kid = kid.present ? kid.text : ""
  return out
}

/**
 * A JWK Set, already fetched, read into keys. The rules:
 *
 * - The document is at most `OIDC_MAX_JWKS_BYTES`, a JSON object whose `keys`
 *   is an array of at most `OIDC_MAX_KEYS` entries.
 *
 * Each entry is then read by these rules, in this order; the first that
 * applies decides it, and a refusal refuses the whole set:
 *
 * 1. An entry that is not an object refuses the set (`OIDC_ERR_JSON`).
 * 2. An entry holding `d`, `p`, `q`, `dp`, `dq`, `qi`, `oth` or `k` refuses the
 *    set (`OIDC_ERR_PRIVATE`), whatever its `use` or type: a publisher that
 *    leaks a private or symmetric key has a set no verifier should trust.
 * 3. An entry without `kty`, or whose `kty`, `use`, `alg`, `kid` or `crv` is
 *    present and not a string, refuses the set (`OIDC_ERR_JSON`).
 * 4. A `kid` that is not 1 to `OIDC_MAX_KID` bytes of printable ASCII refuses
 *    the set (`OIDC_ERR_KEY`), whatever the entry's `use`.
 * 5. An entry whose `use` is present and not `"sig"` is skipped.
 * 6. An entry whose `alg` names an algorithm `nish/crypto/jwt` does not have
 *    is skipped.
 * 7. An entry whose `kty`/`crv` is not RSA, EC P-256, EC P-384 or OKP Ed25519
 *    is skipped when it has no `alg`, and refuses the set (`OIDC_ERR_KEY`)
 *    when it has one, since the `alg` then names a key this module would
 *    misread.
 * 8. The key's algorithm is its `alg` when present, which must agree with its
 *    type (RS256/384/512 for RSA, ES256 for P-256, ES384 for P-384, EdDSA for
 *    Ed25519), or the set is refused (`OIDC_ERR_KEY`); without `alg` it is
 *    ES256, ES384 or EdDSA by curve, and RS256 for RSA, OpenID Connect Core's
 *    default.
 * 9. The key's material must make a key — `n`/`e` with an RSA modulus of 2048
 *    to 8192 bits, `x`/`y` of the curve's size, an Ed25519 `x` of 32 bytes —
 *    or the set is refused (`OIDC_ERR_KEY`).
 *
 * Then:
 *
 * - Two keys taken with the same `kid`, or two without one, refuse the set
 *   (`OIDC_ERR_DUPLICATE_KID`), and a set where none is taken is
 *   `OIDC_ERR_NO_KEYS`.
 *
 * @param doc The JWK Set's bytes.
 * @returns The set; its `error` is `OIDC_OK` or the reason it was refused.
 */
export const oidcParseJwks = (doc: u8[]): OidcKeySet => {
  if (toI32(doc.length) > OIDC_MAX_JWKS_BYTES) {
    return oidcRefused(OIDC_ERR_SIZE)
  }
  const json: JsonDocument = oidcDocument(OIDC_MAX_JWKS_BYTES)
  const root: JsonValue = json.parse(doc, toI32(0), toI32(doc.length))
  if (root < 0 || json.kind(root) !== JSON_VALUE_OBJECT) {
    return oidcRefused(OIDC_ERR_JSON)
  }
  const list: JsonValue = json.get(root, "keys")
  if (json.kind(list) !== JSON_VALUE_ARRAY) {
    return oidcRefused(OIDC_ERR_JSON)
  }
  const n: i32 = json.length(list)
  if (n > OIDC_MAX_KEYS) {
    return oidcRefused(OIDC_ERR_TOO_MANY_KEYS)
  }
  const set: OidcKeySet = new OidcKeySet()
  for (let i: i32 = 0; i < n; i += 1) {
    const entry: OidcEntry = oidcEntry(json, json.at(list, i))
    if (entry.error !== OIDC_OK) {
      return oidcRefused(entry.error)
    }
    const key: JwtKey | null = entry.key
    if (key !== null) {
      const kids: string[] = set.kids
      for (let j: i32 = 0; j < toI32(kids.length); j += 1) {
        if (kids[j] === entry.kid) {
          return oidcRefused(OIDC_ERR_DUPLICATE_KID)
        }
      }
      set.keys.push(key)
      set.kids.push(entry.kid)
    }
  }
  if (set.count() === 0) {
    return oidcRefused(OIDC_ERR_NO_KEYS)
  }
  return set
}

/** The seconds of one `max-age=<digits>` directive, or -1 when `directive` is not one. */
const oidcMaxAge = (directive: string): i64 => {
  const eq: i32 = toI32(directive.indexOf(String.fromCharCode(OIDC_CH_EQUALS)))
  const end: i32 = toI32(directive.length)
  if (eq < 1 || eq >= end || asciiLower(trim(directive.substring(0, eq))) !== "max-age") {
    return toI64(-1)
  }
  const value: string = trim(directive.substring(eq + 1, end))
  const n: i32 = toI32(value.length)
  if (n < 1) {
    return toI64(-1)
  }
  let age: i32 = 0
  for (let i: i32 = 0; i < n; i += 1) {
    const c: i32 = toI32(value.charCodeAt(i))
    if (c < OIDC_CH_0 || c > OIDC_CH_9) {
      return toI64(-1)
    }
    // Saturate rather than overflow (RFC 9111 §1.2.2): the clamp caps it
    // anyway. 86400 is `OIDC_MAX_LIFETIME`, written as an `i32` the bound
    // proofs read.
    let d: i32 = 0
    if (c >= OIDC_CH_0 && c <= OIDC_CH_9) {
      d = c - OIDC_CH_0
    }
    if (age >= 0 && age <= 86400 && d >= 0 && d <= 9) {
      age = age * 10 + d
    }
  }
  return toI64(age)
}

/**
 * How long a key set fetched with this `Cache-Control` is fresh: its first
 * `max-age` directive of plain digits, clamped to `[OIDC_MIN_LIFETIME,
 * OIDC_MAX_LIFETIME]`, or `OIDC_DEFAULT_LIFETIME` when there is none. Other
 * directives (`no-cache`, `no-store`, `s-maxage`) are not read: the floor
 * holds whatever the response says.
 *
 * @param cacheControl The header's value, or null when the response had none.
 * @returns The lifetime, in seconds.
 */
export const oidcLifetime = (cacheControl: string | null): i64 => {
  if (cacheControl === null) {
    return OIDC_DEFAULT_LIFETIME
  }
  const n: i32 = toI32(cacheControl.length)
  let from: i32 = 0
  const text: string = cacheControl
  for (let i: i32 = 0; i >= 0 && i < toI32(text.length); i += 1) {
    if (toI32(text.charCodeAt(i)) === OIDC_CH_COMMA) {
      const age: i64 = oidcMaxAge(trim(text.substring(from, i)))
      if (age >= toI64(0)) {
        return oidcClamp(age)
      }
      from = i + 1
    }
  }
  const last: i64 = oidcMaxAge(trim(cacheControl.substring(from, n)))
  return last >= toI64(0) ? oidcClamp(last) : OIDC_DEFAULT_LIFETIME
}

/** `n` zero bytes, or none when `n` is negative. */
const oidcZeroes = (n: i32): u8[] => {
  if (n < 0) {
    return []
  }
  if (n <= 65535) {
    return new Array<u8>(toU16(n))
  }
  const out: u8[] = new Array<u8>(65535)
  for (let k: i32 = 65535; k < n; k += 1) {
    out.push(0)
  }
  return out
}

/** A `max-age` of `age` seconds, clamped to `[OIDC_MIN_LIFETIME, OIDC_MAX_LIFETIME]`. */
const oidcClamp = (age: i64): i64 => {
  if (age < OIDC_MIN_LIFETIME) {
    return OIDC_MIN_LIFETIME
  }
  return age > OIDC_MAX_LIFETIME ? OIDC_MAX_LIFETIME : age
}

/**
 * An issuer's rotating key set, and a verifier for its tokens. One thread's,
 * like the `JwtVerifier` it holds.
 *
 * The set is fetched by `refresh`, which fetches only when it is due: there
 * is no set yet, the set is past its lifetime (`oidcLifetime`), or a token
 * named a `kid` the set does not hold — and never twice within
 * `OIDC_MIN_REFRESH_INTERVAL`. A refresh that fails keeps the last set taken,
 * which keeps verifying until `OIDC_STALE_GRACE` past the end of its
 * lifetime; past that hard expiry, nothing verifies until a refresh succeeds.
 * A refresh that succeeds replaces the set whole, so a key the issuer stopped
 * publishing stops verifying then. A token whose `kid` the set holds never
 * makes a refresh due early, so a removed key keeps verifying until the set's
 * lifetime ends — at most `OIDC_MAX_LIFETIME` — and, while refreshes fail,
 * until its hard expiry, at most `OIDC_STALE_GRACE` more.
 */
export class OidcKeys {
  /** The issuer's metadata, as discovery gave it. */
  readonly meta: OidcMetadata
  /** The options fetches and verification use. */
  readonly options: OidcOptions
  /** The verifier `oidcVerify` uses; after `OIDC_OK`, its `claims`, `exp` and `nbf` are the token's. */
  readonly verifier: JwtVerifier
  /** The last set taken, or null before the first. */
  set: OidcKeySet | null = null
  /** When the last set taken stops being fresh. */
  freshUntil: i64
  /** When the last set taken stops verifying, if no refresh replaces it. */
  hardUntil: i64
  /** When the last fetch was begun. */
  triedAt: i64
  /** Whether any fetch has been begun. */
  tried: boolean = false
  /** Whether a token named a `kid` the set does not hold since the last fetch. */
  wanted: boolean = false
  /** The result of the last refresh that fetched: `OIDC_OK` or why it failed. */
  lastError: i32 = 0
  /** The token's bytes, copied for the verifier. */
  private readonly text: u8[]
  /** The token's `kid`, as `peekKid` writes it. */
  private readonly kidBytes: u8[]

  /**
   * Keys for the issuer `meta` names; nothing is fetched until `refresh`.
   *
   * @param meta The issuer's metadata, from `oidcDiscover`; a failed one makes
   *   every refresh answer its error.
   * @param options The options.
   */
  constructor(meta: OidcMetadata, options: OidcOptions) {
    this.meta = meta
    this.options = options
    this.freshUntil = toI64(0)
    this.hardUntil = toI64(0)
    this.triedAt = toI64(0)
    this.verifier = new JwtVerifier(options.maxToken)
    // A negative `maxToken` holds no token: `load` refuses every one.
    this.text = oidcZeroes(options.maxToken)
    this.kidBytes = new Array<u8>(OIDC_MAX_KID)
  }

  /**
   * Whether `refresh(now)` would fetch: there is no set, the set is past its
   * lifetime, or a token wanted a `kid` it lacks — and the last fetch began at
   * least `OIDC_MIN_REFRESH_INTERVAL` ago (or later than `now`, after the
   * clock stepped back).
   *
   * @param now The current time, in seconds since 1970.
   * @returns True when a refresh is due.
   */
  due(now: i64): boolean {
    if (this.tried && now >= this.triedAt && now - this.triedAt < OIDC_MIN_REFRESH_INTERVAL) {
      return false
    }
    return this.set === null || now >= this.freshUntil || this.wanted
  }

  /**
   * Take `doc` as the key set when a refresh is due, without fetching: for a
   * caller that fetches the set its own way, and for tests. Counts as a
   * fetch for the rate limit.
   *
   * @param doc The JWK Set's bytes, or null when the fetch failed.
   * @param cacheControl The response's `Cache-Control`, or null.
   * @param now The current time, in seconds since 1970.
   * @returns `OIDC_SKIPPED` when no refresh is due, `OIDC_OK` when the set
   *   was taken, or why it was refused (the last set is kept); a failed
   *   `meta` answers its own error, as `refresh` does.
   */
  refreshWith(doc: u8[] | null, cacheControl: string | null, now: i64): i32 {
    if (!this.due(now)) {
      return OIDC_SKIPPED
    }
    this.begin(now)
    if (this.meta.error !== OIDC_OK) {
      this.lastError = this.meta.error
      return this.meta.error
    }
    if (doc === null) {
      this.lastError = OIDC_ERR_FETCH
      return OIDC_ERR_FETCH
    }
    return this.take(doc, cacheControl, now)
  }

  /**
   * Fetch the key set from `meta.jwksUri` when a refresh is due: one
   * blocking GET, no redirect followed, bounded by `options.timeoutMs` and
   * `OIDC_MAX_JWKS_BYTES`, and under `options.jwksOutbound` when the
   * `jwks_uri` is on another origin than the issuer. Call it once at
   * start-up and then from the server's own loop or timer.
   *
   * @param now The current time, in seconds since 1970.
   * @returns `OIDC_SKIPPED` when no refresh is due, `OIDC_OK` when a set was
   *   taken, or why the refresh failed (the last set is kept).
   */
  refresh(now: i64): i32 {
    if (!this.due(now)) {
      return OIDC_SKIPPED
    }
    this.begin(now)
    if (this.meta.error !== OIDC_OK) {
      this.lastError = this.meta.error
      return this.meta.error
    }
    const outbound: OutboundPolicy | null = oidcSameOrigin(this.meta.issuer, this.meta.jwksUri)
      ? null
      : this.options.jwksOutbound
    const got: OidcFetched = oidcGet(this.meta.jwksUri, this.options, OIDC_MAX_JWKS_BYTES, outbound)
    if (got.error !== OIDC_OK) {
      this.lastError = got.error
      return got.error
    }
    return this.take(got.body, got.cacheControl, now)
  }

  /**
   * Whether the set verifies at `now`: one has been taken and it is not past
   * its hard expiry.
   *
   * @param now The current time, in seconds since 1970.
   * @returns True when a set is in use.
   */
  usable(now: i64): boolean {
    return this.set !== null && now < this.hardUntil
  }

  /**
   * The key whose `kid` is `kid`, without fetching. A `kid` the set lacks
   * marks the set as wanted, so the next due `refresh` fetches it.
   *
   * @param kid The `kid` to look for.
   * @param now The current time, in seconds since 1970.
   * @returns The key, or null when there is no usable set or no such key.
   */
  key(kid: string, now: i64): JwtKey | null {
    const set: OidcKeySet | null = this.set
    if (set === null || !this.usable(now)) {
      return null
    }
    const key: JwtKey | null = set.find(kid)
    if (key === null) {
      this.wanted = true
    }
    return key
  }

  /**
   * The claims of the last token `oidcVerify` accepted, as text.
   *
   * @returns The payload's JSON, or `""` after a refusal.
   */
  claimsText(): string {
    return String.fromBytes(this.verifier.claims, 0, this.verifier.claimsLen)
  }

  /**
   * The token's bytes in the verifier's buffer, for `oidcVerify`.
   *
   * @param token The compact token.
   * @returns Its length, `JWT_ERR_SIZE` when it is too long, or
   *   `JWT_ERR_FORMAT` when a code unit is above 0x7F.
   */
  load(token: string): i32 {
    const n: i32 = toI32(token.length)
    if (n > toI32(this.text.length)) {
      return JWT_ERR_SIZE
    }
    for (let i: i32 = 0; i < n; i += 1) {
      const c: i32 = toI32(token.charCodeAt(i))
      // No token character is above 0x7F. Cut to its low byte, a code unit
      // such as U+0141 would read as `A`, and one signed token would verify
      // under many spellings.
      if (c > 0x7f) {
        return JWT_ERR_FORMAT
      }
      this.text[i] = toU8(c)
    }
    return n
  }

  /**
   * The `kid` of the token `load` copied, read before any signature is
   * checked, only to choose a key.
   *
   * @param n The token's length.
   * @returns The `kid`, or null when the token has none, its `kid` is not a
   *   string, or it is longer than `OIDC_MAX_KID`: such a token is treated as
   *   naming no `kid`.
   */
  peekKid(n: i32): string | null {
    const k: i32 = this.verifier.peekKid(this.text, toI32(0), n, this.kidBytes)
    return k < 0 ? null : String.fromBytes(this.kidBytes, 0, k)
  }

  /**
   * Verify the token `load` copied under `key`, against the issuer and `audience`.
   *
   * @param key The key the token's `kid` chose.
   * @param n The token's length.
   * @param audience The audience the token must name.
   * @param now The current time, in seconds since 1970.
   * @returns `JWT_OK`, or the `JWT_ERR_*` the verifier refused it with.
   */
  check(key: JwtKey, n: i32, audience: string, now: i64): i32 {
    const v: JwtVerifier = this.verifier
    v.issuer = this.meta.issuer
    v.audience = audience
    v.leeway = this.options.leeway
    return v.verify(key, this.text, toI32(0), n, now)
  }

  /** Record a fetch begun at `now`. */
  private begin(now: i64): void {
    this.tried = true
    this.triedAt = now
    this.wanted = false
  }

  /** Take `doc` as the set when it parses; otherwise keep the last one. */
  private take(doc: u8[], cacheControl: string | null, now: i64): i32 {
    const next: OidcKeySet = oidcParseJwks(doc)
    this.lastError = next.error
    if (next.error !== OIDC_OK) {
      return next.error
    }
    this.set = next
    this.freshUntil = now + oidcLifetime(cacheControl)
    this.hardUntil = this.freshUntil + OIDC_STALE_GRACE
    return OIDC_OK
  }
}

/**
 * Verify `token` with the issuer's keys, without fetching. The key is chosen
 * by the token's `kid`; a token with no `kid` — or one whose `kid` is not a
 * string or is longer than `OIDC_MAX_KID`, which counts as none — is taken
 * only when the set holds exactly one key, and is checked under that key,
 * since otherwise which key it means is a guess. The key
 * alone decides the algorithm, so `none`, any HMAC algorithm and any
 * algorithm but the key's are refused (`JWT_ERR_ALG`); then the signature,
 * `iss` (the issuer, exactly), `aud` (a string or an array that holds
 * `audience`), and `exp`, `nbf` and `iat` within `options.leeway` are checked
 * by `nish/crypto/jwt`'s `JwtVerifier`, and `exp` is required.
 *
 * @param keys The issuer's keys.
 * @param token The compact token.
 * @param audience The audience the token must name: this service's client id.
 * @param now The current time, in seconds since 1970.
 * @returns `OIDC_OK` (`JWT_OK`), an `OIDC_ERR_*` when no key could be chosen,
 *   or the `JWT_ERR_*` the verifier refused the token with.
 */
export const oidcVerify = (keys: OidcKeys, token: string, audience: string, now: i64): i32 => {
  // Every refusal leaves no claims behind: no payload and no exp, nbf or iat,
  // neither an earlier token's nor, when the verifier refuses, this one's.
  oidcClearClaims(keys.verifier)
  const code: i32 = oidcPick(keys, token, audience, now)
  if (code !== OIDC_OK) {
    oidcClearClaims(keys.verifier)
  }
  return code
}

/** Forgets the last token's payload and its exp, nbf and iat. */
const oidcClearClaims = (v: JwtVerifier): void => {
  v.claimsLen = 0
  v.hasExp = false
  v.hasNbf = false
  v.hasIat = false
  v.exp = toI64(0)
  v.nbf = toI64(0)
  v.iat = toI64(0)
}

/** Chooses the token's key and verifies the token with it. */
const oidcPick = (keys: OidcKeys, token: string, audience: string, now: i64): i32 => {
  const set: OidcKeySet | null = keys.set
  if (set === null || !keys.usable(now)) {
    return OIDC_ERR_STALE
  }
  const n: i32 = keys.load(token)
  if (n < 0) {
    return n
  }
  const kid: string | null = keys.peekKid(n)
  let key: JwtKey | null = null
  if (kid === null) {
    const only: JwtKey[] = set.keys
    if (toI32(only.length) !== 1) {
      return OIDC_ERR_KID_REQUIRED
    }
    key = only[0]
  } else {
    key = keys.key(kid, now)
  }
  if (key === null) {
    return OIDC_ERR_UNKNOWN_KID
  }
  return keys.check(key, n, audience, now)
}
