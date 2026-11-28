/**
 * `nish/net/outbound` — the policy for a program that fetches URLs it did
 * not choose: a webhook sender, a link previewer, an importer that takes a
 * URL from a form. Without one, such a program is a proxy into its own
 * network for whoever supplies the URL (server-side request forgery): a URL
 * naming `127.0.0.1`, `169.254.169.254` or a name that resolves to either
 * reaches services that trust the program's address.
 *
 *     import { OutboundPolicy } from "nish/net/outbound";
 *     import { HttpOptions } from "nish/net/fetch";
 *
 *     const options = new HttpOptions();
 *     options.outbound = new OutboundPolicy();
 *
 * **The check is on the address, after the lookup.** A name is never judged
 * by its text: `nish/net/fetch` resolves it, drops every address
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
import { tryCopyBytes } from "nish/bytes"
import { DNS_ADDRESS_BYTES } from "nish/net/dns-message"
import { dnsParseAddress } from "nish/net/dns-config"

/** The bytes of one `permit` entry: sixteen of address, then the prefix length in bits. */
const OUTBOUND_PERMIT_BYTES: i32 = 17

/** The longest address text `permit` reads; an IPv6 address with an IPv4 tail takes 45 bytes. */
const OUTBOUND_TEXT_MAX: i32 = 64

/** Where an IPv4 address starts in its sixteen-byte mapped form. */
const OUTBOUND_V4_AT: i32 = 12

/**
 * What a client that fetches untrusted URLs may reach. A new policy refuses
 * every address that is not public, allows any host name, and caps a fetch
 * at 5 redirects, 30 seconds and an 8 MiB body.
 */
export class OutboundPolicy {
  // Declared widest first, so no byte of a policy is padding.
  /** The names a URL may carry, lower-cased; empty for any. See `allowHost`. @internal */
  allowHosts: string[]
  /** `OUTBOUND_PERMIT_BYTES` per prefix `permit` let through. */
  permitted: u8[]
  /** A fetch's body is cut off past this, or past the client's own cap if lower. */
  maxBodyBytes: i64 = 8388608
  /** A whole fetch ends after this, or the client's own budget if lower; 0 or less for the client's alone. */
  totalTimeoutMs: i32 = 30000
  /** At most this many redirects, or the client's own limit if lower. */
  maxRedirects: i32 = 5

  /**
   * Makes the default policy the class describes: public addresses only, any
   * host name, and the default limits.
   */
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
   * @param name The host name, `.`-led for a whole domain, or an address literal.
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
   * @param cidr The address, or the address and its prefix length after a `/`.
   * @returns Whether the prefix was added.
   */
  permit(cidr: string): boolean {
    const n: i32 = toI32(cidr.length)
    const slash: i32 = toI32(cidr.indexOf("/"))
    const end: i32 = slash >= 0 ? slash : n
    if (end <= 0 || end > OUTBOUND_TEXT_MAX) {
      return false
    }
    const text: u8[] = new Array<u8>(OUTBOUND_TEXT_MAX)
    let v4: boolean = true
    for (let i: i32 = 0; i < end && i < n && i < toI32(text.length); i += 1) {
      const c: i32 = toI32(cidr.charCodeAt(i))
      if (c > 127) {
        return false
      }
      v4 = v4 && c !== 58
      text[i] = toU8(c)
    }
    const address: u8[] = new Array<u8>(DNS_ADDRESS_BYTES)
    if (!dnsParseAddress(text, 0, end, address, 0, 0)) {
      return false
    }
    let bits: i32 = v4 ? 32 : 128
    if (slash >= 0 && slash < n) {
      bits = outboundDecimal(cidr, slash + 1, n)
    }
    if (bits < 0) {
      return false
    }
    // An IPv4 prefix is kept in its ::ffff: form, 96 bits longer.
    let stored: i32 = bits
    if (v4) {
      if (bits > 32) {
        return false
      }
      stored = bits + 96
    } else if (bits > 128) {
      return false
    }
    for (let i: i32 = 0; i < 16 && i < toI32(address.length); i += 1) {
      this.permitted.push(address[i])
    }
    this.permitted.push(toU8(stored))
    return true
  }
}

/**
 * Whether the sixteen address bytes at `addr[off]` are public, as the module
 * comment defines it. False when sixteen bytes do not fit there.
 *
 * @param addr The array holding the address; an IPv4 one in its `::ffff:` form, as nish:net writes it.
 * @param off Where the address's sixteen bytes start in `addr`.
 * @returns True for a public address. An IPv4 one carried by NAT64 or 6to4 is judged as that IPv4 address.
 */
