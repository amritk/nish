/**
 * `nish/net/http-client` — a blocking HTTP/1.1 client for command-line
 * programs: `httpFetch(request, options)` dials, sends, and answers the
 * response's head with a reader for its body, and an `HttpClient` does the
 * same while keeping one connection alive between fetches.
 *
 *     import { HttpOptions, HttpRequest, HttpResponse, httpFetch } from "nish/net/http-client";
 *
 *     const req = new HttpRequest("GET", "http://example.com/");
 *     req.header("Accept", "application/json");
 *     const res: HttpResponse | null = httpFetch(req, new HttpOptions());
 *     if (res !== null) {
 *       const body: u8[] | null = res.body.readAll(1048576);
 *     }
 *
 * **It blocks the thread** at every step, the way a CLI wants it to: the
 * lookup, the connect, each write and each read. A server, which must not
 * stall every connection for one slow peer, drives `nish/net/http1-client`'s
 * parser from its own loop instead. Every wait is bounded: `connectTimeoutMs`
 * for the lookup and the connect (one budget across every address the name
 * has), `readTimeoutMs` for each wait on the peer, and `totalTimeoutMs`, when
 * set, for the whole fetch, redirects and body included, so a server that
 * drips one byte a second cannot hold a fetch forever.
 *
 * **Framing is the parser's.** The head is written by `http1RequestHead` and
 * every byte read goes through `Http1ResponseParser`, so a value holding a CR
 * or LF is refused rather than sent, and every response-smuggling shape is
 * refused with the parser's own code (see `docs/security/http1-client.md`).
 *
 * **Keep-alive** holds one connection, to the last origin (or proxy) used. A
 * fetch to the same place reuses it once the last body has been read to its
 * end; a fetch while a body is unread closes it, and the old reader answers an
 * error. A reused connection the server closed while it sat idle is the one
 * failure a client cannot avoid, so a request with an idempotent method that
 * fails on it before any response byte arrives is sent once more on a fresh
 * connection (RFC 9110 §9.2.2). A POST is never sent twice.
 *
 * **Redirects** are not followed unless `followRedirects` is set, and then
 * only to the same origin unless `crossOriginRedirects` is set too. A hop to
 * another origin drops `Authorization`, `Proxy-Authorization`, `Cookie` and
 * the caller's `Host`; a hop from https to http is always refused; 303 turns
 * any method but HEAD into a GET without a body, as do 301 and 302 after a
 * POST, and 307 and 308 keep the method and the body (RFC 9110 §15.4). Past
 * `maxRedirects` hops the fetch fails.
 *
 * **Proxies** come from the environment when `useEnvProxy` is set:
 * `http_proxy` (or `HTTP_PROXY`), `https_proxy` (or `HTTPS_PROXY`) and
 * `no_proxy` (or `NO_PROXY`), the lower-case name first. `HTTP_PROXY` is
 * ignored when `REQUEST_METHOD` is set, since a CGI program finds a request's
 * `Proxy:` header there under that name (the "httpoxy" hole). Only an
 * `http://` proxy is accepted. An http request goes to it in absolute form; an
 * https one goes through a `CONNECT` tunnel.
 *
 * Every failure answers null with a distinct `HTTP_E_*` code in the client's
 * `error` and a sentence in `errorText`; a body reader answers the code
 * negated.
 *
 * Private helpers share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e), which is why each one carries the module's name.
 *
 * Written from RFC 9110 and RFC 9112, not ported from another implementation.
 */
import { base64Encode } from "nish/base64"
import { copyBytes } from "nish/bytes"
import {
  HTTP1_BODY,
  HTTP1_CLOSED,
  HTTP1_END,
  HTTP1_ERROR,
  HTTP1_HEAD,
  HTTP1_NEED_MORE,
  HTTP1_UPGRADE,
} from "nish/net/http1"
import {
  HTTP1_E_BODY_LIMIT,
  HTTP1_INFORMATIONAL,
  Http1ResponseParser,
  http1RequestHead,
} from "nish/net/http1-client"
import { Url, urlDecode, urlDefaultPort, urlOrigin, urlParse, urlResolve } from "nish/net/url"
import { resolveHost } from "nish/net/dns"
import { DNS_ADDRESS_BYTES } from "nish/net/dns-message"
import { DNS_RESOLVE_MAX_ADDRESSES, DNS_RESOLVE_TIMEOUT } from "nish/net/dns-resolver"
import {
  connectResult,
  netClose,
  netRead,
  netWrite,
  pollAdd,
  pollCreate,
  pollModify,
  pollRemove,
  pollWait,
  tcpConnect,
} from "nish:net"
import { getenv, monotonicNanos, wallClockNanos } from "nish:process"
import { PkiRoots, pkiLoadRoots, pkiLoadSystemRoots } from "nish/crypto/pki-roots"
import { TlsClient, TlsClientConfig } from "nish/net/tls/client"
import { TLS_RECORD_AUTH, TlsRecordClient } from "nish/net/tls/record-client"
import { TLS_RECORD_AGAIN, TLS_RECORD_STATE_FAILED, TLS_RECORD_STATE_OPEN } from "nish/net/tls/record-server"
import { TlsClientTrust, tlsClientTrust, tlsClientVerdict } from "nish/net/tls/verify"

/** No error. */
export const HTTP_E_NONE: i32 = 0
/** The request's URL is not an absolute http or https URL. */
export const HTTP_E_URL: i32 = 1
/** The host's name could not be looked up, or has no address. */
export const HTTP_E_DNS: i32 = 2
/** Every address of the host refused the connection, or could not be reached. */
export const HTTP_E_REFUSED: i32 = 3
/** No address of the host answered within `connectTimeoutMs`. */
export const HTTP_E_CONNECT_TIMEOUT: i32 = 4
/** The server sent nothing, or took nothing, for `readTimeoutMs`. */
export const HTTP_E_READ_TIMEOUT: i32 = 5
/** The fetch ran past `totalTimeoutMs`. */
export const HTTP_E_TOTAL_TIMEOUT: i32 = 6
/** The response broke HTTP/1.1; `errorText` names the parser's code. */
export const HTTP_E_PROTOCOL: i32 = 7
/** A redirect past `maxRedirects`. */
export const HTTP_E_TOO_MANY_REDIRECTS: i32 = 8
/** A redirect to another origin, from https to http, or to a URL that is not http or https. */
export const HTTP_E_REDIRECT_REFUSED: i32 = 9
/** A body over `maxBodyBytes`, or over the limit given to `readAll`. */
export const HTTP_E_BODY_TOO_LARGE: i32 = 10
/** The proxy answered its CONNECT with something other than 2xx. */
export const HTTP_E_PROXY_REFUSED: i32 = 11
/** The TLS handshake or a TLS record failed. */
export const HTTP_E_TLS: i32 = 12
/** The server's certificate chain was not accepted for its host. */
export const HTTP_E_CERTIFICATE: i32 = 13
/** The request itself was refused before a byte was sent: a bad method, header or target. */
export const HTTP_E_REQUEST: i32 = 14
/** A socket call failed, or the server closed the connection before it answered. */
export const HTTP_E_IO: i32 = 15
/** A proxy setting that is not an `http://` URL with a host. */
export const HTTP_E_PROXY: i32 = 16

/** A typed zero: a bare literal is an `f64` under `--number-mode f64`. */
const HTTP_CLIENT_ZERO: i32 = 0
/** The read size `drain` asks a body for. */
const HTTP_CLIENT_DRAIN_CHUNK: i32 = 4096

