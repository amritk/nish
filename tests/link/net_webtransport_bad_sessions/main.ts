// `Http3Config.webtransportSessions` is advertised in
// SETTINGS_WEBTRANSPORT_MAX_SESSIONS and sizes the session table, so one past
// `H3_MAX_SESSIONS` is the program's mistake and panics when the connection
// is made, with
//
//     Http3Connection: webtransportSessions of 257, outside 0 to 256
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { QuicConnection } from "nish/net/quic";
import { Http3Connection } from "nish/net/http3";
import { fixedEntropy } from "../net_quic_conn_replay/server";
import { WtLimits, wtH3Config, wtQuicConfig } from "../net_webtransport/peer";

export const main = (): i32 => {
  const limits = new WtLimits();
  const quic = new QuicConnection(wtQuicConfig(limits), fixedEntropy());
  const config = wtH3Config(limits);
  console.log(`the defaults make a connection: ${new Http3Connection(config, quic).webtransport}`);
  config.webtransportSessions = 257;
  console.log(`unreachable: ${new Http3Connection(config, quic).state}`);
  return 0;
};
