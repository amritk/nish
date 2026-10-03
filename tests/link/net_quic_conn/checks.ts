// The checks of `nish/net/quic`, run by `main.ts` in the default number mode
// and by `tests/link/net_quic_conn_f64` under `--number-mode f64`. The
// handshakes and the data path are here; the refusals are in `refusals.ts`.
import { Suite } from "nish/testing";
import { QUIC_FRAME_NEW_CONNECTION_ID } from "nish/net/quic-frame";
import { QuicTransportParameters, quicEncodeTransportParameters, quicParseTransportParameters } from "nish/net/quic-conn-params";
import { QUIC_STATE_CONNECTED, QUIC_STATE_WAIT_INITIAL, QuicConnection } from "nish/net/quic";
import { TLS_AES_128_GCM_SHA256, TLS_AES_256_GCM_SHA384, TLS_CHACHA20_POLY1305_SHA256 } from "nish/net/tls/schedule";
import { fromHex, toHex } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import { CLIENT_ODCID, CLIENT_SCID, QcClient, qcConnect, qcHello, qcParams } from "./client";
import { QcFound, qcDefaultConfig, qcFind, qcFrameTypes, qcServer } from "./common";
import { quicConnRefusalChecks } from "./refusals";
import { quicConnDataChecks } from "./data";

/**
 * The server's transport parameters, read out of the EncryptedExtensions in
 * its Handshake CRYPTO stream: the extension of type 0x39.
 */
const serverParamsOf = (c: QcClient): QuicTransportParameters => {
  const ee: u8[] = c.cryptoHandshake;
  // EncryptedExtensions: type (1), length (3), the extensions' length (2), then each type (2), length (2), body.
  let at: i32 = 6;
  while (at >= 0 && at + 4 <= toI32(ee.length) && at + 3 < toI32(ee.length)) {
    const type: i32 = (toI32(ee[at]) << 8) | toI32(ee[at + 1]);
    const length: i32 = (toI32(ee[at + 2]) << 8) | toI32(ee[at + 3]);
    if (type === 0x39) {
      const body: u8[] = [];
      for (let k: i32 = at + 4; k < at + 4 + length && k < toI32(ee.length); k++) {
        body.push(ee[k]);
      }
      return quicParseTransportParameters(body, true);
    }
    at = at + 4 + length;
  }
  return new QuicTransportParameters();
};

/** A handshake under `suite`, checked step by step. */
const handshakeUnder = (t: Suite, suite: i32, name: string): void => {
  const conn: QuicConnection = qcServer(qcDefaultConfig());
  t.eqI32(`${name}: a new connection waits for an Initial`, conn.state, QUIC_STATE_WAIT_INITIAL);
  const scid: u8[] = fromHex(CLIENT_SCID);
  const c = new QcClient(suite, scid);
  const hello: u8[] = qcHello([suite], "nish-echo", quicEncodeTransportParameters(qcParams(scid, n64(65536))));
  t.ok(`${name}: the handshake completes`, qcConnect(conn, c, hello));
  t.eqI32(`${name}: the connection is connected`, conn.state, QUIC_STATE_CONNECTED);
  t.ok(`${name}: the client verified the server's signature and Finished`, c.view.signatureVerifies && c.view.serverFinishedVerifies);
  const tls = conn.tls;
  t.eqI32(`${name}: TLS negotiated the suite`, tls === null ? n32(0) : tls.suite, suite);
}

