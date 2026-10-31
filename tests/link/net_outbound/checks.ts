// nish/net/outbound, alone and as nish/net/http-client's outbound policy.
//
// The first half is pure: which addresses are public, what `permit` and
// `allowHost` let through, and what `outboundFilter` keeps of a lookup's
// answer. The second runs fetches against a scripted server on loopback, the
// address a server-side request forgery aims at: each is made once without a
// policy, which reaches the server, and once with one, which must fail with
// HTTP_E_BLOCKED before a connection is made. `/accepts` answers how many
// connections the server has taken, which is how the child sees that a
// refused fetch never connected. As in `net_http_fetch`, the parent serves
// and a child of the same binary fetches, since a blocking client and its
// server cannot share a thread.

import { HTTP_E_BLOCKED, HTTP_E_BODY_TOO_LARGE, HTTP_E_NONE, HTTP_E_REFUSED, HTTP_E_TOO_MANY_REDIRECTS, HTTP_E_TOTAL_TIMEOUT, HTTP_E_URL, HttpClient, HttpOptions, HttpRequest, HttpResponse, httpErrorName, httpFetch } from "nish/net/http-client";
import { OutboundPolicy, outboundAddressAllowed, outboundAddressPublic, outboundAddressText, outboundFilter, outboundHostAllowed } from "nish/net/outbound";
import { dnsParseAddress } from "nish/net/dns-config";
import { netClose, netLocalPort, netRead, netWrite, pollAdd, pollCreate, pollRemove, pollWait, tcpAccept, tcpListen } from "nish:net";
import { kill, monotonicNanos, platform, spawn, waitPid } from "nish:process";
import { realpathSync } from "nish:fs";

const selfPath = (): string => {
  const exe: string | null = platform === "linux" ? realpathSync("/proc/self/exe") : null;
  return exe !== null ? exe : process.argv[0];
};

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

// --- the server ----------------------------------------------------------------

class Conn {
  fd: i32;
  buf: u8[];
  len: i32 = 0;
  /** Bytes of `/drip`'s body still to send, one a tick. */
  drip: i32 = 0;
  open: boolean = true;

  constructor(fd: i32) {
    this.fd = fd;
    this.buf = new Array<u8>(8192);
  }
}

class Server {
  loop: i32;
  listen: i32;
  port: i32;
  conns: Conn[];
  accepts: i32 = 0;

  constructor() {
    this.loop = pollCreate();
    this.listen = tcpListen("127.0.0.1", 0, 64);
    this.port = netLocalPort(this.listen);
    pollAdd(this.loop, this.listen, 1, 0);
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
    this.send(c, `HTTP/1.1 ${status}\r\n${fields}Content-Length: ${body.length}\r\n\r\n${body}`);
  }

  redirect(c: Conn, location: string): void {
    this.respond(c, "302 Found", `Location: ${location}\r\n`, "");
  }

