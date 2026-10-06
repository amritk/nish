// The interop server's smoke checks, in process over loopback: the server of
// `server.ts` with the test leaf of `tests/link/net_tls_common`, serving this
// case's `www`, and one request per protocol from the repository's scripted
// clients — HTTP/1.1 through `H1Loop`'s own client, HTTP/2 over TLS,
// `hq-interop` and HTTP/3 over QUIC, and a WebTransport session's datagram
// and bidirectional stream. A change in `nish/net` that breaks the server the
// interop job drives fails here, inside `npm test`, before that job runs.
// Then the refusals of the command line, each with its exit code.
import { Secret, secret, wipe } from "nish:secret";
import { Suite } from "nish/testing";
import { x509ParseCertificate } from "nish/crypto/x509";
import { H2_FLAG_END_STREAM } from "nish/net/http2-frame";
import {
  H3_FRAME_DATA,
  H3_FRAME_HEADERS,
  H3_FRAME_WEBTRANSPORT_STREAM,
  H3_STREAM_CONTROL,
  H3_STREAM_QPACK_DECODER,
  H3_STREAM_QPACK_ENCODER,
} from "nish/net/http3-frame";
import { QpackEncoder } from "nish/net/qpack";
import { bytesOf, textOf } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import { leafCertificate, leafPrivate } from "../net_tls_common/server";
import { getOf } from "../net_http2/peer";
import { CLIENT_CONTROL, CLIENT_DECODER, CLIENT_ENCODER, H3Limits, h3Cat, h3ClientParams, h3ClientSettings, h3Frame, h3Section, h3Varint } from "../net_http3/peer";
import { WtLimits, wtClientParams, wtClientSettingIds, wtClientSettingValues, wtSettingsFrame } from "../net_webtransport/peer";
import { H2TlsClient, QuicClient, h3Answer } from "./client";
import { parseServe, serve } from "./cli";
import { certificateHash, loadChain, loadKey, mintCertificate, mintKey } from "./identity";
import { InteropOptions, InteropServer, supportedTestcase } from "./server";

/** The file the checks ask for, and what it holds. */
const FILE: string = "/hello.txt";
const CONTENT: string = "a file from www\n";

/** A client's three unidirectional HTTP/3 streams, with `settings` on the control stream. */
const openH3 = (q: QuicClient, settings: u8[]): void => {
  q.send(CLIENT_CONTROL, h3Cat([h3Varint(H3_STREAM_CONTROL), settings]), false);
  q.send(CLIENT_ENCODER, h3Varint(H3_STREAM_QPACK_ENCODER), false);
  q.send(CLIENT_DECODER, h3Varint(H3_STREAM_QPACK_DECODER), false);
};

/** The HEADERS frame of a request with these pseudo-headers, then `names`/`values`. */
const request = (method: string, path: string, names: string[], values: string[]): u8[] => {
  const allNames: string[] = [":method", ":scheme", ":authority", ":path"];
  const allValues: string[] = [method, "https", "localhost", path];
  for (let k: i32 = 0; k < toI32(names.length) && k < toI32(values.length); k++) {
    allNames.push(names[k]);
    allValues.push(values[k]);
  }
  return h3Frame(H3_FRAME_HEADERS, h3Section(new QpackEncoder(), allNames, allValues));
};

