/**
 * `nish/net/dns-config` — `/etc/resolv.conf` and `/etc/hosts`, read from bytes
 * the caller already has into fixed tables.
 *
 * Both files are local, but neither is trusted to be small or well formed: a
 * container image, a DHCP client or a VPN writes them, and a resolver that
 * believed a 40,000-entry search list or a line a megabyte long would spend a
 * lookup on it. This module reads each into tables of fixed, documented size,
 * and counts what did not fit rather than growing:
 *
 *     import { DnsConfig, DnsHosts, dnsHostsFind, dnsParseHosts, dnsParseResolvConf } from "nish/net/dns-config"
 *     import { DNS_ADDRESS_BYTES, DNS_TYPE_A } from "nish/net/dns-message"
 *     import { readFileBytesSync } from "nish:fs"
 *
 *     const config: DnsConfig = new DnsConfig()
 *     const resolv: u8[] | null = readFileBytesSync("/etc/resolv.conf")
 *     if (resolv !== null) {
 *       dnsParseResolvConf(resolv, 0, toI32(resolv.length), config)
 *     } else {
 *       // An empty file still gives the defaults; a fresh DnsConfig has no servers.
 *       dnsParseResolvConf(new Array<u8>(0), 0, 0, config)
 *     }
 *     // config.servers[i * 18, +18) for i < config.serverCount, on port 53
 *     const hosts: DnsHosts = new DnsHosts()
 *     const file: u8[] | null = readFileBytesSync("/etc/hosts")
 *     if (file !== null) {
 *       dnsParseHosts(file, 0, toI32(file.length), hosts)
 *     }
 *     const out: u8[] = new Array<u8>(8 * DNS_ADDRESS_BYTES)
 *     const found: i32 = dnsHostsFind(hosts, "localhost", DNS_TYPE_A, 80, out, 8)
 *     // out[0, found * 18): the A addresses /etc/hosts gives localhost, on port 80
 *
 * **resolv.conf** is read as glibc reads it, minus what a stub resolver does
 * not use. `nameserver` takes one IPv4 or IPv6 literal (no zone), and the first
 * `DNS_MAX_SERVERS` (3) are kept; `search` and `domain` each replace the list,
 * so the last one wins, and it holds at most `DNS_MAX_SEARCH` (6) domains and
 * `DNS_MAX_SEARCH_BYTES` (256) bytes; `options` reads `ndots:n` (clamped to 0
 * to 15), `timeout:n` (1 to 30 seconds) and `attempts:n` (1 to 5) and ignores
 * every other option. With no nameserver line that holds an address, the
 * servers are 127.0.0.1 and ::1, as glibc's are.
 *
 * **hosts** is an address and then its names, one entry a line. At most
 * `DNS_HOSTS_MAX_ENTRIES` entries and `DNS_HOSTS_MAX_NAMES` names are kept,
 * in at most `DNS_HOSTS_MAX_NAME_BYTES` bytes; a name past a cap is dropped and
 * counted. Names are kept in lowercase and found without case, with one
 * trailing `.` ignored on either side; an IPv4 address answers only an A
 * lookup and an IPv6 address only an AAAA one, `::ffff:a.b.c.d` being IPv4.
 *
 * **In both**, `#` and `;` start a comment that runs to the end of the line, a
 * line no directive names is ignored, and a line longer than
 * `DNS_CONFIG_MAX_LINE` bytes is skipped whole and counted in
 * `skippedLines`, never cut to a shorter line that means something else.
 * A window outside its array is a bug in the caller and panics; nothing in a
 * file does.
 *
 * Addresses are the 18-byte form of `docs/LANGUAGE.md`, which
 * `dnsParseAddress` writes from a literal. The record of what this module
 * refuses and why is `docs/security/dns.md`.
 */
import { setU16BE } from "nish/bytes"
import { DNS_ADDRESS_BYTES, DNS_TYPE_A, DNS_TYPE_AAAA } from "nish/net/dns-message"

/** How many `nameserver` lines are kept; glibc's MAXNS. */
export const DNS_MAX_SERVERS: i32 = 3
/** How many search domains are kept. */
export const DNS_MAX_SEARCH: i32 = 6
/** How many bytes the search domains may take together. */
export const DNS_MAX_SEARCH_BYTES: i32 = 256
/** The longest line either parser reads; a longer one is skipped whole. */
export const DNS_CONFIG_MAX_LINE: i32 = 1024
/** The port every `nameserver` address carries. */
export const DNS_PORT: i32 = 53
/** The `ndots` without an option: a name with a dot is tried as it stands first. */
export const DNS_DEFAULT_NDOTS: i32 = 1
/** The highest `ndots:n` kept; a higher one is clamped to it, as glibc clamps. */
export const DNS_MAX_NDOTS: i32 = 15
/** The `timeout` without an option, in seconds: how long one server's reply is waited for. */
export const DNS_DEFAULT_TIMEOUT: i32 = 5
/** The highest `timeout:n` kept, in seconds; the lowest is 1. */
export const DNS_MAX_TIMEOUT: i32 = 30
/** The `attempts` without an option: rounds through the server list before a lookup gives up. */
export const DNS_DEFAULT_ATTEMPTS: i32 = 2
/** The highest `attempts:n` kept; the lowest is 1. */
export const DNS_MAX_ATTEMPTS: i32 = 5

