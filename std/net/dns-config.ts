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
 *     import { DNS_TYPE_A } from "nish/net/dns-message"
 *
 *     const config: DnsConfig = new DnsConfig()
 *     dnsParseResolvConf(resolvBytes, 0, resolvLen, config)
 *     // config.servers[i * 18, +18) for i < config.serverCount, on port 53
 *     const hosts: DnsHosts = new DnsHosts()
 *     dnsParseHosts(hostsBytes, 0, hostsLen, hosts)
 *     const found: i32 = dnsHostsFind(hosts, "localhost", DNS_TYPE_A, 80, out, 8)
 *
 * **resolv.conf** is read as glibc reads it, minus what a stub resolver does
 * not use. `nameserver` takes one IPv4 or IPv6 literal (no zone), and the first
 * `DNS_MAX_SERVERS` (3) are kept; `search` and `domain` each replace the list,
 * so the last one wins, and it holds at most `DNS_MAX_SEARCH` (6) domains and
 * `DNS_MAX_SEARCH_BYTES` (256) bytes; `options` reads `ndots:n` (clamped to 0
 * to 15), `timeout:n` (1 to 30 seconds) and `attempts:n` (1 to 5) and ignores
 * every other option. With no nameserver line, the servers are 127.0.0.1 and
 * ::1, as glibc's are.
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
import { setU16BE, skipBlank } from "nish/bytes"
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
/** The `timeout` without an option, in seconds. */
export const DNS_DEFAULT_TIMEOUT: i32 = 5
/** The highest `timeout:n` kept, in seconds; the lowest is 1. */
export const DNS_MAX_TIMEOUT: i32 = 30
/** The `attempts` without an option. */
export const DNS_DEFAULT_ATTEMPTS: i32 = 2
/** The highest `attempts:n` kept; the lowest is 1. */
export const DNS_MAX_ATTEMPTS: i32 = 5

/** How many hosts lines are kept. */
export const DNS_HOSTS_MAX_ENTRIES: i32 = 256
/** How many names all hosts entries may hold together. */
export const DNS_HOSTS_MAX_NAMES: i32 = 1024
/** How many bytes those names may take together. */
export const DNS_HOSTS_MAX_NAME_BYTES: i32 = 16384
/** The longest hosts name kept, the longest a DNS name can be. */
export const DNS_HOSTS_MAX_NAME: i32 = 253

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
  /** Sixteen bytes a literal is parsed into before it is kept, so a parse allocates nothing. */
  scratch: u8[]
  serverCount: i32 = 0
  /** Nameserver lines past `DNS_MAX_SERVERS`, read and not kept. */
  droppedServers: i32 = 0
  /** The search domains, back to back, lowercase, without a trailing dot. */
  search: u8[]
  /** Where each of the `searchCount` domains starts in `search`, and its length. */
  searchStart: i32[]
  searchLength: i32[]
  searchCount: i32 = 0
  /** Search domains past `DNS_MAX_SEARCH` or `DNS_MAX_SEARCH_BYTES`, read and not kept. */
  droppedSearch: i32 = 0
  /** Dots a name needs to be tried as it stands before the search list. */
  ndots: i32
  /** Seconds to wait for one server's reply. */
  timeout: i32
  /** Rounds through the servers before giving up. */
  attempts: i32
  /** Lines longer than `DNS_CONFIG_MAX_LINE`, skipped whole. */
  skippedLines: i32 = 0

  constructor() {
    this.servers = new Array<u8>(DNS_MAX_SERVERS * DNS_ADDRESS_BYTES)
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
  /** `entryCount` addresses of `DNS_ADDRESS_BYTES` each, port 0. */
  addresses: u8[]
  /** Every kept name, back to back, lowercase, without a trailing dot. */
  names: u8[]
  /** Sixteen bytes a literal is parsed into before it is kept, so a parse allocates nothing. */
  scratch: u8[]
  /** Where each of the `nameCount` names starts in `names`, its length, and its entry. */
  nameStart: i32[]
  nameLength: i32[]
  nameEntry: i32[]
  entryCount: i32 = 0
  nameCount: i32 = 0
  nameBytes: i32 = 0
  /** Lines with an address past `DNS_HOSTS_MAX_ENTRIES`, read and not kept. */
  droppedEntries: i32 = 0
  /** Names past a cap, or longer than `DNS_HOSTS_MAX_NAME`, read and not kept. */
  droppedNames: i32 = 0
  /** Lines longer than `DNS_CONFIG_MAX_LINE`, skipped whole. */
  skippedLines: i32 = 0

  constructor() {
    this.addresses = new Array<u8>(DNS_HOSTS_MAX_ENTRIES * DNS_ADDRESS_BYTES)
    this.names = new Array<u8>(DNS_HOSTS_MAX_NAME_BYTES)
    this.scratch = new Array<u8>(16)
    this.nameStart = new Array<i32>(DNS_HOSTS_MAX_NAMES)
    this.nameLength = new Array<i32>(DNS_HOSTS_MAX_NAMES)
    this.nameEntry = new Array<i32>(DNS_HOSTS_MAX_NAMES)
  }
}

