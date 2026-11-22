// DNS messages (std/net/dns-message.ts) under an instruction count: `n` rounds
// that each build two queries with dnsBuildQuery and read three replies with
// dnsParseReply - a CNAME chain with a compressed target, nine A records (one
// past DNS_MAX_ANSWERS) and an NXDOMAIN. The replies are the ones
// tests/link/std_dns_message captured from a resolver. It reaches the name,
// pointer and record reads whose panic sites the std/ ratchet counts, so a
// fix to one of them shows here as a count that holds or falls. It prints a
// sum over what it read.
import { DNS_QUERY_MAX_BYTES, DNS_TYPE_A, DnsReply, dnsBuildQuery, dnsParseReply } from "nish/net/dns-message"

const HEX: string = "0123456789abcdef"

/** The bytes a lowercase hex string spells. */
const fromHex = (hex: string): u8[] => {
  const n: i32 = toI32(hex.length) / 2
  const out: u8[] = []
  for (let i: i32 = 0; i < n; i++) {
    const hi: i32 = toI32(HEX.indexOf(hex.substring(2 * i, 2 * i + 1)))
    const lo: i32 = toI32(HEX.indexOf(hex.substring(2 * i + 1, 2 * i + 2)))
    out.push(toU8(hi * 16 + lo))
  }
  return out
}

/** `www.microsoft.com A`: two CNAMEs, the second target compressed against the first, then one A record. */
const MICROSOFT_A: string =
  "12348180000100030000000003777777096d6963726f736f667403636f6d0000010001c00c000500010000098d002303777777096d6963726f736f667407636f6d2d632d3307656467656b6579036e657400c02f000500010000003000190665313336373804647363620a616b616d616965646765c04dc05e0001000100000014000417362a27"
/** `outlook.com A`: nine A records, one past `DNS_MAX_ANSWERS`. */
const OUTLOOK_A: string =
  "123481800001000900000000076f75746c6f6f6b03636f6d0000010001c00c0001000100000114000434605b22c00c000100010000011400043460ac62c00c000100010000011400043460dee2c00c000100010000011400043460df02c00c0001000100000114000434606f52c00c000100010000011400043460d632c00c000100010000011400043460e482c00c000100010000011400043460e5f2c00c000100010000011400043460dec2"
/** `nxdomain.invalid A`: RCODE 3 and no records. */
const NXDOMAIN: string = "123481830001000000000000086e78646f6d61696e07696e76616c69640000010001"

export const main = (): i32 => {
  const n: i32 = 5000 // bench:n
  const replies: u8[][] = [fromHex(MICROSOFT_A), fromHex(OUTLOOK_A), fromHex(NXDOMAIN)]
  const names: string[] = ["WWW.Microsoft.COM", "outlook.com.", "nxdomain.invalid"]
  const query: u8[] = new Array<u8>(DNS_QUERY_MAX_BYTES)
  const reply = new DnsReply()
  let sum: i64 = 0
  for (let round: i32 = 0; round < n; round++) {
    for (let k: i32 = 0; k < 3; k++) {
      const queryLen: i32 = dnsBuildQuery(query, 0x1234, names[k], DNS_TYPE_A)
      if (queryLen < 0) {
        console.log(`query ${k} failed: ${queryLen}`)
        return 1
      }
      const msg = replies[k]
      const rcode: i32 = dnsParseReply(msg, toI32(msg.length), query, queryLen, 443, reply)
      if (rcode < 0) {
        console.log(`reply ${k} failed: ${rcode}`)
        return 1
      }
      sum += toI64(rcode) + toI64(reply.count) + toI64(reply.dropped) + toI64(queryLen)
      if (reply.count > 0) {
        sum += toI64(reply.ttls[0]) + toI64(reply.addresses[15])
      }
    }
  }
  console.log(`${sum}`)
  return 0
}