export const outboundAddressPublic = (addr: u8[], off: i32): boolean => {
  const a: u8[] | null = outboundSixteen(addr, off)
  return a !== null && outboundPublic(a)
}

/**
 * Whether `policy` lets a connection go to the sixteen address bytes at
 * `addr[off]`: a prefix it `permit`s, or else a public address. False when
 * sixteen bytes do not fit there.
 *
 * @param policy The policy whose permits are checked first.
 * @param addr The array holding the address; an IPv4 one in its `::ffff:` form, as nish:net writes it.
 * @param off Where the address's sixteen bytes start in `addr`.
 * @returns True when a connection may go there. An IPv4 address carried by NAT64 or 6to4 is judged as that address, by a permit too.
 */
export const outboundAddressAllowed = (policy: OutboundPolicy, addr: u8[], off: i32): boolean => {
  const a: u8[] | null = outboundSixteen(addr, off)
  if (a === null) {
    return false
  }
  if (outboundPermitted(policy, a)) {
    return true
  }
  const carried: i32 = outboundCarriedV4(a)
  if (carried < 0) {
    return outboundPublic(a)
  }
  if (!outboundMapped(a) && toI32(policy.permitted.length) > 0) {
    // A permit names an IPv4 prefix in its ::ffff: form, so try the address a NAT64 or 6to4 one carries in that form too.
    const mapped: u8[] = new Array<u8>(16)
    mapped[10] = toU8(255)
    mapped[11] = toU8(255)
    if (tryCopyBytes(mapped, OUTBOUND_V4_AT, a, carried, 4) && outboundPermitted(policy, mapped)) {
      return true
    }
  }
  return outboundV4Public(a, carried)
}

/**
 * Keeps the addresses of `count` `DNS_ADDRESS_BYTES` records in `addresses`
 * that `policy` allows, moved to the front in their order, and answers how
 * many. Refused records are left behind them, so the caller can name one.
 *
 * @param policy The policy each address is checked against, as `outboundAddressAllowed` checks it.
 * @param addresses The records, each sixteen address bytes and a two-byte port, reordered in place.
 * @param count How many records `addresses` holds from its start; records past `addresses`' end are not read, and a negative count keeps none.
 * @returns How many records were kept, now `addresses`' first ones; 0 when every one was refused.
 */
export const outboundFilter = (policy: OutboundPolicy, addresses: u8[], count: i32): i32 => {
  const held: u8[] = new Array<u8>(DNS_ADDRESS_BYTES)
  // Where the next kept record goes, and where the record checked now starts.
  let keptAt: i32 = 0
  let at: i32 = 0
  const n: i32 = toI32(addresses.length)
  for (let i: i32 = 0; i < count && at <= n - DNS_ADDRESS_BYTES; i += 1) {
    if (outboundAddressAllowed(policy, addresses, at)) {
      // Swap, so the refused record stays in the list for an error to name.
      // Both records fit (`keptAt` is at most `at`), so no copy can refuse.
      if (
        keptAt !== at &&
        !(
          tryCopyBytes(held, 0, addresses, keptAt, DNS_ADDRESS_BYTES) &&
          tryCopyBytes(addresses, keptAt, addresses, at, DNS_ADDRESS_BYTES) &&
          tryCopyBytes(addresses, at, held, 0, DNS_ADDRESS_BYTES)
        )
      ) {
        break
      }
      // `keptAt` is at most `at`, which is at most the length less a record,
      // so the step always fits; the test restates that for the bounds
      // proof, with `DNS_ADDRESS_BYTES` (18) spelled as a literal it reads.
      if (keptAt < 0 || keptAt > n - 18) {
        break
      }
      keptAt = keptAt + 18
    }
    // The loop test already keeps `at` at most the length less a record;
    // restated with the literal for the same proof.
    if (at < 0 || at > n - 18) {
      break
    }
    at = at + 18
  }
  return keptAt / DNS_ADDRESS_BYTES
}

