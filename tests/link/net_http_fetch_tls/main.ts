// nish/net/fetch over https, against TLS servers on loopback.
//
// The parent runs four TLS servers, one for each certificate in `certs.ts`
// (good, expired, for another name, from a root the client never trusts),
// and a CONNECT proxy that splices one tunnel at a time to the good one. A
// child of the same binary runs every fetch and prints the checks. The good
// server answers each request with its request line and `X-Conn`, the number
// of the connection it came on, so the child sees a TLS connection reused,
// and sees that a refused fetch never opened one. `/cut` sends half a body
// and drops the TCP connection without a close_notify: a truncation.
// `/until-close` sends a body that ends at the server's close_notify,
// `/stale` drops the connection after a whole reply, `/then-notify` ends it
// with a close_notify after one, `/alert-once` answers its first request with
// a fatal alert and `/alert` every request with one, `/notified-N` says
// whether connection N ended with the client's close_notify, `/head` echoes
// the whole request head and `/connect-head` the proxy's last CONNECT head.
// A CONNECT from proxy user `alert` is answered with the 200 and a fatal
// alert in one segment, and nothing after.

import { HTTP_E_CERTIFICATE, HTTP_E_READ_TIMEOUT, HTTP_E_REDIRECT_REFUSED, HTTP_E_TLS, FetchSyncClient, HttpOptions, HttpRequest, HttpResponse, fetchSync } from "nish/net/fetch";
import { netClose, netLocalPort, tcpListen } from "nish:net";
import { spawn } from "nish:process";
import { writeFileSync } from "nish:fs";
import { PkiRoots, pkiLoadRoots } from "nish/crypto/pki-roots";
import { sha256 } from "nish/crypto/sha256";
import { strangerRootPem, trustedRootPem } from "./certs";
import { Servers, Site, Tally, parsePort, selfPath } from "./servers";

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

const fails = (client: FetchSyncClient, res: HttpResponse | null, code: i32): boolean => {
  if (res !== null || client.error !== code) {
    console.log(`  got ${res !== null ? `status ${res.status}` : "null"}, error ${client.error}: ${client.errorText}`);
    return false;
  }
  return true;
};