/** How many hosts lines, each an address with its names, are kept. */
export const DNS_HOSTS_MAX_ENTRIES: i32 = 256
/** How many names all hosts entries may hold together. */
export const DNS_HOSTS_MAX_NAMES: i32 = 1024
/** How many bytes those names may take together, 16 KiB. */
export const DNS_HOSTS_MAX_NAME_BYTES: i32 = 16384
/** The longest hosts name kept, the longest a DNS name can be. */
export const DNS_HOSTS_MAX_NAME: i32 = 253
// The parsers below compare against these caps as literals (each marked with its name):
// the bounds prover takes a bound from a literal in a comparison, not from a named constant.

const DNS_TAB: i32 = 9
const DNS_NEWLINE: i32 = 10
const DNS_RETURN: i32 = 13
const DNS_SPACE: i32 = 32
const DNS_HASH: i32 = 35
const DNS_DOT: i32 = 46
const DNS_COLON: i32 = 58
const DNS_SEMICOLON: i32 = 59

/** One resolv.conf, read by `dnsParseResolvConf`, made once and reusable. */
export class DnsConfig {
  /** `serverCount` addresses of `DNS_ADDRESS_BYTES` each, on `DNS_PORT`. */
  servers: u8[]
  /**
   * Sixteen bytes a literal is parsed into before it is kept, so a parse allocates nothing.
   * @internal Used by `dnsResolvLine` in this module.
   */
  scratch: u8[]
  /** How many addresses `servers` holds, 1 to `DNS_MAX_SERVERS` once a file is read. */
  serverCount: i32 = 0
  /** Nameserver lines past `DNS_MAX_SERVERS`, read and not kept. */
  droppedServers: i32 = 0
  /** The search domains, back to back, lowercase, without a trailing dot. */
  search: u8[]
  /** Where each of the `searchCount` domains starts in `search`, and its length. */
  searchStart: i32[]
  /** Each search domain's length in bytes, by the same index as `searchStart`. */
  searchLength: i32[]
  /** How many search domains are kept, 0 to `DNS_MAX_SEARCH`. */
  searchCount: i32 = 0
  /**
   * Search domains past `DNS_MAX_SEARCH` or `DNS_MAX_SEARCH_BYTES`, or empty (a bare `.`),
   * read and not kept.
   */
  droppedSearch: i32 = 0
  /** Dots a name needs to be tried as it stands before the search list, 0 to `DNS_MAX_NDOTS`. */
  ndots: i32
  /** Seconds to wait for one server's reply, 1 to `DNS_MAX_TIMEOUT`. */
  timeout: i32
  /** Rounds through the servers before giving up, 1 to `DNS_MAX_ATTEMPTS`. */
  attempts: i32
  /** Lines longer than `DNS_CONFIG_MAX_LINE`, skipped whole. */
  skippedLines: i32 = 0

  /**
   * Makes an empty configuration with no servers or search domains, and
   * `ndots`, `timeout` and `attempts` at resolv.conf's defaults (1, 5
   * seconds, 2).
   */
  constructor() {
    this.servers = new Array<u8>(54)
    this.scratch = new Array<u8>(16)
    this.search = new Array<u8>(DNS_MAX_SEARCH_BYTES)
    this.searchStart = new Array<i32>(DNS_MAX_SEARCH)
    this.searchLength = new Array<i32>(DNS_MAX_SEARCH)
    this.ndots = DNS_DEFAULT_NDOTS
    this.timeout = DNS_DEFAULT_TIMEOUT
    this.attempts = DNS_DEFAULT_ATTEMPTS
  }
}

/** One hosts file, read by `dnsParseHosts`, made once and reusable. */
export class DnsHosts {
  /**
   * `entryCount` addresses of `DNS_ADDRESS_BYTES` each, port 0.
   * @internal Used by `dnsHostsLine` and `dnsHostsFind` in this module.
   */
  addresses: u8[]
  /**
   * Every kept name, back to back, lowercase, without a trailing dot.
   * @internal Used by `dnsAddHostName` and `dnsHostNameIs` in this module.
   */
  names: u8[]
  /**
   * Sixteen bytes a literal is parsed into before it is kept, so a parse allocates nothing.
   * @internal Used by `dnsHostsLine` in this module.
   */
  scratch: u8[]
  /**
   * Where each of the `nameCount` names starts in `names`, its length, and its entry.
   * @internal Used by `dnsAddHostName` and `dnsHostNameIs` in this module.
   */
  nameStart: i32[]
  /** @internal Used by `dnsAddHostName` and `dnsHostNameIs` in this module. */
  nameLength: i32[]
  /** @internal Used by `dnsAddHostName` and `dnsHostsFind` in this module. */
  nameEntry: i32[]
  /** How many entries, each an address and its names, are kept, 0 to `DNS_HOSTS_MAX_ENTRIES`. */
  entryCount: i32 = 0
  /** How many names all the entries hold together, 0 to `DNS_HOSTS_MAX_NAMES`. */
  nameCount: i32 = 0
  /** How many bytes those names take together, 0 to `DNS_HOSTS_MAX_NAME_BYTES`. */
  nameBytes: i32 = 0
  /**
   * Lines with an address word and a name past the first `DNS_HOSTS_MAX_ENTRIES` entries,
   * read and not kept; their address is not parsed.
   */
  droppedEntries: i32 = 0
  /** Names past a cap, or longer than `DNS_HOSTS_MAX_NAME`, read and not kept. */
  droppedNames: i32 = 0
  /** Lines longer than `DNS_CONFIG_MAX_LINE`, skipped whole. */
  skippedLines: i32 = 0

