// `nish/net/tls-client` against RFC 8448 §3, "Simple 1-RTT Handshake", from
// the client's side. The client is handed the trace's x25519 key and sends the
// trace's own ClientHello through `startWith`; it then reads the trace's
// ServerHello and server flight, must derive every traffic secret the trace
// prints, must hand its authenticator the trace's certificate and the exact
// CertificateVerify input, and must write the trace's client Finished. RSA-PSS
// is not linked, so the authenticator compares the signature with the trace's
// bytes rather than verifying it. `startWith`'s refusals follow.
import { Suite } from "nish/testing";
import { TLS_LEVEL_APPLICATION, TLS_LEVEL_HANDSHAKE, TLS_LEVEL_INITIAL } from "nish/net/tls";
import { TLS_SIGNATURE_RSA_PSS_RSAE_SHA256 } from "nish/net/tls/codec";
import {
  TLS_CLIENT_STATE_CONNECTED,
  TLS_CLIENT_STATE_FAILED,
  TLS_CLIENT_STATE_WAIT_AUTHENTICATION,
  TLS_CLIENT_STATE_WAIT_ENCRYPTED_EXTENSIONS,
  TlsClient,
  TlsClientConfig,
  tlsClientAuthenticate,
} from "nish/net/tls-client";
import { fromHex, sameBytes, toHex } from "../crypto_x509/hex";
import { secretHex } from "../net_tls_common/secrets";
import { cat, clientHello, clientPrivate, extension, standardWith, u16, vec16 } from "../net_tls_common/client";
import {
  rfc8448Certificate,
  rfc8448CertificateDer,
  rfc8448CertificateTranscriptHash,
  rfc8448CertificateVerify,
  rfc8448ClientApplicationTraffic,
  rfc8448ClientFinished,
  rfc8448ClientHandshakeTraffic,
  rfc8448ClientHello,
  rfc8448ClientPrivate,
  rfc8448EncryptedExtensions,
  rfc8448ExporterSecret,
  rfc8448RsaPssSignature,
  rfc8448ServerApplicationTraffic,
  rfc8448ServerFinished,
  rfc8448ServerHandshakeTraffic,
  rfc8448ServerHello,
} from "../net_tls_rfc8448/trace";

/** The client configuration the trace's ClientHello matches: "server", no ALPN, AES-128-GCM first. */
const traceConfig = (): TlsClientConfig => {
  const none: string[] = [];
  return { serverName: "server", alpn: none, suites: [toI32(0x1301), toI32(0x1303), toI32(0x1302)], deferShare: false };
};

/** The trace's client random, bytes 6 to 38 of its ClientHello. */
const traceRandom = (): u8[] => fromHex("cb34ecb1e78163ba1c38c6dacb196a6dffa21a8d9912ec18a2ef6283024dece7");

/** A client holding the trace's x25519 key. */
const traceClient = (): TlsClient => new TlsClient(traceConfig(), traceRandom(), rfc8448ClientPrivate());

/**
 * The authenticator of the trace: the chain must be the trace's one
 * certificate, and the CertificateVerify must be RSA-PSS over exactly the
 * input RFC 8446 §4.4.3 defines, carrying the trace's signature.
 */
class TraceAuth {
  chainCalls: i32 = 0;
  signatureCalls: i32 = 0;
  serverName: string = "";
  scheme: i32 = 0;
  content: u8[];

  constructor() {
    this.content = [];
  }
}

/** What CertificateVerify signs: 64 spaces, the server context string, a zero, the transcript hash. */
const verifyInput = (): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < 64; k++) {
    out.push(toU8(0x20));
  }
  const context: string = "TLS 1.3, server CertificateVerify";
  for (let k: i32 = 0; k < toI32(context.length); k++) {
    out.push(toU8(toI32(context.charCodeAt(k))));
  }
  out.push(toU8(0));
  for (const b of rfc8448CertificateTranscriptHash()) {
    out.push(b);
  }
  return out;
};

