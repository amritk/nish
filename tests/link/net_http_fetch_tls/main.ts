// nish/net/http-client over https, against TLS servers on loopback.
//
// The parent runs four TLS servers, one for each certificate in `certs.ts`
// (good, expired, for another name, from a root the client never trusts),
// and a CONNECT proxy that splices one tunnel at a time to the good one. A
// child of the same binary runs every fetch and prints the checks. The good
// server answers each request with its request line and `X-Conn`, the number
// of the connection it came on, so the child sees a TLS connection reused,
// and sees that a refused fetch never opened one. `/cut` sends half a body
// and drops the TCP connection without a close_notify: a truncation.

import { HTTP_E_CERTIFICATE, HTTP_E_TLS, HttpClient, HttpOptions, HttpRequest, HttpResponse, httpFetch } from "nish/net/http-client";
import { netAddress, netClose, netLocalPort, netRead, netWrite, pollAdd, pollCreate, pollModify, pollRemove, pollWait, tcpAccept, tcpConnect, tcpListen } from "nish:net";
import { kill, monotonicNanos, platform, spawn, waitPid } from "nish:process";
import { realpathSync, writeFileSync } from "nish:fs";
import { Secret, secret, wipe } from "nish:secret";
import { TlsServerConfig } from "nish/net/tls";
import { TLS_SIGNATURE_ECDSA_SECP256R1_SHA256 } from "nish/net/tls/codec";
import { TLS_RECORD_DATA, TLS_RECORD_DONE, TLS_RECORD_SIGN } from "nish/net/tls/record-server";
import { TlsTcpServer } from "nish/net/tls-tcp";
import { leafPrivate, serverPrivate, serverRandom } from "../net_tls_common/server";
import { expiredLeaf, goodLeaf, strangerLeaf, strangerRoot, strangerRootPem, trustedRootPem, wrongHostLeaf } from "./certs";

const selfPath = (): string => {
  const exe: string | null = platform === "linux" ? realpathSync("/proc/self/exe") : null;
  return exe !== null ? exe : process.argv[0];
};

const asciiBytes = (s: string): u8[] => {
  const out: u8[] = new Array<u8>(toI32(s.length));
  for (let i: i32 = 0; i < toI32(s.length); i++) {
    out[i] = toU8(s.charCodeAt(i));
  }
  return out;
};

// --- the servers -----------------------------------------------------------------

const GOOD: i32 = 0;
const SITES: i32 = 4;
const SLOTS: i32 = 4;
/** Poll tokens: a site's listener, the proxy's listener and its two ends, and a site's slot. */
const LISTEN_TOKEN: i32 = 10;
const PROXY_LISTEN: i32 = 20;
const PROXY_DOWN: i32 = 21;
const PROXY_UP: i32 = 22;
const SLOT_TOKEN: i32 = 1000;

/** A server configuration sending `chain`, signing with the leaf key. */
const configFor = (chain: u8[][]): TlsServerConfig => {
  const none: u8[] = [];
  const alpn: string[] = ["http/1.1"];
  return {
    certificateChain: chain,
    alpn: alpn,
    quicTransportParameters: none,
    extraExtensions: none,
    signatureScheme: TLS_SIGNATURE_ECDSA_SECP256R1_SHA256,
    quic: false,
  };
};

/** One TLS server: its listener, its pool, and what each slot has read and is numbered. */
class Site {
  server: TlsTcpServer;
  listener: i32;
  port: i32;
  got: string[];
  ids: i32[];

  constructor(chain: u8[][]) {
    this.listener = tcpListen("127.0.0.1", 0, 8);
    this.port = netLocalPort(this.listener);
    this.server = new TlsTcpServer(configFor(chain), this.listener, SLOTS);
    this.got = [];
    this.ids = [];
    for (let i: i32 = 0; i < SLOTS; i++) {
      this.got.push("");
      this.ids.push(0);
    }
  }
}