  /**
   * Makes an empty table, sized for `DNS_HOSTS_MAX_ENTRIES` addresses and
   * `DNS_HOSTS_MAX_NAMES` names, for `dnsParseHosts` to fill.
   */
  constructor() {
    this.addresses = new Array<u8>(4608)
    this.names = new Array<u8>(DNS_HOSTS_MAX_NAME_BYTES)
    this.scratch = new Array<u8>(16)
    this.nameStart = new Array<i32>(DNS_HOSTS_MAX_NAMES)
    this.nameLength = new Array<i32>(DNS_HOSTS_MAX_NAMES)
    this.nameEntry = new Array<i32>(DNS_HOSTS_MAX_NAMES)
  }
}

/** Panics unless `[from, to)` lies inside an array of `size` elements. */
const dnsConfigCheckWindow = (size: i32, from: i32, to: i32, who: string): void => {
  if (from < 0 || to < from || to > size) {
    panic(who + ": the window is outside the array")
  }
}

/** `n + 1`, held at the i32 maximum: a count here moves once per byte of a file at most, so it never gets there. */
const dnsCount = (n: i32): i32 => (n > 2147483646 ? n : n + 1)

/** Whether `b` separates words on a line. */
const dnsIsBlank = (b: i32): boolean => b === DNS_SPACE || b === DNS_TAB || b === DNS_RETURN

/** The value of one hex digit, either case, or -1. */
const dnsHexValue = (b: i32): i32 => {
  if (b >= 48 && b <= 57) {
    return b - 48
  }
  if (b >= 65 && b <= 70) {
    return b - 55
  }
  if (b >= 97 && b <= 102) {
    return b - 87
  }
  return -1
}

/**
 * Writes the dotted quad `b[from, to)` as its four bytes at `out[at]`, and
 * answers whether it was one: four decimal parts of 0 to 255, each without a
 * leading zero, so `010` is never read as octal 8 the way `inet_aton` reads it.
 */
const dnsParseIpv4 = (b: u8[], from: i32, to: i32, out: u8[], at: i32): boolean => {
  if (from < 0 || from > to || to > toI32(b.length)) {
    panic("dnsParseIpv4: the window is outside the array")
  }
  if (at < 0 || at > toI32(out.length) - 4) {
    panic("dnsParseIpv4: out has no room for four bytes at at")
  }
  let i: i32 = from
  let part: i32 = 0
  while (part < 4) {
    const start: i32 = i
    let value: i32 = 0
    // At most three digits, so `value` is below 100 before each one is added.
    while (i < to && i - start < 3 && value >= 0 && value < 100 && toI32(b[i]) >= 48 && toI32(b[i]) <= 57) {
      value = value * 10 + toI32(b[i]) - 48
      i += 1
    }
    const digits: i32 = i - start
    // A part of two or three digits worth less than 10 or 100 has a leading zero.
    if (digits === 0 || value > 255 || (digits === 2 && value < 10) || (digits === 3 && value < 100)) {
      return false
    }
    out[at + part] = toU8(value)
    part += 1
    if (part < 4) {
      if (i >= to || toI32(b[i]) !== DNS_DOT) {
        return false
      }
      i += 1
    }
  }
  return i === to
}

/**
 * Writes the IPv6 literal `b[from, to)` as sixteen bytes at `out[0]`, and
 * answers whether it was one: eight groups of one to four hex digits, at most
 * one `::` standing for one or more zero groups, and a dotted quad allowed in
 * place of the last two groups.
 */
const dnsParseIpv6 = (b: u8[], from: i32, to: i32, out: u8[]): boolean => {
  if (from < 0 || to < 0 || from > to || to > toI32(b.length)) {
    panic("dnsParseIpv6: the window is outside the array")
  }
  let i: i32 = from
  let groups: i32 = 0
  let gap: i32 = -1
  if (i < to - 1 && toI32(b[i]) === DNS_COLON && toI32(b[i + 1]) === DNS_COLON) {
    gap = 0
    i += 2
  }
  while (i < to) {
    if (groups > 7) {
      return false
    }
    const start: i32 = i
    let value: i32 = 0
    while (i < to && i - start < 4) {
      const d: i32 = dnsHexValue(toI32(b[i]))
      // At most four digits, so `value` is at most 0xfff before each one is added.
      if (d < 0 || d > 15 || value < 0 || value > 4095) {
        break
      }
      value = value * 16 + d
      i += 1
    }
    if (i < to && toI32(b[i]) === DNS_DOT) {
      if (groups > 6 || !dnsParseIpv4(b, start, to, out, groups * 2)) {
        return false
      }
      groups += 2
      break
    }
    if (i === start) {
      return false
    }
    if (toI32(out.length) < 16) {
      panic("dnsParseIpv6: out is shorter than 16 bytes")
    }
    const g: i32 = groups * 2
    out[g] = toU8(value >> 8)
    out[g + 1] = toU8(value & 255)
    groups += 1
    if (i < to) {
      if (toI32(b[i]) !== DNS_COLON) {
        return false
      }
      i += 1
      if (i < to && toI32(b[i]) === DNS_COLON) {
        if (gap >= 0) {
          return false
        }
        gap = groups
        i += 1
      } else if (i === to) {
        return false
      }
    }
  }
  if (gap < 0) {
    return groups === 8
  }
  if (groups > 7) {
    return false
  }
  if (toI32(out.length) < 16) {
    panic("dnsParseIpv6: out is shorter than 16 bytes")
  }
  // The groups after the gap move to the end, and the gap fills with zeros:
  // walking down, byte `k` takes byte `k - shift` while that is past the gap's
  // start, is zero while `k` itself is, and is kept before it.
  const shift: i32 = (8 - groups) * 2
  let k: i32 = 15
  while (k >= 0) {
    const src: i32 = k - shift
    if (src >= 0 && src >> 1 >= gap) {
      out[k] = out[src]
    } else if (k >> 1 >= gap) {
      out[k] = toU8(0)
    }
    k -= 1
  }
  return true
}