/** The identity and the command line: no socket. */
const identityChecks = (t: Suite): void => {
  const key: Secret<u8[]> = mintKey();
  const der: u8[] = mintCertificate(key, n64(1767225600000));
  wipe(key);
  const cert = x509ParseCertificate(der);
  t.ok("a minted certificate parses, a P-256 key signed with ecdsa-with-SHA256", cert !== null && cert.p256 && cert.ecdsaSha256);
  t.eqI32("and its SHA-256 is 64 hex digits", toI32(certificateHash(der).length), n32(64));
  const missing: Secret<u8[]> | null = loadKey("tests/link/net_interop_server/www");
  t.ok("no cert.pem or priv.key where none is: no chain, no key", loadChain("tests/link/net_interop_server/www") === null && missing === null);
  if (missing !== null) {
    wipe(missing);
  }

  t.ok(
    "the runner's server test cases are taken",
    supportedTestcase("") && supportedTestcase("handshake") && supportedTestcase("transfer") && supportedTestcase("retry") &&
      supportedTestcase("chacha20") && supportedTestcase("multiconnect") && supportedTestcase("http3")
  );
  t.ok("and resumption, 0-RTT and migration are not", !supportedTestcase("resumption") && !supportedTestcase("zerortt") && !supportedTestcase("connectionmigration"));
  const parsed = parseServe(["main", "serve", "--www", "/www", "--certs", "/certs", "--testcase", "retry", "--port", "443", "--hash-file", "/tmp/h"]);
  t.ok(
    "serve's flags are read",
    parsed.error === "" && parsed.options.www === "/www" && parsed.certs === "/certs" && parsed.options.testcase === "retry" &&
      parsed.options.quicPort === n32(443) && parsed.hashFile === "/tmp/h"
  );
  t.eqStr("an unknown flag is refused", parseServe(["main", "serve", "--nope", "1"]).error, "unknown flag --nope");
  t.eqStr("a flag with no value is refused", parseServe(["main", "serve", "--www"]).error, "--www wants a value");
  t.eqStr("a port past 65535 is refused", parseServe(["main", "serve", "--port", "65536"]).error, "a port outside 0 to 65535");
  t.eqI32("serve exits 2 for a command line it cannot read", serve(["main", "serve", "--h2-port", "x"]), n32(2));
  t.eqI32("127 for a test case it does not take, the runner's unsupported", serve(["main", "serve", "--testcase", "zerortt"]), n32(127));
  t.eqI32("3 for a certificate directory with nothing in it", serve(["main", "serve", "--certs", "tests/link/net_interop_server/www"]), n32(3));
};