/** The size of the client's read buffer: one netRead fills at most this. */
const HTTP_CLIENT_READ_BYTES: i32 = 16384
/** The most header fields a response may carry. */
const HTTP_CLIENT_MAX_HEADERS: i32 = 256
/** The most body bytes a redirect may carry and still leave its connection kept. */
const HTTP_CLIENT_DRAIN_BYTES: i32 = 65536
/** The port a proxy URL without one is dialled on, as curl does. */
const HTTP_CLIENT_PROXY_PORT: i32 = 1080
/** The longest single poll wait, so a deadline far away never overflows an `i32` of milliseconds. */
const HTTP_CLIENT_MAX_WAIT_MS: i64 = 3600000
/** Nanoseconds in a millisecond. */
const HTTP_CLIENT_NS_PER_MS: i64 = 1000000
/** A deadline that never comes: 146 years of monotonic nanoseconds, far below the overflow of a sum with a timeout. */
const HTTP_CLIENT_NEVER: i64 = 4611686018 * 1000000000
/** netRead's and netWrite's answer when the socket has nothing ready. */
const HTTP_CLIENT_WOULD_BLOCK: i32 = -11
/** pollAdd's events: readable, writable. */
const HTTP_CLIENT_READABLE: i32 = 1
const HTTP_CLIENT_WRITABLE: i32 = 2
/** The size of the client random and of each ephemeral private key a TLS handshake draws. */
const HTTP_CLIENT_TLS_KEY_BYTES: i32 = 32

/** A short name for an `HTTP_E_*` code, for messages: "dns", "read timeout", ... */
export const httpErrorName = (code: i32): string => {
  if (code === HTTP_E_NONE) {
    return "none"
  }
  if (code === HTTP_E_URL) {
    return "url"
  }
  if (code === HTTP_E_DNS) {
    return "dns"
  }
  if (code === HTTP_E_REFUSED) {
    return "refused"
  }
  if (code === HTTP_E_CONNECT_TIMEOUT) {
    return "connect timeout"
  }
  if (code === HTTP_E_READ_TIMEOUT) {
    return "read timeout"
  }
  if (code === HTTP_E_TOTAL_TIMEOUT) {
    return "total timeout"
  }
  if (code === HTTP_E_PROTOCOL) {
    return "protocol"
  }
  if (code === HTTP_E_TOO_MANY_REDIRECTS) {
    return "too many redirects"
  }
  if (code === HTTP_E_REDIRECT_REFUSED) {
    return "redirect refused"
  }
  if (code === HTTP_E_BODY_TOO_LARGE) {
    return "body too large"
  }
  if (code === HTTP_E_PROXY_REFUSED) {
    return "proxy refused"
  }
  if (code === HTTP_E_TLS) {
    return "tls"
  }
  if (code === HTTP_E_CERTIFICATE) {
    return "certificate"
  }
  if (code === HTTP_E_REQUEST) {
    return "request"
  }
  if (code === HTTP_E_IO) {
    return "io"
  }
  if (code === HTTP_E_PROXY) {
    return "proxy"
  }
  return "unknown"
}

/**
 * One request: a method, an absolute `http://` or `https://` URL, header
 * fields in the order they are sent, and an optional body. A `Host` field is
 * added from the URL unless the caller gives one, and `Content-Length` from
 * the body, so a caller never frames the body itself. Userinfo in the URL is
 * not sent anywhere: a program that means to authenticate sets its own
 * `Authorization` field, so a password is never sent by accident.
 */
export class HttpRequest {
  method: string
  url: string
  names: string[]
  values: string[]
  /** Null for no body at all; an empty array sends `Content-Length: 0`. */
  body: u8[] | null = null

  constructor(method: string, url: string) {
    this.method = method
    this.url = url
    this.names = []
    this.values = []
  }

  /** Appends one header field; nothing is checked until the request is written. */
  header(name: string, value: string): void {
    this.names.push(name)
    this.values.push(value)
  }
}

/**
 * How a client behaves. Every field has a default meant for a CLI talking to
 * an API; raise `maxBodyBytes` to download something large, and set
 * `readTimeoutMs` to 0 for an event stream that may be quiet for a long time.
 */
export class HttpOptions {
  // Declared widest first, so no byte of a value is padding.
  /** 256 MiB by default; a body past it fails with `HTTP_E_BODY_TOO_LARGE`. */
  maxBodyBytes: i64 = 268435456
  /** A PEM file of the roots an https server's chain must end at; null for the system's. */
  rootsPemPath: string | null = null
  /** The budget for the lookup and the connect together; 0 or less for none but the total. */
  connectTimeoutMs: i32 = 10000
  /** The longest wait for the server to send or take a byte; 0 or less for none. */
  readTimeoutMs: i32 = 30000
  /** The budget for a whole fetch, its body included; 0 or less for none. */
  totalTimeoutMs: i32 = 0
  maxRedirects: i32 = 5
  /** The status line and the header section, each at most this. */
  maxHeaderBytes: i32 = 65536
  followRedirects: boolean = false
  crossOriginRedirects: boolean = false
  /** Read the proxy settings from the environment (see the module comment). */
  useEnvProxy: boolean = true
}

/**
 * A response's head, as the server sent it, and a reader for its body. `url`
 * is the URL that answered, which differs from the request's after a redirect.
 * `names` are lower-cased and in the order they arrived, beside `values`.
 */
export class HttpResponse {
  status: i32 = 0
  reason: string = ""
  url: string = ""
  names: string[]
  values: string[]
  body: HttpBodyReader

  constructor(body: HttpBodyReader) {
    this.names = []
    this.values = []
    this.body = body
  }

  /** The first value of the field `name`, in any case; null when the response has none. */
  header(name: string): string | null {
    const lower: string = httpClientLower(name)
    for (let i: i32 = 0; i < toI32(this.names.length) && i < toI32(this.values.length); i += 1) {
      if (this.names[i] === lower) {
        return this.values[i]
      }
    }
    return null
  }
}

/**
 * A response's body, read as it arrives: de-chunked, bounded by
 * `maxBodyBytes`, and ending where the framing says it ends, so a cut-short
 * body is an error and never taken for a whole one. It reads through the
 * client that made it, and only until that client starts its next fetch.
 */
export class HttpBodyReader {
  client: HttpClient
  generation: i32

  constructor(client: HttpClient, generation: i32) {
    this.client = client
    this.generation = generation
  }

  /**
   * Up to `n` body bytes into `buf[off ..]`: how many (at least one), 0 at
   * the end of the body, or a negated `HTTP_E_*` code, the client's
   * `errorText` saying why. It waits for at least one byte, no more, so an
   * event stream is read event by event. A window outside `buf` panics.
   */
  read(buf: u8[], off: i32, n: i32): i32 {
    if (off < 0 || n < 0 || off + n > toI32(buf.length)) {
      panic("HttpBodyReader.read: the window is outside the buffer")
    }
    return this.client.readBody(this.generation, buf, off, n)
  }