/**
 * Writes the IPv4 or IPv6 literal `b[off, off + len)` at `out[at, at + 18)`,
 * IPv4 as `::ffff:a.b.c.d`, with `port` big-endian after it, and answers
 * whether it was one. `out` is written only when it was. A zone (`%eth0`),
 * brackets and a port are not part of a literal, so a window holding one is
 * refused; so is an IPv4 part with a leading zero, never read as octal.
 *
 * Each call allocates the sixteen bytes it parses into, released when it
 * returns; the two file parsers reuse a buffer of their own instead.
 *
 * @param b The bytes the literal is in.
 * @param off Where the literal starts in `b`.
 * @param len The literal's length in bytes; the whole window must be the literal, with no blank.
 *   A window outside `b` panics.
 * @param out Where the 18-byte address goes.
 * @param at Where in `out` it starts; `out[at, at + 18)` must lie inside `out`, or this panics.
 * @param port The port written after the address, 0 to 65535; any other value panics.
 * @returns True when the window was an IPv4 or IPv6 literal and `out` now holds it.
 */
export const dnsParseAddress = (b: u8[], off: i32, len: i32, out: u8[], at: i32, port: i32): boolean =>
  // A negative `len`, or an end past the i32 range, makes `to` fall below `off`, which panics there.
  dnsParseAddressVia(b, off, toI32(toI64(off) + toI64(len)), out, at, port, new Array<u8>(16))

/**
 * `dnsParseAddress` for the window `b[from, to)`, parsing into `parsed`,
 * sixteen bytes the caller owns, so it allocates nothing.
 */
const dnsParseAddressVia = (
  b: u8[],
  from: i32,
  to: i32,
  out: u8[],
  at: i32,
  port: i32,
  parsed: u8[]
): boolean => {
  if (from < 0 || to < from || to > toI32(b.length)) {
    panic("dnsParseAddress: the window is outside the array")
  }
  const room: i32 = toI32(out.length) - DNS_ADDRESS_BYTES
  if (at < 0 || at > room) {
    panic("dnsParseAddress: at is outside out")
  }
  if (port < 0 || port > 0xffff) {
    panic(`dnsParseAddress: the port ${port} is not 16 bits`)
  }
  if (toI32(parsed.length) < 16) {
    panic("dnsParseAddress: parsed is shorter than 16 bytes")
  }
  let ok: boolean = false
  let i: i32 = from
  while (i < to && toI32(b[i]) !== DNS_COLON) {
    i += 1
  }
  if (i === to) {
    let z: i32 = 0
    while (z < 10) {
      parsed[z] = toU8(0)
      z += 1
    }
    parsed[10] = toU8(255)
    parsed[11] = toU8(255)
    ok = dnsParseIpv4(b, from, to, parsed, 12)
  } else {
    ok = dnsParseIpv6(b, from, to, parsed)
  }
  if (!ok) {
    return false
  }
  // `out[at, at + 18)` and `parsed[0, 16)` were checked above, so the bounds never stop the copy.
  let p: i32 = at
  let k: i32 = 0
  while (k < 16 && k < toI32(parsed.length) && p < toI32(out.length)) {
    out[p] = parsed[k]
    p += 1
    k += 1
  }
  setU16BE(out, at + 16, toU16(port))
  return true
}

/** Whether `b[from, to)` is the ASCII word `word`. */
const dnsWordIs = (b: u8[], from: i32, to: i32, word: string): boolean => {
  if (from < 0 || to < from || to > toI32(b.length)) {
    // Never taken: every caller passes a window inside a checked line; this panics as a bad window would.
    dnsConfigCheckWindow(toI32(b.length), from, to, "dnsParseResolvConf")
    return false
  }
  const n: i32 = toI32(word.length)
  if (to - from !== n) {
    return false
  }
  let i: i32 = from
  let k: i32 = 0
  while (k < n && i < to) {
    if (toI32(b[i]) !== toI32(word.charCodeAt(k))) {
      return false
    }
    i += 1
    k += 1
  }
  return true
}

/** Where the line `b[from, to)` ends once a `#` or `;` comment is cut from it. */
const dnsCommentCut = (b: u8[], from: i32, to: i32): i32 => {
  if (from < 0 || from > to || to > toI32(b.length)) {
    panic("dnsCommentCut: the window is outside the array")
  }
  let i: i32 = from
  while (i < to && toI32(b[i]) !== DNS_HASH && toI32(b[i]) !== DNS_SEMICOLON) {
    i += 1
  }
  return i
}

/**
 * The option `b[from, to)` read as `prefix` and a decimal count, clamped to
 * `[low, high]`, or `fallback` when it is not that option: a digit past the
 * count's fourth stops counting, so a hundred digits clamp rather than wrap.
 */
