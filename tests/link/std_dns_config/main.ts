// `nish/net/dns-config`: every resolv.conf directive and clamp, hosts entries,
// aliases, case and caps, and the IPv4 and IPv6 literals both read. Every line
// names its case, and the run prints the same lines natively and under
// `--profile wasi`.
import {
  DNS_CONFIG_MAX_LINE,
  DNS_HOSTS_MAX_ENTRIES,
  DNS_HOSTS_MAX_NAMES,
  DNS_MAX_SEARCH,
  DNS_MAX_SERVERS,
  DnsConfig,
  DnsHosts,
  dnsHostsFind,
  dnsParseAddress,
  dnsParseHosts,
  dnsParseResolvConf,
} from "nish/net/dns-config"
import { DNS_ADDRESS_BYTES, DNS_TYPE_A, DNS_TYPE_AAAA } from "nish/net/dns-message"
import { Suite } from "nish/testing"

const HEX: string = "0123456789abcdef"

/** The bytes of an ASCII string. */
const ascii = (s: string): u8[] => {
  const n: i32 = toI32(s.length)
  const out: u8[] = new Array<u8>(n)
  let i: i32 = 0
  while (i < n) {
    out[i] = toU8(toI32(s.charCodeAt(i)))
    i += 1
  }
  return out
}

const toHex = (bytes: u8[], off: i32, len: i32): string => {
  let s: string = ""
  let i: i32 = 0
  while (i < len) {
    const b: i32 = toI32(bytes[off + i])
    s = s + HEX.substring(b >> 4, (b >> 4) + 1) + HEX.substring(b & 15, (b & 15) + 1)
    i += 1
  }
  return s
}

/** `s` repeated `n` times. */
const repeat = (s: string, n: i32): string => {
  let out: string = ""
  let i: i32 = 0
  while (i < n) {
    out = out + s
    i += 1
  }
  return out
}

/** The 18-byte form `dnsParseAddress` writes for `literal` on port 53 as hex, or "refused". */
const literal = (text: string): string => {
  const out: u8[] = new Array<u8>(DNS_ADDRESS_BYTES)
  const b: u8[] = ascii(text)
  return dnsParseAddress(b, 0, toI32(b.length), out, 0, 53) ? toHex(out, 0, DNS_ADDRESS_BYTES) : "refused"
}

const resolv = (text: string, config: DnsConfig): void => {
  const b: u8[] = ascii(text)
  dnsParseResolvConf(b, 0, toI32(b.length), config)
}

const hostsOf = (text: string, hosts: DnsHosts): void => {
  const b: u8[] = ascii(text)
  dnsParseHosts(b, 0, toI32(b.length), hosts)
}

/** Server `i` of `config` as hex. */
const server = (config: DnsConfig, i: i32): string => toHex(config.servers, i * DNS_ADDRESS_BYTES, DNS_ADDRESS_BYTES)

/** Search domain `i` of `config` as text. */
const searchAt = (config: DnsConfig, i: i32): string => {
  let s: string = ""
  let k: i32 = 0
  while (k < config.searchLength[i]) {
    s = s + String.fromCharCode(toI32(config.search[config.searchStart[i] + k]))
    k += 1
  }
  return s
}

/** The addresses `hosts` gives `name` for `qtype` on port 80, as hex joined by spaces. */
const find = (hosts: DnsHosts, name: string, qtype: i32): string => {
  const out: u8[] = new Array<u8>(8 * DNS_ADDRESS_BYTES)
  const n: i32 = dnsHostsFind(hosts, name, qtype, 80, out, 8)
  let s: string = ""
  let i: i32 = 0
  while (i < n) {
    s = s + (i > 0 ? " " : "") + toHex(out, i * DNS_ADDRESS_BYTES, DNS_ADDRESS_BYTES)
    i += 1
  }
  return s
}

const V4_LOOPBACK: string = "00000000000000000000ffff7f0000010035"
const V6_LOOPBACK: string = "000000000000000000000000000000010035"