  /**
   * The rest of the body in one array, or null on an error or once it passes
   * `limit` bytes (`HTTP_E_BODY_TOO_LARGE`, and the connection is closed).
   */
  readAll(limit: i32): u8[] | null {
    let size: i32 = 4096
    if (limit < 0) {
      size = 0
    } else if (limit < 4096) {
      size = limit
    }
    let out: u8[] = new Array<u8>(size)
    let len: i32 = 0
    const chunk: u8[] = new Array<u8>(HTTP_CLIENT_READ_BYTES)
    let n: i32 = this.read(chunk, HTTP_CLIENT_ZERO, HTTP_CLIENT_READ_BYTES)
    while (n > 0) {
      if (n > limit - len) {
        this.client.refuseBody(limit)
        return null
      }
      if (len + n > toI32(out.length)) {
        let cap: i32 = toI32(out.length) * 2
        if (cap < len + n) {
          cap = len + n
        }
        if (cap > limit) {
          cap = limit
        }
        const grown: u8[] = new Array<u8>(cap)
        copyBytes(grown, 0, out, 0, len)
        out = grown
      }
      copyBytes(out, len, chunk, 0, n)
      len += n
      n = this.read(chunk, HTTP_CLIENT_ZERO, HTTP_CLIENT_READ_BYTES)
    }
    if (n < 0) {
      return null
    }
    if (len === toI32(out.length)) {
      return out
    }
    const exact: u8[] = new Array<u8>(len)
    copyBytes(exact, 0, out, 0, len)
    return exact
  }
}

/**
 * A client: the options, the proxy settings, and at most one open
 * connection, kept between fetches. Not for two threads at once.
 */
export class HttpClient {
  // Declared widest first, so no byte of a client is padding.
  options: HttpOptions
  errorText: string = ""
  /** The proxy settings in use; "" for none. `setProxies` replaces them. */
  httpProxy: string = ""
  httpsProxy: string = ""
  noProxy: string = ""
  /** Where `fd` leads: an origin, or the proxy an http request went through. */
  route: string = ""
  parser: Http1ResponseParser
  /** The TLS connection over `fd` to an https origin; null over plain http. */
  tls: TlsRecordClient | null = null
  /** The roots an https server's chain must end at, read on the client's first https fetch. */
  trust: TlsClientTrust | null = null
  ready: i32[]
  rbuf: u8[]
  /** Where TLS application data is read before the parser takes it; empty until the first https connection. */
  plain: u8[]
  /** The fetch's end in monotonic nanoseconds; `HTTP_CLIENT_NEVER` for none. */
  deadline: i64 = 0
  /** The last failure's `HTTP_E_*` code; `HTTP_E_NONE` after a fetch that answered. */
  error: i32 = 0
  fd: i32 = -1
  /** The fd registered in `loop`, and for what. */
  loop: i32 = -1
  watched: i32 = -1
  watchedEvents: i32 = 0
  /** Counts responses; a reader reads only while its own is the open one. */
  generation: i32 = 0
  /** How the latest response's body failed, `HTTP_E_NONE` while it has not; its reader answers it again. */
  bodyError: i32 = 0
  /** Where the latest response's unread body bytes start in `parser`, and how many. */
  pendOff: i32 = 0
  pendLen: i32 = 0
  /** Whether `fd` has carried a response before the one in flight. */
  reused: boolean = false
  /** Whether any byte of the response in flight has arrived. */
  gotByte: boolean = false
  /** Whether the failure in hand was the connection going away, which a retry may cure. */
  lost: boolean = false
  /** Whether the latest response's body is unread. */
  bodyOpen: boolean = false
  /** Whether this is `httpFetch`'s client, closed whole once its one body is done with. */
  once: boolean = false

  constructor(options: HttpOptions) {
    this.options = options
    this.parser = httpClientParser(options)
    this.ready = new Array<i32>(8)
    this.rbuf = new Array<u8>(HTTP_CLIENT_READ_BYTES)
    this.plain = []
    if (options.useEnvProxy) {
      const cgi: boolean = getenv("REQUEST_METHOD") !== null
      this.httpProxy = httpChooseProxy(getenv("http_proxy"), getenv("HTTP_PROXY"), !cgi)
      this.httpsProxy = httpChooseProxy(getenv("https_proxy"), getenv("HTTPS_PROXY"), true)
      this.noProxy = httpChooseProxy(getenv("no_proxy"), getenv("NO_PROXY"), true)
    }
  }

  /** Replaces the proxy settings, as the three variables would set them; "" for none. */
  setProxies(httpProxy: string, httpsProxy: string, noProxy: string): void {
    this.httpProxy = httpProxy
    this.httpsProxy = httpsProxy
    this.noProxy = noProxy
  }

  /**
   * Sends `req` and answers the response once its head is in, following
   * redirects as the options say; null on a failure, with `error` and
   * `errorText` set. The body is read through the response's `body` before
   * the next fetch.
   */
  fetch(req: HttpRequest): HttpResponse | null {
    this.error = HTTP_E_NONE
    this.errorText = ""
    if (this.bodyOpen) {
      // An unread body is still on the wire ahead of the next response.
      this.drop()
    }
    this.generation += 1
    const total: i32 = this.options.totalTimeoutMs
    this.deadline = total > 0 ? monotonicNanos() + toI64(total) * HTTP_CLIENT_NS_PER_MS : HTTP_CLIENT_NEVER
    let url: Url | null = urlParse(req.url)
    if (url === null || (url.scheme !== "http" && url.scheme !== "https")) {
      this.fail(HTTP_E_URL, `not an absolute http or https URL: ${req.url}`)
      return null
    }
    let method: string = req.method
    let body: u8[] | null = req.body
    const names: string[] = []
    const values: string[] = []
    for (let i: i32 = 0; i < toI32(req.names.length) && i < toI32(req.values.length); i += 1) {
      names.push(req.names[i])
      values.push(req.values[i])
    }
    let hops: i32 = 0
    while (url !== null) {
      const res: HttpResponse | null = this.exchange(url, method, names, values, body)
      if (res === null) {
        return null
      }
      const location: string | null = res.header("location")
      if (!this.options.followRedirects || location === null || !httpClientIsRedirect(res.status)) {
        return res
      }
      if (hops >= this.options.maxRedirects) {
        this.drop()
        this.fail(
          HTTP_E_TOO_MANY_REDIRECTS,
          `more than ${this.options.maxRedirects} redirects, the last to ${location}`
        )
        return null
      }
      const next: Url | null = urlResolve(url, location)
      if (next === null || (next.scheme !== "http" && next.scheme !== "https")) {
        this.drop()
        this.fail(HTTP_E_REDIRECT_REFUSED, `a redirect to ${location}, which is not an http or https URL`)
        return null
      }
      if (url.scheme === "https" && next.scheme === "http") {
        this.drop()
        this.fail(HTTP_E_REDIRECT_REFUSED, `a redirect from https to http (${location})`)
        return null
      }
      const from: string | null = urlOrigin(url)
      const to: string | null = urlOrigin(next)
      if (from === null || to === null || from !== to) {
        if (!this.options.crossOriginRedirects) {
          this.drop()
          this.fail(HTTP_E_REDIRECT_REFUSED, `a redirect to another origin (${location})`)
          return null
        }
        // Credentials were meant for the first origin, not for wherever it points.
        httpClientDropField(names, values, "authorization")
        httpClientDropField(names, values, "proxy-authorization")
        httpClientDropField(names, values, "cookie")
        httpClientDropField(names, values, "host")
      }
      const status: i32 = res.status
      if (
        (status === 303 && method !== "HEAD") ||
        ((status === 301 || status === 302) && method === "POST")
      ) {
        method = "GET"
        body = null
        httpClientDropField(names, values, "content-type")
      }
      this.drain()
      hops += 1
      url = next
    }
    return null
  }

  /** Closes the connection; the client can still fetch, on a new one. */
  close(): void {
    this.drop()
    if (this.loop >= 0) {
      netClose(this.loop)
      this.loop = -1
    }
  }