const dnsOption = (b: u8[], from: i32, to: i32, prefix: string, low: i32, high: i32, fallback: i32): i32 => {
  if (from < 0 || from > to || to > toI32(b.length)) {
    panic("dnsOption: the window is outside the array")
  }
  const n: i32 = toI32(prefix.length)
  if (to - from <= n) {
    return fallback
  }
  let i: i32 = from
  let k: i32 = 0
  while (k < n) {
    if (i >= to || toI32(b[i]) !== toI32(prefix.charCodeAt(k))) {
      return fallback
    }
    i += 1
    k += 1
  }
  let value: i32 = 0
  while (i < to) {
    const d: i32 = toI32(b[i]) - 48
    if (d < 0 || d > 9) {
      return fallback
    }
    if (value >= 0 && value < 10000) {
      value = value * 10 + d
    }
    i += 1
  }
  if (value < low) {
    return low
  }
  if (value > high) {
    return high
  }
  return value
}

/** Appends `b[from, to)` to `config`'s search list, lowercase, one trailing dot dropped, or counts it dropped. */
const dnsAddSearch = (b: u8[], from: i32, to: i32, config: DnsConfig): void => {
  if (from < 0 || to < 0 || to < from || to > toI32(b.length)) {
    // Never taken: the caller passes a word inside a checked line; this panics as a bad window would.
    dnsConfigCheckWindow(toI32(b.length), from, to, "dnsParseResolvConf")
    return
  }
  let n: i32 = to - from
  const lastByte: i32 = to - 1
  if (n > 0 && lastByte >= 0 && lastByte < toI32(b.length) && toI32(b[lastByte]) === DNS_DOT) {
    n -= 1
  }
  const search: u8[] = config.search
  const starts: i32[] = config.searchStart
  const lengths: i32[] = config.searchLength
  const size: i32 = toI32(search.length)
  const count: i32 = config.searchCount
  if (count < 0) {
    // Never taken: the line reset the count to 0 and only this adds to it; a negative index panics.
    dnsConfigCheckWindow(DNS_MAX_SEARCH, count, count, "dnsParseResolvConf: config.searchCount")
    return
  }
  let used: i32 = 0
  if (count > 0) {
    const last: i32 = count - 1
    if (last >= toI32(starts.length) || last >= toI32(lengths.length)) {
      dnsConfigCheckWindow(toI32(starts.length), last, count, "dnsParseResolvConf: config.searchStart")
      dnsConfigCheckWindow(toI32(lengths.length), last, count, "dnsParseResolvConf: config.searchLength")
      return
    }
    const s: i32 = starts[last]
    const l: i32 = lengths[last]
    // 256 is DNS_MAX_SEARCH_BYTES.
    if (s < 0 || l < 0 || s > 256 || l > 256 || l > 256 - s) {
      // Never taken: this line wrote the domain, inside the cap; -1 fits no window, so this panics.
      dnsConfigCheckWindow(DNS_MAX_SEARCH_BYTES, s, -1, "dnsParseResolvConf: config.searchStart")
      return
    }
    used = s + l
  }
  // 6 is DNS_MAX_SEARCH and 256 DNS_MAX_SEARCH_BYTES; `n > 256` alone never decides, as `used >= 0`.
  if (n === 0 || count >= 6 || n > 256 || n > 256 - used) {
    config.droppedSearch = dnsCount(config.droppedSearch)
    return
  }
  if (count >= toI32(starts.length) || count >= toI32(lengths.length) || n > size - used) {
    // `config`'s arrays were replaced with shorter ones: the writes below would panic, and this does.
    dnsConfigCheckWindow(size, used, used + n, "dnsParseResolvConf: config.search")
    dnsConfigCheckWindow(toI32(starts.length), count, count + 1, "dnsParseResolvConf: config.searchStart")
    dnsConfigCheckWindow(toI32(lengths.length), count, count + 1, "dnsParseResolvConf: config.searchLength")
    return
  }
  let p: i32 = used
  let k: i32 = from
  while (k < to && k - from < n && p < size) {
    const c: i32 = toI32(b[k])
    search[p] = toU8(c >= 65 && c <= 90 ? c + 32 : c)
    p += 1
    k += 1
  }
  starts[count] = used
  lengths[count] = n
  config.searchCount = count + 1
}

