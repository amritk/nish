// WP49 stage 5: `await fetch(url)` speaks https without blocking the process.
// The parent runs `net_http_fetch_tls`'s loopback TLS servers (good, expired,
// for another name, from a root the client never trusts) and its CONNECT
// proxy, and re-runs itself as the client under `/usr/bin/env`, so the child
// sees `https_proxy` (the proxy) and `no_proxy=127.0.0.1`. Every refusal is
// checked against `fetchSync` on the same URL: the async path gives the same
// code and the same sentence. A fetch whose server never answers the
// handshake is started first and a good fetch completes while it waits; only
// then is the silent listener closed, which ends the parked handshake, so
// "good" prints before "silent": the handshake parks only its own task,
// shown by order, not by a clock. (An async wait has no per-wait deadline
// yet, so the close, not `readTimeoutMs`, is what ends it.)
import { awaitAll } from "nish:async"
import { writeFileSync } from "nish:fs"
import { netClose, netLocalPort, tcpListen } from "nish:net"
import { spawn as spawnProcess } from "nish:process"
import { HTTP_E_CERTIFICATE, HTTP_E_TLS, FetchResponse, FetchSyncClient, HttpOptions, HttpRequest, HttpResponse, RequestInit, fetch, httpErrorName } from "nish/net/fetch"
import { strangerRootPem, trustedRootPem } from "../net_http_fetch_tls/certs"
import { Servers, Site, Tally, parsePort, selfPath } from "../net_http_fetch_tls/servers"

/** What a fetch answered: a response, or its error's code and text. */
class Outcome {
  res: FetchResponse | null = null
  code: i32 = 0
  text: string = ""
}

/** Options trusting the roots in `pem`, with no proxy from the environment. */
function trusting(pem: string): HttpOptions {
  const options: HttpOptions = new HttpOptions()
  options.useEnvProxy = false
  options.rootsPemPath = pem
  options.connectTimeoutMs = 5000
  options.readTimeoutMs = 5000
  options.totalTimeoutMs = 20000
  return options
}

function initFor(options: HttpOptions): RequestInit {
  const init: RequestInit = new RequestInit()
  init.options = options
  return init
}

async function get(url: string, options: HttpOptions): Promise<Outcome> {
  const out: Outcome = new Outcome()
  const r = await fetch(url, initFor(options))
  if (r.isErr()) {
    out.code = r.error.code
    out.text = r.error.text
  } else {
    out.res = r.value
  }
  return out
}

function body(o: Outcome): string {
  const res: FetchResponse | null = o.res
  return res !== null ? res.text() : "<none>"
}

function conn(o: Outcome): string {
  const res: FetchResponse | null = o.res
  if (res === null) {
    return "none"
  }
  const v: string | null = res.header("x-conn")
  return v !== null ? v : "none"
}

/** Whether the async fetch failed with `code` and with the sentence `fetchSync` gives the same URL. */
function same(o: Outcome, url: string, options: HttpOptions, code: i32): boolean {
  const client: FetchSyncClient = new FetchSyncClient(options)
  const res: HttpResponse | null = client.fetch(new HttpRequest("GET", url))
  const want: string = client.errorText
  const ok: boolean = o.res === null && res === null && o.code === code && client.error === code && o.text === want
  if (!ok) {
    console.log(`  async ${o.code} "${o.text}"; fetchSync ${client.error} "${want}"`)
  }
  return ok
}

/** A fetch of `url`, logged with `label`, then closes the listener `fd`. */
async function loggedThenClose(label: string, url: string, options: HttpOptions, fd: i32): Promise<i32> {
  const code: i32 = await logged(label, url, options)
  netClose(fd)
  return code
}

/** A fetch of `url`, logged with `label` once it answers. */
async function logged(label: string, url: string, options: HttpOptions): Promise<i32> {
  const o: Outcome = await get(url, options)
  console.log(o.res !== null ? `${label}: ${body(o)}` : `${label}: ${httpErrorName(o.code)}`)
  return o.code
}

