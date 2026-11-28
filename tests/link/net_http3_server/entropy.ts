// The entropy each connection and each WebTransport room draws, for the
// check in `tests/run.js` that runs this program twice: as it is, and under
// a helper that makes `getrandom` answer EPERM. It hands one client Initial
// to an `Http3Server` on no socket, then files one stream in a
// `WebTransportWaiting`, and prints `<accepted> <starved> <busy> <filed>`.
// With the source answering that is `1 0 1 true`; with it failing the
// Initial is dropped before a slot is taken and the room refuses the stream,
// `0 1 0 false`. It draws no entropy of its own: the listener's is fixed.
import { netAddress } from "nish:net";
import { Secret, secret, wipe } from "nish:secret";
import { TLS_AES_128_GCM_SHA256 } from "nish/net/tls/schedule";
import { QUIC_LISTENER_ENTROPY_SIZE } from "nish/net/quic-listener";
import { Http3Server } from "nish/net/http3-server";
import { WebTransportWaiting } from "nish/net/webtransport";
import { fromHex } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import { leafPrivate } from "../net_tls_common/server";
import { CLIENT_SCID, QcClient, qcCrypto, qcInitial } from "../net_quic_conn/client";
import { H3Limits, h3Config, h3Hello, h3QuicConfig } from "../net_http3/peer";

/** The listener's entropy, fixed: 0x30, 0x31, … */
const listenerEntropy = (): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < QUIC_LISTENER_ENTROPY_SIZE; k++) {
    out.push(toU8(0x30 + k));
  }
  return out;
};

export const main = (): i32 => {
  const limits = new H3Limits();
  const server = new Http3Server(h3QuicConfig(limits), h3Config(), n32(-1), n32(2), listenerEntropy());
  const c = new QcClient(TLS_AES_128_GCM_SHA256, fromHex(CLIENT_SCID));
  const hello: u8[] = h3Hello(limits);
  c.before = hello;
  const initial: u8[] = qcInitial(c, qcCrypto(n64(0), hello), n32(1200));
  const from: u8[] = new Array<u8>(18);
  netAddress(from, "127.0.0.1", n32(4433));
  const key: Secret<u8[]> = secret(leafPrivate());
  server.datagram(initial, n32(0), toI32(initial.length), from, c.now, key);
  wipe(key);
  const room = new WebTransportWaiting(n32(4));
  const filed: boolean = room.add(n64(4), n64(0));
  console.log(`${server.accepted} ${server.starved} ${server.busy()} ${filed}`);
  return 0;
};
