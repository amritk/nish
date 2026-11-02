/**
 * `nish/net/outbound` — the policy for a program that fetches URLs it did
 * not choose: a webhook sender, a link previewer, an importer that takes a
 * URL from a form. Without one, such a program is a proxy into its own
 * network for whoever supplies the URL (server-side request forgery): a URL
 * naming `127.0.0.1`, `169.254.169.254` or a name that resolves to either
 * reaches services that trust the program's address.
 *
 *     import { OutboundPolicy } from "nish/net/outbound";
 *     import { HttpOptions } from "nish/net/http-client";
 *
 *     const options = new HttpOptions();
 *     options.outbound = new OutboundPolicy();
 *
 * **The check is on the address, after the lookup.** A name is never judged
 * by its text: `nish/net/http-client` resolves it, drops every address
 * `outboundAddressAllowed` refuses, and connects only to the bytes it kept,
 * with no second lookup, so a name whose answer changes between a check and
 * a connect (DNS rebinding) cannot move the connection. Every redirect hop is
 * dialled the same way, so a public URL that redirects inward is refused at
 * the hop.
 *
 * **Public** is the IANA special-purpose registries read strictly
 * (RFC 6890, and the registries at iana.org/assignments/iana-ipv4-special-registry
 * and iana-ipv6-special-registry). An IPv4 address is public unless it is in
 * `0/8`, `10/8`, `100.64/10`, `127/8`, `169.254/16`, `172.16/12`,
 * `192.0.0/24`, `192.0.2/24`, `192.88.99/24`, `192.168/16`, `198.18/15`,
 * `198.51.100/24`, `203.0.113/24`, `224/4` or `240/4` (the broadcast
 * address included), or is `168.63.129.16`, a cloud host's metadata and DNS
 * service. An IPv6 address is public only in `2000::/3`, and then not in
 * `2001::/23` (Teredo included), `2001:db8::/32` or `3fff::/20`; `2002::/16`
 * (6to4) and `64:ff9b::/96` (NAT64) are judged by the IPv4 address they carry,
 * as is `::ffff:0:0/96`, the form every IPv4 address takes in `nish:net`.
 * Everything else, `::1`, `fc00::/7` and `fe80::/10` among it, is refused.
 *
 * `permit` lets a trusted prefix through anyway (an internal API the program
 * is meant to reach), and `allowHost` narrows the names a URL may carry. The
 * policy also caps a fetch's redirects, total time and body, and the client
 * uses the stricter of these and its own options.
 *
 * Private helpers share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e), which is why each one carries the module's name.
 *
 * Written from RFC 6890, RFC 4291, RFC 6052, RFC 3056, RFC 4380 and the IANA
 * special-purpose address registries, not ported from another implementation.
 */
import { copyBytes } from "nish/bytes"
import { DNS_ADDRESS_BYTES } from "nish/net/dns-message"
import { dnsParseAddress } from "nish/net/dns-config"

/** The bytes of one `permit` entry: sixteen of address, then the prefix length in bits. */
const OUTBOUND_PERMIT_BYTES: i32 = 17

/** Where an IPv4 address starts in its sixteen-byte mapped form. */
const OUTBOUND_V4_AT: i32 = 12

/**
 * What a client that fetches untrusted URLs may reach. A new policy refuses
 * every address that is not public, allows any host name, and caps a fetch
 * at 5 redirects, 30 seconds and an 8 MiB body.
 */
export class OutboundPolicy {
  // Declared widest first, so no byte of a policy is padding.
  /** The names a URL may carry, lower-cased; empty for any. See `allowHost`. */
  allowHosts: string[]
  /** `OUTBOUND_PERMIT_BYTES` per prefix `permit` let through. */
  permitted: u8[]
  /** A fetch's body is cut off past this, or past the client's own cap if lower. */
  maxBodyBytes: i64 = 8388608
  /** A whole fetch ends after this, or the client's own budget if lower; 0 or less for the client's alone. */
  totalTimeoutMs: i32 = 30000
  /** At most this many redirects, or the client's own limit if lower. */
  maxRedirects: i32 = 5

  constructor() {
    this.allowHosts = []
    this.permitted = []
  }

