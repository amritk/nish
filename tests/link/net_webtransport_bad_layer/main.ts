// A `WebTransport` layer over an `Http3Connection` whose configuration has
// `webtransportSessions` 0 would take sessions the connection never
// advertised, so it is the program's mistake and panics when it is made, with
//
//     WebTransport: webtransportSessions of 0, outside 1 to 256
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { QuicConnection } from "nish/net/quic";
import { Http3Config, Http3Connection } from "nish/net/http3";
import { WebTransport, WebTransportConfig } from "nish/net/webtransport";
import { fixedEntropy } from "../net_quic_conn_replay/server";
import { WtLimits, wtH3Config, wtQuicConfig } from "../net_webtransport/peer";

export const main = (): i32 => {
  const limits = new WtLimits();
  const on = new Http3Connection(wtH3Config(limits), new QuicConnection(wtQuicConfig(limits), fixedEntropy()));
  console.log(`a layer over WebTransport: ${new WebTransport(new WebTransportConfig(), on).freeCount - 2}`);
  limits.datagramFrame = toI64(0);
  const config = new Http3Config();
  config.maxFieldSectionSize = 8192;
  const off = new Http3Connection(config, new QuicConnection(wtQuicConfig(limits), fixedEntropy()));
  console.log(`unreachable: ${new WebTransport(new WebTransportConfig(), off).freeCount}`);
  return 0;
};
