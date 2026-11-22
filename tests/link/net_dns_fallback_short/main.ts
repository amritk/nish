// `dnsParseResolvConf` with no nameserver line falls back to 127.0.0.1 and
// ::1. Before WP82 a `config.servers` replaced with an array too short for
// those two addresses panicked in `dnsFallbackServers`; now the config is
// given a full table and the fallback is written into it.
import { DnsConfig, dnsParseResolvConf } from "nish/net/dns-config"

const config: DnsConfig = new DnsConfig()
config.servers = new Array<u8>(4)
const empty: u8[] = new Array<u8>(0)
dnsParseResolvConf(empty, 0, 0, config)
console.log(`servers: ${config.serverCount}, table: ${config.servers.length} bytes`)
let first: string = ""
let i: i32 = 12
while (i < 16) {
  first = first + `${config.servers[i]}` + (i < 15 ? "." : "")
  i += 1
}
console.log(`first: ${first} port ${toI32(config.servers[16]) * 256 + toI32(config.servers[17])}`)
console.log(`second ends in ${config.servers[18 + 15]}, port ${toI32(config.servers[34]) * 256 + toI32(config.servers[35])}`)