class Servers {
  loop: i32;
  sites: Site[];
  proxyListener: i32;
  proxyPort: i32;
  down: i32 = -1;
  up: i32 = -1;
  /** What the proxy has read of the CONNECT head; empty once the tunnel is open. */
  head: string = "";
  tunnel: boolean = false;
  connections: i32 = 0;
  buf: u8[];

  constructor() {
    this.loop = pollCreate();
    this.buf = new Array<u8>(16384);
    this.sites = [];
    this.sites.push(new Site([goodLeaf()]));
    this.sites.push(new Site([expiredLeaf()]));
    this.sites.push(new Site([wrongHostLeaf()]));
    this.sites.push(new Site([strangerLeaf(), strangerRoot()]));
    for (let i: i32 = 0; i < SITES && i < toI32(this.sites.length); i++) {
      pollAdd(this.loop, this.sites[i].listener, 1, LISTEN_TOKEN + i);
    }
    this.proxyListener = tcpListen("127.0.0.1", 0, 8);
    this.proxyPort = netLocalPort(this.proxyListener);
    pollAdd(this.loop, this.proxyListener, 1, PROXY_LISTEN);
  }

  accept(index: i32): void {
    const site: Site = this.sites[index];
    let slot: i32 = site.server.accept(serverRandom(), serverPrivate());
    while (slot >= 0 && slot < SLOTS) {
      this.connections += 1;
      site.got[slot] = "";
      site.ids[slot] = this.connections;
      pollAdd(this.loop, site.server.fd(slot), 1, SLOT_TOKEN + index * 100 + slot);
      slot = site.server.accept(serverRandom(), serverPrivate());
    }
  }

  /** A slot's socket is ready: drive it, sign when asked, answer what it read, close it once it is done. */
  drive(index: i32, slot: i32, events: i32): void {
    const site: Site = this.sites[index];
    if (!site.server.holds(slot)) {
      return;
    }
    let wants: i32 = (events & 5) !== 0 ? site.server.readable(slot) : site.server.writable(slot);
    if ((wants & TLS_RECORD_SIGN) !== 0) {
      const key: Secret<u8[]> = secret(leafPrivate());
      wants = site.server.signP256(slot, key);
      wipe(key);
    }
    while ((wants & TLS_RECORD_DATA) !== 0 && (wants & TLS_RECORD_DONE) === 0) {
      const n: i32 = site.server.read(slot, this.buf, 0, toI32(this.buf.length));
      if (n <= 0) {
        wants = site.server.shutdown(slot);
        break;
      }
      site.got[slot] = site.got[slot] + String.fromBytes(this.buf, 0, n);
      if (!this.answer(site, slot)) {
        return;
      }
      wants = site.server.interest(slot);
    }
    if ((wants & TLS_RECORD_DONE) !== 0) {
      site.server.close(slot);
      return;
    }
    pollModify(this.loop, site.server.fd(slot), wants & 3, SLOT_TOKEN + index * 100 + slot);
  }

  /** Answers every whole request head the slot has read; false once `/cut` has closed it. */
  answer(site: Site, slot: i32): boolean {
    let end: i32 = toI32(site.got[slot].indexOf("\r\n\r\n"));
    while (end >= 0) {
      const head: string = site.got[slot].slice(0, end);
      site.got[slot] = site.got[slot].slice(end + 4);
      const lineEnd: i32 = toI32(head.indexOf("\r\n"));
      const line: string = lineEnd >= 0 ? head.slice(0, lineEnd) : head;
      if (line.startsWith("GET /cut ")) {
        const half: u8[] = asciiBytes("HTTP/1.1 200 OK\r\nContent-Length: 10\r\n\r\nhalf.");
        site.server.write(slot, half, 0, toI32(half.length));
        site.server.flush(slot);
        site.server.connection(slot).abort();
        site.server.close(slot);
        return false;
      }
      const reply: u8[] = asciiBytes(`HTTP/1.1 200 OK\r\nContent-Length: ${line.length}\r\nX-Conn: ${site.ids[slot]}\r\n\r\n${line}`);
      site.server.write(slot, reply, 0, toI32(reply.length));
      end = toI32(site.got[slot].indexOf("\r\n\r\n"));
    }
    return true;
  }