async function checks(ports: i32[], proxy: i32, trusted: string, stranger: string): Promise<i32> {
  const t: Tally = new Tally()
  const good: string = `https://localhost:${ports[0]}`
  const options: HttpOptions = trusting(trusted)

  // --- a trusted server
  const a: Outcome = await get(`${good}/hello`, options)
  t.check(a.res !== null && body(a) === "GET /hello HTTP/1.1", "an async https fetch from a server the roots trust answers")
  if (a.res === null) {
    console.log(`  ${a.text}`)
  }
  const ip: Outcome = await get(`https://127.0.0.1:${ports[0]}/ip`, options)
  t.check(body(ip) === "GET /ip HTTP/1.1", "an IP literal is matched against the certificate's IP name")
  const once: Outcome = await get(`${good}/once`, options)
  const told: Outcome = await get(`${good}/notified-${conn(once)}`, options)
  t.check(body(told) === "yes", "and once its body is read, the connection ends with a close_notify")
  t.check(conn(once) !== conn(a) && conn(told) !== conn(once), "an https connection is not pooled: each fetch opens its own")

  // --- certificates that are refused, as fetchSync refuses them
  const expiredUrl: string = `https://localhost:${ports[1]}/`
  const expired: Outcome = await get(expiredUrl, options)
  t.check(same(expired, expiredUrl, options, HTTP_E_CERTIFICATE), "an expired certificate is HTTP_E_CERTIFICATE, as from fetchSync")
  t.check(expired.text.indexOf("refused") >= 0, "and the error says the certificate was refused")
  const wrongUrl: string = `https://localhost:${ports[2]}/`
  const wrong: Outcome = await get(wrongUrl, options)
  t.check(same(wrong, wrongUrl, options, HTTP_E_CERTIFICATE), "a certificate for another name is HTTP_E_CERTIFICATE, as from fetchSync")
  const strangerUrl: string = `https://localhost:${ports[3]}/`
  const untrusted: Outcome = await get(strangerUrl, options)
  t.check(same(untrusted, strangerUrl, options, HTTP_E_CERTIFICATE), "a chain to a root the client does not trust is HTTP_E_CERTIFICATE, as from fetchSync")
  const others: HttpOptions = trusting(stranger)
  const other: Outcome = await get(`${good}/`, others)
  t.check(same(other, `${good}/`, others, HTTP_E_CERTIFICATE), "and so is a good server under roots that are not its own")

  // --- what is not TLS, and TLS cut short
  const plainUrl: string = `https://127.0.0.1:${proxy}/`
  const plain: Outcome = await get(plainUrl, options)
  t.check(same(plain, plainUrl, options, HTTP_E_TLS), "a server that does not speak TLS is HTTP_E_TLS, as from fetchSync")
  const cut: Outcome = await get(`${good}/cut`, options)
  t.check(cut.res === null && cut.code === HTTP_E_TLS && cut.text.indexOf("close_notify") >= 0, "a body cut off without a close_notify is HTTP_E_TLS, not a short body")
  if (cut.code !== HTTP_E_TLS) {
    console.log(`  ${cut.text}`)
  }
  const ended: Outcome = await get(`${good}/until-close`, options)
  t.check(body(ended) === "until close", "a body with no length ends at the server's close_notify")
  const alertUrl: string = `${good}/alert`
  const alerted: Outcome = await get(alertUrl, options)
  t.check(alerted.code === HTTP_E_TLS && alerted.text.indexOf("the server sent TLS alert 80") >= 0, "a server that ends the connection with an alert is HTTP_E_TLS, naming the alert")

  // --- through the env proxy
  const tunnelled: HttpOptions = trusting(trusted)
  tunnelled.useEnvProxy = true
  const p: Outcome = await get(`${good}/tunnel`, tunnelled)
  t.check(body(p) === "GET /tunnel HTTP/1.1", "https through an http proxy is a CONNECT tunnel, then TLS to the origin")
  if (p.res === null) {
    console.log(`  ${p.text}`)
  }
  const asked: Outcome = await get(`${good}/connect-head`, options)
  t.check(body(asked).startsWith(`CONNECT localhost:${ports[0]} HTTP/1.1\r\n`), "and the proxy was asked for the origin's authority")

  // --- a handshake that never ends parks only its own task
  const silent: i32 = tcpListen("127.0.0.1", 0, 8)
  const [s, g] = await awaitAll(logged("silent", `https://127.0.0.1:${netLocalPort(silent)}/`, options), loggedThenClose("good", `${good}/beside`, options, silent))
  t.check(s !== 0 && g === 0, "the silent handshake fails only once its listener closes, and the good fetch beside it answered first")

  console.log(`fetch async https: ${t.passed} passed, ${t.failed} failed, 0 skipped`)
  return t.failed
}

export async function main(): Promise<i32> {
  const argv: string[] = process.argv
  if (toI32(argv.length) >= 9 && argv[1] === "client") {
    const ports: i32[] = [parsePort(argv[2]), parsePort(argv[3]), parsePort(argv[4]), parsePort(argv[5])]
    const failed: i32 = await checks(ports, parsePort(argv[6]), argv[7], argv[8])
    return failed
  }
  const self: string = selfPath()
  const trusted: string = `${self}.roots.pem`
  const stranger: string = `${self}.stranger.pem`
  writeFileSync(trusted, trustedRootPem)
  writeFileSync(stranger, strangerRootPem)
  const servers: Servers = new Servers()
  const s: Site[] = servers.sites
  const pid: i32 = spawnProcess([
    "/usr/bin/env",
    `https_proxy=http://127.0.0.1:${servers.proxyPort}`,
    "no_proxy=127.0.0.1",
    self,
    "client",
    `${s[0].port}`,
    `${s[1].port}`,
    `${s[2].port}`,
    `${s[3].port}`,
    `${servers.proxyPort}`,
    trusted,
    stranger,
  ])
  if (pid <= 0) {
    console.log("FAIL  the client could not be started")
    return 1
  }
  return servers.serve(pid)
}