/**
 * Whether `policy` lets a URL name `host`, as the URL parser gives it
 * (lower-cased, an IPv6 literal without its brackets). Any host when the
 * policy names none.
 *
 * @param policy The policy whose `allowHost` names are checked.
 * @param host The URL's host; its case and one trailing dot do not matter.
 * @returns True when the host is one the policy names, or under a `.`-led name it allows, or the policy names none.
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
      (name.endsWith(entry) || (toI32(entry.length) - 1 === toI32(name.length) && entry.endsWith(name)))
    ) {
      return true
    }
  }
  return false
}

/**
 * The sixteen address bytes at `addr[off]` as text, for an error to name.
 *
 * @param addr The array holding the address.
 * @param off Where the address's sixteen bytes start in `addr`.
 * @returns Dotted decimal for an IPv4 address in its `::ffff:` form, otherwise all eight lower-case hex groups with no `::` shortening; empty when sixteen bytes do not fit there.
 */
export const outboundAddressText = (addr: u8[], off: i32): string => {
  const a: u8[] | null = outboundSixteen(addr, off)
  return a === null ? "" : outboundText(a)
}

/** The address in `a`, `outboundSixteen`'s, as `outboundAddressText` writes it. */
const outboundText = (a: u8[]): string => {
  const mapped: boolean = outboundMapped(a)
  if (toI32(a.length) < 16) {
    return ""
  }
  if (mapped) {
    return `${a[12]}.${a[13]}.${a[14]}.${a[15]}`
  }
  const parts: string[] = []
  let high: u8 = toU8(0)
  for (let i: i32 = 0; i < 16 && i < toI32(a.length); i += 1) {
    if ((i & 1) === 0) {
      high = a[i]
      continue
    }
    const v: i32 = toI32(high) * 256 + toI32(a[i])
    if (i > 1) {
      parts.push(":")
    }
    for (let shift: i32 = 12; shift >= 0; shift -= 4) {
      const d: i32 = (v >> shift) & 15
      if (v >> shift !== 0 || shift === 0) {
        parts.push(String.fromCharCode(toU8(d < 10 ? 48 + d : 87 + d)))
      }
    }
  }
  return parts.join("")
}

// --- helpers -----------------------------------------------------------------
// Each takes an address as an array of its own, `outboundSixteen`'s, so its
// reads are proven against that array's length rather than a caller's offset.

/** The sixteen address bytes at `addr[off]` in an array of their own, or null when they do not fit there. */
const outboundSixteen = (addr: u8[], off: i32): u8[] | null => {
  const a: u8[] = new Array<u8>(16)
  return tryCopyBytes(a, 0, addr, off, 16) ? a : null
}

