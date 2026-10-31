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
 * **What the key reaches is wiped** (CLAUDE.md, "Security"). The key block
 * is wiped once both hashers have absorbed it, and so is the hash
 * of a key longer than a block and the hasher that made it. `digest` wipes
 * the inner digest and both keyed hashers (chaining value, pending block and
 * message schedule) before it answers, so a finished `HmacSha256` holds
 * nothing of the key. The wipes are `wipe`'s volatile stores, which `-O2`
 * keeps (`tests/wipes/crypto.js`, "crypto_hmac crypto_hkdf: the wipes survive -O2").
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
 * `HmacKey` keys a `Secret<u8[]>` once, for a key MACed with many times (a
 * JWT verifier's HS key): it keeps the inner and outer midstates (RFC 2104
 * §4) as a `Secret<u64[]>`, and `hmacKeyedVerify` / `hmacKeyedInto` copy them
 * into the key's own hashers per message instead of absorbing the key again.
 * Each call wipes the copy, the hashers and the inner digest before it
 * answers; `HmacKey.wipe()` zeroes the pads (see "A key held keyed" below).
 *
 * `pbkdf2HmacSha256` is PBKDF2 with HMAC-SHA-256 (RFC 8018 §5.2), the key
 * derivation SCRAM-SHA-256 runs over a password: the password goes in as a
 * `Secret<u8[]>` and the derived key comes out as one, and every U_j and T_i
 * is wiped before it answers (see "PBKDF2" below).
 *
 * Written from RFC 2104 and RFC 8018, not ported from another implementation.
 */
import { SHA256_BLOCK, SHA256_SIZE, Sha256 } from "nish/crypto/sha256"
import { SHA384_SIZE, SHA512_BLOCK, SHA512_SIZE, Sha384, Sha512 } from "nish/crypto/sha512"
import { timingSafeEqual, timingSafeEqualAt } from "nish/crypto/ct"
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret"

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
 * than SHA-256's block, in one block that is rewritten between the two and
 * wiped once both have absorbed it.
 */
const hmacPadsSha256 = (inner: Sha256, outer: Sha256, k: u8[]): void => {
  const pad: u8[] = hmacPadBlock(k, SHA256_BLOCK, HMAC_IPAD)
  inner.update(pad, HMAC_FROM, SHA256_BLOCK)
  hmacPadInto(pad, k, HMAC_FROM, toI32(k.length), HMAC_OPAD)
  outer.update(pad, HMAC_FROM, SHA256_BLOCK)
  wipe(pad)
}

/**
 * Keys `inner` and `outer` with `key` as RFC 2104 §2 says: a key longer than
 * the block is replaced by its hash, in a hasher of its own, and that hash
 * and that hasher are wiped once the key blocks are absorbed.
 */
const hmacKeySha256 = (inner: Sha256, outer: Sha256, key: u8[]): void => {
  hmacCheckKey(key)
  if (toI32(key.length) <= SHA256_BLOCK) {
    hmacPadsSha256(inner, outer, key)
    return
  }
  const hasher = new Sha256()
  hasher.update(key, HMAC_FROM, toI32(key.length))
  const hashed: u8[] = hasher.digest()
  hmacWipeSha256(hasher)
  hmacPadsSha256(inner, outer, hashed)
  wipe(hashed)
}

/** `hmacPadsSha256` for SHA-384's 128-byte block. */
const hmacPadsSha384 = (inner: Sha384, outer: Sha384, k: u8[]): void => {
  const pad: u8[] = hmacPadBlock(k, SHA512_BLOCK, HMAC_IPAD)
  inner.update(pad, HMAC_FROM, SHA512_BLOCK)
  hmacPadInto(pad, k, HMAC_FROM, toI32(k.length), HMAC_OPAD)
  outer.update(pad, HMAC_FROM, SHA512_BLOCK)
  wipe(pad)
}

/**
 * Keys `inner` and `outer` with `key` as RFC 2104 §2 says: a key longer than
 * the block is replaced by its hash, in a hasher of its own, and that hash
 * and that hasher are wiped once the key blocks are absorbed.
 */