  /**
   * One request and its response's head, on the kept connection when it
   * leads to the same place, once more on a fresh one when a kept connection
   * turns out to be gone (see the module comment).
   */
  exchange(
    url: Url,
    method: string,
    names: string[],
    values: string[],
    body: u8[] | null
  ): HttpResponse | null {
    for (let attempt: i32 = 0; attempt < 2; attempt += 1) {
      if (!this.open(url)) {
        return null
      }
      const res: HttpResponse | null = this.send(url, method, names, values, body)
      if (res !== null) {
        return res
      }
      const retry: boolean = this.reused && this.lost && !this.gotByte && httpClientIdempotent(method)
      this.drop()
      if (!retry) {
        return null
      }
      this.error = HTTP_E_NONE
      this.errorText = ""
    }
    return null
  }

  /**
   * Makes `fd` a connection to where `url` goes: the kept one when it leads
   * there, else a new one, through a proxy when the settings say so. False on
   * a failure, with the error set.
   */
  open(url: Url): boolean {
    const port: i32 = url.port >= 0 ? url.port : urlDefaultPort(url.scheme)
    const proxyText: string = httpProxyFor(
      url.scheme,
      url.host,
      port,
      this.httpProxy,
      this.httpsProxy,
      this.noProxy
    )
    let proxy: Url | null = null
    if (proxyText !== "") {
      proxy = httpClientProxyUrl(proxyText)
      if (proxy === null) {
        this.fail(HTTP_E_PROXY, `the proxy setting is not an http:// URL with a host: ${proxyText}`)
        return false
      }
    }
    const origin: string = `${url.scheme}://${httpClientHostText(url.host)}:${port}`
    let route: string = origin
    if (proxy !== null && url.scheme === "http") {
      route = `proxy ${httpClientHostText(proxy.host)}:${proxy.port}`
    } else if (proxy !== null) {
      route = `${origin} via ${httpClientHostText(proxy.host)}:${proxy.port}`
    }
    if (this.fd >= 0 && this.route === route) {
      this.reused = true
      return true
    }
    this.drop()
    this.reused = false
    // The roots come first, so a client with none never reaches the network.
    if (url.scheme === "https" && !this.loadTrust()) {
      return false
    }
    const dialHost: string = proxy !== null ? proxy.host : url.host
    const dialPort: i32 = proxy !== null ? proxy.port : port
    const fd: i32 = this.dial(dialHost, dialPort)
    if (fd < 0) {
      return false
    }
    this.fd = fd
    this.route = route
    this.parser = httpClientParser(this.options)
    if (url.scheme === "https") {
      let early: u8[] = []
      if (proxy !== null) {
        if (!this.tunnel(url.host, port, proxy)) {
          this.drop()
          return false
        }
        early = this.parser.tunnelBytes()
        this.parser = httpClientParser(this.options)
      }
      if (!this.secure(url.host, early)) {
        this.drop()
        return false
      }
    }
    return true
  }

  /**
   * Reads the roots an https server's chain must end at, once per client:
   * the PEM file `rootsPemPath` names, else the system's. False, with the
   * error set, when none could be read, since no server could then be trusted.
   */
  loadTrust(): boolean {
    if (this.trust !== null) {
      return true
    }
    const path: string | null = this.options.rootsPemPath
    const roots: PkiRoots = path !== null ? pkiLoadRoots(path, [], []) : pkiLoadSystemRoots()
    if (toI32(roots.roots.length) === 0) {
      const where: string = path !== null ? path : "SSL_CERT_FILE, SSL_CERT_DIR or the system's bundle"
      this.fail(HTTP_E_CERTIFICATE, `no trusted root certificate could be read from ${where}`)
      return false
    }
    this.trust = tlsClientTrust(roots)
    return true
  }

  /**
   * Runs a TLS 1.3 handshake for `host` over the fresh `fd`, `early` being
   * what the proxy sent past its CONNECT answer. The server's chain and
   * CertificateVerify are checked under the client's roots at the wall
   * clock's time before its Finished is read. True once the connection is
   * open and the client's last flight sent; false with the error set.
   */
  secure(host: string, early: u8[]): boolean {
    const trust: TlsClientTrust | null = this.trust
    if (trust === null) {
      this.fail(HTTP_E_CERTIFICATE, "no trusted root certificates are loaded")
      return false
    }
    const random: u8[] = new Array<u8>(HTTP_CLIENT_TLS_KEY_BYTES)
    const x25519: u8[] = new Array<u8>(HTTP_CLIENT_TLS_KEY_BYTES)
    const p256: u8[] = new Array<u8>(HTTP_CLIENT_TLS_KEY_BYTES)
    crypto.getRandomValues(random)
    crypto.getRandomValues(x25519)
    crypto.getRandomValues(p256)
    // `TlsClient` copies both keys and zeroes these arrays.
    const conn: TlsRecordClient = new TlsRecordClient(
      new TlsClient(new TlsClientConfig(host, ["http/1.1"]), random, x25519, p256)
    )
    this.tls = conn
    if (toI32(this.plain.length) === 0) {
      this.plain = new Array<u8>(HTTP_CLIENT_READ_BYTES)
    }
    if (toI32(early.length) > 0) {
      conn.receive(early, HTTP_CLIENT_ZERO, toI32(early.length))
    }
    // The connection opens on the server's Finished, with the client's own
    // perhaps still queued: it is sent before the request is.
    while (conn.state !== TLS_RECORD_STATE_OPEN || conn.outputEnd > conn.outputStart) {
      if ((conn.interest() & TLS_RECORD_AUTH) !== 0) {
        const verdict: i32 = tlsClientVerdict(conn.tls, trust, wallClockNanos() / HTTP_CLIENT_NS_PER_MS)
        if (verdict !== 0) {
          conn.reject(verdict)
          this.fail(
            HTTP_E_CERTIFICATE,
            `the certificate ${host} presented was refused (TLS alert ${verdict})`
          )
          return false
        }
        conn.authenticate(true)
      }
      if (conn.state === TLS_RECORD_STATE_FAILED) {
        this.failTls(conn)
        return false
      }
      const moved: boolean = conn.outputEnd > conn.outputStart ? this.flushTls(conn) : this.receiveTls(conn)
      if (!moved) {
        return false
      }
    }
    return true
  }

  /**
   * Asks `proxy`, on the fresh `fd`, for a tunnel to `host:port`. True once
   * the proxy answers 2xx, every byte after its head belonging to the tunnel.
   */
  tunnel(host: string, port: i32, proxy: Url): boolean {
    const authority: string = `${httpClientHostText(host)}:${port}`
    const names: string[] = ["Host"]
    const values: string[] = [authority]
    const auth: string | null = httpClientProxyAuth(proxy)
    if (auth === null) {
      this.fail(HTTP_E_PROXY, "the proxy's user name or password is not valid percent-encoding")
      return false
    }
    if (auth !== "") {
      names.push("Proxy-Authorization")
      values.push(auth)
    }
    const head: u8[] | null = http1RequestHead("CONNECT", authority, names, values, toI64(-2))
    if (head === null) {
      this.fail(HTTP_E_REQUEST, `a CONNECT to ${authority} could not be written`)
      return false
    }
    this.gotByte = false
    this.parser.expect(false, true)
    if (!this.writeAll(head, HTTP_CLIENT_ZERO, toI32(head.length))) {
      return false
    }
    let event: i32 = this.head()
    if (event !== HTTP1_HEAD) {
      return false
    }
    const status: i32 = this.parser.status
    if (status < 200 || status > 299) {
      this.fail(HTTP_E_PROXY_REFUSED, `the proxy answered CONNECT ${authority} with ${status}`)
      return false
    }
    // A 2xx has no body: the parser ends it, then reports the tunnel.
    event = this.pump()
    while (event >= 0 && event !== HTTP1_UPGRADE) {
      event = this.pump()
    }
    return event === HTTP1_UPGRADE
  }