  /** Answers one request by its path. */
  handle(c: Conn, head: string): void {
    const sp1: i32 = toI32(head.indexOf(" "));
    const sp2: i32 = toI32(head.indexOf(" ", sp1 + 1));
    const path: string = head.substring(sp1 + 1, sp2);
    const p: i32 = this.port;
    if (path === "/hello") {
      this.respond(c, "200 OK", "", "hello");
    } else if (path === "/accepts") {
      this.respond(c, "200 OK", "", `${this.accepts}`);
    } else if (path === "/to-localhost") {
      this.redirect(c, `http://localhost:${p}/hello`);
    } else if (path === "/to-loopback-2") {
      this.redirect(c, `http://127.0.0.2:${p}/hello`);
    } else if (path === "/to-mapped") {
      this.redirect(c, `http://[::ffff:127.0.0.2]:${p}/hello`);
    } else if (path === "/to-v6-loopback") {
      this.redirect(c, `http://[::1]:${p}/hello`);
    } else if (path === "/to-metadata") {
      this.redirect(c, "http://169.254.169.254/latest/meta-data/");
    } else if (path === "/to-hello") {
      this.redirect(c, "/hello");
    } else if (path.startsWith("/hops-")) {
      const left: i32 = toI32(path.charCodeAt(6)) - 48;
      if (left > 0) {
        this.redirect(c, `/hops-${left - 1}`);
      } else {
        this.respond(c, "200 OK", "", "landed");
      }
    } else if (path === "/big") {
      this.respond(c, "200 OK", "", "0123456789012345678901234567890123456789");
    } else if (path === "/big-chunked") {
      // The same 40 bytes in chunks, so no length is declared: only the
      // reader's running count can stop it.
      this.send(c, "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n8\r\n01234567\r\n8\r\n89012345\r\n18\r\n678901234567890123456789\r\n0\r\n\r\n");
    } else if (path === "/drip") {
      this.send(c, "HTTP/1.1 200 OK\r\nContent-Length: 40\r\n\r\n");
      c.drip = 40;
    } else {
      this.respond(c, "404 Not Found", "", "no such path");
    }
  }

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
      // Every request here is a GET without a body.
      let text: string = String.fromBytes(c.buf, 0, c.len);
      let end: i32 = toI32(text.indexOf("\r\n\r\n"));
      while (end >= 0 && c.open) {
        const used: i32 = end + 4;
        this.handle(c, text.substring(0, end));
        for (let i: i32 = used; i < c.len; i++) {
          c.buf[i - used] = c.buf[i];
        }
        c.len -= used;
        text = String.fromBytes(c.buf, 0, c.len);
        end = toI32(text.indexOf("\r\n\r\n"));
      }
    }
  }

  accept(): void {
    const peer: u8[] = new Array<u8>(18);
    let s: i32 = tcpAccept(this.listen, peer);
    while (s >= 0) {
      this.accepts += 1;
      this.conns.push(new Conn(s));
      pollAdd(this.loop, s, 1, toI32(this.conns.length));
      s = tcpAccept(this.listen, peer);
    }
  }

  /** Serves until child `pid` exits: its exit code, or 99 when it ran past 60 s. */
  serve(pid: i32): i32 {
    const ready: i32[] = new Array<i32>(64);
    const start: i64 = monotonicNanos();
    while (true) {
      const status: i32[] = waitPid(pid, 1);
      if (status[0] === pid) {
        return status[1];
      }
      if (monotonicNanos() - start > toI64(60000) * toI64(1000000)) {
        kill(pid, 9);
        waitPid(pid, 0);
        console.log("FAIL  the client ran past 60 s");
        return 99;
      }
      const count: i32 = pollWait(this.loop, ready, 20);
      for (let i: i32 = 0; i < count; i++) {
        const token: i32 = ready[i * 2];
        if (token === 0) {
          this.accept();
        } else {
          this.readable(this.conns[token - 1]);
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

/** `text` as sixteen address bytes; all 0xee, which no check expects, when it does not parse. */
const addr = (text: string): u8[] => {
  const out: u8[] = new Array<u8>(18);
  const b: u8[] = bytesOf(text);
  if (!dnsParseAddress(b, 0, toI32(b.length), out, 0, 0)) {
    for (let i: i32 = 0; i < 16; i++) {
      out[i] = toU8(0xee);
    }
  }
  return out;
};

const isPublic = (text: string): boolean => outboundAddressPublic(addr(text), 0);

/** Whether every address in `list` (comma-separated) is public, or every one is not, as `want` says. */
const allAre = (list: string, want: boolean): boolean => {
  let from: i32 = 0;
  while (from <= toI32(list.length)) {
    let to: i32 = toI32(list.indexOf(",", from));
    if (to < 0) {
      to = toI32(list.length);
    }
    const one: string = list.substring(from, to);
    if (isPublic(one) !== want) {
      console.log(`  ${one} is ${want ? "not public" : "public"}`);
      return false;
    }
    from = to + 1;
  }
  return true;
};

const allowed = (policy: OutboundPolicy, text: string): boolean => outboundAddressAllowed(policy, addr(text), 0);

const pureChecks = (t: Tally): void => {
  t.check(httpErrorName(HTTP_E_BLOCKED) === "blocked", "httpErrorName names HTTP_E_BLOCKED");
  t.check(new HttpOptions().outbound === null, "a client has no outbound policy unless given one");
  const fresh: OutboundPolicy = new OutboundPolicy();
  t.check(
    fresh.maxRedirects === 5 && fresh.totalTimeoutMs === 30000 && fresh.maxBodyBytes === toI64(8388608),
    "a new policy caps a fetch at 5 redirects, 30 s and 8 MiB"
  );

  t.check(allAre("8.8.8.8,1.1.1.1,93.184.215.14,2606:4700:4700::1111,2a00:1450:4001::1", true), "public IPv4 and IPv6 addresses are public");
  t.check(
    allAre("0.0.0.0,0.1.2.3,10.0.0.1,10.255.255.255,100.64.0.1,100.127.255.255,127.0.0.1,127.255.255.254", false),
    "this network, 10/8, CGNAT's 100.64/10 and loopback 127/8 are not"
  );
  t.check(allAre("169.254.0.1,169.254.169.254,168.63.129.16", false), "link-local 169.254/16, the metadata address among it, and 168.63.129.16 are not");
  t.check(
    allAre("172.16.0.1,172.31.255.255,192.168.0.1,192.0.0.8,192.0.2.1,192.88.99.1,198.18.0.1,198.19.255.255,198.51.100.7,203.0.113.9", false),
    "172.16/12, 192.168/16 and the special and documentation /24s and 198.18/15 are not"
  );
  t.check(allAre("224.0.0.1,239.255.255.255,240.0.0.1,255.255.255.255", false), "multicast, the reserved 240/4 and broadcast are not");
  t.check(
    allAre("9.255.255.255,11.0.0.0,100.63.255.255,100.128.0.0,126.255.255.255,128.0.0.0,169.253.255.255,169.255.0.0,172.15.255.255,172.32.0.0,192.0.1.1,192.167.255.255,192.169.0.0,198.17.255.255,198.20.0.0,223.255.255.255,168.63.129.17", true),
    "the addresses just outside each range are public"
  );
  t.check(allAre("::,::1,::127.0.0.1,::8.8.8.8,100::1,fe80::1,fec0::1,ff02::1,ff0e::1", false), "unspecified, loopback, IPv4-compatible, discard, link-local, site-local and multicast IPv6 are not");
  t.check(allAre("fc00::1,fd00::1,fd00:ec2::254,fdff:ffff::1", false), "unique local fc00::/7, the IPv6 metadata address among it, is not");
  t.check(allAre("2001::1,2001:0:4136:e378::1,2001:1ff::1,2001:db8::1,3fff::1,3fff:fff::1", false), "2001::/23 (Teredo among it), 2001:db8::/32 and 3fff::/20 are not");
  t.check(allAre("::ffff:127.0.0.1,::ffff:10.0.0.1,::ffff:169.254.169.254,::ffff:7f00:1", false), "an IPv4-mapped address is judged as the IPv4 address it maps");
  t.check(allAre("64:ff9b::7f00:1,64:ff9b::a9fe:a9fe,64:ff9b::10.0.0.1,64:ff9b:1::8.8.8.8", false), "NAT64 64:ff9b::/96 is judged by the IPv4 address in it, and the local 64:ff9b:1::/48 is not public");
  t.check(allAre("2002:7f00:1::1,2002:a9fe:a9fe::1,2002:0a00:0001::1", false), "6to4 2002::/16 is judged by the IPv4 address in it");
  t.check(allAre("::ffff:8.8.8.8,64:ff9b::808:808,2002:808:808::1,2001:200::1,2001:db9::1,3fff:1000::1", true), "and each is public when that address, or the address itself, is");

  const p: OutboundPolicy = new OutboundPolicy();
  t.check(!allowed(p, "127.0.0.1") && allowed(p, "8.8.8.8"), "a policy allows the public addresses alone");
  t.check(p.permit("127.0.0.1/32") && allowed(p, "127.0.0.1") && allowed(p, "::ffff:127.0.0.1") && !allowed(p, "127.0.0.2") && !allowed(p, "::1"), "permit lets one IPv4 address through, in either form, and nothing beside it");
  t.check(p.permit("10.128.0.0/9") && allowed(p, "10.200.1.1") && !allowed(p, "10.127.255.255"), "a prefix ending inside a byte matches on its bits");
  t.check(p.permit("fd00:1::/32") && allowed(p, "fd00:1:ffff::1") && !allowed(p, "fd00:2::1"), "an IPv6 prefix");
  t.check(p.permit("fe80::7") && allowed(p, "fe80::7") && !allowed(p, "fe80::8"), "an address without a length is the address alone");
  const all4: OutboundPolicy = new OutboundPolicy();
  t.check(all4.permit("0.0.0.0/0") && allowed(all4, "192.168.1.1") && !allowed(all4, "::1"), "0.0.0.0/0 is every IPv4 address and no IPv6 one");
  const nat: OutboundPolicy = new OutboundPolicy();
  t.check(nat.permit("10.20.0.0/16") && allowed(nat, "64:ff9b::a14:5") && allowed(nat, "2002:a14:5::1") && !allowed(nat, "64:ff9b::a15:5") && !allowed(nat, "2002:a15:5::1"), "a permitted IPv4 prefix covers its NAT64 and 6to4 forms too");
  const bad: OutboundPolicy = new OutboundPolicy();
  t.check(
    !bad.permit("10.0.0.0/33") && !bad.permit("::/129") && !bad.permit("nope") && !bad.permit("10.0.0.0/") && !bad.permit("/8") && !bad.permit("10.0.0.0/8x") && !bad.permit("127.1/32") && bad.permitted.length === 0,
    "a prefix too long for its address, a bad address or length, or a short IPv4 form, is refused and adds nothing"
  );

  const h: OutboundPolicy = new OutboundPolicy();
  t.check(outboundHostAllowed(h, "anything.test"), "a policy with no allowed hosts allows any");
  h.allowHost("Example.COM.");
  h.allowHost(".api.test");
  h.allowHost("[::1]");
  h.allowHost(".0.0.1");
  t.check(outboundHostAllowed(h, "example.com") && outboundHostAllowed(h, "EXAMPLE.com."), "an allowed name matches in any case, with or without its trailing dot");
  t.check(!outboundHostAllowed(h, "www.example.com") && !outboundHostAllowed(h, "example.com.evil.test") && !outboundHostAllowed(h, "notexample.com"), "but only itself");
  t.check(outboundHostAllowed(h, "api.test") && outboundHostAllowed(h, "a.b.api.test") && !outboundHostAllowed(h, "evilapi.test"), "a leading dot allows the name and the names under it, nothing that only ends the same way");
  t.check(outboundHostAllowed(h, "::1") && !outboundHostAllowed(h, "::2"), "a bracketed IPv6 entry matches the URL's host");
  t.check(!outboundHostAllowed(h, "127.0.0.1") && !outboundHostAllowed(h, "10.0.0.1"), "a dotted entry is never a suffix of an IPv4 literal");

  // A lookup's answer, as resolveHost writes it: three refused addresses among two public ones.
  const list: string[] = ["127.0.0.1", "93.184.215.14", "10.0.0.1", "::1", "2606:4700::1"];
  const records: u8[] = new Array<u8>(18 * toI32(list.length));
  for (let i: i32 = 0; i < toI32(list.length); i++) {
    const one: u8[] = addr(list[i]);
    for (let k: i32 = 0; k < 18; k++) {
      records[i * 18 + k] = one[k];
    }
  }
  const kept: i32 = outboundFilter(new OutboundPolicy(), records, toI32(list.length));
  t.check(
    kept === 2 && outboundAddressText(records, 0) === "93.184.215.14" && outboundAddressText(records, 18) === "2606:4700:0:0:0:0:0:1",
    "outboundFilter keeps a lookup's public addresses, in order, and drops the rest"
  );
  const none: u8[] = addr("::1");
  t.check(
    outboundFilter(new OutboundPolicy(), none, 1) === 0 && outboundAddressText(none, 0) === "0:0:0:0:0:0:0:1",
    "and keeps none of an answer with no public address, which is left in place to be named"
  );
};

// --- fetches ---------------------------------------------------------------------

/** The policy the fetch checks use: loopback refused, as for any client. */
const policy = (): OutboundPolicy => new OutboundPolicy();

/** A client, with `policy` as its outbound policy when it is not null, following redirects across origins. */
const client = (outbound: OutboundPolicy | null): HttpClient => {
  const options: HttpOptions = new HttpOptions();
  options.useEnvProxy = false;
  options.followRedirects = true;
  options.crossOriginRedirects = true;
  options.outbound = outbound;
  return new HttpClient(options);
};

const bodyOf = (res: HttpResponse | null): string => {
  if (res === null) {
    return "<null>";
  }
  const b: u8[] | null = res.body.readAll(toI32(65536));
  return b !== null ? String.fromBytes(b, 0, toI32(b.length)) : "<null>";
};

/** The decimal number `s` spells: a port, or a count of connections. */
const decimalOf = (s: string): i32 => {
  let v: i32 = 0;
  for (let i: i32 = 0; i < toI32(s.length); i++) {
    v = v * 10 + toI32(s.charCodeAt(i)) - 48;
  }
  return v;
};

/** How many connections the server has taken, this fetch's own included. */
const acceptsOf = (base: string): i32 => {
  const options: HttpOptions = new HttpOptions();
  options.useEnvProxy = false;
  return decimalOf(bodyOf(httpFetch(new HttpRequest("GET", `${base}/accepts`), options)));
};

/** Fetches `url` on `c`: "ok <body>", or the error's name and text. */
const fetchText = (c: HttpClient, url: string): string => {
  const res: HttpResponse | null = c.fetch(new HttpRequest("GET", url));
  if (res === null) {
    return c.errorText;
  }
  return `ok ${bodyOf(res)}`;
};

/**
 * Fetches `url` without a policy, which must answer `before`, then with
 * `after` as the policy, which must fail with HTTP_E_BLOCKED; `refusedAt` is
 * what the error must name, and `hops` how many connections the fetch may
 * make before it is refused: none for a URL, one for a redirect's first hop.
 */
const beforeAfter = (t: Tally, base: string, url: string, before: string, after: OutboundPolicy, refusedAt: string, hops: i32, text: string): void => {
  const open: string = fetchText(client(null), url);
  t.check(open === before, `without a policy, ${text} is reached`);
  if (open !== before) {
    console.log(`  got: ${open}`);
  }
  const was: i32 = acceptsOf(base);
  const c: HttpClient = client(after);
  const got: string = fetchText(c, url);
  const now: i32 = acceptsOf(base);
  t.check(c.error === HTTP_E_BLOCKED && got.indexOf(refusedAt) >= 0, `with one, ${text} is HTTP_E_BLOCKED, naming ${refusedAt}`);
  if (c.error !== HTTP_E_BLOCKED || got.indexOf(refusedAt) < 0) {
    console.log(`  got: ${got}`);
  }
  t.check(now === was + 1 + hops, hops === 0 ? "  and no connection was made" : "  and no connection past the first hop");
};

/** A policy permitting the server's own address, as an internal API a program means to reach would be. */
const own = (): OutboundPolicy => {
  const p: OutboundPolicy = new OutboundPolicy();
  p.permit("127.0.0.1/32");
  return p;
};

/** That, with all of loopback permitted and 127.0.0.1 the one host allowed by name. */
const named = (): OutboundPolicy => {
  const p: OutboundPolicy = own();
  p.permit("127.0.0.0/8");
  p.allowHost("127.0.0.1");
  return p;
};

/** `own`, allowing only the host `allowed.test` by name. */
const trick = (): OutboundPolicy => {
  const p: OutboundPolicy = own();
  p.allowHost("allowed.test");
  return p;
};

const fetchChecks = (t: Tally, port: i32): void => {
  const base: string = `http://127.0.0.1:${port}`;
  beforeAfter(t, base, `${base}/hello`, "ok hello", policy(), "127.0.0.1", 0, "a loopback address");
  beforeAfter(t, base, `http://localhost:${port}/hello`, "ok hello", policy(), "resolves to", 0, "localhost");
  beforeAfter(t, base, `http://[::ffff:127.0.0.1]:${port}/hello`, "ok hello", policy(), "127.0.0.1", 0, "an IPv4-mapped loopback literal");

  // `localhost` is answered by the resolver itself, 127.0.0.1 and ::1 (RFC
  // 6761), with no /etc/hosts: a mixed answer. The server listens on
  // 127.0.0.1 alone, so with only ::1 permitted nothing kept can reach it,
  // while a dial over the unfiltered answer would.
  const v6only: OutboundPolicy = policy();
  v6only.permit("::1/128");
  const beforeMixed: i32 = acceptsOf(base);
  const mixed: HttpClient = client(v6only);
  const mixedGot: string = fetchText(mixed, `http://localhost:${port}/hello`);
  const afterMixed: i32 = acceptsOf(base);
  t.check(mixedGot !== "ok hello" && mixed.error !== HTTP_E_NONE && mixed.error !== HTTP_E_BLOCKED && afterMixed === beforeMixed + 1, "on a mixed answer only the addresses kept are dialled: ::1 permitted, 127.0.0.1 is never connected to");
  if (afterMixed !== beforeMixed + 1 || mixed.error === HTTP_E_NONE || mixed.error === HTTP_E_BLOCKED) {
    console.log(`  got: ${mixedGot}`);
  }
  t.check(fetchText(client(own()), `http://localhost:${port}/hello`) === "ok hello", "and with 127.0.0.1 permitted instead, the same answer is fetched");

  // A number that spells loopback without dots, in octal, in hex or short is
  // not a host the URL parser takes, policy or not: it never reaches a lookup.
  const spellings: string[] = ["2130706433", "0177.0.0.1", "0x7f.0.0.1", "0x7f.1", "127.1"];
  for (let i: i32 = 0; i < toI32(spellings.length); i++) {
    const was: i32 = acceptsOf(base);
    const open: HttpClient = client(null);
    fetchText(open, `http://${spellings[i]}:${port}/hello`);
    const odd: HttpClient = client(policy());
    fetchText(odd, `http://${spellings[i]}:${port}/hello`);
    const now: i32 = acceptsOf(base);
    t.check(open.error === HTTP_E_URL && odd.error === HTTP_E_URL && now === was + 1, `${spellings[i]} is HTTP_E_URL with a policy or without, and never connected to`);
  }

  // From here the server's own address is permitted, and the redirects it
  // answers point elsewhere on the host.
  const permitted: HttpClient = client(own());
  t.check(fetchText(permitted, `${base}/to-hello`) === "ok hello" && permitted.error === HTTP_E_NONE, "a permitted address is reached, a redirect to it too");
  t.check(fetchText(client(own()), `${base}/to-localhost`) === "ok hello", "a redirect to a name is followed when an address it resolves to is permitted");
  const second: HttpClient = client(own());
  t.check(fetchText(second, `${base}/to-loopback-2`).indexOf("127.0.0.2") >= 0 && second.error === HTTP_E_BLOCKED, "a redirect to another loopback address is blocked at the hop");
  const mapped: HttpClient = client(own());
  t.check(fetchText(mapped, `${base}/to-mapped`).indexOf("127.0.0.2") >= 0 && mapped.error === HTTP_E_BLOCKED, "and so is one to it written as an IPv4-mapped IPv6 literal");
  const v6: HttpClient = client(own());
  t.check(fetchText(v6, `${base}/to-v6-loopback`).indexOf("0:0:0:0:0:0:0:1") >= 0 && v6.error === HTTP_E_BLOCKED, "and one to [::1]");
  const meta: HttpClient = client(own());
  t.check(fetchText(meta, `${base}/to-metadata`).indexOf("169.254.169.254") >= 0 && meta.error === HTTP_E_BLOCKED, "and one to the metadata address, before any connect is tried");

  // The host allowlist, checked on the URL and on every hop.
  const listed: HttpClient = client(named());
  t.check(fetchText(listed, `${base}/hello`) === "ok hello", "an allowed host is fetched");
  beforeAfter(t, base, `${base}/to-localhost`, "ok hello", named(), "does not allow", 1, "a redirect to a host not on the allowlist");
  const other: HttpClient = client(named());
  t.check(fetchText(other, `http://localhost:${port}/hello`).indexOf("does not allow") >= 0 && other.error === HTTP_E_BLOCKED, "a URL naming a host not on it is blocked before the lookup");
  beforeAfter(t, base, `http://allowed.test@127.0.0.1:${port}/hello`, "ok hello", trick(), "does not allow", 0, "an allowed name in the userinfo");

  // A connection kept from before a policy was set never skips its address check.
  const kept: HttpClient = client(null);
  t.check(fetchText(kept, `${base}/hello`) === "ok hello" && fetchText(kept, `${base}/hello`) === "ok hello" && kept.reused, "without a policy, a kept connection is reused");
  kept.options.outbound = policy();
  t.check(fetchText(kept, `${base}/hello`).indexOf("127.0.0.1 resolves to 127.0.0.1") >= 0 && kept.error === HTTP_E_BLOCKED, "once a policy is set, the connection kept from before it is not reused, and the fetch is HTTP_E_BLOCKED");

  // A proxy looks the name up itself, so under a policy none is used.
  const viaProxy: HttpClient = client(null);
  viaProxy.setProxies("http://127.0.0.1:1", "", "");
  t.check(viaProxy.fetch(new HttpRequest("GET", `${base}/hello`)) === null && viaProxy.error === HTTP_E_REFUSED, "without a policy, a fetch goes to the proxy (here one nothing listens on)");
  const direct: HttpClient = client(own());
  direct.setProxies("http://127.0.0.1:1", "", "");
  t.check(fetchText(direct, `${base}/hello`) === "ok hello", "with one, the proxy is ignored and the fetch goes direct");

  // The caps: the stricter of the policy's and the options' applies.
  const hops: OutboundPolicy = own();
  hops.maxRedirects = 2;
  t.check(fetchText(client(null), `${base}/hops-3`) === "ok landed", "without a policy, three redirects are followed");
  const capped: HttpClient = client(hops);
  t.check(fetchText(capped, `${base}/hops-2`) === "ok landed", "under a policy of two, two are");
  fetchText(capped, `${base}/hops-3`);
  t.check(capped.error === HTTP_E_TOO_MANY_REDIRECTS, "and three are HTTP_E_TOO_MANY_REDIRECTS");
  const small: OutboundPolicy = own();
  small.maxBodyBytes = toI64(10);
  t.check(fetchText(client(null), `${base}/big`) === "ok 0123456789012345678901234567890123456789", "without a policy, a 40-byte body is read");
  const tight: HttpClient = client(small);
  fetchText(tight, `${base}/big`);
  t.check(tight.error === HTTP_E_BODY_TOO_LARGE, "under a policy capping bodies at 10 bytes, it is HTTP_E_BODY_TOO_LARGE");
  t.check(fetchText(client(null), `${base}/big-chunked`) === "ok 0123456789012345678901234567890123456789", "without a policy, the same body in chunks is read");
  const tightChunked: HttpClient = client(small);
  fetchText(tightChunked, `${base}/big-chunked`);
  t.check(tightChunked.error === HTTP_E_BODY_TOO_LARGE, "and under the 10-byte cap, chunks declaring no total length are HTTP_E_BODY_TOO_LARGE as they stream");
  const quick: OutboundPolicy = own();
  quick.totalTimeoutMs = 200;
  t.check(fetchText(client(null), `${base}/drip`).length === 43, "without a policy, a body dripped over most of a second is read");
  const hurried: HttpClient = client(quick);
  fetchText(hurried, `${base}/drip`);
  t.check(hurried.error === HTTP_E_TOTAL_TIMEOUT && hurried.errorText.indexOf("200 ms") >= 0, "under a policy of 200 ms with no total timeout of the options', it is HTTP_E_TOTAL_TIMEOUT");
};

const runClient = (port: i32): i32 => {
  const t: Tally = new Tally();
  pureChecks(t);
  fetchChecks(t, port);
  console.log(`outbound: ${t.passed} passed, ${t.failed} failed, 0 skipped`);
  return t.failed;
};


export function outboundChecks(): i32 {
  const argv: string[] = process.argv;
  if (toI32(argv.length) >= 3 && argv[1] === "client") {
    return runClient(decimalOf(argv[2]));
  }
  const server: Server = new Server();
  const pid: i32 = spawn([selfPath(), "client", `${server.port}`]);
  if (pid <= 0) {
    console.log("FAIL  the client could not be started");
    return 1;
  }
  return server.serve(pid);
}
