// ALPN in `nish/net/tls` (RFC 7301 §3.2): the server picks the first of its
// own protocols that the client offers, whatever order the client lists them
// in, and says so in EncryptedExtensions with a list of exactly that one. A
// client with nothing the server speaks gets `no_application_protocol`. Over
// TCP a client that sends no ALPN, or a server configured with none, simply
// negotiates nothing.
import { Suite } from "nish/testing";
import { TLS_ALERT_NO_APPLICATION_PROTOCOL } from "nish/net/tls/codec";
import { TLS_AES_128_GCM_SHA256 } from "nish/net/tls/schedule";
import { TLS_LEVEL_HANDSHAKE, TLS_STATE_FAILED, TLS_STATE_WAIT_SIGNATURE, TlsServer } from "nish/net/tls";
import { clientHello, extAlpn, sendHello, splitMessages, standardExtensions, standardWith } from "../net_tls_common/client";
import { toHex } from "../net_tls_common/hex";
import { newServer, tcpConfig } from "../net_tls_common/server";

/** The EncryptedExtensions a server wrote, or "none". */
export const encryptedExtensionsOf = (server: TlsServer): string => {
  const messages: u8[][] = splitMessages(server.takeOutput(TLS_LEVEL_HANDSHAKE));
  if (toI32(messages.length) === 0) {
    return "none";
  }
  return toHex(messages[0]);
};

/** Runs every check and answers the exit code. */
export const alpnChecks = (): i32 => {
  const t = new Suite("tls alpn");
  const zero: i32 = 0;
  const suites: i32[] = [TLS_AES_128_GCM_SHA256];

  const preferred: TlsServer = newServer(tcpConfig(["h2", "http/1.1"]));
  t.eqI32(
    "a client offering http/1.1 then h2 is accepted",
    sendHello(preferred, clientHello(suites, standardWith([extAlpn(["http/1.1", "h2"])]))),
    zero
  );
  t.eqStr("and gets h2, the server's first choice", preferred.alpn, "h2");
  t.eqStr(
    "EncryptedExtensions carries ALPN with the one protocol: 0010 0005 0003 02 'h2'",
    encryptedExtensionsOf(preferred),
    "0800000b00090010000500030268" + "32"
  );

  const second: TlsServer = newServer(tcpConfig(["h2", "http/1.1"]));
  sendHello(second, clientHello(suites, standardWith([extAlpn(["spdy/3", "http/1.1"])])));
  t.eqStr("a client without h2 gets the server's next choice it offers", second.alpn, "http/1.1");

  const disjoint: TlsServer = newServer(tcpConfig(["h2"]));
  t.eqI32(
    "no protocol in common is no_application_protocol",
    sendHello(disjoint, clientHello(suites, standardWith([extAlpn(["spdy/3", "h2c"])]))),
    TLS_ALERT_NO_APPLICATION_PROTOCOL
  );
  t.eqI32("and the server has failed", disjoint.state, TLS_STATE_FAILED);
  t.eqI32("with the alert recorded", disjoint.alert, TLS_ALERT_NO_APPLICATION_PROTOCOL);

  const prefix: TlsServer = newServer(tcpConfig(["h2"]));
  t.eqI32(
    "a name that only starts with the server's is not a match",
    sendHello(prefix, clientHello(suites, standardWith([extAlpn(["h2x"])]))),
    TLS_ALERT_NO_APPLICATION_PROTOCOL
  );

  const silent: TlsServer = newServer(tcpConfig(["h2"]));
  t.eqI32("over TCP a client without ALPN is accepted", sendHello(silent, clientHello(suites, standardExtensions())), zero);
  t.eqStr("and negotiates none", silent.alpn, "");
  t.eqStr("and EncryptedExtensions is empty", encryptedExtensionsOf(silent), "080000020000");

  const none: string[] = [];
  const deaf: TlsServer = newServer(tcpConfig(none));
  t.eqI32(
    "a server configured with no ALPN accepts a client offering some",
    sendHello(deaf, clientHello(suites, standardWith([extAlpn(["h2"])]))),
    zero
  );
  t.eqStr("and negotiates none", deaf.alpn, "");
  t.eqI32("the handshake goes on", deaf.state, TLS_STATE_WAIT_SIGNATURE);
  return t.done();
};