  /** Writes the request on `fd` and reads its response's head. */
  send(url: Url, method: string, names: string[], values: string[], body: u8[] | null): HttpResponse | null {
    const viaProxy: boolean = this.route.startsWith("proxy ")
    const sendNames: string[] = []
    const sendValues: string[] = []
    let hasHost: boolean = false
    let hasProxyAuth: boolean = false
    for (let i: i32 = 0; i < toI32(names.length) && i < toI32(values.length); i += 1) {
      // Read before any call, which is where the bounds proof forgets a length.
      const name: string = names[i]
      const value: string = values[i]
      hasHost = hasHost || httpClientNameIs(name, "host")
      const proxyAuth: boolean = httpClientNameIs(name, "proxy-authorization")
      if (proxyAuth && !viaProxy) {
        // Only an http proxy reads it: sent direct or through a tunnel, it
        // would hand the proxy's credentials to the origin.
        continue
      }
      hasProxyAuth = hasProxyAuth || proxyAuth
      sendNames.push(name)
      sendValues.push(value)
    }
    const hostText: string = httpClientHostText(url.host)
    const authority: string = url.port >= 0 ? `${hostText}:${url.port}` : hostText
    if (!hasHost) {
      sendNames.push("Host")
      sendValues.push(authority)
    }
    let target: string = url.path === "" ? "/" : url.path
    const query: string | null = url.query
    if (query !== null) {
      target = target + "?" + query
    }
    if (viaProxy) {
      target = `${url.scheme}://${authority}${target}`
      const proxy: Url | null = httpClientProxyUrl(this.httpProxy)
      const auth: string | null = proxy !== null ? httpClientProxyAuth(proxy) : ""
      if (auth === null) {
        this.fail(HTTP_E_PROXY, "the proxy's user name or password is not valid percent-encoding")
        return null
      }
      if (auth !== "" && !hasProxyAuth) {
        sendNames.push("Proxy-Authorization")
        sendValues.push(auth)
      }
    }
    const bodyLength: i64 = body !== null ? toI64(body.length) : toI64(-2)
    const head: u8[] | null = http1RequestHead(method, target, sendNames, sendValues, bodyLength)
    if (head === null) {
      this.fail(
        HTTP_E_REQUEST,
        `the request ${method} ${target} was refused: a bad method, target or header field`
      )
      return null
    }
    this.gotByte = false
    this.lost = false
    this.parser.expect(method === "HEAD", false)
    if (!this.writeAll(head, HTTP_CLIENT_ZERO, toI32(head.length))) {
      return null
    }
    if (body !== null && !this.writeAll(body, HTTP_CLIENT_ZERO, toI32(body.length))) {
      return null
    }
    const event: i32 = this.head()
    if (event !== HTTP1_HEAD) {
      return null
    }
    const res: HttpResponse = new HttpResponse(new HttpBodyReader(this, this.generation))
    res.status = this.parser.status
    res.reason = this.parser.reason
    res.url = httpClientUrlText(url)
    for (
      let i: i32 = 0;
      i < toI32(this.parser.names.length) && i < toI32(this.parser.values.length);
      i += 1
    ) {
      res.names.push(this.parser.names[i])
      res.values.push(this.parser.values[i])
    }
    this.bodyOpen = true
    this.bodyError = HTTP_E_NONE
    this.pendLen = 0
    return res
  }

  /** Reads up to the final response's head: `HTTP1_HEAD`, `HTTP1_UPGRADE`, or -1 with the error set. */
  head(): i32 {
    let event: i32 = this.pump()
    while (event === HTTP1_INFORMATIONAL) {
      event = this.pump()
    }
    if (event !== HTTP1_HEAD && event !== HTTP1_UPGRADE && event >= 0) {
      this.fail(HTTP_E_PROTOCOL, `the response ended before its head (event ${event})`)
      return -1
    }
    return event
  }

  /** The parser's next event, reading from the socket as it needs; -1 with the error set. */
  pump(): i32 {
    let event: i32 = this.parser.next()
    while (event === HTTP1_NEED_MORE) {
      if (!this.fill()) {
        return -1
      }
      event = this.parser.next()
    }
    if (event === HTTP1_ERROR) {
      const code: i32 = this.parser.error
      if (code === HTTP1_E_BODY_LIMIT) {
        this.fail(
          HTTP_E_BODY_TOO_LARGE,
          `the body is larger than maxBodyBytes (${this.options.maxBodyBytes})`
        )
      } else {
        this.fail(
          HTTP_E_PROTOCOL,
          `the response broke HTTP/1.1: ${this.parser.errorText} (http1 error ${code})`
        )
      }
      return -1
    }
    if (event === HTTP1_CLOSED) {
      this.lost = true
      this.fail(HTTP_E_IO, "the server closed the connection before it answered")
      return -1
    }
    return event
  }

  /** One read of the response into the parser, waiting up to `readTimeoutMs`; false with the error set. */
  fill(): boolean {
    const conn: TlsRecordClient | null = this.tls
    if (conn === null) {
      const n: i32 = this.readRaw(HTTP_CLIENT_READ_BYTES)
      if (n > 0) {
        this.gotByte = true
        this.parser.feed(this.rbuf, HTTP_CLIENT_ZERO, n)
      } else if (n === 0) {
        this.parser.finish()
      }
      return n >= 0
    }
    let got: i32 = conn.read(this.plain, HTTP_CLIENT_ZERO, toI32(this.plain.length))
    while (got === TLS_RECORD_AGAIN) {
      if (!this.flushTls(conn) || !this.receiveTls(conn)) {
        return false
      }
      got = conn.read(this.plain, HTTP_CLIENT_ZERO, toI32(this.plain.length))
    }
    if (got > 0) {
      this.gotByte = true
      this.parser.feed(this.plain, HTTP_CLIENT_ZERO, got)
      return true
    }
    if (got === 0) {
      // The server's close_notify: the orderly end of its stream.
      this.parser.finish()
      return true
    }
    this.lost = true
    this.failTls(conn)
    return false
  }

  /**
   * One read of up to `want` bytes from `fd` into `rbuf`, waiting up to
   * `readTimeoutMs`: the count, 0 at the end of the stream, or -1 with the
   * error set.
   */
  readRaw(want: i32): i32 {
    const until: i64 = this.readDeadline()
    let n: i32 = netRead(this.fd, this.rbuf, 0, want)
    while (n === HTTP_CLIENT_WOULD_BLOCK) {
      const waited: i32 = this.wait(this.fd, HTTP_CLIENT_READABLE, until, HTTP_E_READ_TIMEOUT)
      if (waited !== HTTP_E_NONE) {
        this.failWait(waited, `the server sent nothing for ${this.options.readTimeoutMs} ms`)
        return -1
      }
      n = netRead(this.fd, this.rbuf, 0, want)
    }
    if (n >= 0) {
      return n
    }
    this.lost = true
    this.fail(HTTP_E_IO, `reading from the server failed (errno ${-n})`)
    return -1
  }

