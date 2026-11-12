// `WebTransportConfig.maxDatagramsPerSecond` of 0 would drop every datagram:
// the program's mistake, which panics when the layer is made, with
//
//     WebTransport: maxDatagramsPerSecond of 0, outside 1 to 1048576
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { QuicConnection } from "nish/net/quic";
import { Http3Connection } from "nish/net/http3";
import { WebTransport, WebTransportConfig } from "nish/net/webtransport";
import { fixedEntropy } from "../net_quic_conn_replay/server";
import { WtLimits, wtH3Config, wtQuicConfig } from "../net_webtransport/peer";

export const main = (): i32 => {
  const limits = new WtLimits();
  const h3 = new Http3Connection(wtH3Config(limits), new QuicConnection(wtQuicConfig(limits), fixedEntropy()));
  const config = new WebTransportConfig();
  console.log(`the default rate: ${new WebTransport(config, h3).config.maxDatagramsPerSecond} datagrams a second`);
  config.maxDatagramsPerSecond = 0;
  console.log(`unreachable: ${new WebTransport(config, h3).freeCount}`);
  return 0;
};
