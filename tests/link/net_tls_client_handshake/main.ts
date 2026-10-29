import { Suite } from "nish/testing";
import { TLS_LEVEL_APPLICATION, TLS_LEVEL_HANDSHAKE, TLS_LEVEL_INITIAL, TLS_STATE_CONNECTED, TlsServer } from "nish/net/tls";
import { TLS_CLIENT_STATE_CONNECTED, TLS_CLIENT_STATE_WAIT_AUTH, TlsClient, TlsClientConfig } from "nish/net/tls/client";
import { secretHex } from "../net_tls_common/secrets";
import { newServer, signWithLeaf, tcpConfig } from "../net_tls_common/server";

const bytes = (start: i32): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < 32; k++) {
    out.push(toU8(start + k));
  }
  return out;
};

export const main = (): i32 => {
  const t = new Suite("tls client handshake");
  const zero: i32 = 0;
  const server: TlsServer = newServer(tcpConfig(["h2"]));
  const client = new TlsClient(new TlsClientConfig("localhost", ["h2", "http/1.1"]), bytes(1), bytes(0x40), bytes(0x60));
  t.eqI32("start", client.start(), zero);
  const ch: u8[] = client.takeOutput(TLS_LEVEL_INITIAL);
  t.eqI32("server reads CH", server.receive(TLS_LEVEL_INITIAL, ch, zero, toI32(ch.length)), zero);
  const sh: u8[] = server.takeOutput(TLS_LEVEL_INITIAL);
  t.eqI32("sign", signWithLeaf(server), zero);
  const flight: u8[] = server.takeOutput(TLS_LEVEL_HANDSHAKE);
  t.eqI32("client reads SH", client.receive(TLS_LEVEL_INITIAL, sh, zero, toI32(sh.length)), zero);
  t.eqI32("client reads flight", client.receive(TLS_LEVEL_HANDSHAKE, flight, zero, toI32(flight.length)), zero);
  t.eqI32("wait auth", client.state, TLS_CLIENT_STATE_WAIT_AUTH);
  t.eqI32("certs", toI32(client.peerCertificates().length), 1);
  t.eqI32("authenticate", client.authenticate(true), zero);
  t.eqI32("connected", client.state, TLS_CLIENT_STATE_CONNECTED);
  t.eqStr("alpn", client.alpn(), "h2");
  const fin: u8[] = client.takeOutput(TLS_LEVEL_HANDSHAKE);
  t.eqI32("server reads Finished", server.receive(TLS_LEVEL_HANDSHAKE, fin, zero, toI32(fin.length)), zero);
  t.eqI32("server connected", server.state, TLS_STATE_CONNECTED);
  t.eqStr("c ap", secretHex(client.secrets().clientApplication), secretHex(server.secrets().clientApplication));
  t.eqStr("s ap", secretHex(client.secrets().serverApplication), secretHex(server.secrets().serverApplication));
  return t.done();
};
