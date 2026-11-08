/**
 * `nish/net/fetch` — an HTTP/1.1 client. `fetchSync(request, options)` is the
 * blocking one for command-line programs: it dials, sends, and answers the
 * response's head with a reader for its body, and a `FetchSyncClient` does the
 * same while keeping one connection alive between fetches. `await fetch(url,
 * init)` is the async one: it parks its task on `nish:async` instead of the
 * thread, so `awaitAll(fetch(a), fetch(b))` overlaps the two.
 *
 *     import { fetch } from "nish/net/fetch";
 *
 *     const r = await fetch("http://127.0.0.1:8080/health");
 *     if (r.isOk()) {
 *       const body: string = r.value.text();
 *     }
 *
 * **The async `fetch`** answers a `Result`: a `FetchResponse` whose body was
 * read whole before it answered (up to `maxBodyBytes`, 256 MiB by default,
 * else `HTTP_E_BODY_TOO_LARGE`), or a `FetchError` with the `HTTP_E_*` code.
 * The connect, every write and every read wait on the executor; the name
 * lookup still blocks, and only `http://` is driven (an `https://` URL answers
 * `HTTP_E_TLS` naming `fetchSync`, never a silent block). A `FetchPool` handed
 * in through `RequestInit.pool` keeps idle connections per route, capped.
 * Policy, proxies, redirects and error codes are the shared code below, so
 * both clients behave alike. It does not run under `--emit-ts`.
 *
 *     import { HttpOptions, HttpRequest, HttpResponse, fetchSync } from "nish/net/fetch";
 *
 *     const req = new HttpRequest("GET", "http://example.com/");
 *     req.header("Accept", "application/json");
 *     const res: HttpResponse | null = fetchSync(req, new HttpOptions());
 *     if (res !== null) {
 *       const body: u8[] | null = res.body.readAll(1048576);
 *     }
 *
 * **It blocks the thread** at every step, the way a CLI wants it to: the
 * lookup, the connect, each write and each read. A server, which must not
 * stall every connection for one slow peer, drives `nish/net/http1-client-codec`'s
 * parser from its own loop instead. Every wait is bounded: `connectTimeoutMs`
 * for the lookup and the connect (one budget across every address the name
 * has), `readTimeoutMs` for each wait on the peer, and `totalTimeoutMs`, when
 * set, for the whole fetch, redirects and body included, so a server that
 * drips one byte a second cannot hold a fetch forever.
 *
 * **Framing is the parser's.** The head is written by `http1RequestHead` and
 * every byte read goes through `Http1ResponseParser`, so a value holding a CR
 * or LF is refused rather than sent, and every response-smuggling shape is
 * refused with the parser's own code (see `docs/security/http1-client-codec.md`).
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
} from "nish/net/http1-codec"
import {
  HTTP1_E_BODY_LIMIT,
  HTTP1_E_TRUNCATED,
  HTTP1_INFORMATIONAL,
  Http1ResponseParser,
  http1RequestHead,
} from "nish/net/http1-client-codec"
import { httpFieldBytes } from "nish/net/http-fields"
import { Url, urlDecode, urlDefaultPort, urlOrigin, urlParse, urlResolve } from "nish/net/url"
import { resolveHost } from "nish/net/dns"
import { DNS_ADDRESS_BYTES } from "nish/net/dns-message"
import { DNS_RESOLVE_MAX_ADDRESSES, DNS_RESOLVE_TIMEOUT } from "nish/net/dns-resolver"
import { OutboundPolicy, outboundAddressText, outboundFilter, outboundHostAllowed } from "nish/net/outbound"
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
import { readable, writable } from "nish:async"
import { getenv, monotonicNanos, wallClockNanos } from "nish:process"
import { PkiRoots, pkiLoadRoots, pkiLoadSystemRoots } from "nish/crypto/pki-roots"
import { TlsClient, TlsClientConfig, tlsClientIsIpLiteral } from "nish/net/tls/client"
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
/** The outbound policy refused the URL's host or every address it resolved to. */
export const HTTP_E_BLOCKED: i32 = 17

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
/** The largest body the async fetch can hold in one array, whatever `maxBodyBytes` says. */
const HTTP_CLIENT_ASYNC_BODY_MAX: i64 = 2147483647
/** A deadline that never comes: 146 years of monotonic nanoseconds, far below the overflow of a sum with a timeout. */
const HTTP_CLIENT_NEVER: i64 = 4611686018 * 1000000000
/** netRead's and netWrite's answer when the socket has nothing ready. */
const HTTP_CLIENT_WOULD_BLOCK: i32 = -11
/** pollAdd's events: readable, writable. */
const HTTP_CLIENT_READABLE: i32 = 1
const HTTP_CLIENT_WRITABLE: i32 = 2
/** The size of the client random and of each ephemeral private key a TLS handshake draws. */
const HTTP_CLIENT_TLS_KEY_BYTES: i32 = 32

/**
 * A short name for an `HTTP_E_*` code, for messages: "dns", "read timeout",
 * ... A fetch's `errorText` starts with it.
 *
 * @param code An `HTTP_E_*` code, such as a client's `error`.
 * @returns The code's name, "none" for `HTTP_E_NONE`, or "unknown" for a number that is no code.
 */
export const httpErrorName = (code: i32): string => {
  // Indexed by code: the order of the HTTP_E_* constants above.
  const names: string[] = [
    "none",
    "url",
    "dns",
    "refused",
    "connect timeout",
    "read timeout",
    "total timeout",
    "protocol",
    "too many redirects",
    "redirect refused",
    "body too large",
    "proxy refused",
    "tls",
    "certificate",
    "request",
    "io",
    "proxy",
    "blocked",
  ]
  return code >= 0 && code < toI32(names.length) ? names[code] : "unknown"
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
  /** The request method, sent as given, such as `GET` or `POST`. */
  method: string
  /** The absolute URL the request is sent to. */
  url: string
  /** The header field names, in the order they are sent. */
  names: string[]
  /** The header field values, each beside its name in `names`. */
  values: string[]
  /** Null for no body at all; an empty array sends `Content-Length: 0`. */
  body: u8[] | null = null

  /**
   * A request with no header fields and no body.
   * @param method The request method, such as `GET`.
   * @param url The absolute `http://` or `https://` URL to send it to.
   */
  constructor(method: string, url: string) {
    this.method = method
    this.url = url
    this.names = []
    this.values = []
  }

  /**
   * Appends one header field; nothing is checked until the request is written.
   * @param name The field name.
   * @param value The field value; one holding a CR or LF makes the fetch fail.
   */
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
  /**
   * For a URL the program did not choose: only the addresses and hosts the
   * policy allows are reached, no proxy is used, and its caps apply (see
   * `nish/net/outbound`). Null for none.
   */
  outbound: OutboundPolicy | null = null
  /** The budget for the lookup and the connect together; 0 or less for none but the total. */
  connectTimeoutMs: i32 = 10000
  /** The longest wait for the server to send or take a byte; 0 or less for none. */
  readTimeoutMs: i32 = 30000
  /** The budget for a whole fetch, its body included; 0 or less for none. */
  totalTimeoutMs: i32 = 0
  /** The most redirect hops one fetch follows; past them the fetch fails. */
  maxRedirects: i32 = 5
  /** The status line and the header section, each at most this. */
  maxHeaderBytes: i32 = 65536
  /** Follow a redirect rather than answer it; only to the same origin unless `crossOriginRedirects` is set. */
  followRedirects: boolean = false
  /** Let a followed redirect go to another origin (see the module comment). */
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
  /** The status code, such as 200. */
  status: i32 = 0
  /** The reason phrase the server sent beside the status. */
  reason: string = ""
  /** The URL that answered, which differs from the request's after a redirect. */
  url: string = ""
  /** The header field names, lower-cased, in the order they arrived. */
  names: string[]
  /** The header field values, each beside its name in `names`. */
  values: string[]
  /** The reader for the response's body. */
  body: HttpBodyReader

  /**
   * A response with no status and no fields yet; the client fills them in.
   * @param body The reader for the body that follows the head.
   */
  constructor(body: HttpBodyReader) {
    this.names = []
    this.values = []
    this.body = body
  }

  /**
   * The first value of the field `name`, in any case.
   * @param name The field name to look for.
   * @returns The value, or null when the response has no such field.
   */
  header(name: string): string | null {
    return httpClientField(this.names, this.values, name)
  }
}

