// WP49 stage 5: `await fetch(url, init)` keeps fetchSync's policy. The
// target check, the env proxy, redirects, the body cap, the outbound policy
// and the HTTP_E_* codes come from code the two share; this checks each
// shared path once from the async side, against a scripted server in the
// same process. The program re-runs itself under `/usr/bin/env` so the
// child sees `http_proxy` (this server) and `no_proxy=127.0.0.1`, handing
// the child its listening socket as descriptor 3.
import { awaitAll } from "nish:async"
import { realpathSync } from "nish:fs"
import { netClose, netLocalPort, tcpListen } from "nish:net"
import { platform, spawnWithFds, waitPid } from "nish:process"
import { HTTP_E_BLOCKED, HTTP_E_BODY_TOO_LARGE, HTTP_E_REDIRECT_REFUSED, HTTP_E_TLS, HTTP_E_TOO_MANY_REDIRECTS, HTTP_E_URL, FetchPool, FetchResponse, RequestInit, fetch, httpErrorName } from "nish/net/fetch"
import { OutboundPolicy } from "nish/net/outbound"
import { Control, serveScripted } from "./server"

class Tally {
  passed: i32 = 0
  failed: i32 = 0

  check(ok: boolean, label: string): void {
    if (ok) {
      this.passed += 1
      console.log(`PASS  ${label}`)
    } else {
      this.failed += 1
      console.log(`FAIL  ${label}`)
    }
  }
}

/** What a fetch answered: a response, or the name of its error and its text. */
class Outcome {
  res: FetchResponse | null = null
  error: string = ""
  text: string = ""
}

async function get(url: string, init: RequestInit): Promise<Outcome> {
  const out: Outcome = new Outcome()
  const r = await fetch(url, init)
  if (r.isErr()) {
    out.error = httpErrorName(r.error.code)
    out.text = r.error.text
  } else {
    out.res = r.value
  }
  return out
}

function status(o: Outcome): i32 {
  const res: FetchResponse | null = o.res
  return res !== null ? res.status : 0
}

function body(o: Outcome): string {
  const res: FetchResponse | null = o.res
  return res !== null ? res.text() : ""
}

function bytes(s: string): u8[] {
  const out: u8[] = []
  for (let i: i32 = 0; i < s.length; i += 1) {
    out.push(toU8(s.charCodeAt(i)))
  }
  return out
}

function following(): RequestInit {
  const init: RequestInit = new RequestInit()
  init.options.followRedirects = true
  return init
}

