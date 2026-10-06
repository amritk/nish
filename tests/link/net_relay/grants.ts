// `examples/relay/grant.ts` and its JSON reader against the fixtures cs's
// `grant.rs` tests use: a token `signGrant` in `@cs/protocol` produced, and
// its secret. Every case grant.rs tests, each mapped to grant.rs's close code
// and reason, and the payloads only a signed token can reach — bad JSON,
// wrong types, a port out of range — signed here with the same secret, since
// the signature is checked before any of them is read.
import { Secret, secret, wipe } from "nish:secret";
import { Suite } from "nish/testing";
import { base64urlEncode } from "nish/crypto/base64url";
import { hmacSha256 } from "nish/crypto/hmac";
import { CLOSE_TOKEN_EXPIRED, CLOSE_TOKEN_INVALID } from "../../../examples/relay/frame";
import { GRANT_OK, GrantVerifier, RelayGrant, grantHmac } from "../../../examples/relay/grant";
import { JSON_INTEGER, JSON_OBJECT, JSON_STRING, RELAY_JSON_LENGTH, RelayJson } from "../../../examples/relay/json";
import { bytesOf, toHex } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";

/**
 * grant.rs's TOKEN: `signGrant({host:'127.0.0.1',port:8788,expiresAt:4102444800000,
 * nonce:'testnonce'}, 'test-secret')`.
 */
export const TOKEN: string =
  "v1.eyJob3N0IjoiMTI3LjAuMC4xIiwicG9ydCI6ODc4OCwiZXhwaXJlc0F0Ijo0MTAyNDQ0ODAwMDAwLCJub25jZSI6InRlc3Rub25jZSJ9.mfArgSQu42L9j5fva2tC-1Kp-ead5KEL1Gqhbylt48w";
/** TOKEN's MAC, its last part. */
const TOKEN_MAC: string = "mfArgSQu42L9j5fva2tC-1Kp-ead5KEL1Gqhbylt48w";
/** grant.rs's SECRET. */
export const SECRET: string = "test-secret";
/** grant.rs's `now` for every case but expiry. */
export const NOW: i64 = 1700000000000;

/** A token over `json` signed with `secret`, as `signGrant` builds one. */
export const signGrant = (json: string, secret: string): string => {
  const body: string = `v1.${base64urlEncode(bytesOf(json))}`;
  return `${body}.${base64urlEncode(hmacSha256(bytesOf(secret), bytesOf(body)))}`;
};

/** A token whose payload segment is `payload` as written, signed with SECRET. */
const signRaw = (payload: string): string => {
  const body: string = `v1.${payload}`;
  return `${body}.${base64urlEncode(hmacSha256(bytesOf(SECRET), bytesOf(body)))}`;
};

/** What verifying `token` at `now` answers, with the reason: "code reason". */
const verdict = (v: GrantVerifier, key: Secret<u8[]>, token: string, now: i64, out: RelayGrant): string => {
  const buf: u8[] = bytesOf(token);
  const code: i32 = v.verify(buf, n32(0), toI32(buf.length), now, key, out);
  return code === GRANT_OK ? `ok ${out.hostText()}:${out.port}` : `${code} ${out.reason}`;
};

/** A grant payload with `host`, `port` and `expiresAt` written as JSON text. */
const payload = (host: string, port: string, expiresAt: string): string =>
  `{"host":${host},"port":${port},"expiresAt":${expiresAt},"nonce":"testnonce"}`;