/** The AES-128-GCM handshake, in detail. */
const handshakeChecks = (t: Suite): void => {
  const conn: QuicConnection = qcServer(qcDefaultConfig());
  const scid: u8[] = fromHex(CLIENT_SCID);
  const c = new QcClient(TLS_AES_128_GCM_SHA256, scid);
  const hello: u8[] = qcHello([TLS_AES_128_GCM_SHA256], "nish-echo", quicEncodeTransportParameters(qcParams(scid, n64(65536))));
  t.ok("the handshake completes against the test client", qcConnect(conn, c, hello));
  t.eqI32("the server's first flight is one datagram", toI32(c.datagrams.length), n32(2));
  t.eqI32("padded to 1200 bytes, since it carries an ack-eliciting Initial", toI32(c.datagrams[0].length), n32(1200));
  t.eqStr("its long headers come from the server's first connection ID", toHex(c.serverScid), "8081828384858687");
  t.eqStr("the Initial acknowledges the client's packet 0, then carries the ServerHello", qcFrameTypes(c.longPayloads[0]), "2 6");
  t.eqStr("the Handshake packet carries the rest of the flight, then the padding", qcFrameTypes(c.longPayloads[1]), "6 0");
  t.ok("the client's view checks the server's CertificateVerify under the leaf key", c.view.signatureVerifies);
  t.ok("and its Finished", c.view.serverFinishedVerifies);

  const p: QuicTransportParameters = serverParamsOf(c);
  t.ok("the server's transport parameters parse as a server's", p.error === n64(0));
  t.eqStr("original_destination_connection_id is the DCID of the client's first Initial", toHex(p.originalDcid), CLIENT_ODCID);
  t.eqStr("initial_source_connection_id is the server's SCID", toHex(p.initialScid), toHex(c.serverScid));
  t.ok(
    "the limits are the configuration's",
    p.initialMaxData === n64(65536) &&
      p.initialMaxStreamDataBidiRemote === n64(16384) &&
      p.initialMaxStreamsBidi === n64(4) &&
      p.initialMaxStreamsUni === n64(0) &&
      p.activeConnectionIdLimit === n64(4) &&
      p.maxIdleTimeout === n64(30000)
  );
  t.ok("and the server asks the client not to migrate", p.disableActiveMigration);

  t.eqI32("after the client's Finished the connection is connected", conn.state, QUIC_STATE_CONNECTED);
  t.eqStr("the handshake chose the echo's ALPN", conn.alpn, "nish-echo");
  t.ok("the Handshake packet validated the client's address", conn.addressValidated);
  t.ok("and the Initial keys are discarded (RFC 9001 §4.9.1)", conn.initial.discarded && conn.initial.readKeys === null);
  t.ok("as are the Handshake keys once the handshake is confirmed (§4.9.2)", conn.handshake.discarded && conn.handshake.writeKeys === null);
  t.eqI32("one 1-RTT packet followed", toI32(c.appPayloads.length), n32(1));
  t.eqStr(
    "carrying HANDSHAKE_DONE and three NEW_CONNECTION_IDs, up to the client's limit of 4",
    qcFrameTypes(c.appPayloads[0]),
    "30 24 24 24"
  );
  const ncid: QcFound = qcFind(c.appPayloads, QUIC_FRAME_NEW_CONNECTION_ID);
  t.ok("the first new ID is sequence 1, eight bytes, with a 16-byte reset token", ncid.found && ncid.frame.value === n64(1) && toI32(ncid.frame.connectionId.length) === 8);
  t.ok("the server owns its new IDs", conn.ownsConnectionId(ncid.frame.connectionId) && conn.ownsConnectionId(c.serverScid));
  t.ok("but no longer the original DCID", !conn.ownsConnectionId(fromHex(CLIENT_ODCID)));
  t.eqI32("the table holds four active local IDs", conn.cids.activeLocal(), n32(4));
  t.ok("nothing more is due", conn.takeDatagram() === null);

  handshakeUnder(t, TLS_CHACHA20_POLY1305_SHA256, "ChaCha20-Poly1305");
  handshakeUnder(t, TLS_AES_256_GCM_SHA384, "AES-256-GCM");
};

/** Runs every check and answers the exit code. */
export const quicConnChecks = (): i32 => {
  const t = new Suite("quic connection");
  handshakeChecks(t);
  quicConnDataChecks(t);
  quicConnRefusalChecks(t);
  return t.done();
};
