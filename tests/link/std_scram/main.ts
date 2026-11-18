// `nish/crypto/scram` against RFC 7677 §3's SCRAM-SHA-256 exchange: the
// ClientProof and ServerSignature are the base64 `p=` and `v=` the exchange
// prints, decoded; SaltedPassword, which it does not print, was checked
// against Python's `hashlib.pbkdf2_hmac`. The null checks pin that a count
// below 1 answers an error and never panics. `tests/wipes/crypto.js` reads
// this program's IR for the module's wipes.
import { Suite } from "nish/testing";
import { scramSha256ClientProof, scramSha256SaltedPassword, scramSha256ServerSignature } from "nish/crypto/scram";
import { Secret, expose, secret, wipe } from "nish:secret";

const HEX_DIGITS: string = "0123456789abcdef";

/** `bytes` as lowercase hex, two digits a byte. */
const hexOf = (bytes: u8[]): string => {
  const parts: string[] = [];
  for (const b of bytes) {
    const v: i32 = toI32(b);
    parts.push(HEX_DIGITS.substring(v >> 4, (v >> 4) + 1));
    parts.push(HEX_DIGITS.substring(v & 15, (v & 15) + 1));
  }
  return parts.join("");
};

/** The bytes of an ASCII string. */
const bytesOf = (text: string): u8[] => {
  const out: u8[] = [];
  const n: i32 = toI32(text.length);
  for (let i: i32 = 0; i < n; i += 1) {
    out.push(toU8(text.charCodeAt(i)));
  }
  return out;
};

/** The exchange's salt, `s=W22ZaJ0SNY7soEsUEjb6gQ==` decoded. */
const exchangeSalt = (): u8[] => [
  0x5b, 0x6d, 0x99, 0x68, 0x9d, 0x12, 0x35, 0x8e, 0xec, 0xa0, 0x4b, 0x14, 0x12, 0x36, 0xfa, 0x81,
];

/** The exchange's AuthMessage, as RFC 5802 §3 joins its three messages. */
const AUTH_MESSAGE: string =
  "n=user,r=rOprNGfwEbeRWgbNEkqO,r=rOprNGfwEbeRWgbNEkqO%hvYDpWUa2RaTCAfuxFIlj)hNlF$k0,s=W22ZaJ0SNY7soEsUEjb6gQ==,i=4096,c=biws,r=rOprNGfwEbeRWgbNEkqO%hvYDpWUa2RaTCAfuxFIlj)hNlF$k0";

/** SaltedPassword for "pencil" under the exchange's salt, in hex, or "null". */
const salted = (iterations: i32): string => {
  const password: Secret<u8[]> = secret(bytesOf("pencil"));
  const s: Secret<u8[]> | null = scramSha256SaltedPassword(password, exchangeSalt(), iterations);
  wipe(password);
  if (s === null) {
    return "null";
  }
  const hex: string = expose(s, hexOf);
  wipe(s);
  return hex;
};

/** The proof and the signature for the exchange, in hex, a space between. */
const proofAndSignature = (): string => {
  const password: Secret<u8[]> = secret(bytesOf("pencil"));
  const s: Secret<u8[]> | null = scramSha256SaltedPassword(password, exchangeSalt(), toI32(4096));
  wipe(password);
  if (s === null) {
    return "null";
  }
  const authMessage: u8[] = bytesOf(AUTH_MESSAGE);
  const proof: u8[] = scramSha256ClientProof(s, authMessage);
  const signature: u8[] = scramSha256ServerSignature(s, authMessage);
  wipe(s);
  return `${hexOf(proof)} ${hexOf(signature)}`;
};

export const main = (): i32 => {
  const t = new Suite("scram");
  t.eqStr(
    "RFC 7677 §3: SaltedPassword for 'pencil', i=4096",
    salted(toI32(4096)),
    "c4a49510323ab4f952cac1fa99441939e78ea74d6be81ddf7096e87513dc615d"
  );
  t.eqStr(
    "RFC 7677 §3: the p= and v= of the exchange",
    proofAndSignature(),
    "747cdb65aa56224e2352137e52d7bdcad6a0f738df30782caa69a2cfb0277554 eabae24d1062db75a9451ff0b6ea7e98c8546549ff741e672d3251b2397de46e"
  );
  t.eqStr("0 iterations answers null", salted(toI32(0)), "null");
  t.eqStr("-1 iterations answers null", salted(toI32(-1)), "null");
  return t.done();
};
