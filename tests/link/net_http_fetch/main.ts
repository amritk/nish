// nish/net/http-client against a scripted server on loopback.
//
// The parent listens on two ports (two origins) and serves; a child of the
// same binary runs every fetch and prints the checks, since a blocking client
// and the server it talks to cannot share a thread. The server answers each
// request by its path, and `/echo` sends the request's head and body back, so
// the child can check what was put on the wire: the request line, the Host,
// the fields a redirect dropped, the proxy's absolute form. `X-Conn` numbers
// the connection a response came on, which is how the child sees a connection
// reused, or a stale one replaced.

import { HTTP_E_BODY_TOO_LARGE, HTTP_E_CONNECT_TIMEOUT, HTTP_E_DNS, HTTP_E_IO, HTTP_E_NONE, HTTP_E_PROTOCOL, HTTP_E_PROXY, HTTP_E_PROXY_REFUSED, HTTP_E_READ_TIMEOUT, HTTP_E_REDIRECT_REFUSED, HTTP_E_REFUSED, HTTP_E_REQUEST, HTTP_E_TLS, HTTP_E_TOO_MANY_REDIRECTS, HTTP_E_TOTAL_TIMEOUT, HTTP_E_URL, HttpClient, HttpOptions, HttpRequest, HttpResponse, httpChooseProxy, httpErrorName, httpFetch, httpNoProxyMatch, httpProxyFor } from "nish/net/http-client";
import { netAddress, netClose, netLocalPort, netRead, netWrite, pollAdd, pollCreate, pollRemove, pollWait, tcpAccept, tcpConnect, tcpListen } from "nish:net";
import { kill, monotonicNanos, platform, spawn, waitPid } from "nish:process";
import { realpathSync } from "nish:fs";

const selfPath = (): string => {
  const exe: string | null = platform === "linux" ? realpathSync("/proc/self/exe") : null;
  return exe !== null ? exe : process.argv[0];
};

/** Wait `ms` milliseconds. */
const pause = (ms: i32): void => {
  const loop: i32 = pollCreate();
  const ready: i32[] = new Array<i32>(2);
  pollWait(loop, ready, ms);
  netClose(loop);
};

const bytesOf = (s: string): u8[] => {
  const out: u8[] = new Array<u8>(toI32(s.length));
  for (let i: i32 = 0; i < toI32(s.length); i++) {
    out[i] = toU8(s.charCodeAt(i));
  }
  return out;
};

const lower = (s: string): string => {
  const out: u8[] = bytesOf(s);
  for (let i: i32 = 0; i < toI32(out.length); i++) {
    if (out[i] >= 65 && out[i] <= 90) {
      out[i] = out[i] + 32;
    }
  }
  return String.fromBytes(out, 0, toI32(out.length));
};

// --- the server ----------------------------------------------------------------

class Conn {
  fd: i32;
  id: i32;
  port: i32;
  buf: u8[];
  len: i32 = 0;
  /** Bytes of `/drip`'s body still to send, one a tick. */
  drip: i32 = 0;
  /** An `/sse` stream waiting for `/sse-next` before its second event. */
  sse: boolean = false;
  open: boolean = true;

  constructor(fd: i32, id: i32, port: i32) {
    this.fd = fd;
    this.id = id;
    this.port = port;
    this.buf = new Array<u8>(65536);
  }
}

class Server {
  loop: i32;
  listenA: i32;
  listenB: i32;
  portA: i32;
  portB: i32;
  conns: Conn[];
  accepts: i32 = 0;

  constructor() {
    this.loop = pollCreate();
    this.listenA = tcpListen("127.0.0.1", 0, 64);
    this.listenB = tcpListen("127.0.0.1", 0, 64);
    this.portA = netLocalPort(this.listenA);
    this.portB = netLocalPort(this.listenB);
    pollAdd(this.loop, this.listenA, 1, 0);
    pollAdd(this.loop, this.listenB, 1, 1);
    this.conns = [];
  }

  send(c: Conn, s: string): void {
    const b: u8[] = bytesOf(s);
    let at: i32 = 0;
    let tries: i32 = 0;
    while (at < toI32(b.length) && tries < 1000) {
      const n: i32 = netWrite(c.fd, b, at, toI32(b.length) - at);
      if (n > 0) {
        at += n;
      } else if (n === -11) {
        tries++;
        pause(1);
      } else {
        return;
      }
    }
  }

  close(c: Conn): void {
    if (c.open) {
      pollRemove(this.loop, c.fd);
      netClose(c.fd);
      c.open = false;
    }
  }

  respond(c: Conn, status: string, fields: string, body: string): void {
    this.send(c, `HTTP/1.1 ${status}\r\nX-Conn: ${c.id}\r\n${fields}Content-Length: ${body.length}\r\n\r\n${body}`);
  }

