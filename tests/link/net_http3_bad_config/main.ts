// The caps of an `Http3Connection` are the program's, fixed at start-up, and
// a HEADERS frame of `maxFieldSectionSize` has to fit half of one QUIC
// stream's buffer, or QUIC's credit could stall the frame before it is whole. So a cap past the buffer is
// the program's mistake and panics when the connection is made, with
//
//     Http3Connection: maxFieldSectionSize of 32768, outside 1 to 32752
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { QuicConnection } from "nish/net/quic";
import { Http3Config, Http3Connection } from "nish/net/http3";
import { fixedEntropy } from "../net_quic_conn_replay/server";
import { H3Limits, h3QuicConfig } from "../net_http3/peer";

export const main = (): i32 => {
  const limits = new H3Limits();
  limits.maxStreamData = toI64(65536);
  const quic = new QuicConnection(h3QuicConfig(limits), fixedEntropy());
  const config = new Http3Config();
  console.log(`the defaults make a connection: ${new Http3Connection(config, quic).state === 0}`);
  config.maxFieldSectionSize = 32768;
  console.log(`unreachable: ${new Http3Connection(config, quic).state}`);
  return 0;
};