/** Reads one resolv.conf line, `b[from, to)` with its comment already cut, into `config`. */
const dnsResolvLine = (b: u8[], from: i32, to: i32, config: DnsConfig): void => {
  if (from < 0 || to < from || to > toI32(b.length)) {
    // Never taken: the caller cuts the line from a checked window; this panics as a bad window would.
    dnsConfigCheckWindow(toI32(b.length), from, to, "dnsParseResolvConf")
    return
  }
  let i: i32 = from
  while (i < to && dnsIsBlank(toI32(b[i]))) {
    i += 1
  }
  const keyStart: i32 = i
  while (i < to && !dnsIsBlank(toI32(b[i]))) {
    i += 1
  }
  const keyEnd: i32 = i
  while (i < to && dnsIsBlank(toI32(b[i]))) {
    i += 1
  }
  if (dnsWordIs(b, keyStart, keyEnd, "nameserver")) {
    const start: i32 = i
    while (i < to && !dnsIsBlank(toI32(b[i]))) {
      i += 1
    }
    if (i === start) {
      return
    }
    // The parse reset the count to 0 and only this adds 1 below the cap, so it is never negative.
    const count: i32 = config.serverCount
    // 3 is DNS_MAX_SERVERS.
    if (count < 0 || count >= 3) {
      config.droppedServers = dnsCount(config.droppedServers)
      return
    }
    if (
      dnsParseAddressVia(b, start, i, config.servers, count * DNS_ADDRESS_BYTES, DNS_PORT, config.scratch)
    ) {
      config.serverCount = count + 1
    }
  } else if (dnsWordIs(b, keyStart, keyEnd, "search") || dnsWordIs(b, keyStart, keyEnd, "domain")) {
    const single: boolean = dnsWordIs(b, keyStart, keyEnd, "domain")
    config.searchCount = 0
    config.droppedSearch = 0
    while (i < to) {
      const start: i32 = i
      while (i < to && !dnsIsBlank(toI32(b[i]))) {
        i += 1
      }
      dnsAddSearch(b, start, i, config)
      while (i < to && dnsIsBlank(toI32(b[i]))) {
        i += 1
      }
      if (single) {
        return
      }
    }
  } else if (dnsWordIs(b, keyStart, keyEnd, "options")) {
    while (i < to) {
      const start: i32 = i
      while (i < to && !dnsIsBlank(toI32(b[i]))) {
        i += 1
      }
      config.ndots = dnsOption(b, start, i, "ndots:", 0, DNS_MAX_NDOTS, config.ndots)
      config.timeout = dnsOption(b, start, i, "timeout:", 1, DNS_MAX_TIMEOUT, config.timeout)
      config.attempts = dnsOption(b, start, i, "attempts:", 1, DNS_MAX_ATTEMPTS, config.attempts)
      while (i < to && dnsIsBlank(toI32(b[i]))) {
        i += 1
      }
    }
  }
}

/**
 * Reads the resolv.conf `b[off, off + len)` into `config`, which starts over
 * from the defaults, and gives it 127.0.0.1 and ::1 on port 53 when no
 * nameserver line held an address. It allocates nothing, unless that
 * fallback finds `config.servers` replaced with an array too short for two
 * addresses, when it gives `config` a new full table. Nothing in the bytes
 * makes it panic or fail: what it cannot use is ignored or counted.
 *
 * @param b The file's bytes, read by the caller.
 * @param off Where the file starts in `b`.
 * @param len The file's length in bytes; a window outside `b` panics.
 * @param config The table to fill; its counts and options are reset first, so one can be reused.
 */
export const dnsParseResolvConf = (b: u8[], off: i32, len: i32, config: DnsConfig): void => {
  // A negative `len`, or an end past the i32 range, makes `to` fall below `off`.
  const to: i32 = toI32(toI64(off) + toI64(len))
  if (off < 0 || to < off || to > toI32(b.length)) {
    dnsConfigCheckWindow(toI32(b.length), off, to, "dnsParseResolvConf")
    return
  }
  config.serverCount = 0
  config.droppedServers = 0
  config.searchCount = 0
  config.droppedSearch = 0
  config.ndots = DNS_DEFAULT_NDOTS
  config.timeout = DNS_DEFAULT_TIMEOUT
  config.attempts = DNS_DEFAULT_ATTEMPTS
  config.skippedLines = 0
  let i: i32 = off
  while (i < to) {
    const start: i32 = i
    while (i < to && toI32(b[i]) !== DNS_NEWLINE) {
      i += 1
    }
    if (i - start > DNS_CONFIG_MAX_LINE) {
      config.skippedLines = dnsCount(config.skippedLines)
    } else {
      dnsResolvLine(b, start, dnsCommentCut(b, start, i), config)
    }
    if (i < to) {
      i += 1
    }
  }
  if (config.serverCount === 0) {
    if (toI32(config.servers.length) < 36) {
      // Only a caller that replaced `config.servers` with a shorter array
      // gets here. The fallback needs two addresses, so it gets a full table
      // of `DNS_MAX_SERVERS` addresses, 54 bytes.
      config.servers = new Array<u8>(54)
    }
    dnsFallbackServers(config.servers)
    config.serverCount = 2
  }
}

/**
 * Writes 127.0.0.1 and ::1, each on `DNS_PORT`, as the first two of
 * `servers`, allocating nothing. The caller passes at least 36 bytes, two
 * addresses; a shorter `servers` is left as it is.
 */
const dnsFallbackServers = (servers: u8[]): void => {
  if (toI32(servers.length) < 36) {
    return
  }
  let k: i32 = 0
  while (k < 36) {
    servers[k] = toU8(0)
    k += 1
  }
  servers[10] = toU8(255)
  servers[11] = toU8(255)
  servers[12] = toU8(127)
  servers[15] = toU8(1)
  servers[33] = toU8(1)
  setU16BE(servers, 16, toU16(DNS_PORT))
  setU16BE(servers, DNS_ADDRESS_BYTES + 16, toU16(DNS_PORT))
}

