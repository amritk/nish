// WP49 stage 5: repeated `await fetch(url)` of an https URL leaves
// `Arena.used()` where it was. Each fetch is awaited through a function that
// hands back only its status, so what the fetch, its TLS connection and its
// answer allocated is released when that call's scope ends. The parent runs
// `net_http_fetch_tls`'s loopback TLS servers and re-runs itself as the
// client; the arena is read between iterations of one loop, past a warm-up,
// so no enclosing scope hides a leak. https is never pooled, so every fetch
// is a full handshake, so RUNS is 200 against the http sibling's 2000 to keep
// the fixture's CI cost bounded.
import { writeFileSync } from "nish:fs"
import { spawn as spawnProcess } from "nish:process"
import { RequestInit, fetch } from "nish/net/fetch"
import { trustedRootPem } from "../net_http_fetch_tls/certs"
import { Servers, parsePort, selfPath } from "../net_http_fetch_tls/servers"

const WARM: i32 = 20
const RUNS: i32 = 200

/** The status of a GET of `url` trusting `pem`, or 0 when it failed. */
async function status(url: string, pem: string): Promise<i32> {
  const init: RequestInit = new RequestInit()
  init.options.useEnvProxy = false
  init.options.rootsPemPath = pem
  const res = await fetch(url, init)
  if (res.isErr()) {
    return 0
  }
  return res.value.status
}

async function client(port: i32, pem: string): Promise<i32> {
  const url: string = `https://localhost:${port}/flat`
  let ok: i32 = 0
  let used: i64 = 0
  for (let i: i32 = 0; i < WARM + RUNS; i += 1) {
    if (i === WARM) {
      used = Arena.used()
    }
    const s: i32 = await status(url, pem)
    if (s === 200) {
      ok += 1
    }
  }
  const usedAfter: i64 = Arena.used()
  console.log(`${ok} of ${WARM + RUNS} https fetches answered 200`)
  console.log(`Arena.used() flat over ${RUNS} https fetches: ${usedAfter === used}`)
  if (usedAfter !== used) {
    console.log(`  grew by ${usedAfter - used} bytes`)
  }
  return 0
}

export async function main(): Promise<i32> {
  const argv: string[] = process.argv
  if (toI32(argv.length) >= 4 && argv[1] === "client") {
    const code: i32 = await client(parsePort(argv[2]), argv[3])
    return code
  }
  const self: string = selfPath()
  const trusted: string = `${self}.roots.pem`
  writeFileSync(trusted, trustedRootPem)
  const servers: Servers = new Servers()
  const pid: i32 = spawnProcess([self, "client", `${servers.sites[0].port}`, trusted])
  if (pid <= 0) {
    console.log("FAIL  the client could not be started")
    return 1
  }
  return servers.serve(pid)
}