/** One request per protocol against one server. */
const carrierChecks = (t: Suite): void => {
  const options = new InteropOptions();
  options.host = "127.0.0.1";
  options.www = "tests/link/net_interop_server/www";
  options.slots = n32(4);
  const key: Secret<u8[]> = secret(leafPrivate());
  const server = new InteropServer(options, [leafCertificate()]);
  t.ok("the server listens: QUIC, HTTP/1.1 plain and over TLS, HTTP/2", server.udp >= 0 && server.h1.plainPort > 0 && server.h1.tlsPort > 0 && server.h2.port > 0);

  // HTTP/1.1, through the loop H1Loop owns.
  const plain: i32 = server.h1.connect(false);
  server.h1.send(plain, bytesOf("GET /hello HTTP/1.1\r\nHost: localhost\r\n\r\n"));
  const answer = server.h1.response(plain, false);
  t.eqStr("HTTP/1.1: a GET of /hello", `${answer.status} ${textOf(answer.body)}`, "200 hello from nish/net/http1\n");

  // HTTP/2 over TLS.
  const h2 = new H2TlsClient(server);
  t.ok("HTTP/2: a TLS handshake offering h2, the server's signature and Finished verified", h2.handshake(server.h2.port, key) && h2.verified);
  const none: i32[] = [];
  const noValues: i64[] = [];
  h2.wire.preface();
  h2.wire.settings(none, noValues);
  h2.wire.settingsAck();
  h2.wire.headers(n32(1), getOf(FILE), H2_FLAG_END_STREAM);
  h2.flush(key);
  const frames: string = h2.awaitFrames(n32(5), key);
  t.ok(
    "a GET of the file: 200 and its bytes",
    frames.indexOf("HEADERS 1 :status=200 content-type=application/octet-stream server=nish") >= 0 && frames.indexOf(`DATA 1 16 "a file from www\n" end`) >= 0
  );
  h2.wire.headers(n32(3), getOf("/missing"), H2_FLAG_END_STREAM);
  h2.flush(key);
  t.eqStr("a GET of a file that is not there: 404", h2.awaitFrames(n32(2), key), 'HEADERS 3 :status=404 content-type=text/plain server=nish; DATA 3 10 "not found\n" end');

  // hq-interop, the runner's HTTP/0.9.
  const hqLimits = new H3Limits();
  const hq = new QuicClient(server);
  t.ok("hq-interop: the handshake through the listener into a slot, the server's flight verified", hq.connect("hq-interop", h3ClientParams(hqLimits), key));
  hq.send(n64(0), bytesOf(`GET ${FILE}\r\n`), true);
  t.ok("a request answered and ended", hq.turnUntil(key, n64(0), false));
  t.eqStr("with the file's bytes", textOf(hq.stream(n64(0)).data), CONTENT);
  hq.send(n64(4), bytesOf("GET /../main.ts\r\n"), true);
  t.ok("a path that climbs out of www is answered with nothing", hq.turnUntil(key, n64(4), false) && toI32(hq.stream(n64(4)).data.length) === 0);

  // HTTP/3.
  const h3 = new QuicClient(server);
  t.ok("HTTP/3: the handshake, ALPN h3", h3.connect("h3", h3ClientParams(new H3Limits()), key));
  openH3(h3, h3ClientSettings(n64(-1)));
  const noNames: string[] = [];
  h3.send(n64(0), request("GET", FILE, noNames, noNames), true);
  t.ok("a GET answered and ended", h3.turnUntil(key, n64(0), false));
  const got = h3Answer(h3.stream(n64(0)));
  t.eqStr("200 with the file's bytes", `${got.status} ${got.body}`, `200 ${CONTENT}`);
  h3.send(n64(4), h3Cat([request("POST", "/upload", ["content-length"], ["10"]), h3Frame(H3_FRAME_DATA, bytesOf("0123456789"))]), true);
  t.ok("a POST answered and ended", h3.turnUntil(key, n64(4), false));
  const posted = h3Answer(h3.stream(n64(4)));
  t.eqStr("with how many bytes its body carried", `${posted.status} ${posted.body}`, "200 received 10 bytes\n");

  // WebTransport.
  const wt = new QuicClient(server);
  t.ok("WebTransport: the handshake, DATAGRAM frames on", wt.connect("h3", wtClientParams(new WtLimits()), key));
  openH3(wt, wtSettingsFrame(wtClientSettingIds(), wtClientSettingValues()));
  wt.send(
    n64(0),
    request("CONNECT", "/echo", [":protocol", "origin"], ["webtransport", "https://localhost"]),
    false
  );
  wt.turnUntil(key, n64(-1), false);
  t.eqStr("an extended CONNECT is accepted: 200", h3Answer(wt.stream(n64(0))).status, "200");
  const ping: u8[] = bytesOf("ping");
  wt.datagram(h3Cat([h3Varint(n64(0)), ping]));
  t.ok("a datagram comes back", wt.turnUntil(key, n64(-1), true));
  t.eqStr("echoed, under the session's quarter stream ID", textOf(wt.datagrams[0]), "\u0000ping");
  wt.send(n64(4), h3Cat([h3Varint(H3_FRAME_WEBTRANSPORT_STREAM), h3Varint(n64(0)), bytesOf("a bidirectional stream")]), true);
  t.ok("a bidirectional stream is echoed and ended", wt.turnUntil(key, n64(4), false));
  t.eqStr("byte for byte", textOf(wt.stream(n64(4)).data), "a bidirectional stream");

  t.ok(
    "the application counted each: two hq requests, two HTTP/3, one session, one datagram, one stream",
    server.app.hqAnswered === n32(2) && server.app.h3Answered === n32(2) && server.app.sessions === n32(1) &&
      server.app.datagramsEchoed === n32(1) && server.app.streamsEchoed === n32(1)
  );
  t.eqI32("one QUIC port taken already: serve exits 1", serve(["main", "serve", "--host", "127.0.0.1", "--port", `${server.quicPort}`]), n32(1));
  wipe(key);
};

/** Every check, in one suite. */
export const interopChecks = (): i32 => {
  const t = new Suite("interop server");
  identityChecks(t);
  carrierChecks(t);
  return t.done();
};
