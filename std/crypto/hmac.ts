/**
 * `nish/crypto/hmac` — HMAC as RFC 2104 defines it, over SHA-256, SHA-384 and
 * SHA-512.
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
 * **What the key reaches is wiped** (CLAUDE.md, "Security"). The two key
 * blocks are wiped once their hashers have absorbed them, and so is the hash
 * of a key longer than a block and the hasher that made it. `digest` wipes
 * the inner digest and both keyed hashers (chaining value, pending block and
 * message schedule) before it answers, so a finished `HmacSha256` holds
 * nothing of the key. The wipes are `wipe`'s volatile stores, which `-O2`
 * keeps (`tests/run.js`, "crypto_hmac crypto_hkdf: the wipes survive -O2").
 * What no wipe here reaches is the caller's own key array, and an
 * `HmacSha256` that is keyed and then dropped without a `digest` keeps its
 * keyed hashers (docs/security/crypto-k1.md, K1-7).
 *
 * A caller that holds its key as a `Secret<u8[]>` (`nish:secret`) MACs with
 * `hmacSha256Secret`, `hmacSha384Secret` or `hmacSha512Secret`, which read the
 * key only inside `exposeWith`; the tag they answer is public and plain.
 *
 * `HmacSha256Scratch` and `HmacSha384Scratch` are the same computation in
 * hashers the caller allocates once: `begin` keys them again in place and
 * `finishInto` writes the tag into the caller's array, so a loop of them
 * stores nothing of its own and an arena scope around it releases all it
 * allocated (see "Caller-owned scratch" below).
 *
 * Written from RFC 2104, not ported from another implementation.
 */
import { SHA256_BLOCK, SHA256_SIZE, Sha256 } from "nish/crypto/sha256"
import { SHA384_SIZE, SHA512_BLOCK, SHA512_SIZE, Sha384, Sha512 } from "nish/crypto/sha512"
import { timingSafeEqual } from "nish/crypto/ct"
import { Secret, exposeWith, wipe } from "nish:secret"

/** RFC 2104 §2's `ipad`, the byte XORed into the key for the inner hash. */
const HMAC_IPAD: i32 = 0x36

/** RFC 2104 §2's `opad`, the byte XORed into the key for the outer hash. */
const HMAC_OPAD: i32 = 0x5c

/** A typed zero for the offsets below: a bare literal is an `f64` under `--number-mode f64`. */
const HMAC_FROM: i32 = 0

/**
 * `key[off .. off + len) XOR pad` over a whole block, `out`, with the key
 * already no longer than the block: the key's bytes XOR `pad`, then `pad`
 * alone where the zero padding of RFC 2104 §2 step (1) would be.
 */
const hmacPadInto = (out: u8[], key: u8[], off: i32, len: i32, pad: i32): void => {
  const padByte: u8 = toU8(pad)
  const outLength: i32 = toI32(out.length)
  const keyLength: i32 = toI32(key.length)
  // Bounded by both lengths, so both indices are proved in range.
  let i: i32 = 0
  while (i < len && i < outLength && off + i >= 0 && off + i < keyLength) {
    out[i] = key[off + i] ^ padByte
    i += 1
  }
  while (i < outLength) {
    out[i] = padByte
    i += 1
  }
}

/**
 * `key XOR pad` over a whole block of `blockSize` bytes, in a fresh array, with
 * `key` already no longer than a block (`hmacPadInto`).
 */
const hmacPadBlock = (key: u8[], blockSize: i32, pad: i32): u8[] => {
  const out: u8[] = new Array<u8>(blockSize)
  hmacPadInto(out, key, HMAC_FROM, toI32(key.length), pad)
  return out
}

/**
 * Zeroes everything `h` holds of the key and the message it was fed: its hash
 * value, its pending block and its message schedule, with `wipe`'s volatile
 * stores, which no optimiser removes however dead the hasher is about to be.
 * The hasher is left finished, so that feeding it before it is started again
 * panics, as feeding a spent one always has.
 */
const hmacWipeSha256 = (h: Sha256): void => {
  wipe(h.state)
  wipe(h.block)
  wipe(h.schedule)
  h.fill = 0
  h.total = 0
  h.finished = true
}

