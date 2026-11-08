// The loopback TLS servers `net_http_fetch_tls` and the async https tests
// (`net_fetch_async_https`, `net_fetch_async_https_flat`) fetch from: four
// TLS servers, one for each certificate in `certs.ts` (good, expired, for
// another name, from a root the client never trusts), and a CONNECT proxy
// that splices one tunnel at a time to the good one. What each path answers
// is described at the top of `main.ts`.

import { netAddress, netClose, netLocalPort, netRead, netWrite, pollAdd, pollCreate, pollModify, pollRemove, pollWait, tcpAccept, tcpConnect, tcpListen } from "nish:net";
import { kill, monotonicNanos, platform, waitPid } from "nish:process";
import { realpathSync } from "nish:fs";
import { Secret, secret, wipe } from "nish:secret";
import { TlsServerConfig } from "nish/net/tls";
import { TLS_SIGNATURE_ECDSA_SECP256R1_SHA256 } from "nish/net/tls/codec";
import { TLS_RECORD_DATA, TLS_RECORD_DONE, TLS_RECORD_SIGN } from "nish/net/tls/record-server";
import { TlsTcpServer } from "nish/net/tls-tcp";
import { leafPrivate, serverPrivate, serverRandom } from "../net_tls_common/server";
import { expiredLeaf, goodLeaf, strangerLeaf, strangerRoot, wrongHostLeaf } from "./certs";

export const selfPath = (): string => {
  const exe: string | null = platform === "linux" ? realpathSync("/proc/self/exe") : null;
  return exe !== null ? exe : process.argv[0];
};

export const asciiBytes = (s: string): u8[] => {
  const out: u8[] = new Array<u8>(toI32(s.length));
  for (let i: i32 = 0; i < toI32(s.length); i++) {
    out[i] = toU8(s.charCodeAt(i));
  }
  return out;
};

// --- the servers -----------------------------------------------------------------

export const GOOD: i32 = 0;
const SITES: i32 = 4;
const SLOTS: i32 = 8;
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
export class Site {
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

export class Servers {
  loop: i32;
  sites: Site[];
  proxyListener: i32;
  proxyPort: i32;
  down: i32 = -1;
  up: i32 = -1;
  /** What the proxy has read of the CONNECT head; empty once the tunnel is open. */
  head: string = "";
  tunnel: boolean = false;
  /** The last whole CONNECT head the proxy read, which `/connect-head` answers with. */
  connectHead: string = "";
  /** Set once the proxy has answered a CONNECT with a 200 and an alert: it then only drains. */
  mute: boolean = false;
  connections: i32 = 0;
  /** Whether `/alert-once` has answered with an alert yet. */
  alerted: boolean = false;
  /** The connections whose client ended them with a close_notify. */
  notified: i32[];
  buf: u8[];

  constructor() {
    this.loop = pollCreate();
    this.buf = new Array<u8>(16384);
    this.notified = [];
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
        if (n === 0) {
          this.notified.push(site.ids[slot]);
        }
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

  /** Writes a 200 reply carrying `body` and the connection's number. */
  reply(site: Site, slot: i32, body: string): void {
    const bytes: u8[] = asciiBytes(`HTTP/1.1 200 OK\r\nContent-Length: ${body.length}\r\nX-Conn: ${site.ids[slot]}\r\n\r\n${body}`);
    site.server.write(slot, bytes, 0, toI32(bytes.length));
  }

  /** Whether connection `id` ended with a close_notify, reading what its slot still holds first. */
  wasNotified(id: i32): boolean {
    const site: Site = this.sites[GOOD];
    for (let s: i32 = 0; s < SLOTS; s++) {
      if (site.server.holds(s) && site.ids[s] === id) {
        this.drive(GOOD, s, 1);
      }
    }
    return this.notified.indexOf(id) >= 0;
  }

  /** Answers every whole request head the slot has read; false once a path has closed it. */
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
      if (line.startsWith("GET /until-close ")) {
        const rest: u8[] = asciiBytes("HTTP/1.1 200 OK\r\nConnection: close\r\n\r\nuntil close");
        site.server.write(slot, rest, 0, toI32(rest.length));
        site.server.close(slot);
        return false;
      }
      if (line.startsWith("GET /stale ")) {
        this.reply(site, slot, "stale");
        site.server.flush(slot);
        site.server.connection(slot).abort();
        site.server.close(slot);
        return false;
      }
      if (line.startsWith("GET /alert ")) {
        site.server.connection(slot).fail(80);
        site.server.flush(slot);
        site.server.close(slot);
        return false;
      }
      if (line.startsWith("GET /alert-once ") && !this.alerted) {
        this.alerted = true;
        site.server.connection(slot).fail(80);
        site.server.flush(slot);
        site.server.close(slot);
        return false;
      }
      if (line.startsWith("GET /then-notify ")) {
        this.reply(site, slot, "kept");
        site.server.close(slot);
        return false;
      }
      if (line.startsWith("GET /notified-")) {
        const id: i32 = parsePort(line.slice(14, toI32(line.indexOf(" HTTP/"))));
        this.reply(site, slot, this.wasNotified(id) ? "yes" : "no");
        end = toI32(site.got[slot].indexOf("\r\n\r\n"));
        continue;
      }
      if (line.startsWith("GET /head ")) {
        this.reply(site, slot, head);
        end = toI32(site.got[slot].indexOf("\r\n\r\n"));
        continue;
      }
      if (line.startsWith("GET /connect-head ")) {
        this.reply(site, slot, this.connectHead);
        end = toI32(site.got[slot].indexOf("\r\n\r\n"));
        continue;
      }
      if (line.startsWith("GET /tohttp ")) {
        const moved: u8[] = asciiBytes("HTTP/1.1 301 Moved Permanently\r\nLocation: http://who:hunter2@localhost:1/?token=s3cr3t\r\nContent-Length: 0\r\n\r\n");
        site.server.write(slot, moved, 0, toI32(moved.length));
        end = toI32(site.got[slot].indexOf("\r\n\r\n"));
        continue;
      }
      this.reply(site, slot, line);
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
    // One tunnel at a time: a new client takes over from the last.
    this.proxyEnd();
    this.down = fd;
    this.head = "";
    this.tunnel = false;
    this.mute = false;
    pollAdd(this.loop, fd, 1, PROXY_DOWN);
  }

  /** Reads the CONNECT head, then dials the good site; anything but a CONNECT to it is hung up on. */
  proxyHead(): void {
    const n: i32 = netRead(this.down, this.buf, 0, toI32(this.buf.length));
    if (n <= 0) {
      this.proxyEnd();
      return;
    }
    if (this.mute) {
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
    this.connectHead = this.head;
    if (this.head.indexOf("Proxy-Authorization: Basic YWxlcnQ6eA==\r\n") >= 0) {
      // User "alert": the 200 and a fatal handshake_failure alert record in
      // one segment, then silence, so only the bytes after the head can end it.
      const both: u8[] = asciiBytes("HTTP/1.1 200 Connection established\r\n\r\n");
      const alert: u8[] = [0x15, 0x03, 0x03, 0x00, 0x02, 0x02, 0x28];
      for (let i: i32 = 0; i < toI32(alert.length); i++) {
        both.push(alert[i]);
      }
      this.mute = true;
      this.send(this.down, both, 0, toI32(both.length));
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

export class Tally {
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

export const parsePort = (s: string): i32 => {
  let v: i32 = 0;
  for (let i: i32 = 0; i < toI32(s.length); i++) {
    v = v * 10 + toI32(s.charCodeAt(i)) - 48;
  }
  return v;
};