  // --- the CONNECT proxy

  proxyAccept(): void {
    const peer: u8[] = new Array<u8>(18);
    const fd: i32 = tcpAccept(this.proxyListener, peer);
    if (fd < 0) {
      return;
    }
    if (this.down >= 0) {
      netClose(fd);
      return;
    }
    this.down = fd;
    this.head = "";
    this.tunnel = false;
    pollAdd(this.loop, fd, 1, PROXY_DOWN);
  }

  /** Reads the CONNECT head, then dials the good site; anything but a CONNECT to it is hung up on. */
  proxyHead(): void {
    const n: i32 = netRead(this.down, this.buf, 0, toI32(this.buf.length));
    if (n <= 0) {
      this.proxyEnd();
      return;
    }
    this.head = this.head + String.fromBytes(this.buf, 0, n);
    if (!this.head.startsWith("C")) {
      // Not a request at all (a TLS ClientHello): hang up.
      this.proxyEnd();
      return;
    }
    if (this.head.indexOf("\r\n\r\n") < 0) {
      return;
    }
    if (!this.head.startsWith(`CONNECT localhost:${this.sites[GOOD].port} HTTP/1.1\r\n`)) {
      this.proxyEnd();
      return;
    }
    const addr: u8[] = new Array<u8>(18);
    netAddress(addr, "127.0.0.1", this.sites[GOOD].port);
    this.up = tcpConnect(addr);
    if (this.up < 0) {
      this.proxyEnd();
      return;
    }
    pollAdd(this.loop, this.up, 2, PROXY_UP);
  }

  /** The upstream is connected: tell the client so and start splicing. */
  proxyOpen(): void {
    this.tunnel = true;
    pollModify(this.loop, this.up, 1, PROXY_UP);
    this.send(this.down, asciiBytes("HTTP/1.1 200 Connection established\r\n\r\n"), 0, 39);
  }

  /** Copies what `from` has to `to`; either end closing closes both. */
  splice(from: i32, to: i32): void {
    const n: i32 = netRead(from, this.buf, 0, toI32(this.buf.length));
    if (n === -11) {
      return;
    }
    if (n <= 0 || !this.send(to, this.buf, 0, n)) {
      this.proxyEnd();
    }
  }

  send(fd: i32, bytes: u8[], off: i32, len: i32): boolean {
    let at: i32 = 0;
    let spins: i32 = 0;
    while (at < len && spins < 100000) {
      const n: i32 = netWrite(fd, bytes, off + at, len - at);
      if (n > 0) {
        at += n;
      } else if (n !== -11) {
        return false;
      }
      spins += 1;
    }
    return at === len;
  }

  proxyEnd(): void {
    if (this.down >= 0) {
      pollRemove(this.loop, this.down);
      netClose(this.down);
    }
    if (this.up >= 0) {
      pollRemove(this.loop, this.up);
      netClose(this.up);
    }
    this.down = -1;
    this.up = -1;
    this.tunnel = false;
  }