/** `hmacWipeSha256` for SHA-384. */
const hmacWipeSha384 = (h: Sha384): void => {
  wipe(h.engine.state)
  wipe(h.engine.block)
  wipe(h.engine.schedule)
  h.engine.filled = 0
  h.engine.count = toU64(0)
  h.engine.finished = true
}

/** `hmacWipeSha256` for SHA-512. */
const hmacWipeSha512 = (h: Sha512): void => {
  wipe(h.engine.state)
  wipe(h.engine.block)
  wipe(h.engine.schedule)
  h.engine.filled = 0
  h.engine.count = toU64(0)
  h.engine.finished = true
}

/**
 * Panics on a key longer than 2^31 - 1 bytes, before any `toI32` of its
 * length: under `--number-mode f64` that would saturate, and the key hashed
 * would be a prefix, so two keys sharing it would MAC alike (K1-1).
 */
const hmacCheckKey = (key: u8[]): void => {
  if (key.length > 2147483647) {
    panic("hmac: a key longer than 2^31 - 1 bytes")
  }
}

/**
 * Keys `inner` with `k XOR ipad` and `outer` with `k XOR opad`, `k` no longer
 * than SHA-256's block, and wipes both key blocks once absorbed.
 */
const hmacKeySha256 = (inner: Sha256, outer: Sha256, k: u8[]): void => {
  const ipad: u8[] = hmacPadBlock(k, SHA256_BLOCK, HMAC_IPAD)
  inner.update(ipad, HMAC_FROM, SHA256_BLOCK)
  wipe(ipad)
  const opad: u8[] = hmacPadBlock(k, SHA256_BLOCK, HMAC_OPAD)
  outer.update(opad, HMAC_FROM, SHA256_BLOCK)
  wipe(opad)
}

/** `hmacKeySha256` for SHA-384's 128-byte block. */
const hmacKeySha384 = (inner: Sha384, outer: Sha384, k: u8[]): void => {
  const ipad: u8[] = hmacPadBlock(k, SHA512_BLOCK, HMAC_IPAD)
  inner.update(ipad, HMAC_FROM, SHA512_BLOCK)
  wipe(ipad)
  const opad: u8[] = hmacPadBlock(k, SHA512_BLOCK, HMAC_OPAD)
  outer.update(opad, HMAC_FROM, SHA512_BLOCK)
  wipe(opad)
}

/** `hmacKeySha256` for SHA-512's 128-byte block. */
const hmacKeySha512 = (inner: Sha512, outer: Sha512, k: u8[]): void => {
  const ipad: u8[] = hmacPadBlock(k, SHA512_BLOCK, HMAC_IPAD)
  inner.update(ipad, HMAC_FROM, SHA512_BLOCK)
  wipe(ipad)
  const opad: u8[] = hmacPadBlock(k, SHA512_BLOCK, HMAC_OPAD)
  outer.update(opad, HMAC_FROM, SHA512_BLOCK)
  wipe(opad)
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

  /**
   * Keys the computation. A key longer than 64 bytes is replaced by its
   * SHA-256 (RFC 2104 §2), and that hash and the hasher that made it are
   * wiped once the key blocks are absorbed.
   */
  constructor(key: u8[]) {
    hmacCheckKey(key)
    this.inner = new Sha256()
    this.outer = new Sha256()
    if (toI32(key.length) > SHA256_BLOCK) {
      const hasher = new Sha256()
      hasher.update(key, HMAC_FROM, toI32(key.length))
      const hashed: u8[] = hasher.digest()
      hmacWipeSha256(hasher)
      hmacKeySha256(this.inner, this.outer, hashed)
      wipe(hashed)
    } else {
      hmacKeySha256(this.inner, this.outer, key)
    }
  }

  /** Absorbs `data[off .. off + len)`; a window outside `data` panics in `Sha256.update`. */
  update(data: u8[], off: i32, len: i32): void {
    this.inner.update(data, off, len)
  }

  /** The 32-byte tag, in a fresh array. Ends the computation, and wipes both hashers. */
  digest(): u8[] {
    const innerDigest: u8[] = this.inner.digest()
    this.outer.update(innerDigest, HMAC_FROM, SHA256_SIZE)
    wipe(innerDigest)
    const tag: u8[] = this.outer.digest()
    hmacWipeSha256(this.inner)
    hmacWipeSha256(this.outer)
    return tag
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
    hmacCheckKey(key)
    this.inner = new Sha384()
    this.outer = new Sha384()
    if (toI32(key.length) > SHA512_BLOCK) {
      const hasher = new Sha384()
      hasher.update(key, HMAC_FROM, toI32(key.length))
      const hashed: u8[] = hasher.digest()
      hmacWipeSha384(hasher)
      hmacKeySha384(this.inner, this.outer, hashed)
      wipe(hashed)
    } else {
      hmacKeySha384(this.inner, this.outer, key)
    }
  }

  /** Absorbs `data[off .. off + len)`; a window outside `data` panics in `Sha384.update`. */
  update(data: u8[], off: i32, len: i32): void {
    this.inner.update(data, off, len)
  }

  /** The 48-byte tag, in a fresh array. Ends the computation, and wipes both hashers. */
  digest(): u8[] {
    const innerDigest: u8[] = this.inner.digest()
    this.outer.update(innerDigest, HMAC_FROM, SHA384_SIZE)
    wipe(innerDigest)
    const tag: u8[] = this.outer.digest()
    hmacWipeSha384(this.inner)
    hmacWipeSha384(this.outer)
    return tag
  }
}