export const main = (): number => {
  const t = new Suite("dns-config")

  // --- literals ----------------------------------------------------------------
  t.eqStr("ipv4: 127.0.0.1", literal("127.0.0.1"), V4_LOOPBACK)
  t.eqStr("ipv4: 255.255.255.255", literal("255.255.255.255"), "00000000000000000000ffffffffffff0035")
  t.eqStr("ipv4: 0.0.0.0", literal("0.0.0.0"), "00000000000000000000ffff000000000035")
  t.eqStr("ipv4: a part of 256", literal("1.2.3.256"), "refused")
  t.eqStr("ipv4: a leading zero is not octal", literal("010.0.0.1"), "refused")
  t.eqStr("ipv4: four digits", literal("1.2.3.0004"), "refused")
  t.eqStr("ipv4: three parts", literal("1.2.3"), "refused")
  t.eqStr("ipv4: five parts", literal("1.2.3.4.5"), "refused")
  t.eqStr("ipv4: an empty part", literal("1..3.4"), "refused")
  t.eqStr("ipv4: a trailing dot", literal("1.2.3.4."), "refused")
  t.eqStr("ipv4: one number", literal("2130706433"), "refused")
  t.eqStr("ipv4: a sign", literal("+1.2.3.4"), "refused")
  t.eqStr("ipv4: empty", literal(""), "refused")
  t.eqStr("ipv6: ::1", literal("::1"), V6_LOOPBACK)
  t.eqStr("ipv6: ::", literal("::"), "000000000000000000000000000000000035")
  t.eqStr("ipv6: eight groups", literal("2001:db8:0:0:0:0:0:1"), "20010db8000000000000000000000001" + "0035")
  t.eqStr("ipv6: a gap in the middle", literal("2001:DB8::1"), "20010db8000000000000000000000001" + "0035")
  t.eqStr("ipv6: a gap at the end", literal("fe80::"), "fe800000000000000000000000000000" + "0035")
  t.eqStr("ipv6: a gap standing for one group", literal("1:2:3:4:5:6:7::"), "00010002000300040005000600070000" + "0035")
  t.eqStr("ipv6: an IPv4 tail", literal("::ffff:192.0.2.1"), "00000000000000000000ffffc00002010035")
  t.eqStr("ipv6: an IPv4 tail after six groups", literal("1:2:3:4:5:6:1.2.3.4"), "00010002000300040005000601020304" + "0035")
  t.eqStr("ipv6: an IPv4 tail after seven groups", literal("1:2:3:4:5:6:7:1.2.3.4"), "refused")
  t.eqStr("ipv6: a bad IPv4 tail", literal("::ffff:1.2.3"), "refused")
  t.eqStr("ipv6: nine groups", literal("1:2:3:4:5:6:7:8:9"), "refused")
  t.eqStr("ipv6: seven groups and no gap", literal("1:2:3:4:5:6:7"), "refused")
  t.eqStr("ipv6: eight groups and a gap", literal("1:2:3:4:5:6:7:8::"), "refused")
  t.eqStr("ipv6: two gaps", literal("1::2::3"), "refused")
  t.eqStr("ipv6: a group of five digits", literal("12345::"), "refused")
  t.eqStr("ipv6: a single leading colon", literal(":1::"), "refused")
  t.eqStr("ipv6: a single trailing colon", literal("1::2:"), "refused")
  t.eqStr("ipv6: three colons", literal(":::"), "refused")
  t.eqStr("ipv6: a zone", literal("fe80::1%eth0"), "refused")
  t.eqStr("ipv6: brackets", literal("[::1]"), "refused")
  t.eqStr("ipv6: not hex", literal("::g"), "refused")

  // Only a literal that parses is written; a refusal leaves `out` as it was.
  const kept: u8[] = new Array<u8>(DNS_ADDRESS_BYTES)
  kept[0] = toU8(7)
  const bad: u8[] = ascii("1.2.3.999")
  t.eqBool("literal: a refusal answers false", dnsParseAddress(bad, 0, toI32(bad.length), kept, 0, 53), false)
  t.eqI32("literal: a refusal writes nothing", toI32(kept[0]), 7)
  // A window of a longer array: `x10.0.0.1y`, read from 1 for 8.
  const framed: u8[] = ascii("x10.0.0.1y")
  t.eqBool("literal: a window reads only its bytes", dnsParseAddress(framed, 1, 8, kept, 0, 853), true)
  t.eqStr("literal: 10.0.0.1 on port 853", toHex(kept, 0, DNS_ADDRESS_BYTES), "00000000000000000000ffff0a0000010355")

  // --- resolv.conf ---------------------------------------------------------------
  const config: DnsConfig = new DnsConfig()
  resolv("", config)
  t.eqI32("resolv: empty: two default servers", config.serverCount, 2)
  t.eqStr("resolv: empty: 127.0.0.1 first", server(config, 0), V4_LOOPBACK)
  t.eqStr("resolv: empty: ::1 second", server(config, 1), V6_LOOPBACK)
  t.eqI32("resolv: empty: ndots 1", config.ndots, 1)
  t.eqI32("resolv: empty: timeout 5", config.timeout, 5)
  t.eqI32("resolv: empty: attempts 2", config.attempts, 2)
  t.eqI32("resolv: empty: no search domain", config.searchCount, 0)

  resolv(
    "# written by a DHCP client\n" +
      "nameserver 192.0.2.53\n" +
      "nameserver\t2001:db8::53   # the IPv6 one\r\n" +
      "  nameserver 192.0.2.54;second comment\n" +
      "nameserver 192.0.2.55\n" +
      "nameserver 192.0.2.56\n" +
      "search Corp.Example.  lab.example\n" +
      "options ndots:2 timeout:3 attempts:4 rotate edns0\n" +
      "sortlist 130.155.160.0/255.255.240.0\n",
    config
  )
  t.eqI32("resolv: the first DNS_MAX_SERVERS kept", config.serverCount, DNS_MAX_SERVERS)
  t.eqI32("resolv: the servers past three counted", config.droppedServers, 2)
  t.eqStr("resolv: an IPv4 server on port 53", server(config, 0), "00000000000000000000ffffc00002350035")
  t.eqStr("resolv: an IPv6 server after a tab, its comment and CR cut", server(config, 1), "20010db8000000000000000000000053" + "0035")
  t.eqStr("resolv: a server after blanks and a `;` comment", server(config, 2), "00000000000000000000ffffc00002360035")
  t.eqI32("resolv: two search domains", config.searchCount, 2)
  t.eqStr("resolv: a search domain lowercased, its dot dropped", searchAt(config, 0), "corp.example")
  t.eqStr("resolv: the second search domain", searchAt(config, 1), "lab.example")
  t.eqI32("resolv: ndots:2", config.ndots, 2)
  t.eqI32("resolv: timeout:3", config.timeout, 3)
  t.eqI32("resolv: attempts:4", config.attempts, 4)

  resolv("nameserver 192.0.2.300\nnameserver bogus\nnameserver fe80::1%eth0\nnameserver\n", config)
  t.eqI32("resolv: invalid servers are skipped, then the defaults stand", config.serverCount, 2)
  t.eqStr("resolv: invalid servers: 127.0.0.1", server(config, 0), V4_LOOPBACK)
  t.eqI32("resolv: invalid servers are not counted as dropped", config.droppedServers, 0)

  resolv("nameserver ::1\nnameserver 10.0.0.1 10.0.0.2\n", config)
  t.eqI32("resolv: one word read from a nameserver line", config.serverCount, 2)
  t.eqStr("resolv: an IPv6-only file keeps its server", server(config, 0), V6_LOOPBACK)

  resolv("search a.example b.example\ndomain C.example d.example\n", config)
  t.eqI32("resolv: domain replaces search, one word", config.searchCount, 1)
  t.eqStr("resolv: domain's word", searchAt(config, 0), "c.example")
  resolv("domain a.example\nsearch b.example c.example\n", config)
  t.eqI32("resolv: search replaces domain", config.searchCount, 2)
  t.eqStr("resolv: the last list wins", searchAt(config, 0), "b.example")
  resolv("search a b c d e f g h\n", config)
  t.eqI32("resolv: DNS_MAX_SEARCH domains kept", config.searchCount, DNS_MAX_SEARCH)
  t.eqI32("resolv: the domains past six counted", config.droppedSearch, 2)
  // 200 bytes, then 60, which would make 260 of 256, then 50, which fits.
  resolv("search " + repeat("a", 200) + " " + repeat("b", 60) + " " + repeat("c", 50) + "\n", config)
  t.eqI32("resolv: a domain past DNS_MAX_SEARCH_BYTES dropped", config.droppedSearch, 1)
  t.eqI32("resolv: the domain after it that fits kept", config.searchCount, 2)
  t.eqI32("resolv: the bytes kept", config.searchLength[1], 50)
  resolv("search . a.example\n", config)
  t.eqI32("resolv: a search domain of `.` alone is dropped", config.droppedSearch, 1)
  t.eqStr("resolv: the domain after `.`", searchAt(config, 0), "a.example")

  resolv("options ndots:99 timeout:0 attempts:100\n", config)
  t.eqI32("resolv: ndots clamped to 15", config.ndots, 15)
  t.eqI32("resolv: timeout clamped up to 1", config.timeout, 1)
  t.eqI32("resolv: attempts clamped to 5", config.attempts, 5)
  resolv("options ndots:0 timeout:99999999999999999999 attempts:" + repeat("9", 100) + "\n", config)
  t.eqI32("resolv: ndots:0 stands", config.ndots, 0)
  t.eqI32("resolv: twenty digits clamp, never wrap", config.timeout, 30)
  t.eqI32("resolv: a hundred digits clamp, never wrap", config.attempts, 5)
  resolv("options ndots: ndots:-1 ndots:3x timeout:2.5 attempts:\n", config)
  t.eqI32("resolv: options that are not counts are ignored: ndots", config.ndots, 1)
  t.eqI32("resolv: options that are not counts are ignored: timeout", config.timeout, 5)
  t.eqI32("resolv: options that are not counts are ignored: attempts", config.attempts, 2)
  resolv("options ndots:4\noptions ndots:6\n", config)
  t.eqI32("resolv: the last option wins", config.ndots, 6)
  resolv("Options ndots:4\nNAMESERVER 10.0.0.1\n", config)
  t.eqI32("resolv: directives are lowercase only: options", config.ndots, 1)
  t.eqStr("resolv: directives are lowercase only: nameserver", server(config, 0), V4_LOOPBACK)
  resolv("#nameserver 10.0.0.1\n;nameserver 10.0.0.2\nnameserver 10.0.0.3#x\n", config)
  t.eqI32("resolv: commented-out lines are not read", config.serverCount, 1)
  t.eqStr("resolv: a comment straight after the word", server(config, 0), "00000000000000000000ffff0a0000030035")

  // A line one byte past DNS_CONFIG_MAX_LINE is skipped whole; one at it is read.
  const pad: string = repeat(" ", DNS_CONFIG_MAX_LINE - toI32("nameserver 10.0.0.9".length))
  resolv("nameserver 10.0.0.9" + pad + " \nnameserver 10.0.0.8" + pad + "\n", config)
  t.eqI32("resolv: a line of 1025 bytes skipped and counted", config.skippedLines, 1)
  t.eqI32("resolv: a line of 1024 bytes read", config.serverCount, 1)
  t.eqStr("resolv: the 1024-byte line's server", server(config, 0), "00000000000000000000ffff0a0000080035")
  resolv("nameserver 10.0.0.7", config)
  t.eqStr("resolv: a last line with no newline", server(config, 0), "00000000000000000000ffff0a0000070035")
  // A parse starts over: what the last file set is gone.
  resolv("\n\n", config)
  t.eqI32("resolv: a new parse resets the skipped count", config.skippedLines, 0)
  t.eqI32("resolv: a new parse resets the servers", config.serverCount, 2)

  // A window of a longer array reads only its own bytes.
  const both: u8[] = ascii("nameserver 10.0.0.1\nnameserver 10.0.0.2\n")
  dnsParseResolvConf(both, 20, 20, config)
  t.eqI32("resolv: a window: one server", config.serverCount, 1)
  t.eqStr("resolv: a window: the second line's", server(config, 0), "00000000000000000000ffff0a0000020035")

  // --- hosts ---------------------------------------------------------------------
  const hosts: DnsHosts = new DnsHosts()
  hostsOf(
    "# static table\n" +
      "127.0.0.1\tlocalhost\n" +
      "::1     localhost ip6-localhost ip6-loopback\n" +
      "192.0.2.10  Web.Example.  web   www # aliases\n" +
      "192.0.2.11  web\n" +
      "2001:db8::10 web\n" +
      "::ffff:192.0.2.12 mapped\n" +
      "192.0.2.13\n" +
      "999.0.0.1 broken\n" +
      "   \n" +
      "192.0.2.14 ;nothing\n" +
      "192.0.2.15 dup dup DUP\r\n",
    hosts
  )
  t.eqI32("hosts: the entries with an address and a name", hosts.entryCount, 7)
  t.eqStr("hosts: localhost A", find(hosts, "localhost", DNS_TYPE_A), "00000000000000000000ffff7f0000010050")
  t.eqStr("hosts: localhost AAAA", find(hosts, "localhost", DNS_TYPE_AAAA), "000000000000000000000000000000010050")
  t.eqStr("hosts: an alias", find(hosts, "ip6-loopback", DNS_TYPE_AAAA), "000000000000000000000000000000010050")
  t.eqStr("hosts: an IPv6-only name has no A", find(hosts, "ip6-loopback", DNS_TYPE_A), "")
  t.eqStr(
    "hosts: two entries for one name, in file order",
    find(hosts, "web", DNS_TYPE_A),
    "00000000000000000000ffffc000020a0050 00000000000000000000ffffc000020b0050"
  )
  t.eqStr("hosts: the IPv6 entry for that name", find(hosts, "web", DNS_TYPE_AAAA), "20010db8000000000000000000000010" + "0050")
  t.eqStr("hosts: found without case and with a trailing dot", find(hosts, "WEB.example.", DNS_TYPE_A), "00000000000000000000ffffc000020a0050")
  t.eqStr("hosts: the alias after it", find(hosts, "www", DNS_TYPE_A), "00000000000000000000ffffc000020a0050")
  t.eqStr("hosts: a comment is not a name", find(hosts, "aliases", DNS_TYPE_A), "")
  t.eqStr("hosts: ::ffff:a.b.c.d answers A", find(hosts, "mapped", DNS_TYPE_A), "00000000000000000000ffffc000020c0050")
  t.eqStr("hosts: ::ffff:a.b.c.d does not answer AAAA", find(hosts, "mapped", DNS_TYPE_AAAA), "")
  t.eqStr("hosts: an invalid address's name", find(hosts, "broken", DNS_TYPE_A), "")
  t.eqStr("hosts: a `;` comment is not a name", find(hosts, "nothing", DNS_TYPE_A), "")
  t.eqStr("hosts: a name given twice by one entry is written once", find(hosts, "dup", DNS_TYPE_A), "00000000000000000000ffffc000020f0050")
  t.eqStr("hosts: an unknown name", find(hosts, "missing", DNS_TYPE_A), "")
  t.eqStr("hosts: a prefix of a name is not the name", find(hosts, "localhos", DNS_TYPE_A), "")
  t.eqStr("hosts: the empty name", find(hosts, "", DNS_TYPE_A), "")
  const one: u8[] = new Array<u8>(DNS_ADDRESS_BYTES)
  t.eqI32("hosts: max stops the search", dnsHostsFind(hosts, "web", DNS_TYPE_A, 80, one, 1), 1)
  t.eqStr("hosts: max 1 keeps the first", toHex(one, 0, DNS_ADDRESS_BYTES), "00000000000000000000ffffc000020a0050")
  t.eqI32("hosts: max 0 writes none", dnsHostsFind(hosts, "web", DNS_TYPE_A, 80, one, 0), 0)

  // A name of 253 bytes is kept; one of 254 is dropped and counted.
  hostsOf("10.0.0.1 " + repeat("a", 253) + " " + repeat("b", 254) + " " + repeat("c", 253) + ".\n", hosts)
  t.eqI32("hosts: a 254-byte name dropped and counted", hosts.droppedNames, 1)
  t.eqI32("hosts: 253-byte names kept, one with a trailing dot", hosts.nameCount, 2)
  t.eqStr("hosts: a 253-byte name found", find(hosts, repeat("c", 253), DNS_TYPE_A), "00000000000000000000ffff0a0000010050")

  // 300 entries of one name each: DNS_HOSTS_MAX_ENTRIES kept, the rest counted.
  let many: string = ""
  let i: i32 = 0
  while (i < 300) {
    many = many + `10.0.${i >> 8}.${i & 255} h${i}\n`
    i += 1
  }
  hostsOf(many, hosts)
  t.eqI32("hosts: DNS_HOSTS_MAX_ENTRIES kept", hosts.entryCount, DNS_HOSTS_MAX_ENTRIES)
  t.eqI32("hosts: the entries past the cap counted", hosts.droppedEntries, 300 - DNS_HOSTS_MAX_ENTRIES)
  t.eqStr("hosts: the last kept entry", find(hosts, "h255", DNS_TYPE_A), "00000000000000000000ffff0a0000ff0050")
  t.eqStr("hosts: an entry past the cap is not found", find(hosts, "h256", DNS_TYPE_A), "")

  // Five lines of 250 names each: DNS_HOSTS_MAX_NAMES kept, the rest counted.
  let names: string = ""
  let line: i32 = 0
  while (line < 5) {
    names = names + `10.1.0.${line}`
    let k: i32 = 0
    while (k < 250) {
      names = names + ` n${line * 250 + k}`
      k += 1
    }
    names = names + "\n"
    line += 1
  }
  hostsOf(names, hosts)
  t.eqI32("hosts: a line of 250 names is over DNS_CONFIG_MAX_LINE and skipped", hosts.skippedLines, 5)
  // So the cap is reached with lines of 100 names, each under 1024 bytes.
  names = ""
  line = 0
  while (line < 11) {
    names = names + `10.1.0.${line}`
    let k: i32 = 0
    while (k < 100) {
      names = names + ` n${line * 100 + k}`
      k += 1
    }
    names = names + "\n"
    line += 1
  }
  hostsOf(names, hosts)
  t.eqI32("hosts: no line skipped", hosts.skippedLines, 0)
  t.eqI32("hosts: DNS_HOSTS_MAX_NAMES kept", hosts.nameCount, DNS_HOSTS_MAX_NAMES)
  t.eqI32("hosts: the names past the cap counted", hosts.droppedNames, 1100 - DNS_HOSTS_MAX_NAMES)
  t.eqStr("hosts: the last kept name", find(hosts, "n1023", DNS_TYPE_A), "00000000000000000000ffff0a01000a0050")
  t.eqStr("hosts: a name past the cap is not found", find(hosts, "n1024", DNS_TYPE_A), "")

  // 70 names of 253 bytes on 70 lines would be 17,710 bytes: past DNS_HOSTS_MAX_NAME_BYTES.
  let big: string = ""
  i = 0
  while (i < 70) {
    const tag: string = `${100 + i}`
    big = big + "10.2.0.1 " + tag + repeat("x", 250) + "\n"
    i += 1
  }
  hostsOf(big, hosts)
  t.eqI32("hosts: names kept until DNS_HOSTS_MAX_NAME_BYTES", hosts.nameCount, 64)
  t.eqI32("hosts: the bytes kept", hosts.nameBytes, 64 * 253)
  t.eqI32("hosts: the names past the byte cap counted", hosts.droppedNames, 6)

  // A parse starts over.
  hostsOf("", hosts)
  t.eqI32("hosts: a new parse has no entries", hosts.entryCount, 0)
  t.eqI32("hosts: a new parse has no names", hosts.nameCount, 0)
  t.eqStr("hosts: a new parse finds nothing", find(hosts, "n1", DNS_TYPE_A), "")
  return t.done()
}