  /** Answers one whole request, `head` its head without the blank line. */
  handle(c: Conn, head: string, body: string): void {
    const sp1: i32 = toI32(head.indexOf(" "));
    const sp2: i32 = toI32(head.indexOf(" ", sp1 + 1));
    const method: string = head.substring(0, sp1);
    let target: string = head.substring(sp1 + 1, sp2);
    if (method === "CONNECT") {
      const auth: boolean = lower(head + "\r\n").indexOf("\r\nproxy-authorization: basic dxnlcjpwyxnz\r\n") >= 0;
      if (target === "example.test:443" && auth) {
        // The tunnel opens and closes at once: the TLS handshake over it fails.
        this.send(c, "HTTP/1.1 200 Connection established\r\n\r\n");
        this.close(c);
      } else {
        this.send(c, "HTTP/1.1 407 Proxy Authentication Required\r\nContent-Length: 0\r\n\r\n");
      }
      return;
    }
    if (target.startsWith("http://")) {
      target = target.substring(toI32(target.indexOf("/", 7)), toI32(target.length));
    }
    const q: i32 = toI32(target.indexOf("?"));
    const path: string = q >= 0 ? target.substring(0, q) : target;
    const redirect: string = "redirected, and this body is drained";
    if (path === "/echo") {
      this.respond(c, "200 OK", "Content-Type: text/plain\r\n", head + "\r\n\r\n" + body);
    } else if (path === "/hello") {
      this.respond(c, "200 OK", "", "hello");
    } else if (path === "/chunked") {
      this.send(c, `HTTP/1.1 200 OK\r\nX-Conn: ${c.id}\r\nTransfer-Encoding: chunked\r\n\r\n5\r\nhello\r\n7\r\n, world\r\n0\r\n\r\n`);
    } else if (path === "/informational") {
      this.send(c, `HTTP/1.1 103 Early Hints\r\nLink: </a>\r\n\r\nHTTP/1.1 200 OK\r\nX-Conn: ${c.id}\r\nContent-Length: 2\r\n\r\nok`);
    } else if (path === "/stale") {
      this.respond(c, "200 OK", "", "stale");
      this.close(c);
    } else if (path === "/stall") {
      // Nothing is sent: the client's read timeout ends it.
    } else if (path === "/drip") {
      this.send(c, `HTTP/1.1 200 OK\r\nContent-Length: 1000\r\n\r\n`);
      c.drip = 1000;
    } else if (path === "/big") {
      this.respond(c, "200 OK", "", "0123456789012345678901234567890123456789");
    } else if (path === "/bad") {
      this.send(c, "HTTP/1.1 200 OK\r\nContent-Length: 5\r\nContent-Length: 6\r\n\r\nhello!");
    } else if (path === "/short") {
      this.send(c, "HTTP/1.1 200 OK\r\nContent-Length: 10\r\n\r\nabc");
      this.close(c);
    } else if (path === "/to-echo-302") {
      this.respond(c, "302 Found", "Location: /echo?from=302\r\n", redirect);
    } else if (path === "/to-echo-303") {
      this.respond(c, "303 See Other", "Location: /echo\r\n", redirect);
    } else if (path === "/to-echo-307") {
      this.respond(c, "307 Temporary Redirect", "Location: /echo\r\n", redirect);
    } else if (path === "/to-echo-308") {
      this.respond(c, "308 Permanent Redirect", "Location: echo\r\n", redirect);
    } else if (path === "/method") {
      this.respond(c, "200 OK", `X-Method: ${method}\r\n`, "");
    } else if (path === "/to-method-303") {
      this.respond(c, "303 See Other", "Location: /method\r\n", "");
    } else if (path === "/close-header") {
      // Says it closes, and leaves the socket open: the client must not reuse it.
      this.respond(c, "200 OK", "Connection: close\r\n", "closing");
    } else if (path.startsWith("/hops-")) {
      const left: i32 = toI32(path.charCodeAt(6)) - 48;
      if (left > 0) {
        this.respond(c, "302 Found", `Location: /hops-${left - 1}\r\n`, redirect);
      } else {
        this.respond(c, "200 OK", "", "landed");
      }
    } else if (path === "/loop") {
      this.respond(c, "302 Found", "Location: /loop\r\n", redirect);
    } else if (path === "/to-other") {
      this.respond(c, "302 Found", `Location: http://127.0.0.1:${this.portB}/echo\r\n`, redirect);
    } else if (path === "/to-ftp") {
      this.respond(c, "302 Found", "Location: ftp://127.0.0.1/file\r\n", redirect);
    } else if (path === "/to-https") {
      this.respond(c, "302 Found", `Location: https://127.0.0.1:${this.portA}/\r\n`, redirect);
    } else if (path === "/sse") {
      this.send(c, "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\n\r\ndata: one\n\n");
      c.sse = true;
    } else if (path === "/sse-next") {
      for (let i: i32 = 0; i < toI32(this.conns.length); i++) {
        const s: Conn = this.conns[i];
        if (s.open && s.sse) {
          this.send(s, "data: two\n\n");
          this.close(s);
        }
      }
      this.respond(c, "200 OK", "", "sent");
    } else {
      this.respond(c, "404 Not Found", "", "no such path");
    }
  }