/**
 * HMAC-SHA-512 in progress (RFC 2104 with RFC 4231's SHA-512), with
 * `HmacSha256`'s methods. The block is SHA-512's 128 bytes and the tag 64.
 */
export class HmacSha512 {
  /** H(K XOR ipad, …), fed the key block in the constructor and the message after. */
  inner: Sha512
  /** H(K XOR opad, …), fed the key block in the constructor and the inner digest last. */
  outer: Sha512

  /** Keys the computation. A key longer than 128 bytes is replaced by its SHA-512 (RFC 2104 §2). */
  constructor(key: u8[]) {
    hmacCheckKey(key)
    this.inner = new Sha512()
    this.outer = new Sha512()
    if (toI32(key.length) > SHA512_BLOCK) {
      const hasher = new Sha512()
      hasher.update(key, HMAC_FROM, toI32(key.length))
      const hashed: u8[] = hasher.digest()
      hmacWipeSha512(hasher)
      hmacKeySha512(this.inner, this.outer, hashed)
      wipe(hashed)
    } else {
      hmacKeySha512(this.inner, this.outer, key)
    }
  }

  /** Absorbs `data[off .. off + len)`; a window outside `data` panics in `Sha512.update`. */
  update(data: u8[], off: i32, len: i32): void {
    this.inner.update(data, off, len)
  }

  /** The 64-byte tag, in a fresh array. Ends the computation, and wipes both hashers. */
  digest(): u8[] {
    const innerDigest: u8[] = this.inner.digest()
    this.outer.update(innerDigest, HMAC_FROM, SHA512_SIZE)
    wipe(innerDigest)
    const tag: u8[] = this.outer.digest()
    hmacWipeSha512(this.inner)
    hmacWipeSha512(this.outer)
    return tag
  }
}

/**
 * The HMAC-SHA-256 of all of `data` under `key`, as a fresh 32-byte array.
 *
 * `data` longer than 2^31 - 1 bytes panics, as `sha256` does and for its
 * reason: under `--number-mode f64` the tag would be of a prefix, and a tag
 * that verifies every message sharing that prefix is a forgery. A key that
 * long panics in the constructor for the same reason.
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
 * The HMAC-SHA-512 of all of `data` under `key`, as a fresh 64-byte array.
 * `data` longer than 2^31 - 1 bytes panics, as in `hmacSha256`.
 */
export const hmacSha512 = (key: u8[], data: u8[]): u8[] => {
  if (data.length > 2147483647) {
    panic("hmacSha512: a message longer than 2^31 - 1 bytes")
  }
  const mac = new HmacSha512(key)
  mac.update(data, HMAC_FROM, toI32(data.length))
  return mac.digest()
}

/**
 * `hmacSha256` under a key held as a `Secret`, read only inside `exposeWith`.
 * The tag is public, so it is answered plain; the caller still wipes the key.
 */
