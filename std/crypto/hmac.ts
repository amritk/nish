/**
 * `nish/crypto/hmac` — HMAC as RFC 2104 defines it, over SHA-256 and SHA-384.
 *
 *     H(K XOR opad, H(K XOR ipad, text))
 *
 * `K` is the key zero-padded to the hash's block size, or first hashed when it
 * is longer than a block (RFC 2104 §2); `ipad` is the byte 0x36 and `opad` the
 * byte 0x5c, repeated a block long. The key is absorbed into both hashers in
 * the constructor, so a `HmacSha256` is a keyed inner hash waiting for the
 * message and a keyed outer hash waiting for the inner digest.
 *
 *     import { HmacSha256, hmacSha256, hmacSha256Verify } from "nish/crypto/hmac";
 *
 *     const tag: u8[] = hmacSha256(key, message);
 *     const ok: boolean = hmacSha256Verify(key, message, received);
 *
 *     const mac = new HmacSha256(key);
 *     mac.update(record, off, len);
 *     const tag2: u8[] = mac.digest();
 *
 * Like the hashers underneath, a `digest` ends the computation: a later
 * `update` or a second `digest` panics in the hasher it reaches, and so does
 * a window outside its buffer. The only branch on the key is on its length,
 * which HMAC does not keep secret; a received tag is compared with
 * `timingSafeEqual`, never `===`.
 *
 * Written from RFC 2104, not ported from another implementation.
 */
import { SHA256_BLOCK, SHA256_SIZE, Sha256, sha256 } from "nish/crypto/sha256"
import { SHA384_SIZE, SHA512_BLOCK, Sha384, sha384 } from "nish/crypto/sha512"
import { timingSafeEqual } from "nish/crypto/ct"

/** RFC 2104 §2's `ipad`, the byte XORed into the key for the inner hash. */
const HMAC_IPAD: i32 = 0x36

/** RFC 2104 §2's `opad`, the byte XORed into the key for the outer hash. */
const HMAC_OPAD: i32 = 0x5c

/** A typed zero for the offsets below: a bare literal is an `f64` under `--number-mode f64`. */
const HMAC_FROM: i32 = 0

/**
 * `key XOR pad` over a whole block of `blockSize` bytes, with `key` already no
 * longer than a block: the key's bytes XOR `pad`, then `pad` alone where the
 * zero padding of RFC 2104 §2 step (1) would be.
 */
const hmacPadBlock = (key: u8[], blockSize: i32, pad: i32): u8[] => {
  const padByte: u8 = toU8(pad)
  const out: u8[] = new Array<u8>(blockSize)
  const outLength: i32 = toI32(out.length)
  const keyLength: i32 = toI32(key.length)
  // Bounded by both lengths, so both indices are proved in range.
  let i: i32 = 0
  while (i < keyLength && i < outLength) {
    out[i] = key[i] ^ padByte
    i += 1
  }
  while (i < outLength) {
    out[i] = padByte
    i += 1
  }
  return out
}

/**
 * HMAC-SHA-256 in progress (RFC 2104 with RFC 4231's SHA-256): feed the
 * message with `update`, as many windows as it takes, and take the 32-byte
 * tag with `digest`.
 */
export class HmacSha256 {
  /** H(K XOR ipad, …), fed the key block in the constructor and the message after. */
  inner: Sha256
  /** H(K XOR opad, …), fed the key block in the constructor and the inner digest last. */
  outer: Sha256

  /** Keys the computation. A key longer than 64 bytes is replaced by its SHA-256 (RFC 2104 §2). */
  constructor(key: u8[]) {
    const k: u8[] = toI32(key.length) > SHA256_BLOCK ? sha256(key) : key
    this.inner = new Sha256()
    this.inner.update(hmacPadBlock(k, SHA256_BLOCK, HMAC_IPAD), HMAC_FROM, SHA256_BLOCK)
    this.outer = new Sha256()
    this.outer.update(hmacPadBlock(k, SHA256_BLOCK, HMAC_OPAD), HMAC_FROM, SHA256_BLOCK)
  }