/** Every grant check. */
export const grantChecks = (t: Suite): void => {
  const v = new GrantVerifier();
  const key: Secret<u8[]> = secret(bytesOf(SECRET));
  const out = new RelayGrant();
  t.eqStr("accepts a token signed by the TypeScript", verdict(v, key, TOKEN, NOW, out), "ok 127.0.0.1:8788");
  t.eqI64("and keeps its expiry", out.expiresAt, n64(4102444800000));

  const other: Secret<u8[]> = secret(bytesOf("not-the-secret"));
  t.eqStr("refuses a token signed with another secret", verdict(v, other, TOKEN, NOW, out), `${CLOSE_TOKEN_INVALID} bad signature`);

  // The whole point: rewriting the upstream host must invalidate the MAC.
  const forgedPayload: string = base64urlEncode(bytesOf(payload('"203.0.113.9"', "53", "4102444800000")));
  const mac: string = TOKEN_MAC;
  t.eqStr(
    "refuses a token whose payload was edited after signing",
    verdict(v, key, `v1.${forgedPayload}.${mac}`, NOW, out),
    `${CLOSE_TOKEN_INVALID} bad signature`
  );

  t.eqStr("refuses an expired token even though it is correctly signed", verdict(v, key, TOKEN, n64(4102444800001), out), `${CLOSE_TOKEN_EXPIRED} token expired`);
  t.eqStr("an expiry of exactly now is expired", verdict(v, key, TOKEN, n64(4102444800000), out), `${CLOSE_TOKEN_EXPIRED} token expired`);
  t.eqStr("a millisecond before it is not", verdict(v, key, TOKEN, n64(4102444799999), out), "ok 127.0.0.1:8788");

  // Malformed tokens, refused without panicking: grant.rs's list.
  const malformed: string[] = ["", "v1", "v1.only-two", "v2.eyJ9.abc", "v1.!!!.!!!", "v1.eyJ9.abc.extra"];
  const reasons: string[] = [];
  for (const bad of malformed) {
    reasons.push(verdict(v, key, bad, NOW, out));
  }
  t.eqStr(
    "malformed tokens: empty, one part, two parts, another version, a signature that is not base64url, four parts",
    reasons.join(" | "),
    `${CLOSE_TOKEN_INVALID} malformed token | ${CLOSE_TOKEN_INVALID} malformed token | ${CLOSE_TOKEN_INVALID} malformed token | ${CLOSE_TOKEN_INVALID} malformed token | ${CLOSE_TOKEN_INVALID} malformed token | ${CLOSE_TOKEN_INVALID} malformed token`
  );
  // Forty-two characters end on bits that spell no byte, which base64url refuses, as the base64 crate does.
  t.eqStr("a signature one character short of the real one", verdict(v, key, TOKEN.substring(0, TOKEN.length - 1), NOW, out), `${CLOSE_TOKEN_INVALID} malformed token`);
  t.eqStr("a signature of 31 bytes", verdict(v, key, `${TOKEN.substring(0, TOKEN.length - TOKEN_MAC.length - 1)}.${base64urlEncode(new Array<u8>(31))}`, NOW, out), `${CLOSE_TOKEN_INVALID} bad signature`);
  t.eqStr("a version of one letter more", verdict(v, key, `v11${TOKEN.substring(2, TOKEN.length)}`, NOW, out), `${CLOSE_TOKEN_INVALID} malformed token`);
  t.eqStr("a capital V", verdict(v, key, `V1${TOKEN.substring(2, TOKEN.length)}`, NOW, out), `${CLOSE_TOKEN_INVALID} malformed token`);

  // Signed, so the payload is read: everything a payload can get wrong.
  const invalid: string = `${CLOSE_TOKEN_INVALID} malformed payload`;
  t.eqStr("a payload that is not base64url", verdict(v, key, signRaw("!!!"), NOW, out), invalid);
  t.eqStr("a payload that is not JSON", verdict(v, key, signGrant("not json", SECRET), NOW, out), invalid);
  t.eqStr("an empty payload", verdict(v, key, signRaw(""), NOW, out), invalid);
  t.eqStr("an array", verdict(v, key, signGrant("[1,2]", SECRET), NOW, out), invalid);
  t.eqStr("an empty object", verdict(v, key, signGrant("{}", SECRET), NOW, out), invalid);
  t.eqStr("a host that is a number", verdict(v, key, signGrant(payload("1", "8788", "4102444800000"), SECRET), NOW, out), invalid);
  t.eqStr("a port that is a string", verdict(v, key, signGrant(payload('"127.0.0.1"', '"8788"', "4102444800000"), SECRET), NOW, out), invalid);
  t.eqStr("an expiry that is a string", verdict(v, key, signGrant(payload('"127.0.0.1"', "8788", '"soon"'), SECRET), NOW, out), invalid);
  t.eqStr("a port past u16", verdict(v, key, signGrant(payload('"127.0.0.1"', "65536", "4102444800000"), SECRET), NOW, out), invalid);
  t.eqStr("a negative port", verdict(v, key, signGrant(payload('"127.0.0.1"', "-1", "4102444800000"), SECRET), NOW, out), invalid);
  t.eqStr("port 65535 is in range", verdict(v, key, signGrant(payload('"127.0.0.1"', "65535", "4102444800000"), SECRET), NOW, out), "ok 127.0.0.1:65535");
  t.eqStr("an expiry with a fraction", verdict(v, key, signGrant(payload('"127.0.0.1"', "8788", "4102444800000.5"), SECRET), NOW, out), invalid);
  t.eqStr("an expiry with an exponent", verdict(v, key, signGrant(payload('"127.0.0.1"', "8788", "4.1e12"), SECRET), NOW, out), invalid);
  t.eqStr("a port that is true", verdict(v, key, signGrant(payload('"127.0.0.1"', "true", "4102444800000"), SECRET), NOW, out), invalid);
  t.eqStr("a host that is null", verdict(v, key, signGrant(payload("null", "8788", "4102444800000"), SECRET), NOW, out), invalid);
  t.eqStr("no host at all", verdict(v, key, signGrant('{"port":8788,"expiresAt":4102444800000}', SECRET), NOW, out), invalid);
  t.eqStr("no nonce is fine, as in grant.rs", verdict(v, key, signGrant('{"host":"10.0.0.1","port":1,"expiresAt":4102444800000}', SECRET), NOW, out), "ok 10.0.0.1:1");
  t.eqStr("a host twice", verdict(v, key, signGrant('{"host":"10.0.0.1","host":"10.0.0.2","port":1,"expiresAt":4102444800000}', SECRET), NOW, out), invalid);
  t.eqStr("a second value after the object", verdict(v, key, signGrant(`${payload('"127.0.0.1"', "8788", "4102444800000")}{}`, SECRET), NOW, out), invalid);
  t.eqStr("an escaped host is unescaped", verdict(v, key, signGrant(payload('"127.0.0.\\u0031"', "8788", "4102444800000"), SECRET), NOW, out), "ok 127.0.0.1:8788");
  t.eqStr("whitespace between the tokens", verdict(v, key, signGrant(' { "host" : "::1" ,\n"port":\t9 , "expiresAt" : 4102444800000 } ', SECRET), NOW, out), "ok ::1:9");
  t.eqStr("an object inside the grant is read through", verdict(v, key, signGrant('{"host":"10.0.0.1","port":1,"expiresAt":4102444800000,"meta":{"a":{"b":"c"},"d":1}}', SECRET), NOW, out), "ok 10.0.0.1:1");
  const longHost: string[] = [];
  for (let k: i32 = 0; k < 254; k++) {
    longHost.push("a");
  }
  t.eqStr("a host of 254 bytes", verdict(v, key, signGrant(payload(`"${longHost.join("")}"`, "8788", "4102444800000"), SECRET), NOW, out), invalid);
  longHost.pop();
  t.ok("one of 253 is a grant", verdict(v, key, signGrant(payload(`"${longHost.join("")}"`, "8788", "4102444800000"), SECRET), NOW, out).startsWith("ok "));

  // A secret past one SHA-256 block is hashed first (RFC 2104 §2); one of exactly a block is not.
  const longSecret: string[] = [];
  for (let k: i32 = 0; k < 100; k++) {
    longSecret.push(String.fromCharCode(n32(0x61) + (k % n32(26))));
  }
  const long: Secret<u8[]> = secret(bytesOf(longSecret.join("")));
  t.eqStr("a secret of 100 bytes", verdict(v, long, signGrant(payload('"10.0.0.1"', "1", "4102444800000"), longSecret.join("")), NOW, out), "ok 10.0.0.1:1");
  wipe(long);
  const block: Secret<u8[]> = secret(bytesOf(longSecret.join("").substring(0, 64)));
  t.eqStr("a secret of 64 bytes", verdict(v, block, signGrant(payload('"10.0.0.1"', "1", "4102444800000"), longSecret.join("").substring(0, 64)), NOW, out), "ok 10.0.0.1:1");
  t.eqStr("and it is not the 100-byte one's", verdict(v, block, signGrant(payload('"10.0.0.1"', "1", "4102444800000"), longSecret.join("")), NOW, out), `${CLOSE_TOKEN_INVALID} bad signature`);
  wipe(block);

  // The verifier's own HMAC-SHA-256 against RFC 4231 itself, not only against `nish/crypto/hmac`.
  t.eqStr("RFC 4231 case 2: a key shorter than the output", toHex(grantHmac(bytesOf("Jefe"), bytesOf("what do ya want for nothing?"))), "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843");
  const case6: u8[] = new Array<u8>(131);
  case6.fill(toU8(0xaa));
  t.eqStr("RFC 4231 case 6: a key of 131 bytes, hashed first", toHex(grantHmac(case6, bytesOf("Test Using Larger Than Block-Size Key - Hash Key First"))), "60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54");

  jsonChecks(t);
  arenaCheck(t, v, key, out);
  wipe(key);
  wipe(other);
};