  /**
   * Adds `name` to the hosts a URL may name; once any is added, a URL (or a
   * redirect) naming another is refused before it is looked up. Case and one
   * trailing dot do not matter. A leading dot (`.example.com`) allows the
   * name and every name under it. An address literal matches only itself,
   * as the URL writes it (`::1` or `[::1]`, `127.0.0.1`), never as a suffix.
   */
  allowHost(name: string): void {
    let entry: string = outboundLower(name)
    if (entry.startsWith("[") && entry.endsWith("]")) {
      entry = entry.substring(1, toI32(entry.length) - 1)
    }
    this.allowHosts.push(outboundTrimDot(entry))
  }

  /**
   * Lets the addresses in `cidr` through though they are not public:
   * `10.1.2.0/24`, `fd00:1::/64`, or one address alone. False, with nothing
   * added, when `cidr` is not an address and a prefix length that fits it.
   */
  permit(cidr: string): boolean {
    const n: i32 = toI32(cidr.length)
    const slash: i32 = toI32(cidr.indexOf("/"))
    const end: i32 = slash >= 0 ? slash : n
    const text: u8[] = new Array<u8>(end)
    let v4: boolean = true
    for (let i: i32 = 0; i < toI32(text.length) && i < n; i += 1) {
      const c: i32 = toI32(cidr.charCodeAt(i))
      if (c > 127) {
        return false
      }
      v4 = v4 && c !== 58
      text[i] = toU8(c)
    }
    const address: u8[] = new Array<u8>(DNS_ADDRESS_BYTES)
    if (end === 0 || !dnsParseAddress(text, 0, end, address, 0, 0)) {
      return false
    }
    const width: i32 = v4 ? 32 : 128
    let bits: i32 = width
    if (slash >= 0) {
      bits = outboundDecimal(cidr, slash + 1, n)
      if (bits < 0 || bits > width) {
        return false
      }
    }
    for (let i: i32 = 0; i < 16 && i < toI32(address.length); i += 1) {
      this.permitted.push(address[i])
    }
    this.permitted.push(toU8(v4 ? bits + 96 : bits))
    return true
  }
}

/**
 * Whether the sixteen address bytes at `addr[off]` are public, as the module
 * comment defines it. Panics when sixteen bytes do not fit there.
 */
export const outboundAddressPublic = (addr: u8[], off: i32): boolean => {
  if (off < 0 || off > toI32(addr.length) - 16) {
    panic("outboundAddressPublic: sixteen bytes do not fit at off")
  }
  const carried: i32 = outboundCarriedV4(addr, off)
  if (carried >= 0) {
    return outboundV4Public(addr, carried)
  }
  const b0: i32 = toI32(addr[off])
  const b1: i32 = toI32(addr[off + 1])
  const b2: i32 = toI32(addr[off + 2])
  const b3: i32 = toI32(addr[off + 3])
  if ((b0 & 0xe0) !== 0x20) {
    // Outside 2000::/3: loopback, unspecified, unique local, link-local, multicast, the rest.
    return false
  }
  if (b0 === 0x20 && b1 === 0x01 && (b2 & 0xfe) === 0) {
    // 2001::/23, IETF protocol assignments, Teredo's 2001::/32 among them.
    return false
  }
  if (b0 === 0x20 && b1 === 0x01 && b2 === 0x0d && b3 === 0xb8) {
    // 2001:db8::/32, documentation.
    return false
  }
  // 3fff::/20, documentation (RFC 9637).
  return !(b0 === 0x3f && b1 === 0xff && (b2 & 0xf0) === 0)
}

/** Whether `policy` lets a connection go to the sixteen address bytes at `addr[off]`. */
export const outboundAddressAllowed = (policy: OutboundPolicy, addr: u8[], off: i32): boolean => {
  if (outboundPermitted(policy, addr, off)) {
    return true
  }
  const carried: i32 = outboundCarriedV4(addr, off)
  if (carried < 0) {
    return outboundAddressPublic(addr, off)
  }
  if (!outboundMapped(addr, off) && toI32(policy.permitted.length) > 0) {
    // A permit names an IPv4 prefix in its ::ffff: form, so try the address a NAT64 or 6to4 one carries in that form too.
    const mapped: u8[] = new Array<u8>(16)
    mapped[10] = toU8(255)
    mapped[11] = toU8(255)
    copyBytes(mapped, OUTBOUND_V4_AT, addr, carried, 4)
    if (outboundPermitted(policy, mapped, 0)) {
      return true
    }
  }
  return outboundV4Public(addr, carried)
}

