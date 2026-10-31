// `nish/crypto/jwt` and `nish/crypto/hmac`'s `HmacKey`, checked against
// published answers and against known-bad tokens.
//
// The RFC tokens are copied from RFC 7515 Appendix A.1 (HS256), A.2 (RS256)
// and A.3 (ES256), and RFC 8037 Appendix A.4 (EdDSA), keys included. The
// `SIGN_*` tokens are what `jwtSign` must produce, and the `BAD_*` and `OK_*`
// tokens are each MACed under the A.1 key, so that a refusal is the header's
// or the claims', never the signature's; all of those were computed with
// `node:crypto` (`createHmac`, and `sign` for Ed25519) over the header and
// claims their name describes.
import { Suite } from "nish/testing";
import { base64urlDecode, base64urlEncode } from "nish/crypto/base64url";
import { Sha256 } from "nish/crypto/sha256";
import { HMAC_SHA256, HMAC_SHA384, HMAC_SHA512, HmacKey, hmacKeyedInto, hmacKeyedVerify, hmacSha256, hmacSha384, hmacSha512 } from "nish/crypto/hmac";
import {
  JWT_ALG_ES256,
  JWT_ALG_EDDSA,
  JWT_ALG_ES384,
  JWT_ALG_HS256,
  JWT_ALG_HS384,
  JWT_ALG_HS512,
  JWT_ALG_RS256,
  JWT_ALG_RS384,
  JWT_ERR_ALG,
  JWT_ERR_AUDIENCE,
  JWT_ERR_CLAIMS,
  JWT_ERR_EXPIRED,
  JWT_ERR_FORMAT,
  JWT_ERR_HEADER,
  JWT_ERR_IAT,
  JWT_ERR_ISSUER,
  JWT_ERR_NOT_YET,
  JWT_ERR_SIGNATURE,
  JWT_ERR_SIZE,
  JWT_ERR_SUBJECT,
  JWT_ERR_TYPE,
  JWT_MAX_TOKEN,
  JWT_OK,
  JwtKey,
  JwtVerifier,
  jwtAlgName,
  jwtEcKey,
  jwtEd25519Key,
  jwtEd25519SigningKey,
  jwtEs256SigningKey,
  jwtHmacKey,
  jwtRsaKey,
  jwtRsaKeyParts,
  jwtSign,
  jwtSignKid,
  jwtSignString,
} from "nish/crypto/jwt";
import { Secret, secret, wipe } from "nish:secret";

/** The bytes a base64url literal spells; every literal here is well formed. */
const b64 = (text: string): u8[] => {
  const d: u8[] | null = base64urlDecode(text);
  return d === null ? [] : d;
};

const bytesOf = (text: string): u8[] => {
  const out: u8[] = [];
  for (let i: i32 = 0; i < toI32(text.length); i++) {
    out.push(toU8(text.charCodeAt(i)));
  }
  return out;
};

const seq = (n: i32): u8[] => {
  const out: u8[] = [];
  for (let i: i32 = 0; i < n; i++) {
    out.push(toU8(i & 255));
  }
  return out;
};

const part = (a: u8[], from: i32, to: i32): u8[] => {
  const out: u8[] = [];
  for (let i: i32 = from; i < to; i++) {
    out.push(a[i]);
  }
  return out;
};

const same = (a: u8[], b: u8[]): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  for (let i: i32 = 0; i < toI32(a.length); i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
};

const codeOf = (code: i32): string => `${code}`;

/** A SHA-256 hasher resumed from an all-zero chaining value after one block: what a wiped HMAC key's pads would give. */
const zeroResumed = (): Sha256 => {
  const h: Sha256 = new Sha256();
  for (let i: i32 = 0; i < toI32(h.state.length); i++) {
    h.state[i] = toU32(0);
  }
  h.total = toI64(64);
  return h;
};

/** The HS256 token over `input` a forger computes from the all-zero chaining values a wiped key holds. */
const zeroPadToken = (input: string): string => {
  const inner: Sha256 = zeroResumed();
  const msg: u8[] = bytesOf(input);
  inner.update(msg, toI32(0), toI32(msg.length));
  const digest: u8[] = inner.digest();
  const outer: Sha256 = zeroResumed();
  outer.update(digest, toI32(0), toI32(digest.length));
  return input + "." + base64urlEncode(outer.digest());
};

/** `token` with the character at `at` replaced by `c`. */
const swapAt = (token: string, at: i32, c: string): string => token.substring(0, at) + c + token.substring(at + 1, toI32(token.length));

// RFC 7515 A.1.
const RFC_HS256_KEY: string = "AyM1SysPpbyDfgZld3umj1qzKObwVMkoqQ-EstJQLr_T-1qS0gZH75aKtMN3Yj0iPS4hcgUuTwjAzZr1Z9CAow";
const RFC_HS256_TOKEN: string =
  "eyJ0eXAiOiJKV1QiLA0KICJhbGciOiJIUzI1NiJ9" +
  ".eyJpc3MiOiJqb2UiLA0KICJleHAiOjEzMDA4MTkzODAsDQogImh0dHA6Ly9leGFtcGxlLmNvbS9pc19yb290Ijp0cnVlfQ" +
  ".dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
// RFC 7515 A.2.
const RFC_RSA_N: string =
  "ofgWCuLjybRlzo0tZWJjNiuSfb4p4fAkd_wWJcyQoTbji9k0l8W26mPddxHmfHQp-Vaw-4qPCJrcS2mJPMEzP1Pt0Bm4d4QlL-yRT-SFd2lZS-pCgNMs" +
  "D1W_YpRPEwOWvG6b32690r2jZ47soMZo9wGzjb_7OMg0LOL-bSf63kpaSHSXndS5z5rexMdbBYUsLA9e-KXBdQOS-UTo7WTBEMa2R2CapHg665xsmtdV" +
  "MTBQY4uDZlxvb3qCo5ZwKh9kG4LT6_I5IhlJH7aGhyxXFvUK-DWNmoudF8NAco9_h9iaGNj8q2ethFkMLs91kzk2PAcDTW9gb54h4FRWyuXpoQ";