  /** Absorbs `data[off .. off + len)`; a window outside `data` panics in `Sha256.update`. */
  update(data: u8[], off: i32, len: i32): void {
    this.inner.update(data, off, len)
  }

  /** The 32-byte tag, in a fresh array. Ends the computation. */
  digest(): u8[] {
    const innerDigest: u8[] = this.inner.digest()
    this.outer.update(innerDigest, HMAC_FROM, SHA256_SIZE)
    return this.outer.digest()
  }
}

/**
 * HMAC-SHA-384 in progress (RFC 2104 with RFC 4231's SHA-384), with
 * `HmacSha256`'s methods. The block is SHA-384's 128 bytes and the tag 48.
 */
export class HmacSha384 {
  /** H(K XOR ipad, …), fed the key block in the constructor and the message after. */
  inner: Sha384
  /** H(K XOR opad, …), fed the key block in the constructor and the inner digest last. */
  outer: Sha384

  /** Keys the computation. A key longer than 128 bytes is replaced by its SHA-384 (RFC 2104 §2). */
  constructor(key: u8[]) {
    const k: u8[] = toI32(key.length) > SHA512_BLOCK ? sha384(key) : key
    this.inner = new Sha384()
    this.inner.update(hmacPadBlock(k, SHA512_BLOCK, HMAC_IPAD), HMAC_FROM, SHA512_BLOCK)
    this.outer = new Sha384()
    this.outer.update(hmacPadBlock(k, SHA512_BLOCK, HMAC_OPAD), HMAC_FROM, SHA512_BLOCK)
  }

  /** Absorbs `data[off .. off + len)`; a window outside `data` panics in `Sha384.update`. */
  update(data: u8[], off: i32, len: i32): void {
    this.inner.update(data, off, len)
  }

  /** The 48-byte tag, in a fresh array. Ends the computation. */
  digest(): u8[] {
    const innerDigest: u8[] = this.inner.digest()
    this.outer.update(innerDigest, HMAC_FROM, SHA384_SIZE)
    return this.outer.digest()
  }
}

/**
 * The HMAC-SHA-256 of all of `data` under `key`, as a fresh 32-byte array.
 *
 * `data` longer than 2^31 - 1 bytes panics, as `sha256` does and for its
 * reason: under `--number-mode f64` the tag would be of a prefix, and a tag
 * that verifies every message sharing that prefix is a forgery. A key that
 * long reaches `sha256` in the constructor and panics there.
 */
export const hmacSha256 = (key: u8[], data: u8[]): u8[] => {
  if (data.length > 2147483647) {
    panic("hmacSha256: a message longer than 2^31 - 1 bytes")
  }
  const mac = new HmacSha256(key)
  mac.update(data, HMAC_FROM, toI32(data.length))
  return mac.digest()
}

/**
 * The HMAC-SHA-384 of all of `data` under `key`, as a fresh 48-byte array.
 * `data` longer than 2^31 - 1 bytes panics, as in `hmacSha256`.
 */
export const hmacSha384 = (key: u8[], data: u8[]): u8[] => {
  if (data.length > 2147483647) {
    panic("hmacSha384: a message longer than 2^31 - 1 bytes")
  }
  const mac = new HmacSha384(key)
  mac.update(data, HMAC_FROM, toI32(data.length))
  return mac.digest()
}

/**
 * Whether `tag` is the HMAC-SHA-256 of `data` under `key`, compared by
 * `timingSafeEqual`. A tag that is not 32 bytes answers `false` without a
 * byte compare, since its length is public; one that is is compared in full,
 * so the time taken does not say how many leading bytes were right.
 */
export const hmacSha256Verify = (key: u8[], data: u8[], tag: u8[]): boolean =>
  timingSafeEqual(hmacSha256(key, data), tag)

/** Whether `tag` is the HMAC-SHA-384 of `data` under `key`, compared as `hmacSha256Verify` does. */
export const hmacSha384Verify = (key: u8[], data: u8[], tag: u8[]): boolean =>
  timingSafeEqual(hmacSha384(key, data), tag)