export const hmacSha256Secret = (key: Secret<u8[]>, data: u8[]): u8[] => exposeWith(key, data, hmacSha256)

/** `hmacSha384` under a key held as a `Secret`, as `hmacSha256Secret` is. */
export const hmacSha384Secret = (key: Secret<u8[]>, data: u8[]): u8[] => exposeWith(key, data, hmacSha384)

/** `hmacSha512` under a key held as a `Secret`, as `hmacSha256Secret` is. */
export const hmacSha512Secret = (key: Secret<u8[]>, data: u8[]): u8[] => exposeWith(key, data, hmacSha512)

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

/** Whether `tag` is the HMAC-SHA-512 of `data` under `key`, compared as `hmacSha256Verify` does. */
export const hmacSha512Verify = (key: u8[], data: u8[], tag: u8[]): boolean =>
  timingSafeEqual(hmacSha512(key, data), tag)

// ---- Caller-owned scratch --------------------------------------------------
//
// `HmacSha256` makes its two hashers in its constructor, and the one-shot
// functions above make an `HmacSha256` and a fresh tag on every call, so all
// of them store allocations of their own: memory no automatic arena scope and
// no `using a = arena()` block may release around them (docs/LANGUAGE.md,
// "`using a = arena()`", NL2424). The scratch below is the same computation in
// hashers the caller allocates once and keeps: `begin` keys it again by
// rewriting their state in place, and `finishInto` writes the tag into the
// caller's array. What it allocates on the way — the two digests a hasher
// answers — dies with the call that made it, so a caller may run it a
// thousand times inside one arena scope and leave the arena where it was.

/**
 * Makes `to` the hasher `from` is — the same point in the same message, as
 * `Sha256.copy` makes it — in a hasher the caller already holds, so that
 * nothing is allocated. Copying from a hasher nothing has been fed starts `to`
 * again. It is here rather than beside `Sha256` because the scratch below and
 * the TLS transcript are what need it, and HMAC is the module both sit on.
 */
export const hmacCopySha256 = (from: Sha256, to: Sha256): void => {
  const fromState: u32[] = from.state
  const toState: u32[] = to.state
  for (let i: i32 = 0; i < toI32(fromState.length) && i < toI32(toState.length); i += 1) {
    toState[i] = fromState[i]
  }
  const fromBlock: u8[] = from.block
  const toBlock: u8[] = to.block
  for (let i: i32 = 0; i < from.fill && i < toI32(fromBlock.length) && i < toI32(toBlock.length); i += 1) {
    toBlock[i] = fromBlock[i]
  }
  to.fill = from.fill
  to.total = from.total
  to.finished = from.finished
}

/** `hmacCopySha256` for SHA-384: `to` made the hasher `from` is, in place. */
export const hmacCopySha384 = (from: Sha384, to: Sha384): void => {
  const fromState: u64[] = from.engine.state
  const toState: u64[] = to.engine.state
  for (let i: i32 = 0; i < toI32(fromState.length) && i < toI32(toState.length); i += 1) {
    toState[i] = fromState[i]
  }
  const fromBlock: u8[] = from.engine.block
  const toBlock: u8[] = to.engine.block
  for (
    let i: i32 = 0;
    i < from.engine.filled && i < toI32(fromBlock.length) && i < toI32(toBlock.length);
    i += 1
  ) {
    toBlock[i] = fromBlock[i]
  }
  to.engine.filled = from.engine.filled
  to.engine.count = from.engine.count
  to.engine.finished = from.engine.finished
}

/** Whether `[off, off + len)` is a window inside an array of `length` elements. */
const hmacWindowFits = (length: i32, off: i32, len: i32): boolean =>
  off >= 0 && len >= 0 && off <= length - len

/**
 * HMAC-SHA-256 over hashers the caller owns: allocate one, then for each tag
 * `begin` with the key, `update` with the message, and `finishInto` the
 * caller's array. The tag is the one `hmacSha256` answers.
 *
 *     const mac = new HmacSha256Scratch();          // once, outside the loop
 *     mac.begin(key, 0, key.length);
 *     mac.update(message, 0, message.length);
 *     mac.finishInto(tag, 0);                       // 32 bytes at tag[0]
 *
 * The key block is wiped with `secureZero` once both hashers have absorbed
 * it, and so is every digest on the way; `wipe` zeroes the hashers too, for a
 * caller done with the key. A key or tag window outside its array panics, as
 * a message window does in `Sha256.update`.
 */
