// WP49 stage 5: `awaitAll(fetch(a), fetch(b))` overlaps the two fetches.
// The server holds the first request unanswered until the second has
// arrived (or two seconds pass), then answers the second first. Its
// "both in" line shows the overlap by order, not by a clock: run one after
// the other, the second request could not arrive while the first waited,
// and the server would say so.
import { awaitAll, spawn } from "nish:async"
import { netClose, netLocalPort, tcpListen } from "nish:net"
import { fetch } from "nish/net/fetch"
import { acceptWithin, readTarget, reply } from "../net_fetch_async/server"

/** Answers the first request only after the second has come in. */
async function gate(listen: i32): Promise<void> {
  const one: i32 = await acceptWithin(listen, 2000)
  if (one < 0) {
    console.log("server: no request came")
    netClose(listen)
    return
  }
  const first: string = await readTarget(one)
  const two: i32 = await acceptWithin(listen, 2000)
  if (two < 0) {
    console.log("server: the second request never came while the first waited")
    await reply(one, `hello from ${first}`)
    netClose(listen)
    return
  }
  const second: string = await readTarget(two)
  console.log(`server: both in (${first}, ${second})`)
  await reply(two, `hello from ${second}`)
  await reply(one, `hello from ${first}`)
  netClose(listen)
}

/** The answer's status and body, or the error's text. */
async function get(url: string): Promise<string> {
  const res = await fetch(url)
  if (res.isErr()) {
    return res.error.text
  }
  return `${res.value.status} ${res.value.text()}`
}

export async function main(): Promise<i32> {
  const listen: i32 = tcpListen("127.0.0.1", 0, 16)
  if (listen < 0) {
    return 1
  }
  const port: i32 = netLocalPort(listen)
  spawn(gate(listen))
  const [a, b] = await awaitAll(get(`http://127.0.0.1:${port}/a`), get(`http://127.0.0.1:${port}/b`))
  console.log(`first: ${a}`)
  console.log(`second: ${b}`)
  return 0
}