/**
 * A response's body, read as it arrives: de-chunked, bounded by
 * `maxBodyBytes`, and ending where the framing says it ends, so a cut-short
 * body is an error and never taken for a whole one. It reads through the
 * client that made it, and only until that client starts its next fetch.
 */
export class HttpBodyReader {
  /** The client that made the response; it carries the connection the body arrives on. */
  client: FetchSyncClient
  private generation: i32

  /**
   * A reader for the body of one response.
   * @param client The client that made the response.
   * @param generation The client's response number, so a reader stops reading once the client moves on.
   */
  constructor(client: FetchSyncClient, generation: i32) {
    this.client = client
    this.generation = generation
  }

  /**
   * Up to `n` body bytes into `buf[off ..]`: how many (at least one), 0 at
   * the end of the body, or a negated `HTTP_E_*` code, the client's
   * `errorText` saying why. It waits for at least one byte, no more, so an
   * event stream is read event by event. A window outside `buf` panics; an
   * empty one answers 0 at once, reading nothing, so 0 means the end only
   * when `n` is positive.
   * @param buf Where the body bytes are written.
   * @param off Where in `buf` the first byte goes.
   * @param n The most bytes to read.
   * @returns How many bytes were read, 0 at the end of the body, or a negated `HTTP_E_*` code.
   */
  read(buf: u8[], off: i32, n: i32): i32 {
    if (off < 0 || n < 0 || toI64(off) + toI64(n) > toI64(buf.length)) {
      panic("HttpBodyReader.read: the window is outside the buffer")
    }
    if (n === 0) {
      return 0
    }
    return this.client.readBody(this.generation, buf, off, n)
  }

  /**
   * The rest of the body in one array, or null on an error or once it passes
   * `limit` bytes (`HTTP_E_BODY_TOO_LARGE`, and the connection is closed).
   * @param limit The most body bytes to accept.
   * @returns The body, or null on an error or a body past `limit`.
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
export class FetchSyncClient {
  // Declared widest first, so no byte of a client is padding.
  /** The options every fetch through this client follows. */
  options: HttpOptions
  /** A sentence saying why the last failure happened, for a log; "" after a fetch that answered. */
  errorText: string = ""
  /** The proxy settings in use; "" for none. `setProxies` replaces them. */
  private httpProxy: string = ""
  private httpsProxy: string = ""
  private noProxy: string = ""
  /** Where `fd` leads: an origin, or the proxy an http request went through. */
  private route: string = ""
  /** The outbound policy `fd` was dialled under; a connection is reused only under the same one. */
  private routePolicy: OutboundPolicy | null = null
  private parser: Http1ResponseParser
  /** The TLS connection over `fd` to an https origin; null over plain http. */
  private tls: TlsRecordClient | null = null
  /** The roots an https server's chain must end at, read on the client's first https fetch. */
  private trust: TlsClientTrust | null = null
  private ready: i32[]
  private rbuf: u8[]
  /** Where TLS application data is read before the parser takes it; empty until the first https connection. */
  private plain: u8[]
  /** The fetch's end in monotonic nanoseconds; `HTTP_CLIENT_NEVER` for none. */
  private deadline: i64 = 0
  /** The last failure's `HTTP_E_*` code; `HTTP_E_NONE` after a fetch that answered. */
  error: i32 = 0
  private fd: i32 = -1
  /** The fd registered in `loop`, and for what. */
  private loop: i32 = -1
  private watched: i32 = -1
  private watchedEvents: i32 = 0
  /** Counts responses; a reader reads only while its own is the open one. */
  private generation: i32 = 0
  /** How the latest response's body failed, `HTTP_E_NONE` while it has not; its reader answers it again. */
  private bodyError: i32 = 0
  /** Where the latest response's unread body bytes start in `parser`, and how many. */
  private pendOff: i32 = 0
  private pendLen: i32 = 0
  /** Whether `fd` has carried a response before the one in flight. */
  reused: boolean = false
  /** Whether any byte of the response in flight has arrived. */
  private gotByte: boolean = false
  /** Whether the failure in hand was the connection going away, which a retry may cure. */
  private lost: boolean = false
  /** Whether the latest response's body is unread. */
  private bodyOpen: boolean = false
  /** Whether this is `fetchSync`'s client, closed whole once its one body is done with. @internal */
  once: boolean = false

  /**
   * A client with no connection open yet, its proxy settings read from the
   * environment when `useEnvProxy` is set.
   * @param options How every fetch through the client behaves.
   */
  constructor(options: HttpOptions) {
    this.options = options
    this.parser = httpClientParser(options)
    this.ready = new Array<i32>(8)
    this.rbuf = new Array<u8>(HTTP_CLIENT_READ_BYTES)
    this.plain = []
    const proxies: string[] = httpClientEnvProxies(options)
    this.httpProxy = proxies[0]
    this.httpsProxy = proxies[1]
    this.noProxy = proxies[2]
  }