  /** One read of the socket into the TLS connection `conn`, waiting up to `readTimeoutMs`; false with the error set. */
  receiveTls(conn: TlsRecordClient): boolean {
    const room: i32 = conn.space()
    const want: i32 = room < HTTP_CLIENT_READ_BYTES ? room : HTTP_CLIENT_READ_BYTES
    if (want <= 0) {
      this.fail(HTTP_E_TLS, "the TLS connection has no room for the server's next record")
      return false
    }
    const n: i32 = this.readRaw(want)
    if (n < 0) {
      conn.abort()
      return false
    }
    if (n === 0) {
      // Before the server's close_notify this is truncation, which fails `conn`.
      conn.end()
    } else {
      conn.receive(this.rbuf, HTTP_CLIENT_ZERO, n)
    }
    return true
  }

  /** Sends everything `conn` has sealed, waiting as `writeRaw` does; false with the error set. */
  flushTls(conn: TlsRecordClient): boolean {
    while (conn.outputEnd > conn.outputStart) {
      const len: i32 = conn.outputEnd - conn.outputStart
      if (!this.writeRaw(conn.output, conn.outputStart, len)) {
        conn.abort()
        return false
      }
      conn.consume(len)
    }
    return true
  }

  /** Sets the error for the failed TLS connection `conn`, saying how it failed. */
  failTls(conn: TlsRecordClient): void {
    if (conn.ended && !conn.peerClosed) {
      this.fail(HTTP_E_TLS, "the server closed the connection without a TLS close_notify")
    } else if (conn.peerAlert > 0) {
      this.fail(HTTP_E_TLS, `the server sent TLS alert ${conn.peerAlert}`)
    } else {
      this.fail(HTTP_E_TLS, `the TLS connection failed (alert ${conn.failure()})`)
    }
  }

  /** Writes `bytes[off, off + len)` on the connection, through TLS for an https origin; false with the error set. */
  writeAll(bytes: u8[], off: i32, len: i32): boolean {
    const conn: TlsRecordClient | null = this.tls
    if (conn === null) {
      return this.writeRaw(bytes, off, len)
    }
    let at: i32 = off
    const end: i32 = off + len
    while (at < end) {
      const n: i32 = conn.write(bytes, at, end - at)
      if (n > 0) {
        at += n
      } else if (n !== TLS_RECORD_AGAIN || conn.outputEnd === conn.outputStart) {
        this.lost = true
        this.failTls(conn)
        return false
      }
      if (!this.flushTls(conn)) {
        return false
      }
    }
    return this.flushTls(conn)
  }

  /** Writes `bytes[off, off + len)` to `fd`, waiting up to `readTimeoutMs` each time it is full. */
  writeRaw(bytes: u8[], off: i32, len: i32): boolean {
    let at: i32 = off
    const end: i32 = off + len
    while (at < end) {
      const n: i32 = netWrite(this.fd, bytes, at, end - at)
      if (n > 0) {
        at += n
      } else if (n === HTTP_CLIENT_WOULD_BLOCK || n === 0) {
        const waited: i32 = this.wait(this.fd, HTTP_CLIENT_WRITABLE, this.readDeadline(), HTTP_E_READ_TIMEOUT)
        if (waited !== HTTP_E_NONE) {
          this.failWait(waited, `the server took nothing for ${this.options.readTimeoutMs} ms`)
          return false
        }
      } else {
        this.lost = true
        this.fail(HTTP_E_IO, `writing to the server failed (errno ${-n})`)
        return false
      }
    }
    return true
  }

  /**
   * Looks `host` up and connects to its addresses in turn, every step within
   * `connectTimeoutMs` together: the connected fd, or -1 with the error set.
   */
  dial(host: string, port: i32): i32 {
    const start: i64 = monotonicNanos()
    const budget: i32 = this.options.connectTimeoutMs
    let until: i64 = budget > 0 ? start + toI64(budget) * HTTP_CLIENT_NS_PER_MS : HTTP_CLIENT_NEVER
    let code: i32 = HTTP_E_CONNECT_TIMEOUT
    if (this.deadline < HTTP_CLIENT_NEVER && this.deadline <= until) {
      until = this.deadline
      code = HTTP_E_TOTAL_TIMEOUT
    }
    if (until <= start) {
      this.fail(code, `no time was left to connect to ${host}`)
      return -1
    }
    let lookupMs: i64 = (until - start) / HTTP_CLIENT_NS_PER_MS
    if (lookupMs < toI64(1)) {
      lookupMs = toI64(1)
    } else if (lookupMs > toI64(2147483647)) {
      lookupMs = toI64(2147483647)
    }
    const addresses: u8[] = new Array<u8>(DNS_RESOLVE_MAX_ADDRESSES * DNS_ADDRESS_BYTES)
    const ttls: i32[] = new Array<i32>(DNS_RESOLVE_MAX_ADDRESSES)
    const count: i32 = resolveHost(host, toI32(lookupMs), port, addresses, ttls)
    if (count === DNS_RESOLVE_TIMEOUT && until < HTTP_CLIENT_NEVER) {
      this.failWait(code, `${host} was not looked up within ${budget} ms`)
      return -1
    }
    if (count <= 0) {
      this.fail(
        HTTP_E_DNS,
        `${host} could not be looked up (${count === 0 ? "no address" : `resolver code ${count}`})`
      )
      return -1
    }
    const one: u8[] = new Array<u8>(DNS_ADDRESS_BYTES)
    let last: i32 = 0
    for (let i: i32 = 0; i < count && i < DNS_RESOLVE_MAX_ADDRESSES; i += 1) {
      copyBytes(one, 0, addresses, i * DNS_ADDRESS_BYTES, DNS_ADDRESS_BYTES)
      const fd: i32 = tcpConnect(one)
      if (fd < 0) {
        last = fd
        continue
      }
      const waited: i32 = this.wait(fd, HTTP_CLIENT_WRITABLE, until, code)
      if (waited !== HTTP_E_NONE) {
        this.unwatch(fd)
        netClose(fd)
        this.failWait(waited, `no address of ${host} answered on port ${port} within ${budget} ms`)
        return -1
      }
      const result: i32 = connectResult(fd)
      if (result === 0) {
        return fd
      }
      this.unwatch(fd)
      netClose(fd)
      last = result
    }
    this.fail(HTTP_E_REFUSED, `${host} port ${port} refused the connection (errno ${-last})`)
    return -1
  }

  /**
   * Waits for `events` on `fd` until `until`, or the fetch's deadline if that
   * comes first: `HTTP_E_NONE` when it is ready, `code` or
   * `HTTP_E_TOTAL_TIMEOUT` for whichever deadline passed, `HTTP_E_IO` when
   * the poll loop cannot be made.
   */
  wait(fd: i32, events: i32, until: i64, code: i32): i32 {
    if (this.loop < 0) {
      this.loop = pollCreate()
      if (this.loop < 0) {
        return HTTP_E_IO
      }
    }
    if (this.watched !== fd) {
      if (this.watched >= 0) {
        pollRemove(this.loop, this.watched)
      }
      if (pollAdd(this.loop, fd, events, 0) < 0) {
        this.watched = -1
        return HTTP_E_IO
      }
      this.watched = fd
      this.watchedEvents = events
    } else if (this.watchedEvents !== events) {
      pollModify(this.loop, fd, events, 0)
      this.watchedEvents = events
    }
    let end: i64 = until
    let which: i32 = code
    if (this.deadline <= end) {
      end = this.deadline
      which = HTTP_E_TOTAL_TIMEOUT
    }
    let now: i64 = monotonicNanos()
    while (now < end) {
      let ms: i64 = (end - now + HTTP_CLIENT_NS_PER_MS - toI64(1)) / HTTP_CLIENT_NS_PER_MS
      if (ms > HTTP_CLIENT_MAX_WAIT_MS) {
        ms = HTTP_CLIENT_MAX_WAIT_MS
      }
      const count: i32 = pollWait(this.loop, this.ready, toI32(ms))
      if (count > 0) {
        return HTTP_E_NONE
      }
      if (count < 0) {
        return HTTP_E_IO
      }
      now = monotonicNanos()
    }
    return which
  }

