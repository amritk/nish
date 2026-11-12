// `WebTransportConfig.idleTimeout` of 0 is the program's mistake and panics
// when the layer is made, with
//
//     WebTransport: idleTimeout of 0, outside 1 to 86400000
//
// and exits 1; so does a `maxDatagramsPerSecond` outside 1 to 1,048,576. The
// link harness compares stdout and the exit code only, so the message is
// named here rather than pinned.
import { QuicConnection } from "nish/net/quic";
import { Http3Connection } from "nish/net/http3";
import { WebTransport, WebTransportConfig } from "nish/net/webtransport";
import { fixedEntropy } from "../net_quic_conn_replay/server";
import { WtLimits, wtH3Config, wtQuicConfig } from "../net_webtransport/peer";

export const main = (): i32 => {
  const limits = new WtLimits();
  const h3 = new Http3Connection(wtH3Config(limits), new QuicConnection(wtQuicConfig(limits), fixedEntropy()));
  const config = new WebTransportConfig();
  console.log(`the default clock: ${new WebTransport(config, h3).config.idleTimeout} ms, ${config.maxDatagramsPerSecond} datagrams a second`);
  config.idleTimeout = 0;
  console.log(`unreachable: ${new WebTransport(config, h3).freeCount}`);
  return 0;
};