const traceChain = (auth: TraceAuth, chain: u8[][], serverName: string): i32 => {
  auth.chainCalls = auth.chainCalls + 1;
  auth.serverName = serverName;
  return toI32(chain.length) === 1 && sameBytes(chain[0], rfc8448CertificateDer()) ? 0 : 42;
};

const traceSignature = (auth: TraceAuth, chain: u8[][], scheme: i32, content: u8[], signature: u8[]): boolean => {
  auth.signatureCalls = auth.signatureCalls + 1;
  auth.scheme = scheme;
  auth.content = content;
  return sameBytes(signature, rfc8448RsaPssSignature()) && sameBytes(content, verifyInput());
};

/** `bytes[from .. to)`, fresh. */
const between = (bytes: u8[], from: i32, to: i32): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = from; k < to; k++) {
    out.push(bytes[k]);
  }
  return out;
};

/** Hands `bytes` to `client` at `level`; the alert. */
const give = (client: TlsClient, level: i32, bytes: u8[]): i32 => client.receive(level, bytes, toI32(0), toI32(bytes.length));

/** The whole trace, client side. */
const traceRun = (t: Suite): void => {
  const client: TlsClient = traceClient();
  t.eqI32("startWith takes the trace's ClientHello", client.startWith(rfc8448ClientHello()), toI32(0));
  t.eqStr("the ClientHello goes out unchanged", toHex(client.takeOutput(TLS_LEVEL_INITIAL)), toHex(rfc8448ClientHello()));
  t.eqI32("the ServerHello is accepted", give(client, TLS_LEVEL_INITIAL, rfc8448ServerHello()), toI32(0));
  t.eqI32("then EncryptedExtensions is awaited", client.state, TLS_CLIENT_STATE_WAIT_ENCRYPTED_EXTENSIONS);
  t.eqI32("AES-128-GCM", client.suite, toI32(0x1301));
  t.eqStr(
    "client_handshake_traffic_secret",
    secretHex(client.secrets().clientHandshake),
    toHex(rfc8448ClientHandshakeTraffic())
  );
  t.eqStr(
    "server_handshake_traffic_secret",
    secretHex(client.secrets().serverHandshake),
    toHex(rfc8448ServerHandshakeTraffic())
  );
  t.ok("the Handshake level is readable and writable", client.readKnown(TLS_LEVEL_HANDSHAKE) && client.writeKnown(TLS_LEVEL_HANDSHAKE));

  // The flight in one call: the client stops at the hand-off and keeps the
  // Finished behind it.
  const flight: u8[] = cat([rfc8448EncryptedExtensions(), rfc8448Certificate(), rfc8448CertificateVerify(), rfc8448ServerFinished()]);
  t.eqI32("the server's flight is read", give(client, TLS_LEVEL_HANDSHAKE, flight), toI32(0));
  t.eqI32("the client waits for authentication", client.state, TLS_CLIENT_STATE_WAIT_AUTHENTICATION);
  t.eqI32("nothing is written before it", toI32(client.takeOutput(TLS_LEVEL_HANDSHAKE).length), toI32(0));

  const auth = new TraceAuth();
  t.eqI32("the trace authenticates", tlsClientAuthenticate(client, auth, traceChain, traceSignature), toI32(0));
  t.eqI32("the chain is asked once", auth.chainCalls, toI32(1));
  t.eqStr("for the name the hello carries", auth.serverName, "server");
  t.eqI32("the signature is asked once", auth.signatureCalls, toI32(1));
  t.eqI32("as RSA-PSS with SHA-256", auth.scheme, TLS_SIGNATURE_RSA_PSS_RSAE_SHA256);
  t.eqStr("over the input §4.4.3 defines", toHex(auth.content), toHex(verifyInput()));
  t.eqI32("connected", client.state, TLS_CLIENT_STATE_CONNECTED);
  t.eqStr("the client Finished is the trace's", toHex(client.takeOutput(TLS_LEVEL_HANDSHAKE)), toHex(rfc8448ClientFinished()));
  t.eqStr(
    "client_application_traffic_secret_0",
    secretHex(client.secrets().clientApplication),
    toHex(rfc8448ClientApplicationTraffic())
  );
  t.eqStr(
    "server_application_traffic_secret_0",
    secretHex(client.secrets().serverApplication),
    toHex(rfc8448ServerApplicationTraffic())
  );
  t.eqStr("exporter_master_secret", secretHex(client.secrets().exporter), toHex(rfc8448ExporterSecret()));
  t.ok("the Application level is readable and writable", client.readKnown(TLS_LEVEL_APPLICATION) && client.writeKnown(TLS_LEVEL_APPLICATION));
  client.wipe();
};