const RFC_RS256_TOKEN: string =
  "eyJhbGciOiJSUzI1NiJ9" +
  ".eyJpc3MiOiJqb2UiLA0KICJleHAiOjEzMDA4MTkzODAsDQogImh0dHA6Ly9leGFtcGxlLmNvbS9pc19yb290Ijp0cnVlfQ" +
  ".cC4hiUPoj9Eetdgtv3hF80EGrhuB__dzERat0XF9g2VtQgr9PJbu3XOiZj5RZmh7AAuHIm4Bh-0Qc_lF5YKt_O8W2Fp5jujGbds9uJdbF9CUAr7t1dnZcAcQjbKBYNX4" +
  "BAynRFdiuB--f_nZLgrnbyTyWzO75vRK5h6xBArLIARNPvkSjtQBMHlb1L07Qe7K0GarZRmB_eSN9383LcOLn6_dO--xi12jzDwusC-eOkHWEsqtFZESc6BfI7noOPqv" +
  "hJ1phCnvWh6IeYI2w9QOYEUipUTI8np6LbgGY9Fs98rqVt5AXLIhWkWywlVmtVrBp0igcN_IoypGlUPQGe77Rw";
// RFC 7515 A.3.
const RFC_EC_X: string = "f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU";
const RFC_EC_Y: string = "x_FEzRu9m36HLN_tue659LNpXW6pCyStikYjKIWI5a0";
const RFC_EC_D: string = "jpsQnnGQmL-YBIffH1136cspYG6-0iY7X1fCE9-E9LI";
const RFC_ES256_TOKEN: string =
  "eyJhbGciOiJFUzI1NiJ9" +
  ".eyJpc3MiOiJqb2UiLA0KICJleHAiOjEzMDA4MTkzODAsDQogImh0dHA6Ly9leGFtcGxlLmNvbS9pc19yb290Ijp0cnVlfQ" +
  ".DtEhU3ljbEg8L38VWAfUAqOyKAM6-Xx-F4GawxaepmXFCgfTjDxw5djxLa8ISlSApmWQxfKTUJqPP3-Kg6NU1Q";
// RFC 8037 A.1 and A.4.
const RFC_ED_D: string = "nWGxne_9WmC6hEr0kuwsxERJxWl7MmkZcDusAxyuf2A";
const RFC_ED_X: string = "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo";
const RFC_EDDSA_TOKEN: string =
  "eyJhbGciOiJFZERTQSJ9.RXhhbXBsZSBvZiBFZDI1NTE5IHNpZ25pbmc" +
  ".hgyY0il_MGCjP0JzlnLWG1PPOt7-09PGcvMg3AIbQR6dWbhijcNR4ki4iylGjg5BhVsPt9g7sVvpAr_MuM0KAg";

const SIGN_HS256: string =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhbmEiLCJleHAiOjIwMDAwMDAwMDB9.DHsH3A5UHV5j2Osl5INRMiVSx2x4ZJnzNCzE3HNULKU";
const SIGN_HS256_KID: string =
  "eyJhbGciOiJIUzI1NiIsImtpZCI6ImsxIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhbmEiLCJleHAiOjIwMDAwMDAwMDB9.9T6VQKaPZ5bla_Ffs471XKF0pqryqq7genKbA_nk01Y";
const SIGN_HS384: string =
  "eyJhbGciOiJIUzM4NCIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhbmEiLCJleHAiOjIwMDAwMDAwMDB9.W5Dh0SCC_mkZJtak86oVucowUM-mLAuI87PlvgCdxGgkylF8fOdTEXARfTilub6E";
const SIGN_HS512: string =
  "eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhbmEiLCJleHAiOjIwMDAwMDAwMDB9.Zs24LkMsC6656lwEeAKLOb9DINt1GF1kaSQp_XkRbeJtOttPBz7cO2eROvnnKGBfpjPzrMytb6Jk4-xVKVnwDA";
const SIGN_EDDSA: string =
  "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhbmEiLCJleHAiOjIwMDAwMDAwMDB9.jtmjprz3SMUWN_S2mp_aChJEn-ZPlmFeGyBXxavLmPUSZq-BTgr_TAYlDQeAp-UIziJqsZd7ip9sAcF5gMeiAQ";
const BAD_NONE_HEADER: string =
  "eyJhbGciOiJub25lIn0.eyJleHAiOjIwMDAwMDAwMDB9.kUUrh1c6FsEhpUIvv4hqWFly9ZnRx-GqUQKTXtqVfOI";
const BAD_ALG_RS256: string =
  "eyJhbGciOiJSUzI1NiJ9.eyJleHAiOjIwMDAwMDAwMDB9.pip5FTB1vTJqDCluox6SofjwMBFbTFNtBl_xUvuloXk";
const BAD_ALG_CASE: string =
  "eyJhbGciOiJoczI1NiJ9.eyJleHAiOjIwMDAwMDAwMDB9.u9qy27iqTvpvuyERQOE5O7VQ8pStseU9KnbY-TwqD3k";
const BAD_ALG_MISSING: string =
  "eyJ0eXAiOiJKV1QifQ.eyJleHAiOjIwMDAwMDAwMDB9.CR6A5kj8BPnOsIMfA7VNOzNEiSx8peiJU5yJpiKGpAM";
const BAD_ALG_NUMBER: string =
  "eyJhbGciOjI1Nn0.eyJleHAiOjIwMDAwMDAwMDB9.8cLXAt57yS2l6Br8K3XRujza1rjE84Rqare2uU7zxU4";