/** The SHA-256 of the subjectPublicKeyInfo of the first root in `pem`, or no bytes. */
const rootKey = (pem: string): u8[] => {
  const roots: PkiRoots = pkiLoadRoots(pem, [], []);
  return toI32(roots.roots.length) > 0 ? sha256(roots.roots[0].spki) : [];
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
  const client: FetchSyncClient = new FetchSyncClient(options);

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
  writeFileSync(trusted, strangerRootPem);
  const cached: HttpResponse | null = client.fetch(get(`${good}/cached`));
  t.check(bodyOf(cached) === "GET /cached HTTP/1.1" && conn(cached) !== conn(ip), "a client reads its roots once, not again for each connection");
  writeFileSync(trusted, trustedRootPem);
  const once: HttpResponse | null = fetchSync(get(`${good}/once`), options);
  t.check(bodyOf(once) === "GET /once HTTP/1.1", "fetchSync fetches over https too");
  const told: HttpResponse | null = client.fetch(get(`${good}/notified-${conn(once)}`));
  t.check(bodyOf(told) === "yes", "and once its body is read, it ends the connection with a close_notify");

  // --- certificates that are refused
  const expired: FetchSyncClient = new FetchSyncClient(options);
  t.check(fails(expired, expired.fetch(get(`https://localhost:${ports[1]}/`)), HTTP_E_CERTIFICATE), "an expired certificate is HTTP_E_CERTIFICATE");
  t.check(expired.errorText.indexOf("refused") >= 0, "and the error says the certificate was refused");
  const wrong: FetchSyncClient = new FetchSyncClient(options);
  t.check(fails(wrong, wrong.fetch(get(`https://localhost:${ports[2]}/`)), HTTP_E_CERTIFICATE), "a certificate for another name is HTTP_E_CERTIFICATE");
  const untrusted: FetchSyncClient = new FetchSyncClient(options);
  t.check(fails(untrusted, untrusted.fetch(get(`https://localhost:${ports[3]}/`)), HTTP_E_CERTIFICATE), "a chain to a root the client does not trust is HTTP_E_CERTIFICATE");
  const other: FetchSyncClient = new FetchSyncClient(trusting(stranger));
  t.check(fails(other, other.fetch(get(`${good}/`)), HTTP_E_CERTIFICATE), "and so is a good server under roots that are not its own");
  const system: FetchSyncClient = new FetchSyncClient(trusting(""));
  t.check(fails(system, system.fetch(get(`${good}/`)), HTTP_E_CERTIFICATE), "the system roots do not trust the test's root");

  // --- keys the caller distrusts
  const shunning: HttpOptions = trusting(trusted);
  shunning.distrustSpkiSha256 = [rootKey(trusted)];
  const shunned: FetchSyncClient = new FetchSyncClient(shunning);
  t.check(fails(shunned, shunned.fetch(get(`${good}/`)), HTTP_E_CERTIFICATE), "a chain to a trusted root whose key is distrusted is HTTP_E_CERTIFICATE");
  const sparing: HttpOptions = trusting(trusted);
  sparing.distrustSpkiSha256 = [rootKey(stranger)];
  const spared: FetchSyncClient = new FetchSyncClient(sparing);
  t.check(bodyOf(spared.fetch(get(`${good}/spared`))) === "GET /spared HTTP/1.1", "a distrusted key no certificate of the chain holds changes nothing");
  const garbled: HttpOptions = trusting(trusted);
  garbled.distrustSpkiSha256 = [rootKey(trusted).slice(0, 20)];
  const misread: FetchSyncClient = new FetchSyncClient(garbled);
  t.check(fails(misread, misread.fetch(get(`${good}/`)), HTTP_E_CERTIFICATE), "a key to distrust that is not 32 bytes fails the fetch");
  t.check(misread.errorText.indexOf("not a SHA-256") >= 0, "and the error says the hash is not one");

  // --- no roots at all: refused before any connection
  const fresh: FetchSyncClient = new FetchSyncClient(options);
  const before: HttpResponse | null = fresh.fetch(get(`${good}/before`));
  bodyOf(before);
  const none: FetchSyncClient = new FetchSyncClient(trusting(missing));
  t.check(fails(none, none.fetch(get(`${good}/`)), HTTP_E_CERTIFICATE), "with no root certificate to trust, https is HTTP_E_CERTIFICATE");
  t.check(none.errorText.indexOf("no trusted root certificate") >= 0, "and the error says there was no root to trust");
  const after: FetchSyncClient = new FetchSyncClient(options);
  const next: HttpResponse | null = after.fetch(get(`${good}/after`));
  bodyOf(next);
  t.check(conn(before) !== "none" && parsePort(conn(next)) === parsePort(conn(before)) + 1, "and no connection was opened for it");

  // --- what is not TLS, and TLS cut short
  const plain: FetchSyncClient = new FetchSyncClient(options);
  t.check(fails(plain, plain.fetch(get(`https://127.0.0.1:${proxy}/`)), HTTP_E_TLS), "a server that does not speak TLS is HTTP_E_TLS");
  const cut: FetchSyncClient = new FetchSyncClient(options);
  const c: HttpResponse | null = cut.fetch(get(`${good}/cut`));
  const got: u8[] | null = c !== null ? c.body.readAll(65536) : null;
  t.check(c !== null && got === null && cut.error === HTTP_E_TLS, "a body cut off without a close_notify is HTTP_E_TLS, not a short body");
  if (got !== null || cut.error !== HTTP_E_TLS) {
    console.log(`  error ${cut.error}: ${cut.errorText}`);
  }
  t.check(cut.errorText.indexOf("close_notify") >= 0, "and the error says the close_notify never came");
  const whole: FetchSyncClient = new FetchSyncClient(options);
  const ended: HttpResponse | null = whole.fetch(get(`${good}/until-close`));
  t.check(bodyOf(ended) === "until close", "a body with no length ends at the server's close_notify");
  const again: u8[] = new Array<u8>(16);
  t.check(ended !== null && ended.body.read(again, 0, 16) === 0 && whole.error === 0, "and read again, it answers 0 with no error");
  const stale: FetchSyncClient = new FetchSyncClient(options);
  const s1: HttpResponse | null = stale.fetch(get(`${good}/stale`));
  const s1Body: string = bodyOf(s1);
  const s2: HttpResponse | null = stale.fetch(get(`${good}/fresh`));
  t.check(s1Body === "stale" && bodyOf(s2) === "GET /fresh HTTP/1.1" && conn(s2) !== conn(s1), "a pooled TLS connection the server dropped is retried on a new one");
  if (s2 === null) {
    console.log(`  error ${stale.error}: ${stale.errorText}`);
  }
  const alerting: FetchSyncClient = new FetchSyncClient(options);
  const a1: HttpResponse | null = alerting.fetch(get(`${good}/warm`));
  const a1Body: string = bodyOf(a1);
  const a2: HttpResponse | null = alerting.fetch(get(`${good}/alert-once`));
  t.check(a1Body === "GET /warm HTTP/1.1" && bodyOf(a2) === "GET /alert-once HTTP/1.1" && conn(a2) !== conn(a1), "a pooled TLS connection the server ends with an alert is retried on a new one");
  if (a2 === null) {
    console.log(`  error ${alerting.error}: ${alerting.errorText}`);
  }
  const alerted: FetchSyncClient = new FetchSyncClient(options);
  t.check(fails(alerted, alerted.fetch(get(`${good}/alert`)), HTTP_E_TLS), "a fresh TLS connection the server ends with an alert is HTTP_E_TLS");
  t.check(alerted.errorText.indexOf("the server sent TLS alert 80") >= 0, "and the error names the alert the server sent");
  const idle: FetchSyncClient = new FetchSyncClient(options);
  const n1: HttpResponse | null = idle.fetch(get(`${good}/then-notify`));
  const n1Body: string = bodyOf(n1);
  const n2: HttpResponse | null = idle.fetch(get(`${good}/after-notify`));
  t.check(n1Body === "kept" && bodyOf(n2) === "GET /after-notify HTTP/1.1" && conn(n2) !== conn(n1), "a pooled TLS connection the server ended with a close_notify is retried on a new one");
  if (n2 === null) {
    console.log(`  error ${idle.error}: ${idle.errorText}`);
  }
  const silent: i32 = tcpListen("127.0.0.1", 0, 8);
  const quiet: HttpOptions = trusting(trusted);
  quiet.readTimeoutMs = 300;
  const mute: FetchSyncClient = new FetchSyncClient(quiet);
  t.check(fails(mute, mute.fetch(get(`https://127.0.0.1:${netLocalPort(silent)}/`)), HTTP_E_READ_TIMEOUT), "a server that never answers the handshake is HTTP_E_READ_TIMEOUT");
  netClose(silent);

  // --- a redirect down to http
  const downgrade: HttpOptions = trusting(trusted);
  downgrade.followRedirects = true;
  downgrade.crossOriginRedirects = true;
  const down: FetchSyncClient = new FetchSyncClient(downgrade);
  t.check(fails(down, down.fetch(get(`${good}/tohttp`)), HTTP_E_REDIRECT_REFUSED), "a redirect from https to http is refused even with crossOriginRedirects");
  t.check(down.errorText.endsWith("from https to http (http://localhost:1/?...)"), "and the error says why, naming the Location without its password or query");

  // --- through a proxy
  const tunnelled: FetchSyncClient = new FetchSyncClient(options);
  tunnelled.setProxies("", `http://127.0.0.1:${proxy}`, "");
  const p: HttpResponse | null = tunnelled.fetch(get(`${good}/tunnel`));
  t.check(bodyOf(p) === "GET /tunnel HTTP/1.1", "https through an http proxy is a CONNECT tunnel, then TLS to the origin");
  if (p === null) {
    console.log(`  error ${tunnelled.error}: ${tunnelled.errorText}`);
  }
  const p2: HttpResponse | null = tunnelled.fetch(get(`${good}/tunnel2`));
  t.check(bodyOf(p2) === "GET /tunnel2 HTTP/1.1" && conn(p2) === conn(p), "and the tunnelled connection is reused");
  tunnelled.close();
  const authed: FetchSyncClient = new FetchSyncClient(options);
  authed.setProxies("", `http://user:pass@127.0.0.1:${proxy}`, "");
  const headReq: HttpRequest = get(`${good}/head`);
  headReq.header("Proxy-Authorization", "Basic c2VjcmV0");
  const sent: HttpResponse | null = authed.fetch(headReq);
  const originHead: string = bodyOf(sent);
  t.check(originHead.startsWith("GET /head HTTP/1.1") && originHead.indexOf("roxy-") < 0, "through a tunnel the origin is sent no Proxy-Authorization, not even the caller's");
  if (sent === null) {
    console.log(`  error ${authed.error}: ${authed.errorText}`);
  }
  const asked: string = bodyOf(authed.fetch(get(`${good}/connect-head`)));
  t.check(asked.indexOf("Proxy-Authorization: Basic dXNlcjpwYXNz\r\n") >= 0, "and the CONNECT carries the proxy URL's user and password");
  authed.close();
  const coalescing: HttpOptions = trusting(trusted);
  coalescing.readTimeoutMs = 300;
  const alerting2: FetchSyncClient = new FetchSyncClient(coalescing);
  alerting2.setProxies("", `http://alert:x@127.0.0.1:${proxy}`, "");
  t.check(fails(alerting2, alerting2.fetch(get(`${good}/never`)), HTTP_E_TLS), "an alert the proxy sends in the same segment as its 200 is read by TLS, not lost");

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