async function checks(port: i32, control: Control): Promise<i32> {
  const t: Tally = new Tally()
  const base: string = `http://127.0.0.1:${port}`

  // --- the request, direct and through the env proxy
  const direct: Outcome = await get(`${base}/echo`, new RequestInit())
  t.check(status(direct) === 200 && body(direct).startsWith(`GET /echo HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\n`), "a host in no_proxy is fetched directly, the target origin-form")
  const proxied: Outcome = await get("http://example.test:81/echo?q=1", new RequestInit())
  t.check(body(proxied).startsWith("GET http://example.test:81/echo?q=1 HTTP/1.1\r\nHost: example.test:81\r\n"), "through http_proxy the target is absolute-form, the Host the origin's")
  const post: RequestInit = new RequestInit().header("X-Kept", "yes")
  post.method = "POST"
  post.body = bytes("a=1")
  const o1: Outcome = await get(`${base}/echo`, post)
  const posted: string = body(o1)
  t.check(posted.startsWith("POST /echo HTTP/1.1\r\n") && posted.indexOf("\r\nX-Kept: yes\r\n") >= 0 && posted.indexOf("\r\nContent-Length: 3\r\n") >= 0 && posted.endsWith("\r\n\r\na=1"), "a POST carries the caller's fields and its body, framed by Content-Length")
  const missing: Outcome = await get(`${base}/nothing`, new RequestInit())
  t.check(status(missing) === 404 && missing.error.length === 0, "a 404 is an answer, not an error")

  // --- redirects
  const o2: Outcome = await get(`${base}/to-echo`, new RequestInit())
  t.check(status(o2) === 302, "a redirect is answered as it is by default")
  const followed: Outcome = await get(`${base}/to-echo`, following())
  const followedRes: FetchResponse | null = followed.res
  t.check(status(followed) === 200 && followedRes !== null && followedRes.url === `${base}/echo`, "followed, it ends at the Location, which `url` names")
  const o3: Outcome = await get(`${base}/to-other`, following())
  t.check(o3.error === httpErrorName(HTTP_E_REDIRECT_REFUSED), "a redirect to another origin is HTTP_E_REDIRECT_REFUSED")
  const o13: Outcome = await get(`${base}/to-echo-short`, following())
  t.check(status(o13) === 200 && o13.error.length === 0, "a redirect whose own body fails to read is still followed")
  const crossing: RequestInit = following().header("Authorization", "Bearer s3cret").header("X-Kept", "yes")
  crossing.options.crossOriginRedirects = true
  const o14: Outcome = await get(`${base}/to-other`, crossing)
  const crossed: string = body(o14)
  t.check(crossed.startsWith(`GET http://localhost:${port}/echo HTTP/1.1\r\n`) && crossed.indexOf("Authorization") < 0 && crossed.indexOf("\r\nX-Kept: yes\r\n") >= 0, "a hop to another origin drops Authorization and keeps the caller's other fields")
  const looping: RequestInit = following()
  looping.options.maxRedirects = 2
  const o4: Outcome = await get(`${base}/loop`, looping)
  t.check(o4.error === httpErrorName(HTTP_E_TOO_MANY_REDIRECTS), "past maxRedirects it is HTTP_E_TOO_MANY_REDIRECTS")

  // --- limits and refusals
  const capped: RequestInit = new RequestInit()
  capped.options.maxBodyBytes = 10
  const o5: Outcome = await get(`${base}/big`, capped)
  t.check(o5.error === httpErrorName(HTTP_E_BODY_TOO_LARGE), "a body past maxBodyBytes is HTTP_E_BODY_TOO_LARGE")
  const o6: Outcome = await get(`${base}/big`, new RequestInit())
  t.check(status(o6) === 200, "and under it is read whole")
  const o7: Outcome = await get("not a url", new RequestInit())
  t.check(o7.error === httpErrorName(HTTP_E_URL), "a target that does not parse is HTTP_E_URL")
  const https: Outcome = await get(`https://127.0.0.1:${port}/`, new RequestInit())
  t.check(https.error === httpErrorName(HTTP_E_TLS) && https.text.indexOf("fetchSync") >= 0, "an https URL is HTTP_E_TLS, naming fetchSync, without a connection")
  const guarded: RequestInit = new RequestInit()
  guarded.options.outbound = new OutboundPolicy()
  const o8: Outcome = await get(`${base}/echo`, guarded)
  t.check(o8.error === httpErrorName(HTTP_E_BLOCKED), "a loopback address the outbound policy refuses is HTTP_E_BLOCKED")
  const o15: Outcome = await get(`http://u:pw-s3cret@127.0.0.1:${port}/echo?token=T0K`, guarded)
  t.check(o15.error === httpErrorName(HTTP_E_BLOCKED) && o15.text.indexOf("pw-s3cret") < 0 && o15.text.indexOf("T0K") < 0 && o15.text.length > 0, "and its error text holds neither the password nor the query")

  // --- the connection pool
  const pool: FetchPool = new FetchPool()
  const pooled: RequestInit = new RequestInit()
  pooled.pool = pool
  const o9: Outcome = await get(`${base}/keep/conn`, pooled)
  const p1: string = body(o9)
  t.check(pool.idle() === 1, "a kept-alive answer leaves its connection idle in the pool")
  const o10: Outcome = await get(`${base}/keep/conn`, pooled)
  const p2: string = body(o10)
  t.check(p1.length > 0 && p1 === p2, "and the next fetch to that origin takes it")
  const o11: Outcome = await get(`${base}/keep/conn`, new RequestInit())
  const n1: string = body(o11)
  const o12: Outcome = await get(`${base}/keep/conn`, new RequestInit())
  const n2: string = body(o12)
  t.check(n1.length > 0 && n1 !== n2, "without a pool each fetch has a connection of its own")
  pool.close()
  t.check(pool.idle() === 0, "close() closes the idle connections")

  control.stopping = true
  await get(`${base}/bye`, new RequestInit())
  console.log(`async fetch policy: ${t.passed} passed, ${t.failed} failed`)
  return t.failed
}

async function child(port: i32): Promise<i32> {
  const control: Control = new Control()
  const [accepted, failed] = await awaitAll(serveScripted(3, port, control), checks(port, control))
  return accepted > 0 ? failed : 1
}

function selfPath(): string {
  const exe: string | null = platform === "linux" ? realpathSync("/proc/self/exe") : null
  return exe !== null ? exe : process.argv[0]
}

function argDecimal(s: string): i32 {
  let v: i32 = 0
  for (let i: i32 = 0; i < s.length; i += 1) {
    v = v * 10 + toI32(s.charCodeAt(i)) - 48
  }
  return v
}

export async function main(): Promise<i32> {
  const argv: string[] = process.argv
  if (argv.length >= 3 && argv[1] === "child") {
    return await child(argDecimal(argv[2]))
  }
  const listen: i32 = tcpListen("127.0.0.1", 0, 16)
  if (listen < 0) {
    return 1
  }
  const port: i32 = netLocalPort(listen)
  const argvChild: string[] = ["/usr/bin/env", `http_proxy=http://127.0.0.1:${port}`, "no_proxy=127.0.0.1", selfPath(), "child", `${port}`]
  const pid: i32 = spawnWithFds(argvChild, [listen])
  netClose(listen)
  if (pid <= 0) {
    console.log("FAIL  the child could not be started")
    return 1
  }
  const done: i32[] = waitPid(pid, 0)
  return done[1]
}