const hmacKeySha384 = (inner: Sha384, outer: Sha384, key: u8[]): void => {
  hmacCheckKey(key)
  if (toI32(key.length) <= SHA512_BLOCK) {
    hmacPadsSha384(inner, outer, key)
    return
  }
  const hasher = new Sha384()
  hasher.update(key, HMAC_FROM, toI32(key.length))
  const hashed: u8[] = hasher.digest()
  hmacWipeSha384(hasher)
  hmacPadsSha384(inner, outer, hashed)
  wipe(hashed)
}

/** `hmacPadsSha256` for SHA-512's 128-byte block. */
const hmacPadsSha512 = (inner: Sha512, outer: Sha512, k: u8[]): void => {
  const pad: u8[] = hmacPadBlock(k, SHA512_BLOCK, HMAC_IPAD)
  inner.update(pad, HMAC_FROM, SHA512_BLOCK)
  hmacPadInto(pad, k, HMAC_FROM, toI32(k.length), HMAC_OPAD)
  outer.update(pad, HMAC_FROM, SHA512_BLOCK)
  wipe(pad)
}

/**
 * Keys `inner` and `outer` with `key` as RFC 2104 §2 says: a key longer than
 * the block is replaced by its hash, in a hasher of its own, and that hash
 * and that hasher are wiped once the key blocks are absorbed.
 */
