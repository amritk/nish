// QUIC datagrams carry nothing for HTTP/3 without WebTransport (RFC 9297
// §2.1.1), so advertising `max_datagram_frame_size` with
// `webtransportSessions` 0 is the program's mistake and panics when the
// connection is made, with
//
//     Http3Connection: QUIC datagrams advertised with WebTransport off (webtransportSessions 0)
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { QuicConnection } from "nish/net/quic";
import { Http3Config, Http3Connection } from "nish/net/http3";
import { fixedEntropy } from "../net_quic_conn_replay/server";
import { WtLimits, wtQuicConfig } from "../net_webtransport/peer";

export const main = (): i32 => {
  const limits = new WtLimits();
  limits.datagramFrame = toI64(0);
  const config = new Http3Config();
  config.maxFieldSectionSize = 8192;
  const quic = new QuicConnection(wtQuicConfig(limits), fixedEntropy());
  console.log(`the defaults make a connection: ${new Http3Connection(config, quic).webtransport}`);
  limits.datagramFrame = toI64(1200);
  const datagrams = new QuicConnection(wtQuicConfig(limits), fixedEntropy());
  console.log(`unreachable: ${new Http3Connection(config, datagrams).state}`);
  return 0;
};