  /**
   * Replaces the proxy settings, as the three variables would set them; "" for none.
   * @param httpProxy The proxy for http URLs, as `http_proxy` would give it.
   * @param httpsProxy The proxy for https URLs, as `https_proxy` would give it.
   * @param noProxy The hosts reached without a proxy, as `no_proxy` would list them.
   */
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
   * @param req The request to send.
   * @returns The response, its body still to be read, or null on a failure.
   */
  fetch(req: HttpRequest): HttpResponse | null {
    this.error = HTTP_E_NONE
    this.errorText = ""
    if (this.bodyOpen) {
      // An unread body is still on the wire ahead of the next response.
      this.drop()
    }
    this.generation += 1
    this.deadline = httpClientDeadline(this.options)
    const fault: HttpClientFault = new HttpClientFault()
    let url: Url | null = httpClientTarget(req.url, this.options, fault)
    if (url === null) {
      this.fail(fault.code, fault.text)
      return null
    }
    const hop: HttpClientHop = new HttpClientHop(req.method, req.body, req.names, req.values)
    while (url !== null) {
      const res: HttpResponse | null = this.exchange(url, hop.method, hop.names, hop.values, hop.body)
      if (res === null) {
        return null
      }
      const location: string | null = res.header("location")
      if (!this.options.followRedirects || location === null || !httpClientIsRedirect(res.status)) {
        return res
      }
      const next: Url | null = httpClientRedirect(hop, this.options, url, res.status, location, fault)
      if (next === null) {
        return this.refuse(fault.code, fault.text)
      }
      this.drain()
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
  private exchange(
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
  private open(url: Url): boolean {
    const fault: HttpClientFault = new HttpClientFault()
    const way: HttpClientRoute | null = httpClientRoute(
      url,
      this.options,
      this.httpProxy,
      this.httpsProxy,
      this.noProxy,
      fault
    )
    if (way === null) {
      this.fail(fault.code, fault.text)
      return false
    }
    const proxy: Url | null = way.proxy
    const port: i32 = way.port
    const route: string = way.route
    if (
      this.fd >= 0 &&
      this.route === route &&
      httpClientSamePolicy(this.routePolicy, this.options.outbound) &&
      this.quiet()
    ) {
      this.reused = true
      return true
    }
    this.drop()
    this.reused = false
    // The roots come first, so a client with none never reaches the network.
    if (url.scheme === "https" && !this.loadTrust()) {
      return false
    }
    const fd: i32 = this.dial(way.dialHost, way.dialPort)
    if (fd < 0) {
      return false
    }
    this.fd = fd
    this.route = route
    this.routePolicy = this.options.outbound
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
  private loadTrust(): boolean {
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
  private secure(host: string, early: u8[]): boolean {
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
  private tunnel(host: string, port: i32, proxy: Url): boolean {
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
  private send(
    url: Url,
    method: string,
    names: string[],
    values: string[],
    body: u8[] | null
  ): HttpResponse | null {
    const fault: HttpClientFault = new HttpClientFault()
    const head: u8[] | null = httpClientRequestHead(
      url,
      method,
      names,
      values,
      body,
      this.route.startsWith("proxy ") ? this.httpProxy : "",
      fault
    )
    if (head === null) {
      this.fail(fault.code, fault.text)
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
  private head(): i32 {
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
  private pump(): i32 {
    let event: i32 = this.parser.next()
    while (event === HTTP1_NEED_MORE) {
      if (!this.fill()) {
        return -1
      }
      event = this.parser.next()
    }
    if (event === HTTP1_ERROR || event === HTTP1_CLOSED) {
      const fault: HttpClientFault = new HttpClientFault()
      this.lost = httpClientParserFault(this.parser, event, this.options, fault)
      this.fail(fault.code, fault.text)
      return -1
    }
    return event
  }

  /** One read of the response into the parser, waiting up to `readTimeoutMs`; false with the error set. */
  private fill(): boolean {
    if (this.overdue()) {
      return false
    }
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
  private readRaw(want: i32): i32 {
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
  private receiveTls(conn: TlsRecordClient): boolean {
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
  private flushTls(conn: TlsRecordClient): boolean {
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
  private failTls(conn: TlsRecordClient): void {
    if (conn.ended && !conn.peerClosed) {
      this.fail(HTTP_E_TLS, "the server closed the connection without a TLS close_notify")
    } else if (conn.peerAlert > 0) {
      this.fail(HTTP_E_TLS, `the server sent TLS alert ${conn.peerAlert}`)
    } else {
      this.fail(HTTP_E_TLS, `the TLS connection failed (alert ${conn.failure()})`)
    }
  }

  /** Writes `bytes[off, off + len)` on the connection, through TLS for an https origin; false with the error set. */
  private writeAll(bytes: u8[], off: i32, len: i32): boolean {
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
  private writeRaw(bytes: u8[], off: i32, len: i32): boolean {
    let at: i32 = off
    const end: i32 = off + len
    while (at < end) {
      if (this.overdue()) {
        return false
      }
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
  private dial(host: string, port: i32): i32 {
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
    const addresses: u8[] = new Array<u8>(DNS_RESOLVE_MAX_ADDRESSES * DNS_ADDRESS_BYTES)
    const fault: HttpClientFault = new HttpClientFault()
    const usable: i32 = httpClientResolve(host, port, this.options, start, until, code, addresses, fault)
    if (usable < 0) {
      this.fail(fault.code, fault.text)
      return -1
    }
    const one: u8[] = new Array<u8>(DNS_ADDRESS_BYTES)
    let last: i32 = 0
    for (let i: i32 = 0; i < usable && i < DNS_RESOLVE_MAX_ADDRESSES; i += 1) {
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
    this.fail(HTTP_E_REFUSED, `could not connect to ${host} port ${port} (errno ${-last})`)
    return -1
  }

  /**
   * Waits for `events` on `fd` until `until`, or the fetch's deadline if that
   * comes first: `HTTP_E_NONE` when it is ready, `code` or
   * `HTTP_E_TOTAL_TIMEOUT` for whichever deadline passed, `HTTP_E_IO` when
   * the poll loop cannot be made.
   */
  private wait(fd: i32, events: i32, until: i64, code: i32): i32 {
    if (!this.watch(fd, events)) {
      return HTTP_E_IO
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

  /** Puts `fd` in the poll loop, waiting for `events`: false when the loop cannot be made. */
  private watch(fd: i32, events: i32): boolean {
    if (this.loop < 0) {
      this.loop = pollCreate()
      if (this.loop < 0) {
        return false
      }
    }
    if (this.watched !== fd) {
      if (this.watched >= 0) {
        pollRemove(this.loop, this.watched)
      }
      if (pollAdd(this.loop, fd, events, 0) < 0) {
        this.watched = -1
        return false
      }
      this.watched = fd
      this.watchedEvents = events
    } else if (this.watchedEvents !== events) {
      pollModify(this.loop, fd, events, 0)
      this.watchedEvents = events
    }
    return true
  }

  /**
   * Whether the kept connection has said nothing since its last response
   * ended: no byte and no close waiting on the socket, none held unread. A
   * server that spoke while idle answered nothing yet asked, and is closing
   * or out of step, so the connection is not reused.
   */
  private quiet(): boolean {
    return (
      !this.leftover() &&
      this.watch(this.fd, HTTP_CLIENT_READABLE) &&
      pollWait(this.loop, this.ready, 0) === 0
    )
  }

  /** Whether bytes past the last response are held, in the parser or the TLS layer. */
  private leftover(): boolean {
    const conn: TlsRecordClient | null = this.tls
    if (conn !== null && (conn.plainEnd > conn.plainStart || conn.reader.end > conn.reader.start)) {
      return true
    }
    return this.parser.buffered() > 0
  }

  /** Takes `fd` out of the poll loop before it is closed. */
  private unwatch(fd: i32): void {
    if (this.watched === fd && this.watched >= 0) {
      pollRemove(this.loop, fd)
      this.watched = -1
    }
  }

  /** When the wait for the server's next byte ends: `readTimeoutMs` from now. */
  private readDeadline(): i64 {
    const ms: i32 = this.options.readTimeoutMs
    return ms > 0 ? monotonicNanos() + toI64(ms) * HTTP_CLIENT_NS_PER_MS : HTTP_CLIENT_NEVER
  }

  /** Closes the connection, if any, and forgets the open body. */
  private drop(): void {
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
  private drain(): void {
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

  /** `HttpBodyReader.read` for the response numbered `generation`. @internal */
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
        // Bytes past the end are no answer to anything yet asked: a server
        // that sends them cannot be trusted with the next request.
        if (this.once || !this.parser.keepAlive() || this.leftover()) {
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

  /** Closes the connection a body is done with, and `fetchSync`'s whole client with it. */
  private release(): void {
    if (this.once) {
      this.close()
    } else {
      this.drop()
    }
  }

  /** `readAll`'s refusal: the body passed the caller's limit. @internal */
  refuseBody(limit: i32): void {
    this.release()
    this.fail(HTTP_E_BODY_TOO_LARGE, `the body is larger than the ${limit} bytes asked for`)
    this.bodyError = HTTP_E_BODY_TOO_LARGE
  }

  /**
   * Fails with `HTTP_E_TOTAL_TIMEOUT` once the fetch's deadline has passed:
   * a server that always has the next byte ready never lets a wait see it.
   */
  private overdue(): boolean {
    if (this.deadline < HTTP_CLIENT_NEVER && monotonicNanos() >= this.deadline) {
      this.failWait(HTTP_E_TOTAL_TIMEOUT, "")
      return true
    }
    return false
  }

  /** Sets the error for a wait that ended with `code`, `text` saying what timed out. */
  private failWait(code: i32, text: string): void {
    this.fail(code, httpClientWaitText(code, this.options, text))
  }

  /** Refuses a redirect: closes the connection, whose response is left unread, and fails. */
  private refuse(code: i32, text: string): HttpResponse | null {
    this.drop()
    this.fail(code, text)
    return null
  }

  private fail(code: i32, text: string): void {
    this.error = code
    this.errorText = `${httpErrorName(code)}: ${text}`
  }
}

/**
 * One fetch on a client of its own, closed once the body has been read or
 * the fetch failed. Null on a failure, with no way to say why: a program
 * that reports its errors fetches through a `FetchSyncClient`.
 *
 * @param req The request to send, as a `FetchSyncClient` takes it.
 * @param options The client's limits, timeouts, TLS trust and proxies for this one fetch.
 * @returns The response, the last one when redirects were followed, or null on any failure.
 */
export const fetchSync = (req: HttpRequest, options: HttpOptions): HttpResponse | null => {
  const client: FetchSyncClient = new FetchSyncClient(options)
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
 *
 * @param lower The lower-case variable's value, such as `http_proxy`'s, or null when it is unset.
 * @param upper The upper-case variable's value, such as `HTTP_PROXY`'s, or null when it is unset.
 * @param upperAllowed Whether the upper-case variable may be read: false for `HTTP_PROXY` under CGI, where a request's `Proxy` header sets it.
 * @returns The chosen variable's value, a proxy URL or for `no_proxy` a comma-separated host list, or "" when neither applies.
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
 *
 * @param scheme The request URL's scheme, lower-cased; one other than `http` or `https` gets no proxy.
 * @param host The request URL's host, matched against `noProxy`.
 * @param port The port the request goes to, matched against an entry's `:port`.
 * @param httpProxy The proxy URL for `http` requests, or "" for none.
 * @param httpsProxy The proxy URL for `https` requests, or "" for none.
 * @param noProxy The comma-separated hosts that go direct, as `httpNoProxyMatch` reads them.
 * @returns The proxy URL the request goes through, or "" when it goes direct.
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
 *
 * @param noProxy The list, as `NO_PROXY` holds it; an entry that does not parse is skipped.
 * @param host The request's host name or IP address; trailing dots do not matter.
 * @param port The port the request goes to.
 * @returns True when an entry names the host (and its port, if it has one), so the request goes direct.
 */
export const httpNoProxyMatch = (noProxy: string, host: string, port: i32): boolean => {
  const name: string = httpClientTrimDots(httpClientLower(host))
  const literal: boolean = tlsClientIsIpLiteral(name)
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
    if (!literal && !tlsClientIsIpLiteral(entryHost) && name.endsWith("." + entryHost)) {
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
    httpClientBodyCap(options),
    options.maxHeaderBytes
  )

/** Whether `a` and `b` are the same outbound policy, or both none. */
const httpClientSamePolicy = (a: OutboundPolicy | null, b: OutboundPolicy | null): boolean => {
  if (a === null || b === null) {
    return a === null && b === null
  }
  return a === b
}

/** `maxBodyBytes`, or the outbound policy's cap when it is lower. */
const httpClientBodyCap = (options: HttpOptions): i64 => {
  const policy: OutboundPolicy | null = options.outbound
  return policy !== null && policy.maxBodyBytes < options.maxBodyBytes
    ? policy.maxBodyBytes
    : options.maxBodyBytes
}

/** `totalTimeoutMs`, or the outbound policy's budget when it is set and the options' is not, or is longer. */
const httpClientTotalMs = (options: HttpOptions): i32 => {
  const policy: OutboundPolicy | null = options.outbound
  const own: i32 = options.totalTimeoutMs
  if (policy === null || policy.totalTimeoutMs <= 0) {
    return own
  }
  return own > 0 && own < policy.totalTimeoutMs ? own : policy.totalTimeoutMs
}

/** `maxRedirects`, or the outbound policy's limit when it is lower. */
const httpClientMaxRedirects = (options: HttpOptions): i32 => {
  const policy: OutboundPolicy | null = options.outbound
  return policy !== null && policy.maxRedirects < options.maxRedirects
    ? policy.maxRedirects
    : options.maxRedirects
}

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
 * A URL as an error may name it, built from its parsed scheme, host, port and
 * path alone, so no userinfo, query or fragment reaches `errorText` whatever
 * the text holds; `?...` marks a query or fragment left out. A URL that does
 * not parse, or has no host, is not echoed at all: a scan of the raw text
 * cannot tell a password's `@`, `?` or `/` from a query's.
 */
const httpClientRedact = (u: Url | null): string => {
  if (u === null) {
    return "(a URL that does not parse)"
  }
  if (!u.hasAuthority || u.host === "") {
    return "(a URL without a host)"
  }
  const port: string = u.port >= 0 ? `:${u.port}` : ""
  const cut: string = u.query !== null || u.fragment !== null ? "?..." : ""
  return `${u.scheme}://${httpClientHostText(u.host)}${port}${u.path}${cut}`
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
  return "Basic " + base64Encode(httpFieldBytes(user + ":" + password))
}

/** The first value of the field `name`, in any case, from parallel name and value lists; null when there is none. */
const httpClientField = (names: string[], values: string[], name: string): string | null => {
  const lower: string = httpClientLower(name)
  for (let i: i32 = 0; i < toI32(names.length) && i < toI32(values.length); i += 1) {
    if (names[i] === lower) {
      return values[i]
    }
  }
  return null
}

/**
 * The proxy settings the environment gives, as [http, https, no-proxy]; ""
 * for each when `useEnvProxy` is off. A CGI program (`REQUEST_METHOD` set)
 * ignores `HTTP_PROXY`, which a request's `Proxy:` header could have set.
 */
const httpClientEnvProxies = (options: HttpOptions): string[] => {
  if (!options.useEnvProxy) {
    return ["", "", ""]
  }
  const cgi: boolean = getenv("REQUEST_METHOD") !== null
  return [
    httpChooseProxy(getenv("http_proxy"), getenv("HTTP_PROXY"), !cgi),
    httpChooseProxy(getenv("https_proxy"), getenv("HTTPS_PROXY"), true),
    httpChooseProxy(getenv("no_proxy"), getenv("NO_PROXY"), true),
  ]
}

/** When a fetch starting now must be done by, on the monotonic clock; `HTTP_CLIENT_NEVER` with no total timeout. */
const httpClientDeadline = (options: HttpOptions): i64 => {
  const total: i32 = httpClientTotalMs(options)
  return total > 0 ? monotonicNanos() + toI64(total) * HTTP_CLIENT_NS_PER_MS : HTTP_CLIENT_NEVER
}

/** A failure a shared step found: an `HTTP_E_*` code and its sentence, before the code's name is put in front. */
class HttpClientFault {
  code: i32 = 0
  text: string = ""

  fail(code: i32, text: string): void {
    this.code = code
    this.text = text
  }
}

/** Why the outbound policy refuses to let a URL name `url`'s host; "" when there is no policy or it allows the host. */
const httpClientHostRefusal = (options: HttpOptions, url: Url): string => {
  const policy: OutboundPolicy | null = options.outbound
  if (policy === null || outboundHostAllowed(policy, url.host)) {
    return ""
  }
  return `${httpClientRedact(url)} names a host the outbound policy does not allow`
}

/** The request's URL, parsed and checked against the scheme and the policy; null with `fault` set. */
const httpClientTarget = (text: string, options: HttpOptions, fault: HttpClientFault): Url | null => {
  const url: Url | null = urlParse(text)
  if (url === null || (url.scheme !== "http" && url.scheme !== "https")) {
    fault.fail(HTTP_E_URL, `not an absolute http or https URL: ${httpClientRedact(url)}`)
    return null
  }
  const refusal: string = httpClientHostRefusal(options, url)
  if (refusal !== "") {
    fault.fail(HTTP_E_BLOCKED, refusal)
    return null
  }
  return url
}

/** What the next hop of a fetch sends: the method, body and fields a redirect may rewrite, and the hops taken. */
class HttpClientHop {
  method: string
  body: u8[] | null
  names: string[]
  values: string[]
  hops: i32 = 0

  constructor(method: string, body: u8[] | null, names: string[], values: string[]) {
    this.method = method
    this.body = body
    this.names = []
    this.values = []
    for (let i: i32 = 0; i < toI32(names.length) && i < toI32(values.length); i += 1) {
      // Read before any call, which is where the bounds proof forgets a length.
      const name: string = names[i]
      const value: string = values[i]
      this.names.push(name)
      this.values.push(value)
    }
  }
}

/**
 * Where a redirect from `url` to `location` goes, with `hop` rewritten for
 * it: credentials dropped across origins, a 303 (or a 301/302 after POST)
 * turned into GET. Null with `fault` set when the redirect is refused.
 */
const httpClientRedirect = (
  hop: HttpClientHop,
  options: HttpOptions,
  url: Url,
  status: i32,
  location: string,
  fault: HttpClientFault
): Url | null => {
  const next: Url | null = urlResolve(url, location)
  const maxRedirects: i32 = httpClientMaxRedirects(options)
  if (hop.hops >= maxRedirects) {
    fault.fail(
      HTTP_E_TOO_MANY_REDIRECTS,
      `more than ${maxRedirects} redirects, the last to ${httpClientRedact(next)}`
    )
    return null
  }
  if (next === null || (next.scheme !== "http" && next.scheme !== "https")) {
    fault.fail(
      HTTP_E_REDIRECT_REFUSED,
      `a redirect to ${httpClientRedact(next)}, which is not an http or https URL`
    )
    return null
  }
  if (url.scheme === "https" && next.scheme === "http") {
    fault.fail(HTTP_E_REDIRECT_REFUSED, `a redirect from https to http (${httpClientRedact(next)})`)
    return null
  }
  const refusal: string = httpClientHostRefusal(options, next)
  if (refusal !== "") {
    fault.fail(HTTP_E_BLOCKED, refusal)
    return null
  }
  const from: string | null = urlOrigin(url)
  const to: string | null = urlOrigin(next)
  if (from === null || to === null || from !== to) {
    if (!options.crossOriginRedirects) {
      fault.fail(HTTP_E_REDIRECT_REFUSED, `a redirect to another origin (${httpClientRedact(next)})`)
      return null
    }
    // Credentials were meant for the first origin, not for wherever it points.
    httpClientDropField(hop.names, hop.values, "authorization")
    httpClientDropField(hop.names, hop.values, "proxy-authorization")
    httpClientDropField(hop.names, hop.values, "cookie")
    httpClientDropField(hop.names, hop.values, "host")
  }
  if (
    (status === 303 && hop.method !== "HEAD") ||
    ((status === 301 || status === 302) && hop.method === "POST")
  ) {
    hop.method = "GET"
    hop.body = null
    httpClientDropField(hop.names, hop.values, "content-type")
  }
  hop.hops += 1
  return next
}

/** Where a connection for one URL goes: the address to dial, the proxy if any, and the route a kept connection must match. */
class HttpClientRoute {
  proxy: Url | null = null
  dialHost: string = ""
  route: string = ""
  port: i32 = 0
  dialPort: i32 = 0
}

/**
 * The route to `url` under the proxy settings: none under an outbound
 * policy, since a proxy would look the name up past the policy's address
 * check. Null with `fault` set when the proxy setting is malformed.
 */
const httpClientRoute = (
  url: Url,
  options: HttpOptions,
  httpProxy: string,
  httpsProxy: string,
  noProxy: string,
  fault: HttpClientFault
): HttpClientRoute | null => {
  const way: HttpClientRoute = new HttpClientRoute()
  const port: i32 = url.port >= 0 ? url.port : urlDefaultPort(url.scheme)
  way.port = port
  const proxyText: string =
    options.outbound !== null ? "" : httpProxyFor(url.scheme, url.host, port, httpProxy, httpsProxy, noProxy)
  let proxy: Url | null = null
  if (proxyText !== "") {
    proxy = httpClientProxyUrl(proxyText)
    if (proxy === null) {
      fault.fail(
        HTTP_E_PROXY,
        `the proxy setting is not an http:// URL with a host: ${httpClientRedact(
          urlParse(proxyText.indexOf("://") >= 0 ? proxyText : "http://" + proxyText)
        )}`
      )
      return null
    }
  }
  const origin: string = `${url.scheme}://${httpClientHostText(url.host)}:${port}`
  way.route = origin
  way.dialHost = url.host
  way.dialPort = port
  if (proxy !== null) {
    way.proxy = proxy
    way.dialHost = proxy.host
    way.dialPort = proxy.port
    way.route =
      url.scheme === "http"
        ? `proxy ${httpClientHostText(proxy.host)}:${proxy.port}`
        : `${origin} via ${httpClientHostText(proxy.host)}:${proxy.port}`
  }
  return way
}

/**
 * The bytes of a request's head: `Host` added when the fields lack it, the
 * absolute-form target and the proxy's credentials when `httpProxy` is the
 * http proxy the request goes through ("" for none), and a
 * `Proxy-Authorization` field dropped when it is not. Null with `fault` set.
 */
const httpClientRequestHead = (
  url: Url,
  method: string,
  names: string[],
  values: string[],
  body: u8[] | null,
  httpProxy: string,
  fault: HttpClientFault
): u8[] | null => {
  const viaProxy: boolean = httpProxy !== ""
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
    const proxy: Url | null = httpClientProxyUrl(httpProxy)
    const auth: string | null = proxy !== null ? httpClientProxyAuth(proxy) : ""
    if (auth === null) {
      fault.fail(HTTP_E_PROXY, "the proxy's user name or password is not valid percent-encoding")
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
    fault.fail(
      HTTP_E_REQUEST,
      `the request ${method} ${httpClientRedact(url)} was refused: a bad method, target or header field`
    )
  }
  return head
}

/**
 * The failure behind a parser's `HTTP1_ERROR` or `HTTP1_CLOSED` `event`, in
 * `fault`: true when the connection was lost (closed before or part way
 * through the response), which is what lets a kept connection be retried.
 */
const httpClientParserFault = (
  parser: Http1ResponseParser,
  event: i32,
  options: HttpOptions,
  fault: HttpClientFault
): boolean => {
  if (event === HTTP1_CLOSED) {
    fault.fail(HTTP_E_IO, "the server closed the connection before it answered")
    return true
  }
  const code: i32 = parser.error
  if (code === HTTP1_E_BODY_LIMIT) {
    fault.fail(HTTP_E_BODY_TOO_LARGE, `the body is larger than maxBodyBytes (${httpClientBodyCap(options)})`)
    return false
  }
  fault.fail(HTTP_E_PROTOCOL, `the response broke HTTP/1.1: ${parser.errorText} (http1 error ${code})`)
  // A response the server closed part way through is a connection lost, as
  // one closed before any byte is; it is never sent again, because a byte of
  // it came.
  return code === HTTP1_E_TRUNCATED
}

/** The sentence for a failed wait: the total timeout and a broken poll loop have fixed ones, anything else `text`. */
const httpClientWaitText = (code: i32, options: HttpOptions, text: string): string => {
  if (code === HTTP_E_TOTAL_TIMEOUT) {
    return `the fetch ran past ${httpClientTotalMs(options)} ms`
  }
  if (code === HTTP_E_IO) {
    return "the poll loop failed"
  }
  return text
}

/**
 * Looks `host` up within `start`..`until` into `addresses` and keeps those
 * the outbound policy allows: how many to try, or -1 with `fault` set (`code`
 * names the deadline a lookup that timed out ran past). The lookup blocks.
 */
const httpClientResolve = (
  host: string,
  port: i32,
  options: HttpOptions,
  start: i64,
  until: i64,
  code: i32,
  addresses: u8[],
  fault: HttpClientFault
): i32 => {
  let lookupMs: i64 = (until - start) / HTTP_CLIENT_NS_PER_MS
  if (lookupMs < toI64(1)) {
    lookupMs = toI64(1)
  } else if (lookupMs > toI64(2147483647)) {
    lookupMs = toI64(2147483647)
  }
  const ttls: i32[] = new Array<i32>(DNS_RESOLVE_MAX_ADDRESSES)
  const count: i32 = resolveHost(host, toI32(lookupMs), port, addresses, ttls)
  if (count === DNS_RESOLVE_TIMEOUT && until < HTTP_CLIENT_NEVER) {
    fault.fail(
      code,
      httpClientWaitText(code, options, `${host} was not looked up within ${options.connectTimeoutMs} ms`)
    )
    return -1
  }
  if (count <= 0) {
    fault.fail(
      HTTP_E_DNS,
      `${host} could not be looked up (${count === 0 ? "no address" : `resolver code ${count}`})`
    )
    return -1
  }
  let usable: i32 = count < DNS_RESOLVE_MAX_ADDRESSES ? count : DNS_RESOLVE_MAX_ADDRESSES
  const policy: OutboundPolicy | null = options.outbound
  if (policy !== null) {
    // Only the bytes checked here are connected to: no second lookup a rebinding answer could change.
    usable = outboundFilter(policy, addresses, usable)
    if (usable === 0) {
      fault.fail(
        HTTP_E_BLOCKED,
        `${host} resolves to ${outboundAddressText(addresses, 0)}, which the outbound policy does not allow`
      )
      return -1
    }
  }
  return usable
}

// ---- The async fetch ---------------------------------------------------------

/** How many idle connections a `FetchPool` holds at most, over every route. */
const FETCH_POOL_SLOTS: i32 = 64

/**
 * Why an async `fetch` failed: an `HTTP_E_*` code and its sentence, the
 * code's name first, as `FetchSyncClient.errorText` reads. The text never
 * holds a URL's credentials or query.
 */
export class FetchError {
  /** The `HTTP_E_*` code. */
  code: i32
  /** The code's name, a colon and what went wrong, such as `dns: example.invalid could not be looked up`. */
  text: string

  /**
   * A failure with its code and text.
   * @param code The `HTTP_E_*` code.
   * @param text The code's name, a colon and the sentence.
   */
  constructor(code: i32, text: string) {
    this.code = code
    this.text = text
  }
}

/**
 * A response `fetch` answered, its body already read whole: the body is
 * read before `fetch` answers, up to `maxBodyBytes`, so `text()` and
 * `bytes()` are plain calls. `names` are lower-cased and in the order they
 * arrived, beside `values`; `url` is the URL that answered.
 */
export class FetchResponse {
  /** The status code, such as 200. */
  status: i32 = 0
  /** The reason phrase the server sent beside the status. */
  reason: string = ""
  /** The URL that answered, which differs from the request's after a redirect. */
  url: string = ""
  /** The header field names, lower-cased, in the order they arrived. */
  names: string[]
  /** The header field values, each beside its name in `names`. */
  values: string[]
  /** The body, de-chunked; empty for a `HEAD` or a status that has none. */
  body: u8[]

  /** A response with no status, fields or body yet; `fetch` fills them in. */
  constructor() {
    this.names = []
    this.values = []
    this.body = []
  }

  /**
   * The first value of the field `name`, in any case.
   * @param name The field name to look for.
   * @returns The value, or null when the response has no such field.
   */
  header(name: string): string | null {
    return httpClientField(this.names, this.values, name)
  }

  /**
   * The body as a string, its bytes unchanged: nothing checks that they are UTF-8.
   * @returns The body's text.
   */
  text(): string {
    return String.fromBytes(this.body, HTTP_CLIENT_ZERO, toI32(this.body.length))
  }

  /**
   * The body's bytes.
   * @returns The body, the same array as `body`.
   */
  bytes(): u8[] {
    return this.body
  }
}

/**
 * Connections an async `fetch` leaves open for the next one to the same
 * place, held by the caller and handed in through `RequestInit.pool`. At
 * most `maxIdlePerOrigin` wait per route and 64 in all; a kept connection
 * the server closed, or sent a byte on unasked, is closed when it is next
 * looked at. A fetch under an outbound policy never keeps or takes one.
 */
export class FetchPool {
  /** The most idle connections kept for one route (origin, or proxy). */
  maxIdlePerOrigin: i32
  private fds: i32[]
  private routes: string[]
  private probe: u8[]

  /**
   * An empty pool.
   * @param maxIdlePerOrigin The most idle connections kept for one route; 0 keeps none.
   */
  constructor(maxIdlePerOrigin: i32 = 4) {
    this.maxIdlePerOrigin = maxIdlePerOrigin
    this.fds = []
    this.routes = []
    this.probe = new Array<u8>(1)
    for (let i: i32 = 0; i < FETCH_POOL_SLOTS; i += 1) {
      this.fds.push(toI32(-1))
      this.routes.push("")
    }
  }

  /**
   * How many idle connections the pool holds.
   * @returns The count, over every route.
   */
  idle(): i32 {
    let count: i32 = 0
    for (let i: i32 = 0; i < FETCH_POOL_SLOTS; i += 1) {
      if (this.fds[i] >= 0) {
        count += 1
      }
    }
    return count
  }

  /** Closes every idle connection; the pool can still keep new ones. */
  close(): void {
    for (let i: i32 = 0; i < FETCH_POOL_SLOTS; i += 1) {
      this.drop(i)
    }
  }

  /**
   * A quiet idle connection for `route`, taken out of the pool; -1 for none.
   * A connection that reads anything, its end included, is closed instead.
   * @internal
   */
  take(route: string): i32 {
    for (let i: i32 = 0; i < FETCH_POOL_SLOTS; i += 1) {
      if (this.fds[i] < 0 || this.routes[i] !== route) {
        continue
      }
      const fd: i32 = this.fds[i]
      if (netRead(fd, this.probe, HTTP_CLIENT_ZERO, 1) === HTTP_CLIENT_WOULD_BLOCK) {
        this.fds[i] = -1
        this.routes[i] = ""
        return fd
      }
      this.drop(i)
    }
    return -1
  }

  /** Keeps `fd` for `route` when there is room, else closes it. @internal */
  put(route: string, fd: i32): void {
    let same: i32 = 0
    let free: i32 = -1
    for (let i: i32 = 0; i < FETCH_POOL_SLOTS; i += 1) {
      if (this.fds[i] < 0) {
        free = free < 0 ? i : free
      } else if (this.routes[i] === route) {
        same += 1
      }
    }
    if (same >= this.maxIdlePerOrigin || free < 0) {
      netClose(fd)
      return
    }
    this.fds[free] = fd
    this.routes[free] = route
  }

  private drop(i: i32): void {
    if (this.fds[i] >= 0) {
      netClose(this.fds[i])
    }
    this.fds[i] = -1
    this.routes[i] = ""
  }
}

/**
 * What an async `fetch` sends and how it behaves. `options` are
 * `HttpOptions` as `fetchSync` reads them, except that `readTimeoutMs`
 * bounds no wait (a wait has no deadline yet), `connectTimeoutMs` bounds
 * only the name lookup, and `totalTimeoutMs` is checked each time a wait
 * ends. `pool` keeps connections for later fetches; null closes each one
 * when its fetch is done.
 */
export class RequestInit {
  /** The request method, sent as given; `GET` by default. */
  method: string = "GET"
  /** The header field names, in the order they are sent. */
  names: string[]
  /** The header field values, each beside its name in `names`. */
  values: string[]
  /** Null for no body at all; an empty array sends `Content-Length: 0`. */
  body: u8[] | null = null
  /** The limits, policy and redirect and proxy settings (see above for the timeouts). */
  options: HttpOptions
  /** Where idle connections are kept between fetches; null for none. */
  pool: FetchPool | null = null

  /** A `GET` with no fields, no body, default options and no pool. */
  constructor() {
    this.names = []
    this.values = []
    this.options = new HttpOptions()
  }

  /**
   * Appends one header field; nothing is checked until the request is written.
   * @param name The field name.
   * @param value The field value; one holding a CR or LF makes the fetch fail.
   * @returns This init, so calls chain.
   */
  header(name: string, value: string): RequestInit {
    this.names.push(name)
    this.values.push(value)
    return this
  }
}

/** One connection an async fetch drives, and the state of the exchange on it. */
class HttpClientConn {
  deadline: i64
  options: HttpOptions
  parser: Http1ResponseParser
  rbuf: u8[]
  fault: HttpClientFault
  route: string = ""
  httpProxy: string
  httpsProxy: string
  noProxy: string
  fd: i32 = -1
  gotByte: boolean = false
  lost: boolean = false
  reused: boolean = false

  constructor(options: HttpOptions) {
    this.options = options
    this.deadline = httpClientDeadline(options)
    this.parser = httpClientParser(options)
    this.rbuf = new Array<u8>(HTTP_CLIENT_READ_BYTES)
    this.fault = new HttpClientFault()
    const proxies: string[] = httpClientEnvProxies(options)
    this.httpProxy = proxies[0]
    this.httpsProxy = proxies[1]
    this.noProxy = proxies[2]
  }

  /** Fails with `HTTP_E_TOTAL_TIMEOUT` once the fetch's deadline has passed. */
  overdue(): boolean {
    if (this.deadline < HTTP_CLIENT_NEVER && monotonicNanos() >= this.deadline) {
      this.fault.fail(HTTP_E_TOTAL_TIMEOUT, httpClientWaitText(HTTP_E_TOTAL_TIMEOUT, this.options, ""))
      return true
    }
    return false
  }

  /** Closes the connection, if one is open. */
  close(): void {
    if (this.fd >= 0) {
      netClose(this.fd)
      this.fd = -1
    }
  }

  /** Hands the connection back to `pool` when the response left it clean to reuse, else closes it. */
  release(pool: FetchPool | null): void {
    if (
      pool !== null &&
      this.fd >= 0 &&
      this.options.outbound === null &&
      this.parser.keepAlive() &&
      this.parser.buffered() === 0
    ) {
      pool.put(this.route, this.fd)
      this.fd = -1
      return
    }
    this.close()
  }
}

/** One read of the response into the parser, parking the task until the socket has bytes; false with the fault set. */
const httpClientFillAsync = async (conn: HttpClientConn): Promise<boolean> => {
  if (conn.overdue()) {
    return false
  }
  let n: i32 = netRead(conn.fd, conn.rbuf, HTTP_CLIENT_ZERO, HTTP_CLIENT_READ_BYTES)
  while (n === HTTP_CLIENT_WOULD_BLOCK) {
    const ready = await readable(conn.fd)
    if (!ready) {
      conn.fault.fail(HTTP_E_IO, "the wait for the server failed")
      return false
    }
    if (conn.overdue()) {
      return false
    }
    n = netRead(conn.fd, conn.rbuf, HTTP_CLIENT_ZERO, HTTP_CLIENT_READ_BYTES)
  }
  if (n > 0) {
    conn.gotByte = true
    conn.parser.feed(conn.rbuf, HTTP_CLIENT_ZERO, n)
    return true
  }
  if (n === 0) {
    conn.parser.finish()
    return true
  }
  conn.lost = true
  conn.fault.fail(HTTP_E_IO, `reading from the server failed (errno ${-n})`)
  return false
}

/** The parser's next event, reading as it needs; -1 with the fault set. */
const httpClientPumpAsync = async (conn: HttpClientConn): Promise<i32> => {
  let event: i32 = conn.parser.next()
  while (event === HTTP1_NEED_MORE) {
    const filled = await httpClientFillAsync(conn)
    if (!filled) {
      return -1
    }
    event = conn.parser.next()
  }
  if (event === HTTP1_ERROR || event === HTTP1_CLOSED) {
    conn.lost = httpClientParserFault(conn.parser, event, conn.options, conn.fault)
    return -1
  }
  return event
}

/** Writes `bytes`, parking the task while the socket is full; false with the fault set. */
const httpClientWriteAsync = async (conn: HttpClientConn, bytes: u8[]): Promise<boolean> => {
  let at: i32 = 0
  const end: i32 = toI32(bytes.length)
  while (at < end) {
    if (conn.overdue()) {
      return false
    }
    const n: i32 = netWrite(conn.fd, bytes, at, end - at)
    if (n > 0) {
      at += n
    } else if (n === HTTP_CLIENT_WOULD_BLOCK || n === 0) {
      const ready = await writable(conn.fd)
      if (!ready) {
        conn.fault.fail(HTTP_E_IO, "the wait for the server failed")
        return false
      }
    } else {
      conn.lost = true
      conn.fault.fail(HTTP_E_IO, `writing to the server failed (errno ${-n})`)
      return false
    }
  }
  return true
}

/**
 * Looks `host` up (blocking, within `connectTimeoutMs`) and connects to its
 * addresses in turn, parking the task while each connect is in flight: the
 * connected fd, or -1 with the fault set.
 */
const httpClientDialAsync = async (conn: HttpClientConn, host: string, port: i32): Promise<i32> => {
  const start: i64 = monotonicNanos()
  const budget: i32 = conn.options.connectTimeoutMs
  let until: i64 = budget > 0 ? start + toI64(budget) * HTTP_CLIENT_NS_PER_MS : HTTP_CLIENT_NEVER
  let code: i32 = HTTP_E_CONNECT_TIMEOUT
  if (conn.deadline < HTTP_CLIENT_NEVER && conn.deadline <= until) {
    until = conn.deadline
    code = HTTP_E_TOTAL_TIMEOUT
  }
  if (until <= start) {
    conn.fault.fail(code, httpClientWaitText(code, conn.options, `no time was left to connect to ${host}`))
    return -1
  }
  const addresses: u8[] = new Array<u8>(DNS_RESOLVE_MAX_ADDRESSES * DNS_ADDRESS_BYTES)
  const usable: i32 = httpClientResolve(host, port, conn.options, start, until, code, addresses, conn.fault)
  if (usable < 0) {
    return -1
  }
  const one: u8[] = new Array<u8>(DNS_ADDRESS_BYTES)
  let last: i32 = 0
  for (let i: i32 = 0; i < usable && i < DNS_RESOLVE_MAX_ADDRESSES; i += 1) {
    copyBytes(one, 0, addresses, i * DNS_ADDRESS_BYTES, DNS_ADDRESS_BYTES)
    const fd: i32 = tcpConnect(one)
    if (fd < 0) {
      last = fd
      continue
    }
    const ready = await writable(fd)
    if (conn.overdue()) {
      netClose(fd)
      return -1
    }
    const result: i32 = ready ? connectResult(fd) : -5
    if (result === 0) {
      return fd
    }
    netClose(fd)
    last = result
  }
  conn.fault.fail(HTTP_E_REFUSED, `could not connect to ${host} port ${port} (errno ${-last})`)
  return -1
}

/**
 * Makes `conn` a connection to where `url` goes: one the pool kept when
 * there is one, else a new one, through an http proxy when the settings say
 * so. False with the fault set; an https URL is refused before anything is
 * dialled, since its TLS handshake would block the process.
 */
const httpClientOpenAsync = async (
  conn: HttpClientConn,
  url: Url,
  pool: FetchPool | null,
  fresh: boolean
): Promise<boolean> => {
  if (url.scheme === "https") {
    conn.fault.fail(
      HTTP_E_TLS,
      `${httpClientRedact(url)} is https, which the async fetch does not drive yet; use fetchSync`
    )
    return false
  }
  const way: HttpClientRoute | null = httpClientRoute(
    url,
    conn.options,
    conn.httpProxy,
    conn.httpsProxy,
    conn.noProxy,
    conn.fault
  )
  if (way === null) {
    return false
  }
  conn.route = way.route
  conn.parser = httpClientParser(conn.options)
  conn.reused = false
  if (pool !== null && !fresh && conn.options.outbound === null) {
    const kept: i32 = pool.take(way.route)
    if (kept >= 0) {
      conn.fd = kept
      conn.reused = true
      return true
    }
  }
  const fd: i32 = await httpClientDialAsync(conn, way.dialHost, way.dialPort)
  if (fd < 0) {
    return false
  }
  conn.fd = fd
  return true
}

/** Writes the request on `conn` and reads up to its final response's head; false with the fault set. */
const httpClientSendAsync = async (conn: HttpClientConn, url: Url, hop: HttpClientHop): Promise<boolean> => {
  const head: u8[] | null = httpClientRequestHead(
    url,
    hop.method,
    hop.names,
    hop.values,
    hop.body,
    conn.route.startsWith("proxy ") ? conn.httpProxy : "",
    conn.fault
  )
  if (head === null) {
    return false
  }
  conn.gotByte = false
  conn.lost = false
  conn.parser.expect(hop.method === "HEAD", false)
  const wrote = await httpClientWriteAsync(conn, head)
  if (!wrote) {
    return false
  }
  const body: u8[] | null = hop.body
  if (body !== null) {
    const sent = await httpClientWriteAsync(conn, body)
    if (!sent) {
      return false
    }
  }
  let event: i32 = await httpClientPumpAsync(conn)
  while (event === HTTP1_INFORMATIONAL) {
    event = await httpClientPumpAsync(conn)
  }
  if (event < 0) {
    return false
  }
  if (event !== HTTP1_HEAD) {
    conn.fault.fail(HTTP_E_PROTOCOL, `the response ended before its head (event ${event})`)
    return false
  }
  return true
}

/**
 * Reads the body into `res`, at most `limit` bytes: 1 at its end, 0 when it
 * passed `limit` (the connection is then not reusable), -1 with the fault set.
 */
const httpClientBodyAsync = async (conn: HttpClientConn, res: FetchResponse, limit: i64): Promise<i32> => {
  let buf: u8[] = new Array<u8>(0)
  let len: i32 = 0
  let event: i32 = await httpClientPumpAsync(conn)
  while (event !== HTTP1_END) {
    if (event < 0) {
      return -1
    }
    if (event === HTTP1_BODY) {
      const take: i32 = conn.parser.bodyLen
      const need: i64 = toI64(len) + toI64(take)
      if (need > limit) {
        return 0
      }
      if (need > HTTP_CLIENT_ASYNC_BODY_MAX) {
        // A raised maxBodyBytes cannot carry a body past one array's reach.
        conn.fault.fail(
          HTTP_E_BODY_TOO_LARGE,
          `the body is larger than one array holds (${HTTP_CLIENT_ASYNC_BODY_MAX} bytes)`
        )
        return -1
      }
      if (need > toI64(buf.length)) {
        let room: i64 = toI64(buf.length) * toI64(2)
        if (room < need) {
          room = need
        }
        if (room > HTTP_CLIENT_ASYNC_BODY_MAX) {
          room = HTTP_CLIENT_ASYNC_BODY_MAX
        }
        const grown: u8[] = new Array<u8>(toI32(room))
        copyBytes(grown, 0, buf, 0, len)
        buf = grown
      }
      copyBytes(buf, len, conn.parser.body, conn.parser.bodyOff, take)
      len += take
    }
    event = await httpClientPumpAsync(conn)
  }
  if (len === toI32(buf.length)) {
    res.body = buf
  } else {
    const exact: u8[] = new Array<u8>(len)
    copyBytes(exact, 0, buf, 0, len)
    res.body = exact
  }
  return 1
}

/**
 * One request and its whole response on `conn`, once more on a fresh
 * connection when a kept one turns out to be gone before any byte of an
 * idempotent request's answer came. Null with the fault set.
 */
const httpClientExchangeAsync = async (
  conn: HttpClientConn,
  url: Url,
  hop: HttpClientHop,
  pool: FetchPool | null,
  redirectable: boolean
): Promise<FetchResponse | null> => {
  for (let attempt: i32 = 0; attempt < 2; attempt += 1) {
    const opened = await httpClientOpenAsync(conn, url, pool, attempt > 0)
    if (!opened) {
      return null
    }
    const sent = await httpClientSendAsync(conn, url, hop)
    if (sent) {
      const res: FetchResponse = new FetchResponse()
      res.status = conn.parser.status
      res.reason = conn.parser.reason
      res.url = httpClientUrlText(url)
      for (
        let i: i32 = 0;
        i < toI32(conn.parser.names.length) && i < toI32(conn.parser.values.length);
        i += 1
      ) {
        res.names.push(conn.parser.names[i])
        res.values.push(conn.parser.values[i])
      }
      // A redirect's own body is read only far enough to keep its connection.
      const hopping: boolean =
        redirectable && httpClientIsRedirect(res.status) && res.header("location") !== null
      const limit: i64 = hopping ? toI64(HTTP_CLIENT_DRAIN_BYTES) : httpClientBodyCap(conn.options)
      const read: i32 = await httpClientBodyAsync(conn, res, limit)
      if (read < 0) {
        conn.close()
        if (!hopping) {
          return null
        }
        // As fetchSync's drain: a redirect's body that fails to read costs
        // only its connection, never the fetch.
        conn.fault.fail(HTTP_E_NONE, "")
      } else if (read === 0) {
        conn.close()
      } else {
        conn.release(pool)
      }
      return res
    }
    const retry: boolean = conn.reused && conn.lost && !conn.gotByte && httpClientIdempotent(hop.method)
    conn.close()
    if (!retry) {
      return null
    }
  }
  return null
}

/** `fetch` before its answer is wrapped: the response, or null with `fault` set. */
const httpClientFetchAsync = async (
  text: string,
  init: RequestInit,
  fault: HttpClientFault
): Promise<FetchResponse | null> => {
  const options: HttpOptions = init.options
  const conn: HttpClientConn = new HttpClientConn(options)
  conn.fault = fault
  let url: Url | null = httpClientTarget(text, options, fault)
  if (url === null) {
    return null
  }
  const hop: HttpClientHop = new HttpClientHop(init.method, init.body, init.names, init.values)
  while (url !== null) {
    const res: FetchResponse | null = await httpClientExchangeAsync(
      conn,
      url,
      hop,
      init.pool,
      options.followRedirects
    )
    if (res === null) {
      return null
    }
    const location: string | null = res.header("location")
    if (!options.followRedirects || location === null || !httpClientIsRedirect(res.status)) {
      return res
    }
    url = httpClientRedirect(hop, options, url, res.status, location, fault)
  }
  return null
}

/**
 * Fetches `url` without blocking the process: the task waits on the
 * executor while the connection is made, the request written and the
 * response read, so other tasks run meanwhile and `awaitAll(fetch(a),
 * fetch(b))` overlaps the two. The body is read whole, up to
 * `maxBodyBytes`, before the answer comes. Only http is driven this way: an
 * https URL answers `HTTP_E_TLS` (use `fetchSync`). The name lookup still
 * blocks. Policy, proxy, redirect and error rules are `fetchSync`'s.
 *
 * @param url The absolute `http://` URL to fetch.
 * @param init The method, fields, body, options and pool; null for a plain `GET`.
 * @returns The response with its body, or the failure: never a panic.
 */
export const fetch = async (
  url: string,
  init: RequestInit | null = null
): Promise<Result<FetchResponse, FetchError>> => {
  const req: RequestInit = init !== null ? init : new RequestInit()
  const fault: HttpClientFault = new HttpClientFault()
  const res: FetchResponse | null = await httpClientFetchAsync(url, req, fault)
  if (res === null) {
    return Err(new FetchError(fault.code, `${httpErrorName(fault.code)}: ${fault.text}`))
  }
  return Ok(res)
}