const hmacKeySha512 = (inner: Sha512, outer: Sha512, key: u8[]): void => {
  hmacCheckKey(key)
  if (toI32(key.length) <= SHA512_BLOCK) {
    hmacPadsSha512(inner, outer, key)
    return
  }
  const hasher = new Sha512()
  hasher.update(key, HMAC_FROM, toI32(key.length))
  const hashed: u8[] = hasher.digest()
  hmacWipeSha512(hasher)
  hmacPadsSha512(inner, outer, hashed)
  wipe(hashed)
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
   * SHA-256 (RFC 2104 §2), which is wiped once used (`hmacKeySha256`).
   */
  constructor(key: u8[]) {
    this.inner = new Sha256()
    this.outer = new Sha256()
    hmacKeySha256(this.inner, this.outer, key)
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
    this.inner = new Sha384()
    this.outer = new Sha384()
    hmacKeySha384(this.inner, this.outer, key)
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
    this.inner = new Sha512()
    this.outer = new Sha512()
    hmacKeySha512(this.inner, this.outer, key)
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
    // Starting a hasher again copies only the live part of `fresh`, so the
    // last computation's block and schedule are wiped first (K1-7).
    hmacWipeSha256(this.inner)
    hmacWipeSha256(this.outer)
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
    // Starting a hasher again copies only the live part of `fresh`, so the
    // last computation's block and schedule are wiped first (K1-7).
    hmacWipeSha384(this.inner)
    hmacWipeSha384(this.outer)
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

// ---- PBKDF2 ----------------------------------------------------------------
//
// PBKDF2 with HMAC-SHA-256 as its PRF (RFC 8018 §5.2), the key derivation
// SCRAM-SHA-256 (RFC 7677, RFC 5802 §3 "Hi") runs over a password. The
// password keys an inner and an outer hasher once; every U_j after that is
// two compressions in a working hasher copied from them, so a count of 4096
// costs 4096 HMACs and never keys one again.

/** What `pbkdf2HmacSha256` passes through `exposeWith`, which carries one argument. */
interface Pbkdf2Request {
  /** The salt, public: SCRAM's server sends it. */
  salt: u8[]
  /** The iteration count `c`, at least 1. */
  iterations: i32
  /** The derived key's length `dkLen` in bytes, at least 1. */
  length: i32
}

/** The length of INT(i), the big-endian block index after the salt; typed, as `HMAC_FROM` is. */
const PBKDF2_INDEX: i32 = 4

/**
 * Ends the HMAC `work` holds, keyed as `keyedOuter` is on the outer side, and
 * writes its 32-byte tag into `out`. Both digests `work` answers are wiped
 * here, so they die with this call and its arena scope.
 */
const pbkdf2Finish = (keyedOuter: Sha256, work: Sha256, out: u8[]): void => {
  const innerDigest: u8[] = work.digest()
  hmacCopySha256(keyedOuter, work)
  work.update(innerDigest, HMAC_FROM, SHA256_SIZE)
  wipe(innerDigest)
  const tag: u8[] = work.digest()
  for (let i: i32 = 0; i < SHA256_SIZE && i < toI32(tag.length) && i < toI32(out.length); i += 1) {
    out[i] = tag[i]
  }
  wipe(tag)
}

/** `pbkdf2HmacSha256` on the exposed password. */
const pbkdf2HmacSha256Exposed = (password: u8[], request: Pbkdf2Request): u8[] | null => {
  const salt: u8[] = request.salt
  const iterations: i32 = request.iterations
  const length: i32 = request.length
  // Before any `toI32`, which would saturate under `--number-mode f64`.
  if (password.length > 2147483647 || salt.length > 2147483647) {
    return null
  }
  if (iterations < 1 || length < 1) {
    return null
  }
  const keyedInner = new Sha256()
  const keyedOuter = new Sha256()
  hmacKeySha256(keyedInner, keyedOuter, password)
  const work = new Sha256()
  const u: u8[] = new Array<u8>(SHA256_SIZE)
  const t: u8[] = new Array<u8>(SHA256_SIZE)
  const index: u8[] = new Array<u8>(PBKDF2_INDEX)
  const dk: u8[] = new Array<u8>(length)
  // dkLen is an i32, so it never reaches RFC 8018's (2^32 - 1) * hLen bound,
  // and the block index below never passes 2^26.
  let block: i32 = 1
  let done: i32 = 0
  while (done < length) {
    // U_1 = PRF(P, S || INT(i)), INT(i) four bytes, most significant first.
    index[0] = toU8((block >> 24) & 0xff)
    index[1] = toU8((block >> 16) & 0xff)
    index[2] = toU8((block >> 8) & 0xff)
    index[3] = toU8(block & 0xff)
    hmacCopySha256(keyedInner, work)
    work.update(salt, HMAC_FROM, toI32(salt.length))
    work.update(index, HMAC_FROM, PBKDF2_INDEX)
    pbkdf2Finish(keyedOuter, work, u)
    for (let j: i32 = 0; j < SHA256_SIZE && j < toI32(t.length) && j < toI32(u.length); j += 1) {
      t[j] = u[j]
    }
    // U_c = PRF(P, U_{c-1}); T_i = U_1 XOR ... XOR U_c.
    for (let c: i32 = 1; c < iterations; c += 1) {
      hmacCopySha256(keyedInner, work)
      work.update(u, HMAC_FROM, SHA256_SIZE)
      pbkdf2Finish(keyedOuter, work, u)
      for (let j: i32 = 0; j < SHA256_SIZE && j < toI32(t.length) && j < toI32(u.length); j += 1) {
        t[j] = t[j] ^ u[j]
      }
    }
    const take: i32 = length - done < SHA256_SIZE ? length - done : SHA256_SIZE
    for (let j: i32 = 0; j < take && j < toI32(t.length) && done + j < toI32(dk.length); j += 1) {
      dk[done + j] = t[j]
    }
    done += take
    block += 1
  }
  wipe(u)
  wipe(t)
  hmacWipeSha256(work)
  hmacWipeSha256(keyedInner)
  hmacWipeSha256(keyedOuter)
  return dk
}

/**
 * PBKDF2-HMAC-SHA256(P, S, c, dkLen) as RFC 8018 §5.2 defines it: the
 * `dkLen`-byte key derived from the password `password` and the salt `salt`
 * over `iterations` rounds, as a `Secret`.
 *
 *     const salted: Secret<u8[]> | null = pbkdf2HmacSha256(password, salt, 4096, 32);
 *
 * Bad input answers `null` and never panics: an iteration count or a length
 * below 1, or a password or salt longer than 2^31 - 1 bytes. The password is
 * read only inside `exposeWith`, and every U_j, every T_i, both keyed hashers
 * and the working one are wiped before the key is answered; the digests on
 * the way are wiped in the call that made them. The time taken depends on
 * `iterations`, `dkLen` and the password's length past a block, all of which
 * RFC 8018 treats as public, and on nothing of the password's bytes. The time
 * is linear in `iterations` and nothing here bounds it, so a caller that takes
 * the count from an untrusted peer (a SCRAM server's `i=`) must cap it first:
 * 2^31 - 1 rounds is about 2^32 compressions.
 */
export const pbkdf2HmacSha256 = (
  password: Secret<u8[]>,
  salt: u8[],
  iterations: i32,
  length: i32
): Secret<u8[]> | null => {
  const request: Pbkdf2Request = { salt: salt, iterations: iterations, length: length }
  const dk: u8[] | null = exposeWith(password, request, pbkdf2HmacSha256Exposed)
  if (dk === null) {
    return null
  }
  return secret(dk)
}

// ---- A key held keyed: the pads absorbed once, as a Secret --------------------
//
// A verifier that checks many tags under one key — a JWT's HS256 signature on
// every request — pays for the key's two pad blocks once, not once per tag.
// RFC 2104 §4 notes the two keyed chaining values can be kept and the
// computation started from them; `HmacKey` keeps exactly those, and keeps them
// as a `Secret`, because they are key material: either one, with the hash's
// length padding, MACs any message under the key without the key itself.
//
// A function `exposeWith` runs may not write through the argument it is
// handed (NL2450), and a hasher made per tag stores its arrays in its fields,
// which no arena block may release around (NL2424). So each tag copies the
// midstates out with `expose`, resumes the two hashers the key owns from the
// copy, wipes the copy, feeds and finishes them and wipes them; what it
// allocates — the copy and the two digests — dies inside the arena block of
// `hmacKeyedInto` and `hmacKeyedVerify`. That is the shape
// `p256SignSha256Into` has (`std/crypto/p256.ts`): a plain copy of a secret
// step's answer, used in caller-owned scratch and wiped before return.

/** `HmacKey`'s hash: HMAC-SHA-256. */
export const HMAC_SHA256: i32 = 1
/** `HmacKey`'s hash: HMAC-SHA-384. */
export const HMAC_SHA384: i32 = 2
/** `HmacKey`'s hash: HMAC-SHA-512. */
export const HMAC_SHA512: i32 = 3

/** Words of one chaining value: eight, for SHA-256's `u32` and SHA-512's `u64` alike. */
const HMAC_WORDS: i32 = 8

/** The tag length of `hash` in bytes, 0 for no hash `HmacKey` knows. */
const hmacTagSize = (hash: i32): i32 => {
  if (hash === HMAC_SHA256) {
    return SHA256_SIZE
  }
  if (hash === HMAC_SHA384) {
    return SHA384_SIZE
  }
  if (hash === HMAC_SHA512) {
    return SHA512_SIZE
  }
  return 0
}

/**
 * The inner and outer chaining values after the key's pad blocks, for
 * `exposeWith` to run on the plain key: words 0 to 7 the inner, 8 to 15 the
 * outer, SHA-256's `u32` words widened to `u64`. The two keying hashers are
 * wiped before it answers.
 */
const hmacMidstates = (key: u8[], hash: i32): u64[] => {
  const out: u64[] = new Array<u64>(2 * HMAC_WORDS)
  if (hash === HMAC_SHA256) {
    const inner = new Sha256()
    const outer = new Sha256()
    hmacKeySha256(inner, outer, key)
    for (
      let i: i32 = 0;
      i < HMAC_WORDS && i < toI32(inner.state.length) && i < toI32(outer.state.length);
      i += 1
    ) {
      const j: i32 = i + HMAC_WORDS
      if (i < toI32(out.length) && j < toI32(out.length)) {
        out[i] = toU64(inner.state[i])
        out[j] = toU64(outer.state[i])
      }
    }
    hmacWipeSha256(inner)
    hmacWipeSha256(outer)
  } else if (hash === HMAC_SHA384) {
    const inner = new Sha384()
    const outer = new Sha384()
    hmacKeySha384(inner, outer, key)
    hmacMidstates512(out, inner.engine.state, outer.engine.state)
    hmacWipeSha384(inner)
    hmacWipeSha384(outer)
  } else {
    const inner = new Sha512()
    const outer = new Sha512()
    hmacKeySha512(inner, outer, key)
    hmacMidstates512(out, inner.engine.state, outer.engine.state)
    hmacWipeSha512(inner)
    hmacWipeSha512(outer)
  }
  return out
}

/** `out[0 .. 8) = inner`, `out[8 .. 16) = outer`, for the SHA-512 family. */
const hmacMidstates512 = (out: u64[], inner: u64[], outer: u64[]): void => {
  for (let i: i32 = 0; i < HMAC_WORDS && i < toI32(inner.length) && i < toI32(outer.length); i += 1) {
    const j: i32 = i + HMAC_WORDS
    if (i < toI32(out.length) && j < toI32(out.length)) {
      out[i] = inner[i]
      out[j] = outer[i]
    }
  }
}

/**
 * An HMAC key absorbed once: the inner and outer chaining values after the
 * key's pad blocks (RFC 2104 §4), held as a `Secret<u64[]>`. Every tag it
 * makes or checks starts from them, so a tag costs the message's blocks and
 * two finishing blocks, and never the key's two again.
 *
 *     const key = new HmacKey(HMAC_SHA256, secretKey);   // once
 *     hmacKeyedInto(key, data, 0, data.length, tag, 0);  // per message
 *     const ok: boolean = hmacKeyedVerify(key, data, 0, data.length, tag, 0);
 *     key.wipe();                                        // when done
 *
 * The tags are `hmacSha256`'s, `hmacSha384`'s and `hmacSha512`'s for the same
 * key. The key itself is read only inside `exposeWith`, and the hashers that
 * keyed it are wiped; the caller still owns and wipes the `Secret` it passed.
 * An unknown `hash` panics.
 *
 * The key also owns two hashers of its family, made once, that each tag is
 * computed in and that are wiped before the tag call returns. One key is
 * therefore used by one computation at a time, as a `Sha256` is.
 */
export class HmacKey {
  /** `HMAC_SHA256`, `HMAC_SHA384` or `HMAC_SHA512`. */
  readonly hash: i32
  /** Words 0 to 7: the keyed inner chaining value; 8 to 15: the keyed outer one. */
  readonly pads: Secret<u64[]>
  /** SHA-256's work hashers; idle and wiped between tags. */
  readonly inner256: Sha256
  readonly outer256: Sha256
  /**
   * SHA-384's and SHA-512's work hashers: SHA-384 is SHA-512's compression
   * from another start, cut to 48 bytes, so resumed from a chaining value the
   * two are one hasher and differ only in the digest length taken.
   */
  readonly inner512: Sha512
  readonly outer512: Sha512

  constructor(hash: i32, key: Secret<u8[]>) {
    if (hmacTagSize(hash) === 0) {
      panic("HmacKey: an unknown hash")
    }
    this.hash = hash
    this.pads = secret(exposeWith(key, hash, hmacMidstates))
    this.inner256 = new Sha256()
    this.outer256 = new Sha256()
    this.inner512 = new Sha512()
    this.outer512 = new Sha512()
    hmacWipeSha256(this.inner256)
    hmacWipeSha256(this.outer256)
    hmacWipeSha512(this.inner512)
    hmacWipeSha512(this.outer512)
  }

  /** The tag length in bytes: 32, 48 or 64. */
  size(): i32 {
    return hmacTagSize(this.hash)
  }

  /** Zero both keyed chaining values and the work hashers; the key MACs nothing after. */
  wipe(): void {
    wipe(this.pads)
    hmacWipeSha256(this.inner256)
    hmacWipeSha256(this.outer256)
    hmacWipeSha512(this.inner512)
    hmacWipeSha512(this.outer512)
  }
}

/** A plain copy of the 16 midstate words, for `expose` to run; the caller wipes it. */
const hmacCopyWords = (pads: u64[]): u64[] => {
  const out: u64[] = new Array<u64>(2 * HMAC_WORDS)
  for (let i: i32 = 0; i < toI32(out.length) && i < toI32(pads.length); i += 1) {
    out[i] = pads[i]
  }
  return out
}

/** `h` started again at the point after one keyed block, chaining value `mid[at .. at + 8)`. */
const hmacResume256 = (h: Sha256, mid: u64[], at: i32): void => {
  hmacWipeSha256(h)
  const state: u32[] = h.state
  for (let i: i32 = 0; i < HMAC_WORDS && i < toI32(state.length) && at + i < toI32(mid.length); i += 1) {
    state[i] = toU32(mid[at + i])
  }
  h.total = toI64(SHA256_BLOCK)
  h.finished = false
}

/** `hmacResume256` for the SHA-512 family's hasher. */
const hmacResume512 = (h: Sha512, mid: u64[], at: i32): void => {
  hmacWipeSha512(h)
  const state: u64[] = h.engine.state
  for (let i: i32 = 0; i < HMAC_WORDS && i < toI32(state.length) && at + i < toI32(mid.length); i += 1) {
    state[i] = mid[at + i]
  }
  h.engine.count = toU64(SHA512_BLOCK)
  h.engine.finished = false
}

/**
 * The tag of `data[off .. off + len)` under `key`, as a fresh array the
 * caller wipes: the midstates copied out of their `Secret`, the key's two
 * hashers resumed from them, fed and finished, and the copy, the inner digest
 * and both hashers wiped before it answers.
 */
const hmacKeyedTag = (key: HmacKey, data: u8[], off: i32, len: i32): u8[] => {
  const mid: u64[] = expose(key.pads, hmacCopyWords)
  if (key.hash === HMAC_SHA256) {
    const inner: Sha256 = key.inner256
    const outer: Sha256 = key.outer256
    hmacResume256(inner, mid, 0)
    hmacResume256(outer, mid, HMAC_WORDS)
    wipe(mid)
    inner.update(data, off, len)
    const digest: u8[] = inner.digest()
    outer.update(digest, HMAC_FROM, SHA256_SIZE)
    const tag: u8[] = outer.digest()
    wipe(digest)
    hmacWipeSha256(inner)
    hmacWipeSha256(outer)
    return tag
  }
  const size: i32 = key.hash === HMAC_SHA384 ? SHA384_SIZE : SHA512_SIZE
  const inner: Sha512 = key.inner512
  const outer: Sha512 = key.outer512
  hmacResume512(inner, mid, 0)
  hmacResume512(outer, mid, HMAC_WORDS)
  wipe(mid)
  inner.update(data, off, len)
  const digest: u8[] = inner.digest()
  outer.update(digest, HMAC_FROM, size)
  const tag: u8[] = outer.digest()
  wipe(digest)
  hmacWipeSha512(inner)
  hmacWipeSha512(outer)
  return tag
}

/**
 * The tag of `data[off .. off + len)` under `key`, written at
 * `out[at .. at + key.size())`. A window outside its array panics before
 * anything is read. It runs in an arena block of its own and stores nothing,
 * so a tag leaves the arena where it was.
 */
export const hmacKeyedInto = (key: HmacKey, data: u8[], off: i32, len: i32, out: u8[], at: i32): void => {
  const size: i32 = key.size()
  if (!hmacWindowFits(toI32(data.length), off, len)) {
    panic("hmacKeyedInto: the message window is outside its array")
  }
  if (!hmacWindowFits(toI32(out.length), at, size)) {
    panic("hmacKeyedInto: the tag window is outside its array")
  }
  using _scope = arena()
  const tag: u8[] = hmacKeyedTag(key, data, off, len)
  for (let i: i32 = 0; i < size && i < toI32(tag.length) && at + i < toI32(out.length); i += 1) {
    out[at + i] = tag[i]
  }
  wipe(tag)
}

/**
 * Whether `tag[tagAt .. tagAt + key.size())` is the tag of
 * `data[off .. off + len)` under `key`, compared in constant time and the
 * computed tag wiped, since it is the one tag a forger needs. A tag window
 * that does not fit answers `false`; a message window outside its array
 * panics. It runs in an arena block of its own and stores nothing.
 */
export const hmacKeyedVerify = (
  key: HmacKey,
  data: u8[],
  off: i32,
  len: i32,
  tag: u8[],
  tagAt: i32
): boolean => {
  const size: i32 = key.size()
  if (!hmacWindowFits(toI32(data.length), off, len)) {
    panic("hmacKeyedVerify: the message window is outside its array")
  }
  if (!hmacWindowFits(toI32(tag.length), tagAt, size)) {
    return false
  }
  using _scope = arena()
  const mine: u8[] = hmacKeyedTag(key, data, off, len)
  const ok: boolean = timingSafeEqualAt(mine, HMAC_FROM, tag, tagAt, size)
  wipe(mine)
  return ok
}
