// `quic_transport_parameters` in `nish/net/tls` (RFC 9001 §8.2): opaque bytes
// in and opaque bytes out, carried only when the configuration says the
// carrier is QUIC. Over QUIC the client's parameters are exposed and the
// server's are sent in EncryptedExtensions; a client without them is
// `missing_extension`, and one without an ALPN protocol the server speaks is
// `no_application_protocol`, since QUIC requires ALPN (§8.1). Over TCP the
// extension is ignored both ways.
import { Suite } from "nish/testing";
import { TLS_ALERT_MISSING_EXTENSION, TLS_ALERT_NO_APPLICATION_PROTOCOL } from "nish/net/tls/codec";
import { TLS_AES_128_GCM_SHA256 } from "nish/net/tls/schedule";
import { TLS_LEVEL_HANDSHAKE, TLS_LEVEL_INITIAL, TLS_STATE_CONNECTED, TlsServer } from "nish/net/tls";
import { ClientView, clientFinish, clientHello, extAlpn, extQuic, sendHandshake, sendHello, standardWith } from "../net_tls_common/client";
import { fromHex, toHex } from "../crypto_x509/hex";
import { leafPublic, newServer, quicConfig, signWithLeaf, tcpConfig } from "../net_tls_common/server";
import { encryptedExtensionsOf } from "../net_tls_ext_alpn/checks";

/** Runs every check and answers the exit code. */
export const quicChecks = (): i32 => {
  const t = new Suite("tls quic transport parameters");
  const zero: i32 = 0;
  const h: i32 = 32;
  const suites: i32[] = [TLS_AES_128_GCM_SHA256];
  const serverParams: u8[] = fromHex("010203");
  const clientParams: u8[] = fromHex("0f0408c0ffee");

  const quic: TlsServer = newServer(quicConfig(["h3"], serverParams));
  const hello: u8[] = clientHello(suites, standardWith([extAlpn(["h3"]), extQuic(clientParams)]));
  t.eqI32("over QUIC a client with parameters and h3 is accepted", sendHello(quic, hello), zero);
  t.eqStr("its parameters are exposed as they were sent", toHex(quic.clientTransportParameters), "0f0408c0ffee");
  t.eqStr("h3 is chosen", quic.alpn, "h3");
  t.eqI32("the handshake is signed", signWithLeaf(quic), zero);
  const initial: u8[] = quic.takeOutput(TLS_LEVEL_INITIAL);
  const handshake: u8[] = quic.takeOutput(TLS_LEVEL_HANDSHAKE);
  t.eqStr(
    "EncryptedExtensions carries ALPN h3, then the server's parameters: 0039 0003 010203",
    toHex(handshake).substring(0, 44),
    "080000120010001000050003026833003900030102" + "03"
  );
  const view: ClientView = clientFinish(h, hello, initial, handshake, leafPublic());
  t.ok("the client verifies the flight", view.signatureVerifies && view.serverFinishedVerifies);
  t.eqI32("and the server its Finished", sendHandshake(quic, view.clientFinished), zero);
  t.eqI32("a QUIC handshake completes", quic.state, TLS_STATE_CONNECTED);

  t.eqI32(
    "over QUIC a client without transport parameters is missing_extension",
    sendHello(newServer(quicConfig(["h3"], serverParams)), clientHello(suites, standardWith([extAlpn(["h3"])]))),
    TLS_ALERT_MISSING_EXTENSION
  );
  t.eqI32(
    "over QUIC a client without ALPN is no_application_protocol",
    sendHello(newServer(quicConfig(["h3"], serverParams)), clientHello(suites, standardWith([extQuic(clientParams)]))),
    TLS_ALERT_NO_APPLICATION_PROTOCOL
  );
  const none: string[] = [];
  t.eqI32(
    "a QUIC server configured with no ALPN refuses even a client offering some",
    sendHello(newServer(quicConfig(none, serverParams)), clientHello(suites, standardWith([extAlpn(["h3"]), extQuic(clientParams)]))),
    TLS_ALERT_NO_APPLICATION_PROTOCOL
  );

  const tcp: TlsServer = newServer(tcpConfig(none));
  t.eqI32(
    "over TCP a client sending transport parameters is accepted",
    sendHello(tcp, clientHello(suites, standardWith([extQuic(clientParams)]))),
    zero
  );
  t.eqStr("but they are not exposed", toHex(tcp.clientTransportParameters), "");
  t.eqStr("and none are sent", encryptedExtensionsOf(tcp), "080000020000");
  return t.done();
};
