/**
 * How many sessions each remote address holds: the per-peer half of the
 * relay's two caps (main.rs's `Limits.per_peer`).
 *
 * A table of `rows` addresses, open addressing with linear probing and
 * backward-shift deletion, so a row goes the moment its count reaches zero
 * and leaves no tombstone behind: the key is an address whoever connects
 * chooses, and a table that only grew would be memory reachable from outside.
 * The hash mixes the address's sixteen bytes with eight bytes of entropy drawn
 * at start-up, by multiplication, so a client cannot choose addresses that
 * collide without learning the salt; the relay sizes the table at twice the
 * slots that can hold a peer, so a probe run stays short. Nothing allocates
 * after the constructor.
 *
 * An address is the first 16 bytes of `nish:net`'s address form — IPv6, with
 * IPv4 mapped — and the port is not part of it: the cap is per host, as
 * main.rs keys it by `IpAddr`.
 */
import { quicPacketCopy } from "nish/net/quic-packet"

/** The bytes of an address the table keys on. */
export const RELAY_PEER_KEY: i32 = 16

/** A typed zero, since a bare literal handed to a function is an `f64` under `--number-mode f64` where its parameter is not typed. */
const RELAY_PEER_ZERO: i32 = 0

/** The odd 31-bit multiplier of the hash. */
const RELAY_PEER_MIX: i64 = 0x5bd1e995

/** Keeps the hash's products inside an i64. */
const RELAY_PEER_MASK: i64 = 0x7fffffff

/** Session counts per remote address. */
export class RelayPeers {
  /** Row `r`'s address is `keys[r * 16 .. r * 16 + 16)`; a count of 0 is an empty row. */
  keys: u8[]
  counts: i32[]
  /** A key's bytes, for rehashing a row while deleting. */
  scratch: u8[]
  salt: i64 = 0
  /** How many rows hold an address. */
  used: i32 = 0

  /** A table of `rows` rows, keyed with `salt` (eight bytes of entropy, or more). */
  constructor(rows: i32, salt: u8[]) {
    if (rows < 1 || rows > 1048576) {
      panic(`RelayPeers: ${rows} rows, outside 1 to 1048576`)
    }
    this.keys = new Array<u8>(rows * RELAY_PEER_KEY)
    this.counts = new Array<i32>(rows)
    this.scratch = new Array<u8>(RELAY_PEER_KEY)
    let s: i64 = 0
    for (let k: i32 = 0; k < 8 && k < toI32(salt.length); k++) {
      s = ((s << 8) | toI64(salt[k])) & RELAY_PEER_MASK
    }
    this.salt = s
  }

  /** The row the address at `addr[0 ..]` hashes to. */
  home(addr: u8[]): i32 {
    let h: i64 = this.salt
    for (let k: i32 = 0; k < RELAY_PEER_KEY && k < toI32(addr.length); k++) {
      h = (((h ^ toI64(addr[k])) & RELAY_PEER_MASK) * RELAY_PEER_MIX) & RELAY_PEER_MASK
      h = h ^ (h >> 15)
    }
    return toI32(h % toI64(toI32(this.counts.length)))
  }

  /** Whether row `r` holds the address at `addr[0 ..]`. */
  holds(r: i32, addr: u8[]): boolean {
    const at: i32 = r * RELAY_PEER_KEY
    for (let k: i32 = 0; k < RELAY_PEER_KEY; k++) {
      if (at + k >= toI32(this.keys.length) || k >= toI32(addr.length) || this.keys[at + k] !== addr[k]) {
        return false
      }
    }
    return true
  }

  /** The row holding the address, or -1. */
  find(addr: u8[]): i32 {
    const rows: i32 = toI32(this.counts.length)
    let r: i32 = this.home(addr)
    for (let probe: i32 = 0; probe < rows; probe++) {
      if (r < 0 || r >= rows || this.counts[r] === 0) {
        return -1
      }
      if (this.holds(r, addr)) {
        return r
      }
      r = r + 1 < rows ? r + 1 : 0
    }
    return -1
  }

  /** The sessions the address holds. */
  count(addr: u8[]): i32 {
    const r: i32 = this.find(addr)
    return r >= 0 ? this.counts[r] : 0
  }

  /**
   * Counts one more session against the address, unless it already holds
   * `max`, or the table is full: answers whether it was counted.
   */
  claim(addr: u8[], max: i32): boolean {
    const found: i32 = this.find(addr)
    if (found >= 0) {
      if (this.counts[found] >= max) {
        return false
      }
      this.counts[found] = this.counts[found] + 1
      return true
    }
    const rows: i32 = toI32(this.counts.length)
    if (max < 1 || this.used >= rows) {
      return false
    }
    let r: i32 = this.home(addr)
    for (let probe: i32 = 0; probe < rows; probe++) {
      if (r >= 0 && r < rows && this.counts[r] === 0) {
        quicPacketCopy(this.keys, r * RELAY_PEER_KEY, addr, RELAY_PEER_ZERO, RELAY_PEER_KEY)
        this.counts[r] = 1
        this.used = this.used + 1
        return true
      }
      r = r + 1 < rows ? r + 1 : 0
    }
    return false
  }

  /**
   * Gives back one session of the address; its row goes with its last.
   * Keyed by the address, not a row number: a deletion moves the rows after
   * it, so a row number kept from `claim` can name another address by now.
   */
  release(addr: u8[]): void {
    const rows: i32 = toI32(this.counts.length)
    const r: i32 = this.find(addr)
    if (r < 0 || r >= rows) {
      return
    }
    this.counts[r] = this.counts[r] - 1
    if (this.counts[r] > 0) {
      return
    }
    this.used = this.used - 1
    // Backward-shift deletion: pull later rows of the run back over the hole.
    let hole: i32 = r
    let next: i32 = r + 1 < rows ? r + 1 : 0
    for (let probe: i32 = 0; probe < rows && this.counts[next] !== 0; probe++) {
      const home: i32 = this.home(this.keyOf(next))
      // `next` may move into `hole` when its home is not cyclically within (hole, next].
      const between: boolean = hole <= next ? home > hole && home <= next : home > hole || home <= next
      if (!between) {
        this.move(next, hole)
        hole = next
      }
      next = next + 1 < rows ? next + 1 : 0
    }
  }

  /** Row `r`'s address, copied into `scratch` for `home` to read. */
  keyOf(r: i32): u8[] {
    quicPacketCopy(this.scratch, RELAY_PEER_ZERO, this.keys, r * RELAY_PEER_KEY, RELAY_PEER_KEY)
    return this.scratch
  }

  /** Moves row `from` into the empty row `to`. */
  move(from: i32, to: i32): void {
    quicPacketCopy(this.keys, to * RELAY_PEER_KEY, this.keys, from * RELAY_PEER_KEY, RELAY_PEER_KEY)
    this.counts[to] = this.counts[from]
    this.counts[from] = 0
  }
}