/**
 * Keeps the addresses of `count` `DNS_ADDRESS_BYTES` records in `addresses`
 * that `policy` allows, moved to the front in their order, and answers how
 * many. Refused records are left behind them, so the caller can name one.
 */
export const outboundFilter = (policy: OutboundPolicy, addresses: u8[], count: i32): i32 => {
  if (count < 0 || count * DNS_ADDRESS_BYTES > toI32(addresses.length)) {
    panic("outboundFilter: count records do not fit in addresses")
  }
  let kept: i32 = 0
  for (let i: i32 = 0; i < count; i += 1) {
    if (!outboundAddressAllowed(policy, addresses, i * DNS_ADDRESS_BYTES)) {
      continue
    }
    if (i !== kept) {
      // Swap, so the refused record stays in the list for an error to name.
      for (let k: i32 = 0; k < DNS_ADDRESS_BYTES; k += 1) {
        const held: u8 = addresses[kept * DNS_ADDRESS_BYTES + k]
        addresses[kept * DNS_ADDRESS_BYTES + k] = addresses[i * DNS_ADDRESS_BYTES + k]
        addresses[i * DNS_ADDRESS_BYTES + k] = held
      }
    }
    kept += 1
  }
  return kept
}

/**
 * Whether `policy` lets a URL name `host`, as the URL parser gives it
 * (lower-cased, an IPv6 literal without its brackets). Any host when the
 * policy names none.
 */
export const outboundHostAllowed = (policy: OutboundPolicy, host: string): boolean => {
  if (policy.allowHosts.length === 0) {
    return true
  }
  const name: string = outboundTrimDot(outboundLower(host))
  const literal: boolean = outboundIsLiteral(name)
  for (let i: i32 = 0; i < toI32(policy.allowHosts.length); i += 1) {
    const entry: string = policy.allowHosts[i]
    if (entry === name) {
      return true
    }
    if (
      !literal &&
      entry.startsWith(".") &&
      (name.endsWith(entry) || (toI32(name.length) + 1 === toI32(entry.length) && entry.endsWith(name)))
    ) {
      return true
    }
  }
  return false
}

/** The sixteen address bytes at `addr[off]` as text: dotted for an IPv4 address, eight hex groups otherwise. */
export const outboundAddressText = (addr: u8[], off: i32): string => {
  if (outboundMapped(addr, off)) {
    const at: i32 = off + OUTBOUND_V4_AT
    return `${addr[at]}.${addr[at + 1]}.${addr[at + 2]}.${addr[at + 3]}`
  }
  // Eight groups of at most four digits and seven colons.
  const out: u8[] = new Array<u8>(39)
  let at: i32 = 0
  for (let g: i32 = 0; g < 8; g += 1) {
    const v: i32 = toI32(addr[off + 2 * g]) * 256 + toI32(addr[off + 2 * g + 1])
    if (g > 0 && at < toI32(out.length)) {
      out[at] = toU8(58)
      at += 1
    }
    for (let shift: i32 = 12; shift >= 0; shift -= 4) {
      const d: i32 = (v >> shift) & 15
      if (v >> shift !== 0 || shift === 0) {
        if (at < toI32(out.length)) {
          out[at] = toU8(d < 10 ? 48 + d : 87 + d)
          at += 1
        }
      }
    }
  }
  return String.fromBytes(out, 0, at)
}

// --- helpers -----------------------------------------------------------------

/** Whether one of `policy`'s permits covers the sixteen address bytes at `addr[off]`. */
const outboundPermitted = (policy: OutboundPolicy, addr: u8[], off: i32): boolean => {
  const p: u8[] = policy.permitted
  for (let at: i32 = 0; at + OUTBOUND_PERMIT_BYTES <= toI32(p.length); at += OUTBOUND_PERMIT_BYTES) {
    const bitsAt: i32 = at + 16
    if (bitsAt >= 0 && bitsAt < toI32(p.length) && outboundPrefixMatch(p, at, toI32(p[bitsAt]), addr, off)) {
      return true
    }
  }
  return false
}

/** Whether the sixteen address bytes at `addr[off]` are an IPv4-mapped address, `::ffff:0:0/96`. */
const outboundMapped = (addr: u8[], off: i32): boolean =>
  outboundZeros(addr, off, 10) && addr[off + 10] === toU8(255) && addr[off + 11] === toU8(255)