export class HmacSha256Scratch {
  /** H(K XOR ipad, …): keyed by `begin`, fed the message by `update`. */
  inner: Sha256
  /** H(K XOR opad, …): keyed by `begin`, fed the inner digest by `finishInto`. */
  outer: Sha256
  /** A hasher nothing is ever fed: the initial hash value `begin` copies from. */
  fresh: Sha256
  /** One key block XOR a pad, wiped as soon as it is absorbed. */
  pad: u8[]
  /** The SHA-256 of a key longer than a block, which RFC 2104 §2 keys with instead; wiped once used. */
  keyHash: u8[]

  constructor() {
    this.inner = new Sha256()
    this.outer = new Sha256()
    this.fresh = new Sha256()
    this.pad = new Array<u8>(SHA256_BLOCK)
    this.keyHash = new Array<u8>(SHA256_SIZE)
  }

  /** Keys a new computation with `key[off .. off + len)`, a key longer than 64 bytes by its SHA-256 (RFC 2104 §2). */
  begin(key: u8[], off: i32, len: i32): void {
    if (!hmacWindowFits(toI32(key.length), off, len)) {
      panic("HmacSha256Scratch: the key window is outside its array")
    }
    if (len <= SHA256_BLOCK) {
      this.keyBlocks(key, off, len)
      return
    }
    hmacCopySha256(this.fresh, this.inner)
    this.inner.update(key, off, len)
    const digest: u8[] = this.inner.digest()
    for (let i: i32 = 0; i < toI32(digest.length) && i < toI32(this.keyHash.length); i += 1) {
      this.keyHash[i] = digest[i]
    }
    secureZero(digest)
    // The key's last partial block and its schedule are still in the hasher,
    // and starting it again copies neither over (K1-7).
    hmacWipeSha256(this.inner)
    this.keyBlocks(this.keyHash, HMAC_FROM, SHA256_SIZE)
    secureZero(this.keyHash)
  }

  /**
   * Absorbs `key[off .. off + len)`, no longer than a block, XOR ipad into the
   * inner hasher and XOR opad into the outer one, each started again, and
   * wipes the block. A method of its own so that `begin` never keeps the
   * caller's key in a local it reassigns, which would make the key look
   * stored to the arena analysis.
   */
  keyBlocks(key: u8[], off: i32, len: i32): void {
    hmacPadInto(this.pad, key, off, len, HMAC_IPAD)
    hmacCopySha256(this.fresh, this.inner)
    this.inner.update(this.pad, HMAC_FROM, SHA256_BLOCK)
    hmacPadInto(this.pad, key, off, len, HMAC_OPAD)
    hmacCopySha256(this.fresh, this.outer)
    this.outer.update(this.pad, HMAC_FROM, SHA256_BLOCK)
    secureZero(this.pad)
  }

  /** Absorbs `data[off .. off + len)`; a window outside `data` panics in `Sha256.update`. */
  update(data: u8[], off: i32, len: i32): void {
    this.inner.update(data, off, len)
  }

  /** Writes the 32-byte tag at `out[at]` and ends the computation; a window outside `out` panics. */
  finishInto(out: u8[], at: i32): void {
    if (!hmacWindowFits(toI32(out.length), at, SHA256_SIZE)) {
      panic("HmacSha256Scratch: the tag window is outside its array")
    }
    const innerDigest: u8[] = this.inner.digest()
    this.outer.update(innerDigest, HMAC_FROM, SHA256_SIZE)
    secureZero(innerDigest)
    const tag: u8[] = this.outer.digest()
    for (let i: i32 = 0; i < SHA256_SIZE && i < toI32(tag.length) && at + i < toI32(out.length); i += 1) {
      out[at + i] = tag[i]
    }
    secureZero(tag)
  }