/** Adds `b[from, to)` as a name of entry `entry`, lowercase, one trailing dot dropped, or counts it dropped. */
const dnsAddHostName = (b: u8[], from: i32, to: i32, entry: i32, hosts: DnsHosts): void => {
  if (from < 0 || to < 0 || to < from || to > toI32(b.length)) {
    // Never taken: the caller passes a word inside a checked line; this panics as a bad window would.
    dnsConfigCheckWindow(toI32(b.length), from, to, "dnsParseHosts")
    return
  }
  let n: i32 = to - from
  const lastByte: i32 = to - 1
  if (n > 0 && lastByte >= 0 && lastByte < toI32(b.length) && toI32(b[lastByte]) === DNS_DOT) {
    n -= 1
  }
  const names: u8[] = hosts.names
  const starts: i32[] = hosts.nameStart
  const lengths: i32[] = hosts.nameLength
  const entries: i32[] = hosts.nameEntry
  const size: i32 = toI32(names.length)
  // The parse reset both counts to 0 and only this moves them, inside their caps, so the
  // first two tests on `count` and `used` are never what drops a name.
  const count: i32 = hosts.nameCount
  const used: i32 = hosts.nameBytes
  if (
    count < 0 ||
    used < 0 ||
    used > 16384 || // DNS_HOSTS_MAX_NAME_BYTES
    n === 0 ||
    n > 253 || // DNS_HOSTS_MAX_NAME
    count >= 1024 || // DNS_HOSTS_MAX_NAMES
    n > 16384 - used
  ) {
    hosts.droppedNames = dnsCount(hosts.droppedNames)
    return
  }
  if (
    count >= toI32(starts.length) ||
    count >= toI32(lengths.length) ||
    count >= toI32(entries.length) ||
    n > size - used
  ) {
    // `hosts`' arrays were replaced with shorter ones: the writes below would panic, and this does.
    dnsConfigCheckWindow(size, used, used + n, "dnsParseHosts: hosts.names")
    dnsConfigCheckWindow(toI32(starts.length), count, count + 1, "dnsParseHosts: hosts.nameStart")
    dnsConfigCheckWindow(toI32(lengths.length), count, count + 1, "dnsParseHosts: hosts.nameLength")
    dnsConfigCheckWindow(toI32(entries.length), count, count + 1, "dnsParseHosts: hosts.nameEntry")
    return
  }
  let p: i32 = used
  let k: i32 = from
  while (k < to && k - from < n && p < size) {
    const c: i32 = toI32(b[k])
    names[p] = toU8(c >= 65 && c <= 90 ? c + 32 : c)
    p += 1
    k += 1
  }
  starts[count] = used
  lengths[count] = n
  entries[count] = entry
  hosts.nameCount = count + 1
  hosts.nameBytes = used + n
}

/** Reads one hosts line, `b[from, to)` with its comment already cut, into `hosts`. */
const dnsHostsLine = (b: u8[], from: i32, to: i32, hosts: DnsHosts): void => {
  if (from < 0 || to < from || to > toI32(b.length)) {
    // Never taken: the caller cuts the line from a checked window; this panics as a bad window would.
    dnsConfigCheckWindow(toI32(b.length), from, to, "dnsParseHosts")
    return
  }
  let i: i32 = from
  while (i < to && dnsIsBlank(toI32(b[i]))) {
    i += 1
  }
  const addrStart: i32 = i
  while (i < to && !dnsIsBlank(toI32(b[i]))) {
    i += 1
  }
  const addrEnd: i32 = i
  while (i < to && dnsIsBlank(toI32(b[i]))) {
    i += 1
  }
  if (addrEnd === addrStart || i === to) {
    return
  }
  // The parse reset the count to 0 and only this adds 1 below the cap, so it is never negative.
  const count: i32 = hosts.entryCount
  // 256 is DNS_HOSTS_MAX_ENTRIES.
  if (count < 0 || count >= 256) {
    hosts.droppedEntries = dnsCount(hosts.droppedEntries)
    return
  }
  if (
    !dnsParseAddressVia(b, addrStart, addrEnd, hosts.addresses, count * DNS_ADDRESS_BYTES, 0, hosts.scratch)
  ) {
    return
  }
  hosts.entryCount = count + 1
  while (i < to) {
    const start: i32 = i
    while (i < to && !dnsIsBlank(toI32(b[i]))) {
      i += 1
    }
    dnsAddHostName(b, start, i, count, hosts)
    while (i < to && dnsIsBlank(toI32(b[i]))) {
      i += 1
    }
  }
}

/**
 * Reads the hosts file `b[off, off + len)` into `hosts`, which starts over
 * empty. It allocates nothing; a line whose address is not a literal, or
 * that names nothing, is ignored, and what does not fit is counted.
 *
 * @param b The file's bytes, read by the caller.
 * @param off Where the file starts in `b`.
 * @param len The file's length in bytes; a window outside `b` panics.
 * @param hosts The table to fill; it is emptied first, so one can be reused.
 */