const BAD_ALG_TWICE: string =
  "eyJhbGciOiJIUzI1NiIsImFsZyI6IkhTMjU2In0.eyJleHAiOjIwMDAwMDAwMDB9.ZWGNq4EwepMi42Bo56w7KdrNybN7n6nCEjJW-wWyaog";
const BAD_ALG_TWICE_NONE: string =
  "eyJhbGciOiJIUzI1NiIsImFsZyI6Im5vbmUifQ.eyJleHAiOjIwMDAwMDAwMDB9.gCpM1IhRz6vU2GaDOafPAqtTVxIYLJiHAgSdH8aaoWo";
// {"alg":"HS256","\u0061lg":"none"}: the second alg spelled with an escape.
const BAD_ALG_ESCAPED: string =
  "eyJhbGciOiJIUzI1NiIsIlx1MDA2MWxnIjoibm9uZSJ9.eyJleHAiOjIwMDAwMDAwMDB9.AaSZqHehhmaSQAkQDPYqjHFcYI0VufDJtyZwDf1Wc9o";
// {"exp":2000000000,"\u0065xp":1}: the second exp spelled with an escape.
const BAD_EXP_ESCAPED: string =
  "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjIwMDAwMDAwMDAsIlx1MDA2NXhwIjoxfQ.irY_yCNb_-ICZCCOpoJQ7EeTsZmhxJDGy_8BvjDbRmE";
const BAD_CRIT: string =
  "eyJhbGciOiJIUzI1NiIsImNyaXQiOlsiZXhwIl19.eyJleHAiOjIwMDAwMDAwMDB9.Dia-bxt3JTdKaDXA4Xm6ILgoJJjxeBPLrYn7UsqJSic";
const BAD_B64: string =
  "eyJhbGciOiJIUzI1NiIsImI2NCI6ZmFsc2V9.eyJleHAiOjIwMDAwMDAwMDB9.rAdqQqTXRXQXKa0N4oWMln2NMcLEiJZqjGhvNSv99WQ";
const BAD_TYP_NUMBER: string =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6MX0.eyJleHAiOjIwMDAwMDAwMDB9.ExQsEUfhMwmypoqwWt-2eWawWEFCc8NS0Yx5_GZchMc";
const BAD_HEADER_ARRAY: string =
  "WyJIUzI1NiJd.eyJleHAiOjIwMDAwMDAwMDB9.u9VEenHpVaCJOd7OFaJxWMx4sZjKidQQKTbU3B3PhYg";
const BAD_HEADER_TRAILING: string =
  "eyJhbGciOiJIUzI1NiJ9IHt9.eyJleHAiOjIwMDAwMDAwMDB9.RoTPdAeXIqzUXFZf0KtxiZFjckd45nRCnUWs8DXTAF0";
const OK_PLAIN: string =
  "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjIwMDAwMDAwMDAsImlzcyI6Imh0dHBzOi8vaXNzdWVyLmV4YW1wbGUiLCJhdWQiOlsib3RoZXIiLCJhcGkiXSwic3ViIjoiYW5hIiwibmJmIjoxMDAwLCJpYXQiOjEwMDAsIngiOnsieSI6WzEsMix7InoiOm51bGx9XX19.PKAfWyqmYNUzDY1F7-w_LdLFRub55q9OWKtrhTyfbzU";
const BAD_EXPIRED: string =
  "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjEwMDB9.m24mdw8OoOEzchvNJdwPLQagTb2G8_Wm2q7rww_463o";
const BAD_NBF: string =
  "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjIwMDAwMDAwMDAsIm5iZiI6MTk5OTk5OTAwMH0.Hli2ccq4F5TvWEOKxhF_9TPjvzuRcNXVOKtzqwqrgpY";
const BAD_IAT: string =
  "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjIwMDAwMDAwMDAsImlhdCI6MTk5OTk5OTAwMH0.LdaWih1y_2aBoJItty3FTQ5dHum2PG5Vkh_MFPrMCbA";
const BAD_NO_EXP: string =
  "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhbmEifQ.JB19cJaHki1z_ScDCoayTna7tjOcnVFAc0XHYPi_35k";
const BAD_EXP_TWICE: string =
  "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjIwMDAwMDAwMDAsImV4cCI6MX0.PMJz0F7p2wKnsb2dZpeGxZH43PhIu0IYfrm2hjBmDIw";
const BAD_EXP_STRING: string =
  "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOiIyMDAwMDAwMDAwIn0.r0aU0V0zJ4L1J9GTniTTnWnCzgYzcttNy9xiJsRi6S4";
const BAD_EXP_FRACTION: string =
  "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjIwMDAwMDAwMDAuNX0.UintjCz7xUIJ2dTU_JgV3bUXijErUX1gQaR6tZN5Q-4";
const BAD_ISS: string =
  "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjIwMDAwMDAwMDAsImlzcyI6Imh0dHBzOi8vZXZpbC5leGFtcGxlIn0.AsRRmBUaLfmCKerBsTowEuYU2G73FCgiEVVO3JvF6xs";
const BAD_AUD: string =
  "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjIwMDAwMDAwMDAsImF1ZCI6Im90aGVyIn0.kDdhX5MgZI-aydXuCeErMynRH6_Ehxh_wU-UBT18iGo";
const BAD_AUD_NUMBER: string =
  "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjIwMDAwMDAwMDAsImF1ZCI6WzFdfQ.Mj3acIHuDsG4ynLdJrEcme1SZiNlgOaBrgvzxLOMyeY";
const BAD_SUB: string =
  "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjIwMDAwMDAwMDAsInN1YiI6ImJvYiJ9.7jFFbX2cGv0vAjLqMSJg6zvXNkgyJscG95tZN7VeAyc";
const BAD_PAYLOAD_ARRAY: string =
  "eyJhbGciOiJIUzI1NiJ9.W3siZXhwIjoyMDAwMDAwMDAwfV0.04S0XejhQVPLhKvkCoOYKrmkBKdx5UqRn6Jwwm2buM8";