/** What `RelayJson.read` answers for `text`. */
const reads = (j: RelayJson, text: string): boolean => {
  const b: u8[] = bytesOf(text);
  return j.read(b, n32(0), toI32(b.length));
};

/** The reader on its own: every value it takes, and every one it refuses. */
const jsonChecks = (t: Suite): void => {
  const j = new RelayJson();
  t.ok("an object of a string, an integer and an object", reads(j, '{"s":"x","i":-12,"o":{}}') && j.count === n32(3));
  t.ok("their kinds", j.kind[0] === JSON_STRING && j.kind[1] === JSON_INTEGER && j.kind[2] === JSON_OBJECT && j.integer[1] === n64(-12));
  t.ok("i64's largest integer", reads(j, '{"i":9223372036854775807}') && j.integer[0] === (n64(0x7fffffff) << n64(32)) + n64(0xffffffff));
  t.ok("one more is refused", !reads(j, '{"i":9223372036854775808}'));
  t.ok("every escape", reads(j, '{"s":"\\"\\\\\\/\\b\\f\\n\\r\\t\\u00e9\\ud83d\\ude00"}') && j.valueLength[0] === n32(14));
  t.ok("raw UTF-8 in a string", reads(j, '{"s":"café"}') && j.valueLength[0] === n32(5));
  const refused: string[] = [
    '{"s":"\\ud83d"}',
    '{"s":"\\ude00"}',
    '{"s":"\\ud83dx"}',
    '{"s":"\\u12"}',
    '{"s":"\\x"}',
    '{"s":"a\tb"}',
    '{"s":"open',
    '{"i":01}',
    '{"i":-}',
    '{"i":+1}',
    '{"b":false}',
    '{"a":[]}',
    '{"o":{"o":{"o":{"o":{}}}}}',
    '{"o":{"a":1,}}',
    '{"o":{"a" 1}}',
    '{"a":1,}',
    '{"a":1 "b":2}',
    '{a:1}',
    '"top"',
    "",
    "{",
  ];
  let count: i32 = 0;
  const missed: string[] = [];
  for (const text of refused) {
    if (!reads(j, text)) {
      count++;
    } else {
      missed.push(text);
    }
  }
  t.eqStr(
    "refused: lone surrogates, a short or unknown escape, a raw control character, an open string, a leading zero, a bare sign, a plus, a boolean, an array, five levels, trailing commas, a missing colon or comma, a bare key, a top-level string, nothing, an open object",
    missed.join(" "),
    ""
  );
  t.ok("four levels are read", reads(j, '{"o":{"o":{"o":{"x":1}}}}') && reads(j, '{"o":{"o":{"o":{}}}}'));
  const invalidUtf8: u8[] = bytesOf('{"s":"..."}');
  invalidUtf8[6] = toU8(0xff);
  t.ok("a byte that is not UTF-8", !j.read(invalidUtf8, n32(0), toI32(invalidUtf8.length)));
  const members: string[] = [];
  for (let k: i32 = 0; k < 17; k++) {
    members.push(`"k${k}":${k}`);
  }
  t.ok("seventeen members are refused", !reads(j, `{${members.join(",")}}`));
  members.pop();
  t.ok("sixteen are read", reads(j, `{${members.join(",")}}`) && j.find("k15") === n32(15));
  const long: u8[] = new Array<u8>(RELAY_JSON_LENGTH + 1);
  long.fill(toU8(0x20));
  long[0] = toU8(0x7b);
  long[RELAY_JSON_LENGTH - 1] = toU8(0x7d);
  t.ok("a document of 1,024 bytes is read", j.read(long, n32(0), RELAY_JSON_LENGTH));
  t.ok("one of 1,025 is refused", !j.read(long, n32(0), toI32(long.length)));
};