export const dnsParseHosts = (b: u8[], off: i32, len: i32, hosts: DnsHosts): void => {
  // A negative `len`, or an end past the i32 range, makes `to` fall below `off`.
  const to: i32 = toI32(toI64(off) + toI64(len))
  if (off < 0 || to < off || to > toI32(b.length)) {
    dnsConfigCheckWindow(toI32(b.length), off, to, "dnsParseHosts")
    return
  }
  hosts.entryCount = 0
  hosts.nameCount = 0
  hosts.nameBytes = 0
  hosts.droppedEntries = 0
  hosts.droppedNames = 0
  hosts.skippedLines = 0
  let i: i32 = off
  while (i < to) {
    const start: i32 = i
    while (i < to && toI32(b[i]) !== DNS_NEWLINE) {
      i += 1
    }
    if (i - start > DNS_CONFIG_MAX_LINE) {
      hosts.skippedLines = dnsCount(hosts.skippedLines)
    } else {
      dnsHostsLine(b, start, dnsCommentCut(b, start, i), hosts)
    }
    if (i < to) {
      i += 1
    }
  }
}
/**
 * Writes the addresses `hosts` gives `name`, of `qtype` (`DNS_TYPE_A` or
 * `DNS_TYPE_AAAA`), into `out` from offset 0 with `port`, in file order and at
 * most `max` of them, and answers how many it wrote. An entry that names
 * `name` twice is written once; two entries with the same address are each
 * written. It allocates nothing.
 *
 * @param hosts The table `dnsParseHosts` filled.
 * @param name The name to find, without case, one trailing `.` ignored.
 * @param qtype `DNS_TYPE_A` for the IPv4 entries or `DNS_TYPE_AAAA` for the IPv6 ones; any
 *   other type panics.
 * @param port The port written into each address, 0 to 65535; any other value panics.
 * @param out Where the 18-byte addresses go, back to back from offset 0.
 * @param max The most addresses to write, 0 or more; `out` must have room for `max` of them,
 *   or this panics.
 * @returns How many addresses were written, 0 when `hosts` does not name `name`.
 */
export const dnsHostsFind = (
  hosts: DnsHosts,
  name: string,
  qtype: i32,
  port: i32,
  out: u8[],
  max: i32
): i32 => {
  if (qtype !== DNS_TYPE_A && qtype !== DNS_TYPE_AAAA) {
    panic(`dnsHostsFind: the type ${qtype} is not DNS_TYPE_A or DNS_TYPE_AAAA`)
  }
  if (max < 0 || max > toI32(out.length) / DNS_ADDRESS_BYTES) {
    panic("dnsHostsFind: out has no room for max addresses")
  }
  if (port < 0 || port > 0xffff) {
    panic(`dnsHostsFind: the port ${port} is not 16 bits`)
  }
  let n: i32 = toI32(name.length)
  if (n > 0 && toI32(name.charCodeAt(n - 1)) === DNS_DOT) {
    n -= 1
  }
  const addresses: u8[] = hosts.addresses
  const names: u8[] = hosts.names
  const starts: i32[] = hosts.nameStart
  const lengths: i32[] = hosts.nameLength
  const entries: i32[] = hosts.nameEntry
  const count: i32 = hosts.nameCount
  const wantV4: boolean = qtype === DNS_TYPE_A
  let found: i32 = 0
  let last: i32 = -1
  let i: i32 = 0
  while (i < count && found < max) {
    // A table `dnsParseHosts` filled always passes these; only one whose arrays or counts
    // were changed by hand can fail them, where the reads below would have panicked.
    if (i >= toI32(entries.length) || i >= toI32(lengths.length) || i >= toI32(starts.length)) {
      panic("dnsHostsFind: hosts is not a table dnsParseHosts filled")
    }
    const entry: i32 = entries[i]
    if (entry !== last) {
      // 256 is DNS_HOSTS_MAX_ENTRIES.
      if (entry < 0 || entry >= 256) {
        panic("dnsHostsFind: hosts is not a table dnsParseHosts filled")
      }
      const at: i32 = entry * DNS_ADDRESS_BYTES
      const room: i32 = toI32(addresses.length) - DNS_ADDRESS_BYTES
      if (at > room) {
        panic("dnsHostsFind: hosts is not a table dnsParseHosts filled")
      }
      let p: i32 = at
      let zeros: i32 = 0
      while (zeros < 10 && p < toI32(addresses.length) && toI32(addresses[p]) === 0) {
        p += 1
        zeros += 1
      }
      // After ten zeros `p` is `at + 10`, inside the 18 bytes checked above.
      const v4: boolean =
        zeros === 10 &&
        p < toI32(addresses.length) - 1 &&
        toI32(addresses[p]) === 255 &&
        toI32(addresses[p + 1]) === 255
      let same: boolean = v4 === wantV4 && lengths[i] === n
      if (same) {
        const start: i32 = starts[i]
        if (start < 0 || start > toI32(names.length) - n) {
          panic("dnsHostsFind: hosts is not a table dnsParseHosts filled")
        }
        let q: i32 = start
        let k: i32 = 0
        while (same && k < n && q < toI32(names.length)) {
          const c: i32 = toI32(name.charCodeAt(k))
          same = toI32(names[q]) === (c >= 65 && c <= 90 ? c + 32 : c)
          q += 1
          k += 1
        }
      }
      if (same) {
        // Never taken: `found < max <= out.length / 18`, so `found` is at most 119304646;
        // the cap only states it as a literal, and fails as a short `out` would.
        if (found < 0 || found > 119304646) {
          panic("dnsHostsFind: out has no room for max addresses")
        }
        const base: i32 = found * DNS_ADDRESS_BYTES
        const outRoom: i32 = toI32(out.length) - DNS_ADDRESS_BYTES
        if (base > outRoom) {
          panic("dnsHostsFind: out has no room for max addresses")
        }
        let q: i32 = base
        let r: i32 = at
        let k: i32 = 0
        while (k < 16 && q < toI32(out.length) && r < toI32(addresses.length)) {
          out[q] = addresses[r]
          q += 1
          r += 1
          k += 1
        }
        setU16BE(out, base + 16, toU16(port))
        found += 1
        last = entry
      }
    }
    i += 1
  }
  return found
}