/**
 * Where the IPv4 address that the sixteen address bytes at `addr[off]` carry
 * starts, or -1 for none: `::ffff:a.b.c.d`, how nish:net writes every IPv4
 * address; `64:ff9b::/96`, the NAT64 well-known prefix (RFC 6052), in its
 * last four bytes; `2002::/16`, 6to4 (RFC 3056), in the four after the prefix.
 */
const outboundCarriedV4 = (addr: u8[], off: i32): i32 => {
  if (outboundMapped(addr, off)) {
    return off + OUTBOUND_V4_AT
  }
  const b0: i32 = toI32(addr[off])
  const b1: i32 = toI32(addr[off + 1])
  if (
    b0 === 0 &&
    b1 === 0x64 &&
    addr[off + 2] === toU8(0xff) &&
    addr[off + 3] === toU8(0x9b) &&
    outboundZeros(addr, off + 4, 8)
  ) {
    return off + OUTBOUND_V4_AT
  }
  if (b0 === 0x20 && b1 === 0x02) {
    return off + 2
  }
  return -1
}

/** Whether the IPv4 address in the four bytes at `addr[at]` is public. */
const outboundV4Public = (addr: u8[], at: i32): boolean => {
  const a: i32 = toI32(addr[at])
  const b: i32 = toI32(addr[at + 1])
  const c: i32 = toI32(addr[at + 2])
  const d: i32 = toI32(addr[at + 3])
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    (a === 168 && b === 63 && c === 129 && d === 16)
  )
}

/** Whether the `n` bytes at `b[at]` are all zero. */
const outboundZeros = (b: u8[], at: i32, n: i32): boolean => {
  for (let i: i32 = 0; i < n; i += 1) {
    if (b[at + i] !== toU8(0)) {
      return false
    }
  }
  return true
}

/** Whether the first `bits` bits of `p[at]` and `addr[off]` agree. */
const outboundPrefixMatch = (p: u8[], at: i32, bits: i32, addr: u8[], off: i32): boolean => {
  const whole: i32 = bits >> 3
  for (let i: i32 = 0; i < whole; i += 1) {
    if (p[at + i] !== addr[off + i]) {
      return false
    }
  }
  const rest: i32 = bits & 7
  if (rest === 0) {
    return true
  }
  const mask: i32 = (toI32(0xff) << (8 - rest)) & toI32(0xff)
  return (toI32(p[at + whole]) & mask) === (toI32(addr[off + whole]) & mask)
}

/** `s[from..to)` as a decimal of one to three digits, or -1. */
const outboundDecimal = (s: string, from: i32, to: i32): i32 => {
  if (to <= from || to - from > 3) {
    return -1
  }
  let v: i32 = 0
  for (let i: i32 = from; i < to; i += 1) {
    const c: i32 = toI32(s.charCodeAt(i))
    if (c < 48 || c > 57) {
      return -1
    }
    v = v * 10 + c - 48
  }
  return v
}

/** Whether `name` is an address literal: it holds a colon, or its last label is all digits. */
const outboundIsLiteral = (name: string): boolean => {
  if (name.indexOf(":") >= 0) {
    return true
  }
  const n: i32 = toI32(name.length)
  let i: i32 = n - 1
  while (i >= 0 && name.charCodeAt(i) >= 48 && name.charCodeAt(i) <= 57) {
    i -= 1
  }
  return i < n - 1 && (i < 0 || name.charCodeAt(i) === 46)
}

/** `s` with A to Z lower-cased. */
const outboundLower = (s: string): string => {
  const n: i32 = toI32(s.length)
  const out: u8[] = new Array<u8>(n)
  for (let i: i32 = 0; i < toI32(out.length) && i < n; i += 1) {
    const c: i32 = toI32(s.charCodeAt(i))
    out[i] = c >= 65 && c <= 90 ? toU8(c + 32) : toU8(c)
  }
  return String.fromBytes(out, 0, n)
}

/** `s` without one trailing dot. */
const outboundTrimDot = (s: string): string => {
  const n: i32 = toI32(s.length)
  return n > 0 && s.charCodeAt(n - 1) === 46 ? s.substring(0, n - 1) : s
}