const BAD_PAYLOAD_TEXT: string =
  "eyJhbGciOiJIUzI1NiJ9.bm90IGpzb24.J9kLxcAAJvD38MniCADm16oGN4rIuPvoqaJykse54zU";
const OK_AUD_STRING: string =
  "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjIwMDAwMDAwMDAsImF1ZCI6ImFwaSJ9.5C5pZnV0dft5R4jrzMUVxg-gaUAsiJPFPe_zFkx3suE";
const OK_EXP_EDGE: string =
  "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE1MDAwMDAwMzF9.JhOmZl0oAEftrRZY60Wfvq4fIir-Z0-4MlNlbf0jl20";
const BAD_NONE_UNSIGNED: string =
  "eyJhbGciOiJub25lIn0.eyJleHAiOjIwMDAwMDAwMDB9.";

const NOW: i64 = 1500000000;
const HUGE: i64 = 1073741824 * 1073741824 * 7;
const RFC_NOW: i64 = 1300819000;

/** A verifier set as the `OK_PLAIN` token expects. */
const configured = (): JwtVerifier => {
  const v = new JwtVerifier(JWT_MAX_TOKEN);
  v.issuer = "https://issuer.example";
  v.audience = "api";
  v.subject = "ana";
  return v;
};

const hmacKeyedChecks = (t: Suite): void => {
  const lengths: i32[] = [0, 1, 55, 56, 63, 64, 65, 111, 112, 127, 128, 129, 300];
  const hashes: i32[] = [HMAC_SHA256, HMAC_SHA384, HMAC_SHA512];
  const keyLengths: i32[] = [0, 20, 64, 129];
  let agree: boolean = true;
  let verifies: boolean = true;
  let refuses: boolean = true;
  for (let h: i32 = 0; h < toI32(hashes.length); h++) {
    for (let k: i32 = 0; k < toI32(keyLengths.length); k++) {
      const raw: u8[] = seq(keyLengths[k]);
      const plain: Secret<u8[]> = secret(seq(keyLengths[k]));
      const key = new HmacKey(hashes[h], plain);
      wipe(plain);
      for (let m: i32 = 0; m < toI32(lengths.length); m++) {
        const data: u8[] = seq(lengths[m] + 3);
        const window: u8[] = part(data, 2, 2 + lengths[m]);
        const want: u8[] =
          hashes[h] === HMAC_SHA256 ? hmacSha256(raw, window) : hashes[h] === HMAC_SHA384 ? hmacSha384(raw, window) : hmacSha512(raw, window);
        const tag: u8[] = new Array<u8>(key.size() + 1);
        hmacKeyedInto(key, data, 2, lengths[m], tag, 1);
        if (!same(part(tag, 1, toI32(tag.length)), want)) {
          agree = false;
        }
        if (!hmacKeyedVerify(key, data, 2, lengths[m], tag, 1)) {
          verifies = false;
        }
        tag[toI32(tag.length) - 1] = toU8(toI32(tag[toI32(tag.length) - 1]) ^ 1);
        if (hmacKeyedVerify(key, data, 2, lengths[m], tag, 1) || hmacKeyedVerify(key, data, 2, lengths[m], tag, 2)) {
          refuses = false;
        }
      }
      key.wipe();
    }
  }
  t.ok("HmacKey: the keyed tag is hmacSha256/384/512's, at every block boundary", agree);
  t.ok("HmacKey: hmacKeyedVerify accepts the tag it made", verifies);
  t.ok("HmacKey: hmacKeyedVerify refuses a flipped bit and a tag window that does not fit", refuses);
};

