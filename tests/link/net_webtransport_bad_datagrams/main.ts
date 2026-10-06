// WebTransport carries HTTP datagrams in QUIC DATAGRAM frames, so turning it
// on over a QUIC connection that does not take them (`maxDatagramFrameSize`
// 0) is the program's mistake and panics when the connection is made, with
//
//     Http3Connection: WebTransport needs QUIC datagrams, and the QUIC maxDatagramFrameSize is 0
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { QuicConnection } from "nish/net/quic";
import { Http3Connection } from "nish/net/http3";
import { fixedEntropy } from "../net_quic_conn_replay/server";
import { WtLimits, wtH3Config, wtQuicConfig } from "../net_webtransport/peer";

export const main = (): i32 => {
  const limits = new WtLimits();
  const config = wtH3Config(limits);
  const quic = new QuicConnection(wtQuicConfig(limits), fixedEntropy());
  console.log(`the defaults make a connection: ${new Http3Connection(config, quic).webtransport}`);
  limits.datagramFrame = toI64(0);
  const without = new QuicConnection(wtQuicConfig(limits), fixedEntropy());
  console.log(`unreachable: ${new Http3Connection(config, without).state}`);
  return 0;
};