  /** Takes `fd` out of the poll loop before it is closed. */
  unwatch(fd: i32): void {
    if (this.watched === fd && this.watched >= 0) {
      pollRemove(this.loop, fd)
      this.watched = -1
    }
  }

  /** When the wait for the server's next byte ends: `readTimeoutMs` from now. */
  readDeadline(): i64 {
    const ms: i32 = this.options.readTimeoutMs
    return ms > 0 ? monotonicNanos() + toI64(ms) * HTTP_CLIENT_NS_PER_MS : HTTP_CLIENT_NEVER
  }

  /** Closes the connection, if any, and forgets the open body. */
  drop(): void {
    const conn: TlsRecordClient | null = this.tls
    if (conn !== null) {
      conn.close()
      // One try, without waiting, so the server sees the close_notify, or
      // the alert a refusal sealed, when the socket has room for it.
      if (this.fd >= 0 && conn.outputEnd > conn.outputStart) {
        netWrite(this.fd, conn.output, conn.outputStart, conn.outputEnd - conn.outputStart)
      }
      conn.wipe()
      this.tls = null
    }
    if (this.fd >= 0) {
      this.unwatch(this.fd)
      netClose(this.fd)
      this.fd = -1
    }
    this.route = ""
    if (this.bodyOpen) {
      // Closed before its end, the body was cut short: never a whole one.
      this.bodyError = HTTP_E_IO
    }
    this.bodyOpen = false
    this.pendLen = 0
  }

  /**
   * Reads past a redirect's body so the connection can carry the next
   * request; a body too long to be worth reading, or any failure, closes it.
   */
  drain(): void {
    const sink: u8[] = new Array<u8>(HTTP_CLIENT_DRAIN_CHUNK)
    let left: i32 = HTTP_CLIENT_DRAIN_BYTES
    while (this.bodyOpen && left > 0) {
      const n: i32 = this.readBody(this.generation, sink, HTTP_CLIENT_ZERO, HTTP_CLIENT_DRAIN_CHUNK)
      if (n <= 0) {
        break
      }
      left -= n
    }
    if (this.bodyOpen) {
      this.drop()
    }
    this.error = HTTP_E_NONE
    this.errorText = ""
  }

  /** `HttpBodyReader.read` for the response numbered `generation`. */
  readBody(generation: i32, buf: u8[], off: i32, n: i32): i32 {
    if (generation !== this.generation) {
      // The client's error is the later fetch's; a stale reader leaves it be.
      return -HTTP_E_IO
    }
    if (!this.bodyOpen) {
      return -this.bodyError
    }
    while (this.pendLen === 0) {
      const event: i32 = this.pump()
      if (event < 0) {
        this.release()
        this.bodyError = this.error
        return -this.error
      }
      if (event === HTTP1_END) {
        this.bodyOpen = false
        if (this.once || !this.parser.keepAlive()) {
          this.release()
        }
        return 0
      }
      if (event === HTTP1_BODY) {
        this.pendOff = this.parser.bodyOff
        this.pendLen = this.parser.bodyLen
      }
    }
    const take: i32 = n < this.pendLen ? n : this.pendLen
    copyBytes(buf, off, this.parser.body, this.pendOff, take)
    this.pendOff += take
    this.pendLen -= take
    return take
  }

  /** Closes the connection a body is done with, and `httpFetch`'s whole client with it. */
  release(): void {
    if (this.once) {
      this.close()
    } else {
      this.drop()
    }
  }

  /** `readAll`'s refusal: the body passed the caller's limit. */
  refuseBody(limit: i32): void {
    this.release()
    this.fail(HTTP_E_BODY_TOO_LARGE, `the body is larger than the ${limit} bytes asked for`)
    this.bodyError = HTTP_E_BODY_TOO_LARGE
  }

  /** Sets the error for a wait that ended with `code`, `text` saying what timed out. */
  failWait(code: i32, text: string): void {
    if (code === HTTP_E_TOTAL_TIMEOUT) {
      this.fail(code, `the fetch ran past ${this.options.totalTimeoutMs} ms`)
    } else if (code === HTTP_E_IO) {
      this.fail(code, "the poll loop failed")
    } else {
      this.fail(code, text)
    }
  }

  fail(code: i32, text: string): void {
    this.error = code
    this.errorText = `${httpErrorName(code)}: ${text}`
  }
}

/**
 * One fetch on a client of its own, closed once the body has been read or
 * the fetch failed. Null on a failure, with no way to say why: a program
 * that reports its errors fetches through an `HttpClient`.
 */
export const httpFetch = (req: HttpRequest, options: HttpOptions): HttpResponse | null => {
  const client: HttpClient = new HttpClient(options)
  client.once = true
  const res: HttpResponse | null = client.fetch(req)
  if (res === null) {
    client.close()
  }
  return res
}

/**
 * A proxy variable's value: `lower` when it is set and not empty, else
 * `upper` when `upperAllowed`, else "". `HTTP_PROXY` is not allowed under CGI.
 */
export const httpChooseProxy = (
  lower: string | null,
  upper: string | null,
  upperAllowed: boolean
): string => {
  if (lower !== null && lower !== "") {
    return lower
  }
  if (upperAllowed && upper !== null) {
    return upper
  }
  return ""
}

/**
 * The proxy a request to `scheme://host:port` goes through, given the three
 * settings: `httpsProxy` for https, `httpProxy` for http, and "" for none or
 * when `noProxy` names the host.
 */
export const httpProxyFor = (
  scheme: string,
  host: string,
  port: i32,
  httpProxy: string,
  httpsProxy: string,
  noProxy: string
): string => {
  let proxy: string = ""
  if (scheme === "https") {
    proxy = httpsProxy
  } else if (scheme === "http") {
    proxy = httpProxy
  }
  if (proxy === "" || httpNoProxyMatch(noProxy, host, port)) {
    return ""
  }
  return proxy
}

/**
 * Whether `noProxy`, a comma-separated list, names `host` on `port`: an entry
 * is `*` (every host), a name that matches the host or any domain under it
 * (with or without a leading dot), or an IP address that matches only itself;
 * any of them may end in `:port`, and an IPv6 address with a port is written
 * in brackets. Case does not matter. Address ranges are not understood.
 */
export const httpNoProxyMatch = (noProxy: string, host: string, port: i32): boolean => {
  const name: string = httpClientTrimDots(httpClientLower(host))
  const literal: boolean = httpClientIsIpLiteral(name)
  let start: i32 = 0
  const n: i32 = toI32(noProxy.length)
  while (start <= n) {
    let end: i32 = toI32(noProxy.indexOf(",", start))
    if (end < 0) {
      end = n
    }
    const entry: string = httpClientLower(httpClientTrim(noProxy.slice(start, end)))
    start = end + 1
    if (entry === "*") {
      return true
    }
    let entryHost: string = entry
    let entryPort: i32 = -1
    const colon: i32 = toI32(entry.indexOf(":"))
    if (entry.startsWith("[")) {
      const close: i32 = toI32(entry.indexOf("]"))
      if (close < 0) {
        continue
      }
      entryHost = entry.slice(1, close)
      if (close + 1 < toI32(entry.length)) {
        if (entry.charCodeAt(close + 1) !== 58) {
          continue
        }
        entryPort = httpClientPort(entry.substring(close + 2, toI32(entry.length)))
        if (entryPort < 0) {
          continue
        }
      }
    } else if (colon >= 0 && entry.indexOf(":", colon + 1) < 0) {
      entryHost = entry.slice(0, colon)
      entryPort = httpClientPort(entry.substring(colon + 1, toI32(entry.length)))
      if (entryPort < 0) {
        continue
      }
    }
    entryHost = httpClientTrimDots(entryHost)
    if (entryHost === "" || (entryPort >= 0 && entryPort !== port)) {
      continue
    }
    if (entryHost === name) {
      return true
    }
    if (!literal && !httpClientIsIpLiteral(entryHost) && name.endsWith("." + entryHost)) {
      return true
    }
  }
  return false
}