export const jwtChecks = (): i32 => {
  const t = new Suite("nish/crypto/jwt");
  hmacKeyedChecks(t);

  t.eqStr("jwtAlgName names RFC 7518's algorithms", jwtAlgName(JWT_ALG_HS256) + jwtAlgName(JWT_ALG_RS384) + jwtAlgName(JWT_ALG_ES256) + jwtAlgName(JWT_ALG_EDDSA), "HS256RS384ES256EdDSA");

  const hsSecret: Secret<u8[]> = secret(b64(RFC_HS256_KEY));
  const hsKeyOrNull: JwtKey | null = jwtHmacKey(JWT_ALG_HS256, hsSecret);
  wipe(hsSecret);
  if (hsKeyOrNull === null) {
    t.fail("jwtHmacKey takes RFC 7515 A.1's 64-byte key", "null");
    return t.done();
  }
  const hs: JwtKey = hsKeyOrNull;
  const rsaOrNull: JwtKey | null = jwtRsaKeyParts(JWT_ALG_RS256, b64(RFC_RSA_N), b64("AQAB"));
  const point: u8[] = [toU8(4)];
  const x: u8[] = b64(RFC_EC_X);
  const y: u8[] = b64(RFC_EC_Y);
  for (let i: i32 = 0; i < toI32(x.length); i++) {
    point.push(x[i]);
  }
  for (let i: i32 = 0; i < toI32(y.length); i++) {
    point.push(y[i]);
  }
  const ecOrNull: JwtKey | null = jwtEcKey(JWT_ALG_ES256, point);
  const edOrNull: JwtKey | null = jwtEd25519Key(b64(RFC_ED_X));
  if (rsaOrNull === null || ecOrNull === null || edOrNull === null) {
    t.fail("the RFC 7515 A.2, A.3 and RFC 8037 A.2 keys load", "null");
    return t.done();
  }
  const rsa: JwtKey = rsaOrNull;
  const ec: JwtKey = ecOrNull;
  const ed: JwtKey = edOrNull;

  const v = new JwtVerifier(JWT_MAX_TOKEN);
  t.eqStr("RFC 7515 A.1: HS256 verifies", codeOf(v.verifyString(hs, RFC_HS256_TOKEN, RFC_NOW)), codeOf(JWT_OK));
  t.ok("RFC 7515 A.1: exp is read", v.hasExp && v.exp === toI64(1300819380) && !v.hasNbf && !v.hasIat);
  t.ok("RFC 7515 A.1: the claims are left in the buffer", v.claimsLen > 0 && toI32(v.claims[0]) === 123);
  t.eqStr("RFC 7515 A.1: after exp it has expired", codeOf(v.verifyString(hs, RFC_HS256_TOKEN, toI64(1300819380))), codeOf(JWT_ERR_EXPIRED));
  t.eqStr("RFC 7515 A.2: RS256 verifies", codeOf(v.verifyString(rsa, RFC_RS256_TOKEN, RFC_NOW)), codeOf(JWT_OK));
  t.eqStr("RFC 7515 A.3: ES256 verifies", codeOf(v.verifyString(ec, RFC_ES256_TOKEN, RFC_NOW)), codeOf(JWT_OK));
  t.eqStr(
    "RFC 8037 A.4: EdDSA's signature holds, and its text payload is not claims",
    codeOf(v.verifyString(ed, RFC_EDDSA_TOKEN, RFC_NOW)),
    codeOf(JWT_ERR_CLAIMS)
  );
  t.eqStr("RFC 8037 A.4: a flipped signature byte fails", codeOf(v.verifyString(ed, swapAt(RFC_EDDSA_TOKEN, 60, "A"), RFC_NOW)), codeOf(JWT_ERR_SIGNATURE));
  t.eqStr("RFC 7515 A.2: a flipped signature byte fails", codeOf(v.verifyString(rsa, swapAt(RFC_RS256_TOKEN, 150, "A"), RFC_NOW)), codeOf(JWT_ERR_SIGNATURE));
  t.eqStr("RFC 7515 A.3: a flipped signature byte fails", codeOf(v.verifyString(ec, swapAt(RFC_ES256_TOKEN, 150, "A"), RFC_NOW)), codeOf(JWT_ERR_SIGNATURE));
  t.eqStr("RFC 7515 A.1: a flipped signature byte fails", codeOf(v.verifyString(hs, swapAt(RFC_HS256_TOKEN, 200, "A"), RFC_NOW)), codeOf(JWT_ERR_SIGNATURE));
  t.eqStr("RFC 7515 A.1: a flipped payload byte fails", codeOf(v.verifyString(hs, swapAt(RFC_HS256_TOKEN, 60, "A"), RFC_NOW)), codeOf(JWT_ERR_SIGNATURE));

  // The key decides the algorithm.
  t.eqStr("confusion: an RS256 token under an HS256 key is refused by alg", codeOf(v.verifyString(hs, RFC_RS256_TOKEN, RFC_NOW)), codeOf(JWT_ERR_ALG));
  t.eqStr("confusion: an HS256 token under an RSA key is refused by alg", codeOf(v.verifyString(rsa, RFC_HS256_TOKEN, RFC_NOW)), codeOf(JWT_ERR_ALG));
  t.eqStr("confusion: an ES256 token under an EdDSA key is refused by alg", codeOf(v.verifyString(ed, RFC_ES256_TOKEN, RFC_NOW)), codeOf(JWT_ERR_ALG));
  t.eqStr("none: an unsigned token is refused", codeOf(v.verifyString(hs, BAD_NONE_UNSIGNED, NOW)), codeOf(JWT_ERR_ALG));
  t.eqStr("none: alg none with a valid MAC is refused", codeOf(v.verifyString(hs, BAD_NONE_HEADER, NOW)), codeOf(JWT_ERR_ALG));
  t.eqStr("alg RS256 over an HS256 MAC is refused", codeOf(v.verifyString(hs, BAD_ALG_RS256, NOW)), codeOf(JWT_ERR_ALG));
  t.eqStr("alg is spelled exactly: hs256 is refused", codeOf(v.verifyString(hs, BAD_ALG_CASE, NOW)), codeOf(JWT_ERR_ALG));
  t.eqStr("a header without alg is refused", codeOf(v.verifyString(hs, BAD_ALG_MISSING, NOW)), codeOf(JWT_ERR_ALG));
  t.eqStr("an alg that is not a string is refused", codeOf(v.verifyString(hs, BAD_ALG_NUMBER, NOW)), codeOf(JWT_ERR_ALG));
  t.eqStr("alg twice is refused, even agreeing", codeOf(v.verifyString(hs, BAD_ALG_TWICE, NOW)), codeOf(JWT_ERR_HEADER));
  t.eqStr("alg twice, the second none, is refused", codeOf(v.verifyString(hs, BAD_ALG_TWICE_NONE, NOW)), codeOf(JWT_ERR_HEADER));
  t.eqStr("alg twice, the second spelled with an escape, is refused", codeOf(v.verifyString(hs, BAD_ALG_ESCAPED, NOW)), codeOf(JWT_ERR_HEADER));
  t.eqStr("crit is refused", codeOf(v.verifyString(hs, BAD_CRIT, NOW)), codeOf(JWT_ERR_HEADER));
  t.eqStr("b64 is refused", codeOf(v.verifyString(hs, BAD_B64, NOW)), codeOf(JWT_ERR_HEADER));
  t.eqStr("a typ that is not a string is refused", codeOf(v.verifyString(hs, BAD_TYP_NUMBER, NOW)), codeOf(JWT_ERR_HEADER));
  t.eqStr("a header that is an array is refused", codeOf(v.verifyString(hs, BAD_HEADER_ARRAY, NOW)), codeOf(JWT_ERR_HEADER));
  t.eqStr("a header with trailing JSON is refused", codeOf(v.verifyString(hs, BAD_HEADER_TRAILING, NOW)), codeOf(JWT_ERR_HEADER));

  // Form.
  t.eqStr("two parts are refused", codeOf(v.verifyString(hs, "eyJhbGciOiJIUzI1NiJ9.e30", NOW)), codeOf(JWT_ERR_FORMAT));
  t.eqStr("four parts are refused", codeOf(v.verifyString(hs, OK_AUD_STRING + ".AA", NOW)), codeOf(JWT_ERR_FORMAT));
  t.eqStr("a + in the header is refused", codeOf(v.verifyString(hs, swapAt(OK_AUD_STRING, 3, "+"), NOW)), codeOf(JWT_ERR_FORMAT));
  t.eqStr("a character outside ASCII is refused", codeOf(v.verifyString(hs, swapAt(OK_AUD_STRING, toI32(OK_AUD_STRING.indexOf(".")), "\u012e"), NOW)), codeOf(JWT_ERR_FORMAT));
  t.eqStr("padding is refused", codeOf(v.verifyString(hs, OK_AUD_STRING + "=", NOW)), codeOf(JWT_ERR_FORMAT));
  t.eqStr("a stray bit in the signature's last character is refused", codeOf(v.verifyString(hs, swapAt(RFC_HS256_TOKEN, toI32(RFC_HS256_TOKEN.length) - 1, "l"), RFC_NOW)), codeOf(JWT_ERR_FORMAT));
  t.eqStr("an empty header is refused", codeOf(v.verifyString(hs, "..", NOW)), codeOf(JWT_ERR_FORMAT));
  t.eqStr("a short signature is refused", codeOf(v.verifyString(hs, RFC_HS256_TOKEN.substring(0, toI32(RFC_HS256_TOKEN.length) - 3), RFC_NOW)), codeOf(JWT_ERR_SIGNATURE));
  t.eqStr("an empty signature is refused", codeOf(v.verifyString(rsa, "eyJhbGciOiJSUzI1NiJ9.e30.", NOW)), codeOf(JWT_ERR_SIGNATURE));
  const small = new JwtVerifier(64);
  t.eqStr("a token over maxToken is refused before decoding", codeOf(small.verifyString(hs, RFC_HS256_TOKEN, RFC_NOW)), codeOf(JWT_ERR_SIZE));
  const raw: u8[] = bytesOf(RFC_HS256_TOKEN);
  t.eqStr("a window outside its array is refused", codeOf(v.verify(hs, raw, toI32(1), toI32(raw.length), RFC_NOW)), codeOf(JWT_ERR_SIZE));
  const framed: u8[] = bytesOf("[" + RFC_HS256_TOKEN + "]");
  t.eqStr("verify reads only its window", codeOf(v.verify(hs, framed, toI32(1), toI32(raw.length), RFC_NOW)), codeOf(JWT_OK));

  // Claims.
  const c = configured();
  t.eqStr("claims: every registered claim checked and passed", codeOf(c.verifyString(hs, OK_PLAIN, NOW)), codeOf(JWT_OK));
  t.ok("claims: nbf and iat are read", c.hasNbf && c.nbf === toI64(1000) && c.hasIat && c.iat === toI64(1000));
  t.eqStr("claims: expired", codeOf(c.verifyString(hs, BAD_EXPIRED, NOW)), codeOf(JWT_ERR_EXPIRED));
  t.eqStr("claims: not yet valid", codeOf(c.verifyString(hs, BAD_NBF, NOW)), codeOf(JWT_ERR_NOT_YET));
  t.eqStr("claims: issued in the future", codeOf(c.verifyString(hs, BAD_IAT, NOW)), codeOf(JWT_ERR_IAT));
  t.eqStr("claims: no exp", codeOf(v.verifyString(hs, BAD_NO_EXP, NOW)), codeOf(JWT_ERR_CLAIMS));
  t.eqStr("claims: exp twice", codeOf(v.verifyString(hs, BAD_EXP_TWICE, NOW)), codeOf(JWT_ERR_CLAIMS));
  t.eqStr("claims: exp twice, the second spelled with an escape", codeOf(v.verifyString(hs, BAD_EXP_ESCAPED, NOW)), codeOf(JWT_ERR_CLAIMS));
  t.eqStr("claims: exp as a string", codeOf(v.verifyString(hs, BAD_EXP_STRING, NOW)), codeOf(JWT_ERR_CLAIMS));
  t.eqStr("claims: exp with a fraction", codeOf(v.verifyString(hs, BAD_EXP_FRACTION, NOW)), codeOf(JWT_ERR_CLAIMS));
  t.eqStr("claims: the wrong issuer", codeOf(c.verifyString(hs, BAD_ISS, NOW)), codeOf(JWT_ERR_ISSUER));
  t.eqStr("claims: no issuer when one is required", codeOf(c.verifyString(hs, OK_AUD_STRING, NOW)), codeOf(JWT_ERR_ISSUER));
  const audOnly = new JwtVerifier(JWT_MAX_TOKEN);
  audOnly.audience = "api";
  t.eqStr("claims: aud as one string", codeOf(audOnly.verifyString(hs, OK_AUD_STRING, NOW)), codeOf(JWT_OK));
  t.eqStr("claims: the wrong audience", codeOf(audOnly.verifyString(hs, BAD_AUD, NOW)), codeOf(JWT_ERR_AUDIENCE));
  t.eqStr("claims: no audience when one is required", codeOf(audOnly.verifyString(hs, OK_EXP_EDGE, NOW)), codeOf(JWT_ERR_AUDIENCE));
  t.eqStr("claims: an aud the verifier names none for (RFC 7519 4.1.3)", codeOf(v.verifyString(hs, OK_AUD_STRING, NOW)), codeOf(JWT_ERR_AUDIENCE));
  t.eqStr("claims: an aud array holding a number", codeOf(audOnly.verifyString(hs, BAD_AUD_NUMBER, NOW)), codeOf(JWT_ERR_CLAIMS));
  const subOnly = new JwtVerifier(JWT_MAX_TOKEN);
  subOnly.subject = "ana";
  t.eqStr("claims: the wrong subject", codeOf(subOnly.verifyString(hs, BAD_SUB, NOW)), codeOf(JWT_ERR_SUBJECT));
  t.eqStr("claims: a payload that is an array", codeOf(v.verifyString(hs, BAD_PAYLOAD_ARRAY, NOW)), codeOf(JWT_ERR_CLAIMS));
  t.eqStr("claims: a payload that is not JSON", codeOf(v.verifyString(hs, BAD_PAYLOAD_TEXT, NOW)), codeOf(JWT_ERR_CLAIMS));
  t.ok("claims: a refused token leaves claimsLen 0", v.claimsLen === 0);
  const noExp = new JwtVerifier(JWT_MAX_TOKEN);
  noExp.requireExp = false;
  t.eqStr("claims: no exp, with requireExp cleared", codeOf(noExp.verifyString(hs, BAD_NO_EXP, NOW)), codeOf(JWT_OK));

  // Leeway at its edges: exp 1500000031.
  t.eqStr("leeway 0: one second before exp", codeOf(v.verifyString(hs, OK_EXP_EDGE, toI64(1500000030))), codeOf(JWT_OK));
  t.eqStr("leeway 0: at exp", codeOf(v.verifyString(hs, OK_EXP_EDGE, toI64(1500000031))), codeOf(JWT_ERR_EXPIRED));
  v.leeway = toI64(30);
  t.eqStr("leeway 30: 29 seconds after exp", codeOf(v.verifyString(hs, OK_EXP_EDGE, toI64(1500000060))), codeOf(JWT_OK));
  t.eqStr("leeway 30: 30 seconds after exp", codeOf(v.verifyString(hs, OK_EXP_EDGE, toI64(1500000061))), codeOf(JWT_ERR_EXPIRED));
  const lv = new JwtVerifier(JWT_MAX_TOKEN);
  lv.leeway = toI64(1000);
  t.eqStr("leeway 1000: nbf 1000 seconds ahead", codeOf(lv.verifyString(hs, BAD_NBF, toI64(1999998000))), codeOf(JWT_OK));
  t.eqStr("leeway 1000: nbf 1001 seconds ahead", codeOf(lv.verifyString(hs, BAD_NBF, toI64(1999997999))), codeOf(JWT_ERR_NOT_YET));
  v.leeway = toI64(-5);
  t.eqStr("a negative leeway is read as 0", codeOf(v.verifyString(hs, OK_EXP_EDGE, toI64(1500000031))), codeOf(JWT_ERR_EXPIRED));
  v.leeway = HUGE;
  t.eqStr("a huge leeway is held, and now - leeway cannot overflow", codeOf(v.verifyString(hs, OK_EXP_EDGE, -HUGE)), codeOf(JWT_OK));
  v.leeway = toI64(0);

  // typ.
  const typed = new JwtVerifier(JWT_MAX_TOKEN);
  typed.typ = "JWT";
  t.eqStr("typ: the required typ", codeOf(typed.verifyString(hs, RFC_HS256_TOKEN, RFC_NOW)), codeOf(JWT_OK));
  t.eqStr("typ: no typ when one is required", codeOf(typed.verifyString(hs, OK_EXP_EDGE, NOW)), codeOf(JWT_ERR_TYPE));

  // Signing.
  t.eqStr("jwtSignString: HS256", jwtSignString(hs, "{\"sub\":\"ana\",\"exp\":2000000000}") ?? "null", SIGN_HS256);
  t.ok("jwtSignString: claims outside ASCII are refused", jwtSignString(hs, "{\"sub\":\"jos\u00e9\"}") === null);
  t.eqStr("jwtSignKid: HS256 with a kid", jwtSignKid(hs, "k1", bytesOf("{\"sub\":\"ana\",\"exp\":2000000000}")) ?? "null", SIGN_HS256_KID);
  const kidOut: u8[] = new Array<u8>(8);
  const kidLen: i32 = v.peekKid(bytesOf(SIGN_HS256_KID), toI32(0), toI32(SIGN_HS256_KID.length), kidOut);
  t.eqStr("peekKid reads the kid", kidLen === 2 ? String.fromBytes(kidOut, 0, 2) : "none", "k1");
  t.ok("peekKid: no kid answers -1", v.peekKid(bytesOf(SIGN_HS256), toI32(0), toI32(SIGN_HS256.length), kidOut) === -1);
  const s384: Secret<u8[]> = secret(seq(48));
  const s512: Secret<u8[]> = secret(seq(64));
  const hs384: JwtKey | null = jwtHmacKey(JWT_ALG_HS384, s384);
  const hs512: JwtKey | null = jwtHmacKey(JWT_ALG_HS512, s512);
  wipe(s384);
  wipe(s512);
  t.eqStr("jwtSignString: HS384", hs384 === null ? "null" : jwtSignString(hs384, "{\"sub\":\"ana\",\"exp\":2000000000}") ?? "null", SIGN_HS384);
  t.eqStr("jwtSignString: HS512", hs512 === null ? "null" : jwtSignString(hs512, "{\"sub\":\"ana\",\"exp\":2000000000}") ?? "null", SIGN_HS512);
  t.eqStr("HS512 verifies its own token", hs512 === null ? "null" : codeOf(v.verifyString(hs512, SIGN_HS512, NOW)), codeOf(JWT_OK));
  const seed: Secret<u8[]> = secret(b64(RFC_ED_D));
  const edSigner: JwtKey | null = jwtEd25519SigningKey(seed);
  wipe(seed);
  t.eqStr("jwtSignString: EdDSA under RFC 8037 A.1's key", edSigner === null ? "null" : jwtSignString(edSigner, "{\"sub\":\"ana\",\"exp\":2000000000}") ?? "null", SIGN_EDDSA);
  t.eqStr("EdDSA: the verify-only key takes the signed token", codeOf(v.verifyString(ed, SIGN_EDDSA, NOW)), codeOf(JWT_OK));
  const d: Secret<u8[]> = secret(b64(RFC_EC_D));
  const ecSigner: JwtKey | null = jwtEs256SigningKey(d);
  wipe(d);
  const esToken: string | null = ecSigner === null ? null : jwtSignString(ecSigner, "{\"sub\":\"ana\",\"exp\":2000000000}");
  t.eqStr("ES256: RFC 7515 A.3's key signs, and its public key verifies", esToken === null ? "null" : codeOf(v.verifyString(ec, esToken, NOW)), codeOf(JWT_OK));
  t.ok("jwtSign: an RS key cannot sign", jwtSign(rsa, bytesOf("{}")) === null);
  t.ok("jwtSign: a verify-only EdDSA key cannot sign", jwtSign(ed, bytesOf("{}")) === null);
  t.ok("jwtSign: claims that are not one object are refused", jwtSign(hs, bytesOf("{} {}")) === null && jwtSign(hs, bytesOf("[]")) === null);
  t.ok("jwtSignKid: a kid needing an escape is refused", jwtSignKid(hs, "a\"b", bytesOf("{}")) === null && jwtSignKid(hs, "", bytesOf("{}")) === null);

  // Keys.
  const short: Secret<u8[]> = secret(seq(31));
  t.ok("jwtHmacKey: a key shorter than the hash is refused (RFC 7518 3.2)", jwtHmacKey(JWT_ALG_HS256, short) === null);
  wipe(short);
  const k: Secret<u8[]> = secret(seq(64));
  t.ok("jwtHmacKey: an alg that is not HS is refused", jwtHmacKey(JWT_ALG_RS256, k) === null);
  wipe(k);
  t.ok("jwtRsaKeyParts: an alg that is not RS is refused", jwtRsaKeyParts(JWT_ALG_HS256, b64(RFC_RSA_N), b64("AQAB")) === null);
  t.ok("jwtRsaKeyParts: a 1024-bit modulus is refused (RFC 7518 3.3)", jwtRsaKeyParts(JWT_ALG_RS256, part(b64(RFC_RSA_N), 0, 128), b64("AQAB")) === null);
  t.ok("jwtRsaKey: DER that does not parse is refused", jwtRsaKey(JWT_ALG_RS256, [toU8(0x30), toU8(0)]) === null);
  t.ok("jwtEcKey: a P-256 point under ES384 is refused", jwtEcKey(JWT_ALG_ES384, point) === null);
  t.ok("jwtEd25519Key: 31 bytes are refused", jwtEd25519Key(seq(31)) === null);

  // One verifier, many tokens.
  let all: boolean = true;
  for (let i: i32 = 0; i < 200; i++) {
    if (v.verifyString(hs, RFC_HS256_TOKEN, RFC_NOW) !== JWT_OK || v.verifyString(hs, BAD_NONE_HEADER, NOW) !== JWT_ERR_ALG) {
      all = false;
    }
  }
  t.ok("one verifier answers the same over 200 tokens", all);

  hs.wipe();
  t.eqStr("a wiped key verifies nothing", codeOf(v.verifyString(hs, RFC_HS256_TOKEN, RFC_NOW)), codeOf(JWT_ERR_SIGNATURE));
  const forgedInput: string = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhbmEiLCJleHAiOjQxMDI0NDQ4MDB9";
  t.eqStr(
    "a wiped key refuses a token forged from its zeroed pads",
    codeOf(new JwtVerifier(JWT_MAX_TOKEN).verifyString(hs, zeroPadToken(forgedInput), NOW)),
    codeOf(JWT_ERR_SIGNATURE),
  );
  t.ok("a wiped key signs nothing", jwtSignString(hs, "{\"sub\":\"ana\"}") === null);

  // A key built by hand that names RS256 but holds an HMAC key verifies nothing:
  // the check follows the name, so the public key is never an HMAC secret.
  const confusedRaw: u8[] = seq(32);
  const confusedSecret: Secret<u8[]> = secret(seq(32));
  const confusedEmpty: Secret<u8[]> = secret(new Array<u8>(0));
  const confused: JwtKey = new JwtKey(JWT_ALG_RS256, new HmacKey(HMAC_SHA256, confusedSecret), null, [], confusedEmpty, false);
  wipe(confusedSecret);
  wipe(confusedEmpty);
  const confusedInput: string = base64urlEncode(bytesOf("{\"alg\":\"RS256\"}")) + "." + base64urlEncode(bytesOf("{\"exp\":4102444800}"));
  const confusedToken: string = confusedInput + "." + base64urlEncode(hmacSha256(confusedRaw, bytesOf(confusedInput)));
  t.eqStr(
    "a hand-built RS256 key holding an HMAC key refuses an HMAC-signed RS256 token",
    codeOf(new JwtVerifier(JWT_MAX_TOKEN).verifyString(confused, confusedToken, NOW)),
    codeOf(JWT_ERR_SIGNATURE),
  );
  confused.wipe();
  if (edSigner !== null) {
    edSigner.wipe();
    t.ok("a wiped EdDSA key signs nothing", jwtSignString(edSigner, "{\"sub\":\"ana\"}") === null);
    t.eqStr("a wiped EdDSA key verifies nothing", codeOf(v.verifyString(edSigner, SIGN_EDDSA, NOW)), codeOf(JWT_ERR_SIGNATURE));
  }
  if (ecSigner !== null) {
    ecSigner.wipe();
    t.ok("a wiped ES256 key signs nothing", jwtSignString(ecSigner, "{\"sub\":\"ana\"}") === null);
  }
  if (hs384 !== null) {
    hs384.wipe();
  }
  if (hs512 !== null) {
    hs512.wipe();
  }
  return t.done();
};