  /** Reads what `c` has and answers every whole request in it. */
  readable(c: Conn): void {
    while (c.open) {
      if (c.len === toI32(c.buf.length)) {
        this.close(c);
        return;
      }
      const n: i32 = netRead(c.fd, c.buf, c.len, toI32(c.buf.length) - c.len);
      if (n === -11) {
        return;
      }
      if (n <= 0) {
        this.close(c);
        return;
      }
      c.len += n;
      if (c.buf[0] === 0x16) {
        // A TLS ClientHello: this server speaks only plain HTTP, so it hangs up.
        this.close(c);
        return;
      }
      let text: string = String.fromBytes(c.buf, 0, c.len);
      let end: i32 = toI32(text.indexOf("\r\n\r\n"));
      while (end >= 0 && c.open) {
        const head: string = text.substring(0, end);
        const lowered: string = lower(head);
        let bodyLen: i32 = 0;
        const cl: i32 = toI32(lowered.indexOf("\r\ncontent-length: "));
        if (cl >= 0) {
          let k: i32 = cl + 18;
          while (k < toI32(head.length) && head.charCodeAt(k) >= 48 && head.charCodeAt(k) <= 57) {
            bodyLen = bodyLen * 10 + toI32(head.charCodeAt(k)) - 48;
            k++;
          }
        }
        if (end + 4 + bodyLen > toI32(text.length)) {
          break;
        }
        const body: string = text.substring(end + 4, end + 4 + bodyLen);
        const used: i32 = end + 4 + bodyLen;
        for (let i: i32 = used; i < c.len; i++) {
          c.buf[i - used] = c.buf[i];
        }
        c.len -= used;
        this.handle(c, head, body);
        text = String.fromBytes(c.buf, 0, c.len);
        end = toI32(text.indexOf("\r\n\r\n"));
      }
    }
  }

  accept(fd: i32, port: i32): void {
    const peer: u8[] = new Array<u8>(18);
    let s: i32 = tcpAccept(fd, peer);
    while (s >= 0) {
      this.accepts += 1;
      const c: Conn = new Conn(s, this.accepts, port);
      this.conns.push(c);
      pollAdd(this.loop, s, 1, toI32(this.conns.length) + 1);
      s = tcpAccept(fd, peer);
    }
  }

  /** Serves until child `pid` exits: its exit code, or 99 when it ran past 100 s. */
  serve(pid: i32): i32 {
    const ready: i32[] = new Array<i32>(128);
    const start: i64 = monotonicNanos();
    while (true) {
      const status: i32[] = waitPid(pid, 1);
      if (status[0] === pid) {
        return status[1];
      }
      if (monotonicNanos() - start > toI64(100000) * toI64(1000000)) {
        kill(pid, 9);
        waitPid(pid, 0);
        console.log("FAIL  the client ran past 100 s");
        return 99;
      }
      const count: i32 = pollWait(this.loop, ready, 20);
      for (let i: i32 = 0; i < count; i++) {
        const token: i32 = ready[i * 2];
        if (token === 0) {
          this.accept(this.listenA, this.portA);
        } else if (token === 1) {
          this.accept(this.listenB, this.portB);
        } else {
          this.readable(this.conns[token - 2]);
        }
      }
      for (let i: i32 = 0; i < toI32(this.conns.length); i++) {
        const c: Conn = this.conns[i];
        if (c.open && c.drip > 0) {
          this.send(c, "x");
          c.drip -= 1;
        }
      }
    }
  }
}

// --- the client ------------------------------------------------------------------

class Tally {
  passed: i32 = 0;
  failed: i32 = 0;

  check(ok: boolean, text: string): void {
    if (ok) {
      this.passed += 1;
      console.log(`PASS  ${text}`);
    } else {
      this.failed += 1;
      console.log(`FAIL  ${text}`);
    }
  }
}

const text = (b: u8[] | null): string => (b !== null ? String.fromBytes(b, 0, toI32(b.length)) : "<null>");

const get = (url: string): HttpRequest => new HttpRequest("GET", url);

const post = (url: string, body: string): HttpRequest => {
  const req: HttpRequest = new HttpRequest("POST", url);
  req.header("Content-Type", "text/plain");
  req.body = bytesOf(body);
  return req;
};

/** The whole body of `res`, or "<null>" when it is null or the read failed. */
const bodyOf = (res: HttpResponse | null): string => (res !== null ? text(res.body.readAll(1048576)) : "<null>");

/** Field `name` of `res`, or "<null>" when there is no response or no such field. */
const field = (res: HttpResponse | null, name: string): string => {
  if (res === null) {
    return "<null>";
  }
  const v: string | null = res.header(name);
  return v !== null ? v : "<null>";
};

const conn = (res: HttpResponse | null): string => {
  if (res === null) {
    return "none";
  }
  const v: string | null = res.header("X-Conn");
  return v !== null ? v : "none";
};

const fails = (client: HttpClient, res: HttpResponse | null, code: i32): boolean => {
  if (res !== null || client.error !== code) {
    console.log(`  got ${res !== null ? `status ${res.status}` : "null"}, error ${client.error}: ${client.errorText}`);
    return false;
  }
  return true;
};