  /** Zeroes both keyed hashers, for a caller done with the key; `begin` starts again. */
  wipe(): void {
    hmacWipeSha256(this.inner)
    hmacWipeSha256(this.outer)
  }
}

/**
 * HMAC-SHA-384 over hashers the caller owns, with `HmacSha256Scratch`'s
 * methods. The block is 128 bytes and the tag 48.
 */
export class HmacSha384Scratch {
  /** H(K XOR ipad, …): keyed by `begin`, fed the message by `update`. */
  inner: Sha384
  /** H(K XOR opad, …): keyed by `begin`, fed the inner digest by `finishInto`. */
  outer: Sha384
  /** A hasher nothing is ever fed: the initial hash value `begin` copies from. */
  fresh: Sha384
  /** One key block XOR a pad, wiped as soon as it is absorbed. */
  pad: u8[]
  /** The SHA-384 of a key longer than a block; wiped once used. */
  keyHash: u8[]

  constructor() {
    this.inner = new Sha384()
    this.outer = new Sha384()
    this.fresh = new Sha384()
    this.pad = new Array<u8>(SHA512_BLOCK)
    this.keyHash = new Array<u8>(SHA384_SIZE)
  }

  /** Keys a new computation with `key[off .. off + len)`, a key longer than 128 bytes by its SHA-384 (RFC 2104 §2). */
  begin(key: u8[], off: i32, len: i32): void {
    if (!hmacWindowFits(toI32(key.length), off, len)) {
      panic("HmacSha384Scratch: the key window is outside its array")
    }
    if (len <= SHA512_BLOCK) {
      this.keyBlocks(key, off, len)
      return
    }
    hmacCopySha384(this.fresh, this.inner)
    this.inner.update(key, off, len)
    const digest: u8[] = this.inner.digest()
    for (let i: i32 = 0; i < toI32(digest.length) && i < toI32(this.keyHash.length); i += 1) {
      this.keyHash[i] = digest[i]
    }
    secureZero(digest)
    // The key's last partial block and its schedule are still in the hasher,
    // and starting it again copies neither over (K1-7).
    hmacWipeSha384(this.inner)
    this.keyBlocks(this.keyHash, HMAC_FROM, SHA384_SIZE)
    secureZero(this.keyHash)
  }

  /**
   * Absorbs `key[off .. off + len)`, no longer than a block, XOR ipad into the
   * inner hasher and XOR opad into the outer one, each started again, and
   * wipes the block. A method of its own so that `begin` never keeps the
   * caller's key in a local it reassigns, which would make the key look
   * stored to the arena analysis.
   */
  keyBlocks(key: u8[], off: i32, len: i32): void {
    hmacPadInto(this.pad, key, off, len, HMAC_IPAD)
    hmacCopySha384(this.fresh, this.inner)
    this.inner.update(this.pad, HMAC_FROM, SHA512_BLOCK)
    hmacPadInto(this.pad, key, off, len, HMAC_OPAD)
    hmacCopySha384(this.fresh, this.outer)
    this.outer.update(this.pad, HMAC_FROM, SHA512_BLOCK)
    secureZero(this.pad)
  }

  /** Absorbs `data[off .. off + len)`; a window outside `data` panics in the hasher. */
  update(data: u8[], off: i32, len: i32): void {
    this.inner.update(data, off, len)
  }

  /** Writes the 48-byte tag at `out[at]` and ends the computation; a window outside `out` panics. */
  finishInto(out: u8[], at: i32): void {
    if (!hmacWindowFits(toI32(out.length), at, SHA384_SIZE)) {
      panic("HmacSha384Scratch: the tag window is outside its array")
    }
    const innerDigest: u8[] = this.inner.digest()
    this.outer.update(innerDigest, HMAC_FROM, SHA384_SIZE)
    secureZero(innerDigest)
    const tag: u8[] = this.outer.digest()
    for (let i: i32 = 0; i < SHA384_SIZE && i < toI32(tag.length) && at + i < toI32(out.length); i += 1) {
      out[at + i] = tag[i]
    }
    secureZero(tag)
  }

  /** Zeroes both keyed hashers, for a caller done with the key; `begin` starts again. */
  wipe(): void {
    hmacWipeSha384(this.inner)
    hmacWipeSha384(this.outer)
  }
}