  serve(pid: i32): i32 {
    const ready: i32[] = new Array<i32>(64);
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
        const events: i32 = ready[i * 2 + 1];
        if (token >= SLOT_TOKEN) {
          this.drive((token - SLOT_TOKEN) / 100, (token - SLOT_TOKEN) % 100, events);
        } else if (token >= LISTEN_TOKEN && token < LISTEN_TOKEN + SITES) {
          this.accept(token - LISTEN_TOKEN);
        } else if (token === PROXY_LISTEN) {
          this.proxyAccept();
        } else if (token === PROXY_DOWN && this.down >= 0) {
          if (this.tunnel) {
            this.splice(this.down, this.up);
          } else if (this.up < 0) {
            this.proxyHead();
          }
        } else if (token === PROXY_UP && this.up >= 0) {
          if (this.tunnel) {
            this.splice(this.up, this.down);
          } else {
            this.proxyOpen();
          }
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

const get = (url: string): HttpRequest => new HttpRequest("GET", url);

/** The whole body of `res`, or "<null>" when it is null or the read failed. */
const bodyOf = (res: HttpResponse | null): string => {
  if (res === null) {
    return "<null>";
  }
  const b: u8[] | null = res.body.readAll(65536);
  return b !== null ? String.fromBytes(b, 0, toI32(b.length)) : "<null>";
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

const parsePort = (s: string): i32 => {
  let v: i32 = 0;
  for (let i: i32 = 0; i < toI32(s.length); i++) {
    v = v * 10 + toI32(s.charCodeAt(i)) - 48;
  }
  return v;
};

/** Options trusting the roots in `pem`, with no proxy from the environment. */
const trusting = (pem: string): HttpOptions => {
  const options: HttpOptions = new HttpOptions();
  options.useEnvProxy = false;
  options.rootsPemPath = pem;
  options.connectTimeoutMs = 5000;
  options.readTimeoutMs = 5000;
  options.totalTimeoutMs = 20000;
  return options;
};

const runClient = (ports: i32[], proxy: i32, trusted: string, stranger: string, missing: string): i32 => {
  const t: Tally = new Tally();
  const good: string = `https://localhost:${ports[0]}`;
  const options: HttpOptions = trusting(trusted);
  const client: HttpClient = new HttpClient(options);

  // --- a trusted server
  const a: HttpResponse | null = client.fetch(get(`${good}/hello`));
  const aBody: string = bodyOf(a);
  t.check(a !== null && a.status === 200 && aBody === "GET /hello HTTP/1.1", "an https fetch from a server the roots trust answers");
  if (a === null) {
    console.log(`  error ${client.error}: ${client.errorText}`);
  }
  const b: HttpResponse | null = client.fetch(get(`${good}/again`));
  t.check(bodyOf(b) === "GET /again HTTP/1.1" && conn(b) === conn(a), "and the next fetch reuses the TLS connection");
  const ip: HttpResponse | null = client.fetch(get(`https://127.0.0.1:${ports[0]}/ip`));
  t.check(bodyOf(ip) === "GET /ip HTTP/1.1" && conn(ip) !== conn(b), "an IP literal is matched against the certificate's IP name, on its own connection");
  const once: HttpResponse | null = httpFetch(get(`${good}/once`), options);
  t.check(bodyOf(once) === "GET /once HTTP/1.1", "httpFetch fetches over https too");

  // --- certificates that are refused
  const expired: HttpClient = new HttpClient(options);
  t.check(fails(expired, expired.fetch(get(`https://localhost:${ports[1]}/`)), HTTP_E_CERTIFICATE), "an expired certificate is HTTP_E_CERTIFICATE");
  t.check(expired.errorText.indexOf("refused") >= 0, "and the error says the certificate was refused");
  const wrong: HttpClient = new HttpClient(options);
  t.check(fails(wrong, wrong.fetch(get(`https://localhost:${ports[2]}/`)), HTTP_E_CERTIFICATE), "a certificate for another name is HTTP_E_CERTIFICATE");
  const untrusted: HttpClient = new HttpClient(options);
  t.check(fails(untrusted, untrusted.fetch(get(`https://localhost:${ports[3]}/`)), HTTP_E_CERTIFICATE), "a chain to a root the client does not trust is HTTP_E_CERTIFICATE");
  const other: HttpClient = new HttpClient(trusting(stranger));
  t.check(fails(other, other.fetch(get(`${good}/`)), HTTP_E_CERTIFICATE), "and so is a good server under roots that are not its own");
  const system: HttpClient = new HttpClient(trusting(""));
  t.check(fails(system, system.fetch(get(`${good}/`)), HTTP_E_CERTIFICATE), "the system roots do not trust the test's root");

  // --- no roots at all: refused before any connection
  const before: HttpResponse | null = client.fetch(get(`${good}/before`));
  bodyOf(before);
  const none: HttpClient = new HttpClient(trusting(missing));
  t.check(fails(none, none.fetch(get(`${good}/`)), HTTP_E_CERTIFICATE), "with no root certificate to trust, https is HTTP_E_CERTIFICATE");
  t.check(none.errorText.indexOf("no trusted root certificate") >= 0, "and the error says there was no root to trust");
  const after: HttpClient = new HttpClient(options);
  const next: HttpResponse | null = after.fetch(get(`${good}/after`));
  bodyOf(next);
  t.check(conn(before) !== "none" && parsePort(conn(next)) === parsePort(conn(before)) + 1, "and no connection was opened for it");

  // --- what is not TLS, and TLS cut short
  const plain: HttpClient = new HttpClient(options);
  t.check(fails(plain, plain.fetch(get(`https://127.0.0.1:${proxy}/`)), HTTP_E_TLS), "a server that does not speak TLS is HTTP_E_TLS");
  const cut: HttpClient = new HttpClient(options);
  const c: HttpResponse | null = cut.fetch(get(`${good}/cut`));
  const got: u8[] | null = c !== null ? c.body.readAll(65536) : null;
  t.check(c !== null && got === null && cut.error === HTTP_E_TLS, "a body cut off without a close_notify is HTTP_E_TLS, not a short body");
  if (got !== null || cut.error !== HTTP_E_TLS) {
    console.log(`  error ${cut.error}: ${cut.errorText}`);
  }

  // --- through a proxy
  const tunnelled: HttpClient = new HttpClient(options);
  tunnelled.setProxies("", `http://127.0.0.1:${proxy}`, "");
  const p: HttpResponse | null = tunnelled.fetch(get(`${good}/tunnel`));
  t.check(bodyOf(p) === "GET /tunnel HTTP/1.1", "https through an http proxy is a CONNECT tunnel, then TLS to the origin");
  if (p === null) {
    console.log(`  error ${tunnelled.error}: ${tunnelled.errorText}`);
  }
  const p2: HttpResponse | null = tunnelled.fetch(get(`${good}/tunnel2`));
  t.check(bodyOf(p2) === "GET /tunnel2 HTTP/1.1" && conn(p2) === conn(p), "and the tunnelled connection is reused");

  console.log(`http fetch tls: ${t.passed} passed, ${t.failed} failed, 0 skipped`);
  return t.failed;
};

export function main(): i32 {
  const argv: string[] = process.argv;
  if (toI32(argv.length) >= 10 && argv[1] === "client") {
    const ports: i32[] = [parsePort(argv[2]), parsePort(argv[3]), parsePort(argv[4]), parsePort(argv[5])];
    return runClient(ports, parsePort(argv[6]), argv[7], argv[8], argv[9]);
  }
  const self: string = selfPath();
  const trusted: string = `${self}.roots.pem`;
  const stranger: string = `${self}.stranger.pem`;
  writeFileSync(trusted, trustedRootPem);
  writeFileSync(stranger, strangerRootPem);
  const servers: Servers = new Servers();
  const s: Site[] = servers.sites;
  const pid: i32 = spawn([self, "client", `${s[0].port}`, `${s[1].port}`, `${s[2].port}`, `${s[3].port}`, `${servers.proxyPort}`, trusted, stranger, `${self}.missing.pem`]);
  if (pid <= 0) {
    console.log("FAIL  the client could not be started");
    return 1;
  }
  return servers.serve(pid);
}