/** Whether the address in `a`, `outboundSixteen`'s, is public, as `outboundAddressPublic` answers. */
const outboundPublic = (a: u8[]): boolean => {
  if (toI32(a.length) < 16) {
    return false
  }
  const carried: i32 = outboundCarriedV4(a)
  if (carried >= 0) {
    return outboundV4Public(a, carried)
  }
  const b0: i32 = toI32(a[0])
  const b1: i32 = toI32(a[1])
  const b2: i32 = toI32(a[2])
  const b3: i32 = toI32(a[3])
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

/** Whether one of `policy`'s permits covers the address in `a`. */
const outboundPermitted = (policy: OutboundPolicy, a: u8[]): boolean => {
  const p: u8[] = policy.permitted
  const entry: u8[] = new Array<u8>(OUTBOUND_PERMIT_BYTES)
  const n: i32 = toI32(p.length)
  let at: i32 = 0
  while (at >= 0 && at <= n - OUTBOUND_PERMIT_BYTES) {
    if (tryCopyBytes(entry, 0, p, at, OUTBOUND_PERMIT_BYTES) && outboundPrefixMatch(entry, a)) {
      return true
    }
    // At most the length less a permit before, so the sum fits; the test
    // restates that for the bounds proof, with `OUTBOUND_PERMIT_BYTES` (17)
    // spelled as a literal it reads.
    if (at > n - 17) {
      break
    }
    at = at + 17
  }
  return false
}

/** Whether the address in `a` is an IPv4-mapped address, `::ffff:0:0/96`. */
const outboundMapped = (a: u8[]): boolean =>
  toI32(a.length) >= 16 && outboundZeros(a, 0, 10) && a[10] === toU8(255) && a[11] === toU8(255)

/**
 * Where the IPv4 address that the address in `a` carries starts, or -1 for
 * none: `::ffff:a.b.c.d`, how nish:net writes every IPv4 address;
 * `64:ff9b::/96`, the NAT64 well-known prefix (RFC 6052), in its last four
 * bytes; `2002::/16`, 6to4 (RFC 3056), in the four after the prefix.
 */
const outboundCarriedV4 = (a: u8[]): i32 => {
  if (toI32(a.length) < 16) {
    return -1
  }
  if (outboundMapped(a)) {
    return OUTBOUND_V4_AT
  }
  const b0: i32 = toI32(a[0])
  const b1: i32 = toI32(a[1])
  if (b0 === 0 && b1 === 0x64 && a[2] === toU8(0xff) && a[3] === toU8(0x9b) && outboundZeros(a, 4, 12)) {
    return OUTBOUND_V4_AT
  }
  if (b0 === 0x20 && b1 === 0x02) {
    return 2
  }
  return -1
}

/** Whether the IPv4 address in the four bytes at `a[at]` is public; false when four do not fit there. */
const outboundV4Public = (a: u8[], at: i32): boolean => {
  if (at < 0 || at > toI32(a.length) - 4) {
    return false
  }
  const x: i32 = toI32(a[at])
  const b: i32 = toI32(a[at + 1])
  const c: i32 = toI32(a[at + 2])
  const d: i32 = toI32(a[at + 3])
  return !(
    x === 0 ||
    x === 10 ||
    x === 127 ||
    x >= 224 ||
    (x === 100 && b >= 64 && b <= 127) ||
    (x === 169 && b === 254) ||
    (x === 172 && b >= 16 && b <= 31) ||
    (x === 192 && b === 0 && (c === 0 || c === 2)) ||
    (x === 192 && b === 88 && c === 99) ||
    (x === 192 && b === 168) ||
    (x === 198 && (b === 18 || b === 19)) ||
    (x === 198 && b === 51 && c === 100) ||
    (x === 203 && b === 0 && c === 113) ||
    (x === 168 && b === 63 && c === 129 && d === 16)
  )
}

/** Whether the bytes `b[from..to)` are all zero; a range past `b`'s end is not. */
const outboundZeros = (b: u8[], from: i32, to: i32): boolean => {
  if (from < 0 || to > toI32(b.length)) {
    return false
  }
  for (let i: i32 = from; i < to; i += 1) {
    if (b[i] !== toU8(0)) {
      return false
    }
  }
  return true
}

/**
 * Whether the address in `a` is under the permit `entry`, one
 * `OUTBOUND_PERMIT_BYTES` record: its first prefix-length bits agree with
 * the entry's sixteen address bytes. Never for a length past 128.
 */
const outboundPrefixMatch = (entry: u8[], a: u8[]): boolean => {
  if (toI32(entry.length) <= 16 || toI32(a.length) < 16) {
    return false
  }
  const bits: i32 = toI32(entry[16])
  if (bits > 128) {
    return false
  }
  const whole: i32 = bits >> 3
  for (let i: i32 = 0; i < whole && i < 16; i += 1) {
    if (entry[i] !== a[i]) {
      return false
    }
  }
  const rest: i32 = bits & 7
  if (rest === 0 || whole >= 16) {
    return true
  }
  const mask: i32 = (toI32(0xff) << (8 - rest)) & toI32(0xff)
  return (toI32(entry[whole]) & mask) === (toI32(a[whole]) & mask)
}

/** `s[from..to)` as a decimal of one to three digits, or -1. */
const outboundDecimal = (s: string, from: i32, to: i32): i32 => {
  if (to <= from || to - from > 3) {
    return -1
  }
  // Unsigned, so the prover need not carry `v`'s bound round the loop: three
  // digits make at most 999.
  let v: u32 = toU32(0)
  for (let i: i32 = from; i < to; i += 1) {
    const c: i32 = toI32(s.charCodeAt(i))
    if (c < 48 || c > 57) {
      return -1
    }
    v = v * toU32(10) + toU32(c - 48)
  }
  return toI32(v)
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
  const parts: string[] = []
  for (let i: i32 = 0; i < toI32(s.length); i += 1) {
    const c: i32 = toI32(s.charCodeAt(i))
    parts.push(String.fromCharCode(toU8(c >= 65 && c <= 90 ? c + 32 : c)))
  }
  return parts.join("")
}

/** `s` without one trailing dot. */
const outboundTrimDot = (s: string): string => {
  const n: i32 = toI32(s.length)
  return n > 0 && s.charCodeAt(n - 1) === 46 ? s.substring(0, n - 1) : s
}