/**
 * What one call keeps in the arena, counted in a chunk of its own: a
 * 70,000-byte filler takes the rest of the current chunk, so the call starts
 * a new one at 0 (`net_quic_stream`'s `NqMeter`, exact under 64 KiB).
 */
const keptBy = (v: GrantVerifier, key: Secret<u8[]>, token: u8[], out: RelayGrant): i64 => {
  const filler: u8[] = new Array<u8>(70000);
  const before: i64 = Arena.used();
  v.verify(token, n32(0), toI32(token.length), NOW, key, out);
  const after: i64 = Arena.used();
  return after !== before && toI32(filler.length) > 0 ? after : n64(0);
};

/** Verifying a grant after warm-up keeps nothing in the arena, accepted or refused at every stage. */
const arenaCheck = (t: Suite, v: GrantVerifier, key: Secret<u8[]>, out: RelayGrant): void => {
  const short: string = `${TOKEN.substring(0, TOKEN.length - TOKEN_MAC.length - 1)}.${base64urlEncode(new Array<u8>(31))}`;
  const tokens: u8[][] = [
    bytesOf(TOKEN),
    bytesOf(signGrant("[1]", SECRET)),
    bytesOf("v1.!!!.!!!"),
    bytesOf(short),
    bytesOf(signGrant(payload('"h"', "1", "1"), SECRET)),
  ];
  let kept: i64 = 0;
  const each: string[] = [];
  for (const b of tokens) {
    keptBy(v, key, b, out);
    const k: i64 = keptBy(v, key, b, out);
    each.push(`${k}`);
    kept = kept + k;
  }
  t.eqStr("a grant verified, refused as bad JSON, as malformed, as a bad signature and as expired keeps no arena memory", each.join(" "), "0 0 0 0 0");
};
