// `rsaParsePublicKey` answers `null` for DER whose lengths or tags are wrong,
// rather than reading past its array or panicking: a length that runs past
// the buffer, at the SEQUENCE and at an INTEGER, a wrong tag at either, a
// truncated key and a length form DER does not allow. The well-formed key
// they are cut from parses, so each `null` is the refusal it names.
import { RsaPublicKey, rsaParsePublicKey } from "nish/crypto/rsa";

/** A PKCS#1 RSAPublicKey: a 1024-bit odd modulus and the exponent 65537. */
const goodKey = (): u8[] => {
  const der: u8[] = [0x30, 0x81, 0x89, 0x02, 0x81, 0x81, 0x00];
  for (let i: i32 = 0; i < 128; i++) {
    der.push(toU8(i === 0 ? 0xc5 : i === 127 ? 0x0b : 0x5a));
  }
  der.push(toU8(0x02));
  der.push(toU8(0x03));
  der.push(toU8(0x01));
  der.push(toU8(0x00));
  der.push(toU8(0x01));
  return der;
};

/** `der` with the byte at `at` set to `value`. */
const withByte = (der: u8[], at: i32, value: i32): u8[] => {
  const out: u8[] = der.map((b: u8): u8 => b);
  if (at >= 0 && at < out.length) {
    out[at] = toU8(value);
  }
  return out;
};

const report = (name: string, der: u8[]): void => {
  const key: RsaPublicKey | null = rsaParsePublicKey(der);
  console.log(`${name}: ${key === null ? "null" : "key"}`);
};

export const main = (): i32 => {
  const good: u8[] = goodKey();
  report("well-formed", good);
  report("SEQUENCE length one past the buffer", withByte(good, 2, 0x8a));
  report("modulus length 255, past the buffer", withByte(good, 5, 0xff));
  report("modulus long-form length 0xffff", withByte(withByte(withByte(good, 4, 0x82), 5, 0xff), 6, 0xff));
  report("SEQUENCE tag 0x31", withByte(good, 0, 0x31));
  report("modulus tag 0x03", withByte(good, 3, 0x03));
  report("exponent tag 0x04", withByte(good, 135, 0x04));
  report("four-byte length form", withByte(good, 1, 0x84));
  const short: u8[] = good.filter((_b: u8, k: number): boolean => toI32(k) < 139);
  report("last byte cut", short);
  return 0;
};