// --- helpers -----------------------------------------------------------------

/** A parser with the options' limits. */
const httpClientParser = (options: HttpOptions): Http1ResponseParser =>
  new Http1ResponseParser(
    options.maxHeaderBytes,
    options.maxHeaderBytes,
    HTTP_CLIENT_MAX_HEADERS,
    options.maxBodyBytes,
    options.maxHeaderBytes
  )

/** The statuses a redirect is followed for: 301, 302, 303, 307 and 308. */
const httpClientIsRedirect = (status: i32): boolean =>
  status === 301 || status === 302 || status === 303 || status === 307 || status === 308

/** RFC 9110 §9.2.2's idempotent methods, the ones a retry cannot do twice. */
const httpClientIdempotent = (method: string): boolean =>
  method === "GET" ||
  method === "HEAD" ||
  method === "OPTIONS" ||
  method === "TRACE" ||
  method === "PUT" ||
  method === "DELETE"

/** Removes every field named `lower`, in any case. */
const httpClientDropField = (names: string[], values: string[], lower: string): void => {
  let i: i32 = 0
  while (i < toI32(names.length) && i < toI32(values.length)) {
    if (httpClientNameIs(names[i], lower)) {
      for (let k: i32 = i; k + 1 < toI32(names.length) && k + 1 < toI32(values.length); k += 1) {
        names[k] = names[k + 1]
        values[k] = values[k + 1]
      }
      names.pop()
      values.pop()
    } else {
      i += 1
    }
  }
}

/** Whether the field name `name` is `lower`, a lower-case name, in any case; it allocates nothing. */
const httpClientNameIs = (name: string, lower: string): boolean => {
  const n: i32 = toI32(name.length)
  if (n !== toI32(lower.length)) {
    return false
  }
  for (let i: i32 = 0; i < n && i < toI32(lower.length); i += 1) {
    let c: i32 = toI32(name.charCodeAt(i))
    if (c >= 65 && c <= 90) {
      c += 32
    }
    if (c !== toI32(lower.charCodeAt(i))) {
      return false
    }
  }
  return true
}

/** `s` with A to Z lower-cased. */
const httpClientLower = (s: string): string => {
  const n: i32 = toI32(s.length)
  let upper: boolean = false
  for (let i: i32 = 0; i < n; i += 1) {
    const c: i32 = toI32(s.charCodeAt(i))
    upper = upper || (c >= 65 && c <= 90)
  }
  if (!upper) {
    return s
  }
  const out: u8[] = new Array<u8>(n)
  for (let i: i32 = 0; i < toI32(out.length) && i < toI32(s.length); i += 1) {
    const c: i32 = toI32(s.charCodeAt(i))
    out[i] = c >= 65 && c <= 90 ? toU8(c + 32) : toU8(c)
  }
  return String.fromBytes(out, 0, n)
}

/** `s` without spaces and tabs at either end. */
const httpClientTrim = (s: string): string => {
  let a: i32 = 0
  let b: i32 = toI32(s.length)
  while (a < b && (s.charCodeAt(a) === 32 || s.charCodeAt(a) === 9)) {
    a += 1
  }
  while (b > a && (s.charCodeAt(b - 1) === 32 || s.charCodeAt(b - 1) === 9)) {
    b -= 1
  }
  return s.substring(a, b)
}

/** `s` without one leading dot and one trailing dot, so `.a.com.` compares as `a.com`. */
const httpClientTrimDots = (s: string): string => {
  let a: i32 = 0
  let b: i32 = toI32(s.length)
  if (a < b && s.charCodeAt(a) === 46) {
    a += 1
  }
  if (b > a && s.charCodeAt(b - 1) === 46) {
    b -= 1
  }
  return s.substring(a, b)
}

/** `s` as a port, 0 to 65535, or -1 when it is not one. */
const httpClientPort = (s: string): i32 => {
  const n: i32 = toI32(s.length)
  if (n === 0 || n > 5) {
    return -1
  }
  let v: i32 = 0
  for (let i: i32 = 0; i < n; i += 1) {
    const c: i32 = toI32(s.charCodeAt(i))
    if (c < 48 || c > 57) {
      return -1
    }
    v = v * 10 + c - 48
  }
  return v > 65535 ? -1 : v
}

/** Whether `host` is an IPv6 address (it has a colon) or a dotted IPv4 one (only digits and dots). */
const httpClientIsIpLiteral = (host: string): boolean => {
  if (host.indexOf(":") >= 0) {
    return true
  }
  const n: i32 = toI32(host.length)
  for (let i: i32 = 0; i < n; i += 1) {
    const c: i32 = toI32(host.charCodeAt(i))
    if (c !== 46 && (c < 48 || c > 57)) {
      return false
    }
  }
  return n > 0
}

/** A host as an authority writes it: an IPv6 address in brackets. */
const httpClientHostText = (host: string): string => (host.indexOf(":") >= 0 ? "[" + host + "]" : host)

/** `url` without its userinfo and fragment, as a response names it. */
const httpClientUrlText = (url: Url): string => {
  const host: string = httpClientHostText(url.host)
  const authority: string = url.port >= 0 ? `${host}:${url.port}` : host
  const query: string | null = url.query
  return `${url.scheme}://${authority}${url.path === "" ? "/" : url.path}${query !== null ? "?" + query : ""}`
}

/**
 * A proxy setting as a URL: `http://` is assumed when no scheme is written,
 * the port is 1080 when none is, and anything but `http` with a host is null.
 */
const httpClientProxyUrl = (text: string): Url | null => {
  const u: Url | null = urlParse(text.indexOf("://") >= 0 ? text : "http://" + text)
  if (u === null || u.scheme !== "http" || u.host === "") {
    return null
  }
  if (u.port < 0) {
    u.port = HTTP_CLIENT_PROXY_PORT
  }
  return u
}

/**
 * The `Proxy-Authorization` value for a proxy URL's userinfo, `Basic` and
 * the decoded `user:password` in base64; "" when it has none; null when
 * either half is not valid percent-encoding.
 */
const httpClientProxyAuth = (proxy: Url): string | null => {
  if (proxy.username === "" && proxy.password === "") {
    return ""
  }
  const user: string | null = urlDecode(proxy.username, 0)
  const password: string | null = urlDecode(proxy.password, 0)
  if (user === null || password === null) {
    return null
  }
  const text: string = user + ":" + password
  const n: i32 = toI32(text.length)
  const bytes: u8[] = new Array<u8>(n)
  for (let i: i32 = 0; i < toI32(bytes.length) && i < toI32(text.length); i += 1) {
    bytes[i] = toU8(text.charCodeAt(i))
  }
  return "Basic " + base64Encode(bytes)
}
