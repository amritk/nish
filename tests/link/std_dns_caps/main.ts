// `nish/net/dns` reaches what it says it does, and the report says so with the
// chain. A resolver driven on the program's own loop is `net` and `entropy`
// (its sockets and its random IDs) and nothing else: the core reads no clock
// and no file, so the caller hands it the time. `resolveHost` adds `fs.read`
// for /etc/resolv.conf and /etc/hosts, and `clock` for its own deadline. Both
// resolve `localhost`, which sends no packet.
import { DnsClient, resolveHost } from "nish/net/dns"
import { DnsResolver } from "nish/net/dns-resolver"
import { DnsConfig } from "nish/net/dns-config"
import { pollCreate } from "nish:net"

/** A lookup on a loop the program owns, at a time it gives. */
export const onLoop = (): i32 => {
  const loop: i32 = pollCreate()
  if (loop < 0) {
    return loop
  }
  const client: DnsClient = new DnsClient(new DnsResolver(new DnsConfig(), null, 1), loop, 0)
  const lookup: i32 = client.start("localhost", 80, toI64(0))
  const out: u8[] = new Array<u8>(32 * 18)
  const ttls: i32[] = new Array<i32>(32)
  return client.result(lookup, out, ttls)
}

/** The blocking call, configured from the system's files. */
export const blocking = (): i32 => {
  const out: u8[] = new Array<u8>(32 * 18)
  const ttls: i32[] = new Array<i32>(32)
  return resolveHost("localhost", 1000, 80, out, ttls)
}

export const main = (): number => {
  return onLoop() === 2 && blocking() === 2 ? 0 : 1
}