/** A client with RFC 7748's Alice, whose share `standardWith` carries, refusing `hello`. */
const startRefused = (t: Suite, label: string, hello: u8[]): void => {
  const none: string[] = [];
  const config: TlsClientConfig = { serverName: "localhost", alpn: none, suites: [toI32(0x1301)], deferShare: false };
  const client = new TlsClient(config, traceRandom(), clientPrivate());
  t.eqI32(label, client.startWith(hello), toI32(80));
  t.eqI32(`${label}: failed`, client.state, TLS_CLIENT_STATE_FAILED);
  t.eqI32(`${label}: nothing to send`, toI32(client.takeOutput(TLS_LEVEL_INITIAL).length), toI32(0));
};

/** `startWith`'s refusals: each a hello this client cannot finish, answered with `internal_error`. */
const startChecks = (t: Suite): void => {
  const none: u8[] = [];
  const plain: u8[] = clientHello([toI32(0x1301)], standardWith([]));
  const noAlpn: string[] = [];
  const config: TlsClientConfig = { serverName: "localhost", alpn: noAlpn, suites: [toI32(0x1301)], deferShare: false };
  const accepted = new TlsClient(config, traceRandom(), clientPrivate());
  t.eqI32("a hello carrying this client's share is taken", accepted.startWith(plain), toI32(0));
  t.eqI32("but not twice", accepted.startWith(plain), toI32(80));
  startRefused(t, "the trace's hello carries another key's share", rfc8448ClientHello());
  startRefused(t, "an empty hello", none);
  const wrongType: u8[] = cat([[toU8(2)], between(plain, toI32(1), toI32(plain.length))]);
  startRefused(t, "a message that is not a ClientHello", wrongType);
  const short: u8[] = between(plain, toI32(0), toI32(plain.length) - 1);
  startRefused(t, "a header longer than its body", short);
  startRefused(t, "a body that does not parse", cat([[toU8(1), toU8(0), toU8(0), toU8(2)], [toU8(3), toU8(3)]]));
  startRefused(t, "no TLS 1.3 in supported_versions", clientHello([toI32(0x1301)], [
    extension(toI32(43), cat([[toU8(2)], u16(toI32(0x0303))])),
    standardWith([])[1],
    standardWith([])[2],
    standardWith([])[3],
  ]));
  startRefused(t, "early_data", clientHello([toI32(0x1301)], standardWith([extension(toI32(42), none)])));
  startRefused(t, "a cookie", clientHello([toI32(0x1301)], standardWith([extension(toI32(44), vec16([toU8(1), toU8(2)]))])));
  // A pre_shared_key extension must come last; an identity of one byte and a
  // binder of 32 are enough for the hello to parse.
  const binder: u8[] = [];
  for (let k: i32 = 0; k < 32; k++) {
    binder.push(toU8(7));
  }
  const psk: u8[] = extension(
    toI32(41),
    cat([vec16(cat([vec16([toU8(9)]), [toU8(0), toU8(0), toU8(0), toU8(0)]])), vec16(cat([[toU8(32)], binder]))])
  );
  startRefused(
    t,
    "a pre_shared_key",
    clientHello([toI32(0x1301)], standardWith([extension(toI32(45), [toU8(1), toU8(1)]), psk]))
  );
};

/** Every check, with the summary line; the exit code is the failure count. */
export const clientRfc8448Checks = (): i32 => {
  const t = new Suite("nish/net/tls-client against RFC 8448");
  traceRun(t);
  startChecks(t);
  return t.done();
};