const pureChecks = (t: Tally): void => {
  t.check(httpNoProxyMatch("*", "anything.example", 80), "NO_PROXY: * matches every host");
  t.check(httpNoProxyMatch("example.com", "example.com", 80), "NO_PROXY: a name matches itself");
  t.check(httpNoProxyMatch("example.com", "api.example.com", 80), "NO_PROXY: and any name under it");
  t.check(httpNoProxyMatch(".example.com", "api.example.com", 80) && httpNoProxyMatch(".example.com", "example.com", 80), "NO_PROXY: a leading dot changes nothing");
  t.check(!httpNoProxyMatch("example.com", "badexample.com", 80), "NO_PROXY: but not a name that only ends the same way");
  t.check(httpNoProxyMatch(" a.test , EXAMPLE.com ", "Api.Example.COM", 80), "NO_PROXY: entries are trimmed, and case does not matter");
  t.check(httpNoProxyMatch("example.com:8080", "example.com", 8080) && !httpNoProxyMatch("example.com:8080", "example.com", 80), "NO_PROXY: an entry with a port matches that port only");
  t.check(httpNoProxyMatch("10.0.0.1", "10.0.0.1", 80) && !httpNoProxyMatch("0.0.1", "10.0.0.1", 80), "NO_PROXY: an IPv4 address matches only itself, never as a suffix");
  t.check(httpNoProxyMatch("::1", "::1", 80) && httpNoProxyMatch("[::1]:8080", "::1", 8080) && !httpNoProxyMatch("[::1]:8080", "::1", 80), "NO_PROXY: an IPv6 address, bare or bracketed with a port");
  t.check(!httpNoProxyMatch("", "example.com", 80) && !httpNoProxyMatch(",,", "example.com", 80), "NO_PROXY: an empty list or empty entries match nothing");
  t.check(!httpNoProxyMatch("example.com:http", "example.com", 80) && !httpNoProxyMatch("[::1", "::1", 80), "NO_PROXY: an entry with a bad port or no closing bracket is skipped");
  t.check(httpChooseProxy("http://a:1", "http://b:2", true) === "http://a:1", "proxy variables: the lower-case name wins");
  t.check(httpChooseProxy(null, "http://b:2", true) === "http://b:2" && httpChooseProxy("", "http://b:2", true) === "http://b:2", "proxy variables: the upper-case one is used when the lower is unset or empty");
  t.check(httpChooseProxy(null, "http://b:2", false) === "", "proxy variables: HTTP_PROXY is ignored under CGI (httpoxy)");
  t.check(httpProxyFor("http", "a.test", 80, "http://p:1", "http://q:2", "") === "http://p:1", "httpProxyFor: http takes the http proxy");
  t.check(httpProxyFor("https", "a.test", 443, "http://p:1", "http://q:2", "") === "http://q:2", "httpProxyFor: https takes the https proxy");
  t.check(httpProxyFor("https", "a.test", 443, "http://p:1", "", "") === "", "httpProxyFor: https never falls back to the http proxy");
  t.check(httpProxyFor("http", "a.test", 80, "http://p:1", "", "a.test") === "", "httpProxyFor: NO_PROXY bypasses it");
  t.check(httpErrorName(HTTP_E_READ_TIMEOUT) === "read timeout" && httpErrorName(99) === "unknown", "httpErrorName names each code");
};

