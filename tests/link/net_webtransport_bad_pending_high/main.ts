// `WebTransportConfig.maxPending` past 4,096 is the program's mistake and
// panics when the layer is made, with
//
//     WebTransport: maxPending of 4097, outside 0 to 4096
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
  config.maxPending = 4096;
  console.log(`the most a layer takes: ${new WebTransport(config, h3).config.maxPending}`);
  config.maxPending = 4097;
  console.log(`unreachable: ${new WebTransport(config, h3).freeCount}`);
  return 0;
};