/** Panics unless `bytes[off, off + len)` lies inside `bytes`. */
const dnsConfigCheckWindow = (bytes: u8[], off: i32, len: i32, who: string): void => {
  const size: i32 = toI32(bytes.length)
  if (off < 0 || len < 0 || off > size || len > size - off) {
    panic(who + ": the window is outside the array")
  }
}

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
  let i: i32 = from
  let part: i32 = 0
  while (part < 4) {
    const start: i32 = i
    let value: i32 = 0
    while (i < to && i - start < 3 && toI32(b[i]) >= 48 && toI32(b[i]) <= 57) {
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
 * Writes the IPv6 literal `b[from, to)` as sixteen bytes at `out[at]`, and
 * answers whether it was one: eight groups of one to four hex digits, at most
 * one `::` standing for one or more zero groups, and a dotted quad allowed in
 * place of the last two groups.
 */
const dnsParseIpv6 = (b: u8[], from: i32, to: i32, out: u8[], at: i32): boolean => {
  if (from < 0 || from > to || to > toI32(b.length)) {
    panic("dnsParseIpv6: the window is outside the array")
  }
  let i: i32 = from
  let groups: i32 = 0
  let gap: i32 = -1
  if (to - i >= 2 && toI32(b[i]) === DNS_COLON && toI32(b[i + 1]) === DNS_COLON) {
    gap = 0
    i += 2
  }
  while (i < to) {
    if (groups === 8 || i < 0 || i >= toI32(b.length)) {
      return false
    }
    let j: i32 = i
    let value: i32 = 0
    while (j < to && j - i < 4 && dnsHexValue(toI32(b[j])) >= 0) {
      value = value * 16 + dnsHexValue(toI32(b[j]))
      j += 1
    }
    if (j < to && toI32(b[j]) === DNS_DOT) {
      if (groups > 6 || !dnsParseIpv4(b, i, to, out, at + groups * 2)) {
        return false
      }
      groups += 2
      i = to
    } else {
      if (j === i) {
        return false
      }
      out[at + groups * 2] = toU8(value >> 8)
      out[at + groups * 2 + 1] = toU8(value & 255)
      groups += 1
      i = j
      if (i < to) {
        if (i < 0 || i >= toI32(b.length) || toI32(b[i]) !== DNS_COLON) {
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
  }
  if (gap < 0) {
    return groups === 8
  }
  if (groups > 7) {
    return false
  }
  // The groups after the gap move to the end, and the gap fills with zeros.
  const shift: i32 = (8 - groups) * 2
  let k: i32 = groups * 2 - 1
  while (k >= gap * 2) {
    out[at + k + shift] = out[at + k]
    k -= 1
  }
  k = gap * 2
  while (k < gap * 2 + shift) {
    out[at + k] = toU8(0)
    k += 1
  }
  return true
}

/**
 * Writes the IPv4 or IPv6 literal `b[off, off + len)` at `out[at, at + 18)`,
 * IPv4 as `::ffff:a.b.c.d`, with `port` big-endian after it, and answers
 * whether it was one. `out` is written only when it was. A zone (`%eth0`),
 * brackets and a port are not part of a literal.
 *
 * Each call allocates the sixteen bytes it parses into, released when it
 * returns; the two file parsers reuse a buffer of their own instead.
 */
export const dnsParseAddress = (b: u8[], off: i32, len: i32, out: u8[], at: i32, port: i32): boolean =>
  dnsParseAddressVia(b, off, len, out, at, port, new Array<u8>(16))

/** `dnsParseAddress`, parsing into `parsed`, sixteen bytes the caller owns, so it allocates nothing. */
const dnsParseAddressVia = (
  b: u8[],
  off: i32,
  len: i32,
  out: u8[],
  at: i32,
  port: i32,
  parsed: u8[]
): boolean => {
  dnsConfigCheckWindow(b, off, len, "dnsParseAddress")
  if (at < 0 || at > toI32(out.length) - DNS_ADDRESS_BYTES) {
    panic("dnsParseAddress: at is outside out")
  }
  if (port < 0 || port > 0xffff) {
    panic(`dnsParseAddress: the port ${port} is not 16 bits`)
  }
  if (toI32(parsed.length) < 16) {
    panic("dnsParseAddress: parsed is shorter than 16 bytes")
  }
  let ok: boolean = false
  const end: i32 = off + len
  let i: i32 = off
  while (i >= 0 && i < end && i < toI32(b.length) && toI32(b[i]) !== DNS_COLON) {
    i += 1
  }
  if (i === end) {
    let z: i32 = 0
    while (z < 10) {
      parsed[z] = toU8(0)
      z += 1
    }
    ok = dnsParseIpv4(b, off, end, parsed, 12)
    parsed[10] = toU8(255)
    parsed[11] = toU8(255)
  } else {
    ok = dnsParseIpv6(b, off, end, parsed, 0)
  }
  if (!ok) {
    return false
  }
  let k: i32 = 0
  while (k < 16) {
    out[at + k] = parsed[k]
    k += 1
  }
  setU16BE(out, at + 16, toU16(port))
  return true
}

/** Whether the address at `a[at]` is `::ffff:a.b.c.d`, an IPv4 one. */
const dnsIsIpv4 = (a: u8[], at: i32): boolean => {
  let k: i32 = 0
  while (k < 10) {
    if (toI32(a[at + k]) !== 0) {
      return false
    }
    k += 1
  }
  return toI32(a[at + 10]) === 255 && toI32(a[at + 11]) === 255
}

/**
 * The end of the line that starts at `from`, before `to`: the offset of its
 * newline, or `to`.
 */
const dnsLineEnd = (b: u8[], from: i32, to: i32): i32 => {
  if (from < 0 || from > to || to > toI32(b.length)) {
    panic("dnsLineEnd: the window is outside the array")
  }
  let i: i32 = from
  while (i < to && toI32(b[i]) !== DNS_NEWLINE) {
    i += 1
  }
  return i
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

/** The end of the word that starts at `from`, before `to`. */
const dnsWordEnd = (b: u8[], from: i32, to: i32): i32 => {
  if (from < 0 || from > to || to > toI32(b.length)) {
    panic("dnsWordEnd: the window is outside the array")
  }
  let i: i32 = from
  while (i < to && !dnsIsBlank(toI32(b[i]))) {
    i += 1
  }
  return i
}

/** Whether `b[from, to)` is the ASCII word `word`. */
const dnsWordIs = (b: u8[], from: i32, to: i32, word: string): boolean => {
  const n: i32 = toI32(word.length)
  if (to - from !== n) {
    return false
  }
  let k: i32 = 0
  while (k < n) {
    if (toI32(b[from + k]) !== toI32(word.charCodeAt(k))) {
      return false
    }
    k += 1
  }
  return true
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
  if (to - from <= n || !dnsWordIs(b, from, from + n, prefix)) {
    return fallback
  }
  let value: i32 = 0
  let i: i32 = from + n
  while (i < to) {
    const d: i32 = toI32(b[i]) - 48
    if (d < 0 || d > 9) {
      return fallback
    }
    if (value < 10000) {
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
  let end: i32 = to
  if (end > from && toI32(b[end - 1]) === DNS_DOT) {
    end -= 1
  }
  const n: i32 = end - from
  const used: i32 =
    config.searchCount === 0
      ? 0
      : config.searchStart[config.searchCount - 1] + config.searchLength[config.searchCount - 1]
  if (n === 0 || config.searchCount === DNS_MAX_SEARCH || n > DNS_MAX_SEARCH_BYTES - used) {
    config.droppedSearch += 1
    return
  }
  let k: i32 = 0
  while (k < n) {
    const c: i32 = toI32(b[from + k])
    config.search[used + k] = toU8(c >= 65 && c <= 90 ? c + 32 : c)
    k += 1
  }
  config.searchStart[config.searchCount] = used
  config.searchLength[config.searchCount] = n
  config.searchCount += 1
}

/** Reads one resolv.conf line, `b[from, to)` with its comment already cut, into `config`. */
const dnsResolvLine = (b: u8[], from: i32, to: i32, config: DnsConfig): void => {
  const keyStart: i32 = skipBlank(b, from, to)
  const keyEnd: i32 = dnsWordEnd(b, keyStart, to)
  let i: i32 = skipBlank(b, keyEnd, to)
  if (dnsWordIs(b, keyStart, keyEnd, "nameserver")) {
    const end: i32 = dnsWordEnd(b, i, to)
    if (end === i) {
      return
    }
    if (config.serverCount === DNS_MAX_SERVERS) {
      config.droppedServers += 1
      return
    }
    if (
      dnsParseAddressVia(
        b,
        i,
        end - i,
        config.servers,
        config.serverCount * DNS_ADDRESS_BYTES,
        DNS_PORT,
        config.scratch
      )
    ) {
      config.serverCount += 1
    }
  } else if (dnsWordIs(b, keyStart, keyEnd, "search") || dnsWordIs(b, keyStart, keyEnd, "domain")) {
    const single: boolean = dnsWordIs(b, keyStart, keyEnd, "domain")
    config.searchCount = 0
    config.droppedSearch = 0
    while (i < to) {
      const end: i32 = dnsWordEnd(b, i, to)
      dnsAddSearch(b, i, end, config)
      i = skipBlank(b, end, to)
      if (single) {
        return
      }
    }
  } else if (dnsWordIs(b, keyStart, keyEnd, "options")) {
    while (i < to) {
      const end: i32 = dnsWordEnd(b, i, to)
      config.ndots = dnsOption(b, i, end, "ndots:", 0, DNS_MAX_NDOTS, config.ndots)
      config.timeout = dnsOption(b, i, end, "timeout:", 1, DNS_MAX_TIMEOUT, config.timeout)
      config.attempts = dnsOption(b, i, end, "attempts:", 1, DNS_MAX_ATTEMPTS, config.attempts)
      i = skipBlank(b, end, to)
    }
  }
}

/**
 * Reads the resolv.conf `b[off, off + len)` into `config`, which starts over
 * from the defaults, and gives it 127.0.0.1 and ::1 on port 53 when no
 * nameserver line held an address.
 */
export const dnsParseResolvConf = (b: u8[], off: i32, len: i32, config: DnsConfig): void => {
  dnsConfigCheckWindow(b, off, len, "dnsParseResolvConf")
  config.serverCount = 0
  config.droppedServers = 0
  config.searchCount = 0
  config.droppedSearch = 0
  config.ndots = DNS_DEFAULT_NDOTS
  config.timeout = DNS_DEFAULT_TIMEOUT
  config.attempts = DNS_DEFAULT_ATTEMPTS
  config.skippedLines = 0
  const to: i32 = off + len
  let i: i32 = off
  while (i < to) {
    const end: i32 = dnsLineEnd(b, i, to)
    if (end - i > DNS_CONFIG_MAX_LINE) {
      config.skippedLines += 1
    } else {
      dnsResolvLine(b, i, dnsCommentCut(b, i, end), config)
    }
    i = end + 1
  }
  if (config.serverCount === 0) {
    dnsFallbackServers(config.servers)
    config.serverCount = 2
  }
}

/** Writes 127.0.0.1 and ::1, each on `DNS_PORT`, as the first two of `servers`, allocating nothing. */
const dnsFallbackServers = (servers: u8[]): void => {
  if (toI32(servers.length) < 2 * DNS_ADDRESS_BYTES) {
    panic("dnsFallbackServers: servers has no room for two addresses")
  }
  let k: i32 = 0
  while (k < 2 * DNS_ADDRESS_BYTES && k < toI32(servers.length)) {
    servers[k] = toU8(0)
    k += 1
  }
  servers[10] = toU8(255)
  servers[11] = toU8(255)
  servers[12] = toU8(127)
  servers[15] = toU8(1)
  setU16BE(servers, 16, toU16(DNS_PORT))
  servers[DNS_ADDRESS_BYTES + 15] = toU8(1)
  setU16BE(servers, DNS_ADDRESS_BYTES + 16, toU16(DNS_PORT))
}

/** Adds `b[from, to)` as a name of entry `entry`, lowercase, one trailing dot dropped, or counts it dropped. */
const dnsAddHostName = (b: u8[], from: i32, to: i32, entry: i32, hosts: DnsHosts): void => {
  let end: i32 = to
  if (end > from && toI32(b[end - 1]) === DNS_DOT) {
    end -= 1
  }
  const n: i32 = end - from
  if (
    n === 0 ||
    n > DNS_HOSTS_MAX_NAME ||
    hosts.nameCount === DNS_HOSTS_MAX_NAMES ||
    n > DNS_HOSTS_MAX_NAME_BYTES - hosts.nameBytes
  ) {
    hosts.droppedNames += 1
    return
  }
  let k: i32 = 0
  while (k < n) {
    const c: i32 = toI32(b[from + k])
    hosts.names[hosts.nameBytes + k] = toU8(c >= 65 && c <= 90 ? c + 32 : c)
    k += 1
  }
  hosts.nameStart[hosts.nameCount] = hosts.nameBytes
  hosts.nameLength[hosts.nameCount] = n
  hosts.nameEntry[hosts.nameCount] = entry
  hosts.nameCount += 1
  hosts.nameBytes += n
}

/** Reads one hosts line, `b[from, to)` with its comment already cut, into `hosts`. */
const dnsHostsLine = (b: u8[], from: i32, to: i32, hosts: DnsHosts): void => {
  const addrStart: i32 = skipBlank(b, from, to)
  const addrEnd: i32 = dnsWordEnd(b, addrStart, to)
  let i: i32 = skipBlank(b, addrEnd, to)
  if (addrEnd === addrStart || i === to) {
    return
  }
  if (hosts.entryCount === DNS_HOSTS_MAX_ENTRIES) {
    hosts.droppedEntries += 1
    return
  }
  const at: i32 = hosts.entryCount * DNS_ADDRESS_BYTES
  if (!dnsParseAddressVia(b, addrStart, addrEnd - addrStart, hosts.addresses, at, 0, hosts.scratch)) {
    return
  }
  const entry: i32 = hosts.entryCount
  hosts.entryCount += 1
  while (i < to) {
    const end: i32 = dnsWordEnd(b, i, to)
    dnsAddHostName(b, i, end, entry, hosts)
    i = skipBlank(b, end, to)
  }
}

/** Reads the hosts file `b[off, off + len)` into `hosts`, which starts over empty. */
export const dnsParseHosts = (b: u8[], off: i32, len: i32, hosts: DnsHosts): void => {
  dnsConfigCheckWindow(b, off, len, "dnsParseHosts")
  hosts.entryCount = 0
  hosts.nameCount = 0
  hosts.nameBytes = 0
  hosts.droppedEntries = 0
  hosts.droppedNames = 0
  hosts.skippedLines = 0
  const to: i32 = off + len
  let i: i32 = off
  while (i < to) {
    const end: i32 = dnsLineEnd(b, i, to)
    if (end - i > DNS_CONFIG_MAX_LINE) {
      hosts.skippedLines += 1
    } else {
      dnsHostsLine(b, i, dnsCommentCut(b, i, end), hosts)
    }
    i = end + 1
  }
}

/** Whether kept name `index` of `hosts` is `name[0, n)`, without case. */
const dnsHostNameIs = (hosts: DnsHosts, index: i32, name: string, n: i32): boolean => {
  if (hosts.nameLength[index] !== n) {
    return false
  }
  const start: i32 = hosts.nameStart[index]
  let k: i32 = 0
  while (k < n) {
    const c: i32 = toI32(name.charCodeAt(k))
    if (toI32(hosts.names[start + k]) !== (c >= 65 && c <= 90 ? c + 32 : c)) {
      return false
    }
    k += 1
  }
  return true
}

/**
 * Writes the addresses `hosts` gives `name`, of `qtype` (`DNS_TYPE_A` or
 * `DNS_TYPE_AAAA`), into `out` from offset 0 with `port`, in file order and at
 * most `max` of them, and answers how many it wrote. An entry that names
 * `name` twice is written once.
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
  let found: i32 = 0
  let last: i32 = -1
  let i: i32 = 0
  while (i < hosts.nameCount && found < max) {
    const entry: i32 = hosts.nameEntry[i]
    const at: i32 = entry * DNS_ADDRESS_BYTES
    if (
      entry !== last &&
      dnsIsIpv4(hosts.addresses, at) === (qtype === DNS_TYPE_A) &&
      dnsHostNameIs(hosts, i, name, n)
    ) {
      let k: i32 = 0
      while (k < 16) {
        out[found * DNS_ADDRESS_BYTES + k] = hosts.addresses[at + k]
        k += 1
      }
      setU16BE(out, found * DNS_ADDRESS_BYTES + 16, toU16(port))
      found += 1
      last = entry
    }
    i += 1
  }
  return found
}