const runClient = (portA: i32, portB: i32): i32 => {
  const t: Tally = new Tally();
  pureChecks(t);
  const base: string = `http://127.0.0.1:${portA}`;
  const options: HttpOptions = new HttpOptions();
  options.useEnvProxy = false;
  options.readTimeoutMs = 5000;
  options.connectTimeoutMs = 5000;
  const client: HttpClient = new HttpClient(options);

  // --- plain fetches and keep-alive
  const a: HttpResponse | null = client.fetch(get(`${base}/hello`));
  t.check(a !== null && a.status === 200 && a.reason === "OK" && bodyOf(a) === "hello", "a GET with a Content-Length body");
  t.check(a !== null && a.url === `${base}/hello` && client.error === HTTP_E_NONE, "the response names its URL, and the client no error");
  const b: HttpResponse | null = client.fetch(get(`${base}/chunked`));
  t.check(b !== null && bodyOf(b) === "hello, world", "a chunked body comes back de-chunked");
  t.check(conn(a) === conn(b) && conn(a) !== "none", "the second fetch reused the first one's connection");
  const e: HttpResponse | null = client.fetch(get(`${base}/echo?x=1&y=two`));
  const echoed: string = bodyOf(e);
  t.check(echoed.startsWith("GET /echo?x=1&y=two HTTP/1.1\r\nHost: 127.0.0.1:" + `${portA}\r\n`), "the request line is origin-form, and Host comes first from the URL");
  t.check(field(e, "content-type") === "text/plain" && field(e, "CONTENT-TYPE") === "text/plain" && field(e, "x-missing") === "<null>", "header() finds a field in any case");
  const i: HttpResponse | null = client.fetch(get(`${base}/informational`));
  t.check(i !== null && i.status === 200 && bodyOf(i) === "ok", "a 103 before the response is read past");
  const p: HttpResponse | null = client.fetch(post(`${base}/echo`, "a=1"));
  t.check(bodyOf(p).endsWith("\r\nContent-Length: 3\r\n\r\na=1"), "a POST body goes with its Content-Length");
  const emptyReq: HttpRequest = new HttpRequest("PUT", `${base}/echo`);
  const nothing: u8[] = [];
  emptyReq.body = nothing;
  t.check(bodyOf(client.fetch(emptyReq)).endsWith("\r\nContent-Length: 0\r\n\r\n"), "an empty body sends Content-Length: 0, and no body sends none");
  const hostReq: HttpRequest = get(`${base}/echo`);
  hostReq.header("Host", "named.test");
  t.check(bodyOf(client.fetch(hostReq)).indexOf("\r\nHost: named.test\r\n") >= 0, "a caller's Host is sent in place of the URL's");
  const proxyAuthReq: HttpRequest = get(`${base}/echo`);
  proxyAuthReq.header("Proxy-Authorization", "Basic c2VjcmV0");
  const direct: string = bodyOf(client.fetch(proxyAuthReq));
  t.check(direct.startsWith("GET /echo HTTP/1.1\r\n") && direct.indexOf("c2VjcmV0") < 0, "a caller's Proxy-Authorization never goes to an origin fetched directly");

  // --- a fetch while a body is unread
  const open: HttpResponse | null = client.fetch(get(`${base}/hello`));
  const after: HttpResponse | null = client.fetch(get(`${base}/hello`));
  const buf: u8[] = new Array<u8>(16);
  t.check(open !== null && open.body.read(buf, 0, 16) === -HTTP_E_IO, "a body left unread answers an error once the next fetch starts");
  t.check(after !== null && bodyOf(after) === "hello" && conn(after) !== conn(open), "and the next fetch went on a new connection");
  t.check(after !== null && after.body.read(buf, 0, 16) === 0, "a body read to its end answers 0 again");
  const stale: HttpResponse | null = client.fetch(get(`${base}/hello`));
  const urlFailed: boolean = fails(client, client.fetch(get("ftp://127.0.0.1/")), HTTP_E_URL);
  t.check(urlFailed && stale !== null && stale.body.read(buf, 0, 16) === -HTTP_E_IO && client.error === HTTP_E_URL, "a stale body's read leaves the later fetch's error in place");
  const cutter: HttpClient = new HttpClient(options);
  const cut: HttpResponse | null = cutter.fetch(get(`${base}/big`));
  const cutRead: i32 = cut !== null ? cut.body.read(buf, 0, 4) : -1;
  cutter.close();
  t.check(cutRead === 4 && cut !== null && cut.body.read(buf, 0, 16) === -HTTP_E_IO, "a body its client closed before its end answers an error, never 0");
  const pieces: HttpResponse | null = client.fetch(get(`${base}/hello`));
  let pieced: string = "";
  let piece: i32 = pieces !== null ? pieces.body.read(buf, 0, 2) : -1;
  t.check(piece === 2, "a read asking for two bytes of a longer body answers two");
  while (piece > 0 && pieces !== null) {
    pieced = pieced + String.fromBytes(buf, 0, piece);
    piece = pieces.body.read(buf, 0, 2);
  }
  t.check(piece === 0 && pieced === "hello", "a body read two bytes at a time is read whole");
  const closing: HttpResponse | null = client.fetch(get(`${base}/close-header`));
  t.check(bodyOf(closing) === "closing", "a response that says Connection: close is read");
  const reopened: HttpResponse | null = client.fetch(get(`${base}/hello`));
  t.check(bodyOf(reopened) === "hello" && conn(reopened) !== conn(closing), "and its connection is not used again, though the server left it open");
  const closed: HttpResponse | null = client.fetch(get(`${base}/close-header`));
  bodyOf(closed);
  const posted: HttpResponse | null = client.fetch(post(`${base}/echo`, "after"));
  t.check(bodyOf(posted).endsWith("\r\n\r\nafter") && conn(posted) !== conn(closed), "a POST after it goes on a new connection, with no retry needed");

  // --- a stale kept-alive connection
  const s1: HttpResponse | null = client.fetch(get(`${base}/stale`));
  t.check(bodyOf(s1) === "stale", "the server answers and then closes the kept connection");
  pause(100);
  const s2: HttpResponse | null = client.fetch(get(`${base}/hello`));
  t.check(s2 !== null && bodyOf(s2) === "hello" && conn(s2) !== conn(s1), "a GET on it is sent again on a fresh connection");
  bodyOf(client.fetch(get(`${base}/stale`)));
  pause(100);
  const s3: HttpResponse | null = client.fetch(post(`${base}/echo`, "once"));
  t.check(fails(client, s3, HTTP_E_IO), "a POST on it is not sent twice: it fails with HTTP_E_IO");
  t.check(bodyOf(client.fetch(get(`${base}/hello`))) === "hello", "and the client fetches again after it");

  // --- limits and broken responses
  const small: HttpOptions = new HttpOptions();
  small.useEnvProxy = false;
  small.maxBodyBytes = 10;
  const limited: HttpClient = new HttpClient(small);
  t.check(fails(limited, limited.fetch(get(`${base}/big`)), HTTP_E_BODY_TOO_LARGE), "a Content-Length past maxBodyBytes is HTTP_E_BODY_TOO_LARGE before the body is read");
  const chunkedBig: HttpResponse | null = limited.fetch(get(`${base}/chunked`));
  t.check(chunkedBig !== null && chunkedBig.body.readAll(1000) === null && limited.error === HTTP_E_BODY_TOO_LARGE, "and a chunked body is cut off as it passes maxBodyBytes");
  const big2: HttpResponse | null = client.fetch(get(`${base}/big`));
  t.check(big2 !== null && big2.body.readAll(39) === null && client.error === HTTP_E_BODY_TOO_LARGE, "and so is one past readAll's limit");
  t.check(big2 !== null && big2.body.read(buf, 0, 16) === -HTTP_E_BODY_TOO_LARGE, "and the body answers that error again when read after it");
  const big3: HttpResponse | null = client.fetch(get(`${base}/big`));
  t.check(big3 !== null && text(big3.body.readAll(40)) === "0123456789012345678901234567890123456789", "while one exactly at the limit is read whole");
  t.check(fails(client, client.fetch(get(`${base}/bad`)), HTTP_E_PROTOCOL), "two Content-Length fields that disagree are HTTP_E_PROTOCOL");
  t.check(client.errorText.indexOf("http1 error") >= 0, "and errorText names the parser's code");
  const short: HttpResponse | null = client.fetch(get(`${base}/short`));
  t.check(short !== null && short.body.readAll(100) === null && client.error === HTTP_E_PROTOCOL, "a body cut short by the close is an error, never a whole body");
  t.check(short !== null && short.body.read(buf, 0, 16) === -HTTP_E_PROTOCOL, "and the body answers that error again when read after it");
  const crlf: HttpRequest = get(`${base}/echo`);
  crlf.header("X-Evil", "a\r\nInjected: yes");
  t.check(fails(client, client.fetch(crlf), HTTP_E_REQUEST), "a header value with CR LF is refused before a byte is sent");
  t.check(fails(client, client.fetch(new HttpRequest("GE T", `${base}/`)), HTTP_E_REQUEST), "and so is a method that is not a token");
  t.check(fails(client, client.fetch(get("ftp://127.0.0.1/")), HTTP_E_URL), "an ftp URL is HTTP_E_URL");
  t.check(fails(client, client.fetch(get("/relative")), HTTP_E_URL), "and so is a relative one");

  // --- timeouts and failures to connect
  const quick: HttpOptions = new HttpOptions();
  quick.useEnvProxy = false;
  quick.readTimeoutMs = 300;
  const q: HttpClient = new HttpClient(quick);
  let t0: i64 = monotonicNanos();
  t.check(fails(q, q.fetch(get(`${base}/stall`)), HTTP_E_READ_TIMEOUT), "a server that never answers is HTTP_E_READ_TIMEOUT");
  const stallMs: i64 = (monotonicNanos() - t0) / toI64(1000000);
  t.check(stallMs >= toI64(290) && stallMs < toI64(3000), "after readTimeoutMs");
  const total: HttpOptions = new HttpOptions();
  total.useEnvProxy = false;
  total.readTimeoutMs = 0;
  total.totalTimeoutMs = 400;
  const tc: HttpClient = new HttpClient(total);
  t0 = monotonicNanos();
  const drip: HttpResponse | null = tc.fetch(get(`${base}/drip`));
  t.check(drip !== null && drip.body.readAll(4096) === null && tc.error === HTTP_E_TOTAL_TIMEOUT, "a body dripped a byte at a time is cut off by totalTimeoutMs");
  t.check(tc.errorText.indexOf("ran past 400 ms") >= 0, "and the error says the fetch ran past totalTimeoutMs");
  const dripMs: i64 = (monotonicNanos() - t0) / toI64(1000000);
  t.check(dripMs >= toI64(390) && dripMs < toI64(3000), "after totalTimeoutMs, counted from the start of the fetch");
  const listener: i32 = tcpListen("127.0.0.1", 0, 0);
  const fullPort: i32 = netLocalPort(listener);
  const addr: u8[] = new Array<u8>(18);
  netAddress(addr, "127.0.0.1", fullPort);
  for (let k: i32 = 0; k < 4; k++) {
    tcpConnect(addr);
  }
  const ct: HttpOptions = new HttpOptions();
  ct.useEnvProxy = false;
  ct.connectTimeoutMs = 300;
  const cc: HttpClient = new HttpClient(ct);
  t.check(fails(cc, cc.fetch(get(`http://127.0.0.1:${fullPort}/`)), HTTP_E_CONNECT_TIMEOUT), "a listener whose backlog is full is HTTP_E_CONNECT_TIMEOUT");
  const gone: i32 = tcpListen("127.0.0.1", 0, 1);
  const gonePort: i32 = netLocalPort(gone);
  netClose(gone);
  t.check(fails(client, client.fetch(get(`http://127.0.0.1:${gonePort}/`)), HTTP_E_REFUSED), "a port nothing listens on is HTTP_E_REFUSED");
  t.check(fails(cc, cc.fetch(get("http://nonexistent.invalid/")), HTTP_E_DNS), "a name that does not exist is HTTP_E_DNS");
  t.check(httpFetch(get(`http://127.0.0.1:${gonePort}/`), ct) === null, "httpFetch answers null on a failure");
  const once: HttpResponse | null = httpFetch(get(`${base}/hello`), options);
  t.check(bodyOf(once) === "hello", "and the response on a success");

  // --- redirects
  const r0: HttpResponse | null = client.fetch(get(`${base}/to-echo-303`));
  t.check(r0 !== null && r0.status === 303 && field(r0, "location") === "/echo", "a redirect is not followed by default");
  bodyOf(r0);
  const follow: HttpOptions = new HttpOptions();
  follow.useEnvProxy = false;
  follow.followRedirects = true;
  const rc: HttpClient = new HttpClient(follow);
  const warm: HttpResponse | null = rc.fetch(get(`${base}/hello`));
  bodyOf(warm);
  const authed: HttpRequest = get(`${base}/to-echo-302`);
  authed.header("Authorization", "Bearer kept");
  const r1: HttpResponse | null = rc.fetch(authed);
  const r1body: string = bodyOf(r1);
  t.check(r1 !== null && r1.status === 200 && r1body.startsWith("GET /echo?from=302 HTTP/1.1\r\n"), "followed, a 302 fetches its Location");
  t.check(r1 !== null && r1.url === `${base}/echo?from=302`, "and the response names the URL that answered");
  t.check(r1body.indexOf("\r\nAuthorization: Bearer kept\r\n") >= 0, "a redirect within the origin keeps Authorization");
  t.check(conn(r1) === conn(warm), "and its body was drained, so the connection was kept");
  const r2: string = bodyOf(rc.fetch(post(`${base}/to-echo-303`, "dropped")));
  t.check(r2.startsWith("GET /echo HTTP/1.1\r\n") && r2.indexOf("Content-Length") < 0 && r2.indexOf("Content-Type") < 0, "a POST redirected by 303 becomes a GET without its body");
  const r3: string = bodyOf(rc.fetch(post(`${base}/to-echo-302`, "dropped")));
  t.check(r3.startsWith("GET /echo?from=302 HTTP/1.1\r\n") && r3.indexOf("Content-Length") < 0, "and so does one redirected by 302");
  const r4: string = bodyOf(rc.fetch(post(`${base}/to-echo-307`, "kept")));
  t.check(r4.startsWith("POST /echo HTTP/1.1\r\n") && r4.endsWith("\r\n\r\nkept") && r4.indexOf("Content-Type: text/plain") >= 0, "307 keeps the method and the body");
  const put: HttpRequest = new HttpRequest("PUT", `${base}/to-echo-308`);
  put.body = bytesOf("also");
  const r5: string = bodyOf(rc.fetch(put));
  t.check(r5.startsWith("PUT /echo HTTP/1.1\r\n") && r5.endsWith("\r\n\r\nalso"), "and so does 308, its relative Location resolved");
  const limitOpts: HttpOptions = new HttpOptions();
  limitOpts.useEnvProxy = false;
  limitOpts.followRedirects = true;
  limitOpts.maxRedirects = 3;
  const lc: HttpClient = new HttpClient(limitOpts);
  t.check(fails(lc, lc.fetch(get(`${base}/loop`)), HTTP_E_TOO_MANY_REDIRECTS), "a redirect loop is HTTP_E_TOO_MANY_REDIRECTS after maxRedirects");
  t.check(bodyOf(lc.fetch(get(`${base}/hops-3`))) === "landed", "exactly maxRedirects redirects are followed");
  t.check(fails(lc, lc.fetch(get(`${base}/hops-4`)), HTTP_E_TOO_MANY_REDIRECTS), "and one more is HTTP_E_TOO_MANY_REDIRECTS");
  const headed: HttpResponse | null = rc.fetch(new HttpRequest("HEAD", `${base}/to-method-303`));
  const headedMethod: string | null = headed !== null ? headed.header("X-Method") : null;
  t.check(headedMethod !== null && headedMethod === "HEAD", "a HEAD redirected by 303 stays a HEAD");
  const other: HttpRequest = get(`${base}/to-other`);
  other.header("Authorization", "Bearer secret");
  other.header("Proxy-Authorization", "Basic c2VjcmV0");
  other.header("Cookie", "id=1");
  other.header("Host", `127.0.0.1:${portA}`);
  other.header("X-Kept", "yes");
  t.check(fails(rc, rc.fetch(other), HTTP_E_REDIRECT_REFUSED), "a redirect to another origin is refused by default");
  t.check(fails(rc, rc.fetch(get(`${base}/to-ftp`)), HTTP_E_REDIRECT_REFUSED), "and so is one to an ftp URL");
  t.check(fails(rc, rc.fetch(get(`${base}/to-https`)), HTTP_E_REDIRECT_REFUSED), "and one from http to https, which is another origin");
  const cross: HttpOptions = new HttpOptions();
  cross.useEnvProxy = false;
  cross.followRedirects = true;
  cross.crossOriginRedirects = true;
  const xc: HttpClient = new HttpClient(cross);
  const x1: HttpResponse | null = xc.fetch(other);
  const x1body: string = bodyOf(x1);
  t.check(x1 !== null && x1.url === `http://127.0.0.1:${portB}/echo`, "allowed, it is followed to the other origin");
  t.check(lower(x1body).indexOf("authorization") < 0 && lower(x1body).indexOf("cookie") < 0, "without Authorization, Proxy-Authorization or Cookie");
  t.check(x1body.indexOf(`\r\nHost: 127.0.0.1:${portB}\r\n`) >= 0 && x1body.indexOf("\r\nX-Kept: yes\r\n") >= 0, "with the new origin's Host and the caller's other fields");

  // --- proxies
  const viaProxy: HttpClient = new HttpClient(options);
  viaProxy.setProxies(`http://us%65r:pa%73s@127.0.0.1:${portA}`, "", "");
  const px: string = bodyOf(viaProxy.fetch(get("http://example.test:81/echo?q=1")));
  t.check(px.startsWith("GET http://example.test:81/echo?q=1 HTTP/1.1\r\nHost: example.test:81\r\n"), "through an http proxy the target is absolute-form, the Host the origin's");
  t.check(px.indexOf("\r\nProxy-Authorization: Basic dXNlcjpwYXNz\r\n") >= 0, "and the proxy's decoded userinfo is sent as Proxy-Authorization");
  viaProxy.setProxies(`http://127.0.0.1:${portB}`, "", "127.0.0.1");
  const bypass: string = bodyOf(viaProxy.fetch(get(`${base}/echo`)));
  t.check(bypass.startsWith("GET /echo HTTP/1.1\r\n"), "a host in NO_PROXY is fetched directly");
  viaProxy.setProxies("ftp://127.0.0.1:1", "", "");
  t.check(fails(viaProxy, viaProxy.fetch(get("http://example.test/")), HTTP_E_PROXY), "a proxy that is not http:// is HTTP_E_PROXY");
  viaProxy.setProxies("", `http://user:pass@127.0.0.1:${portA}`, "");
  t.check(fails(viaProxy, viaProxy.fetch(get("https://example.test/")), HTTP_E_TLS), "an https fetch through a proxy is tunnelled with CONNECT, the proxy authorised");
  viaProxy.setProxies("", `http://user:pass@127.0.0.1:${portA}`, "");
  t.check(fails(viaProxy, viaProxy.fetch(get("https://deny.test/")), HTTP_E_PROXY_REFUSED), "a CONNECT the proxy answers with 407 is HTTP_E_PROXY_REFUSED");
  t.check(fails(client, client.fetch(get(`https://127.0.0.1:${portA}/`)), HTTP_E_TLS), "an https server that hangs up on the ClientHello is HTTP_E_TLS");

  // --- an event stream
  const sse: HttpResponse | null = client.fetch(get(`${base}/sse`));
  const ev: u8[] = new Array<u8>(256);
  const first: i32 = sse !== null ? sse.body.read(ev, 0, 256) : -1;
  t.check(first > 0 && String.fromBytes(ev, 0, first) === "data: one\n\n", "an event stream's first event is read while the server holds the stream open");
  const nudge: HttpResponse | null = httpFetch(get(`http://127.0.0.1:${portB}/sse-next`), options);
  bodyOf(nudge);
  const rest: string = sse !== null ? text(sse.body.readAll(256)) : "";
  t.check(rest === "data: two\n\n", "and the next one, the stream ending with the connection");

  console.log(`http fetch: ${t.passed} passed, ${t.failed} failed, 0 skipped`);
  return t.failed;
};

const parsePort = (s: string): i32 => {
  let v: i32 = 0;
  for (let i: i32 = 0; i < toI32(s.length); i++) {
    v = v * 10 + toI32(s.charCodeAt(i)) - 48;
  }
  return v;
};

export function main(): i32 {
  const argv: string[] = process.argv;
  if (toI32(argv.length) >= 4 && argv[1] === "client") {
    return runClient(parsePort(argv[2]), parsePort(argv[3]));
  }
  const server: Server = new Server();
  const pid: i32 = spawn([selfPath(), "client", `${server.portA}`, `${server.portB}`]);
  if (pid <= 0) {
    console.log("FAIL  the client could not be started");
    return 1;
  }
  return server.serve(pid);
}
