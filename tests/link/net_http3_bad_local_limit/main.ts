// The server opens three unidirectional streams of its own (§6.2), so a QUIC
// configuration that lets it open two is refused when the connection is made. It panics, on stderr, with
//
//     Http3Connection: the QUIC local stream limit of 2, outside 3 to 1024
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { QuicConnection } from "nish/net/quic";
import { Http3Connection } from "nish/net/http3";
import { fixedEntropy } from "../net_quic_conn_replay/server";
import { H3Limits, h3Config, h3QuicConfig } from "../net_http3/peer";

export const main = (): i32 => {
  const limits = new H3Limits();
  const config = h3Config();
  limits.localStreams = toI64(2);
  console.log("an out-of-range cap, everything else valid: the constructor refuses it");
  console.log(`unreachable: ${new Http3Connection(config, new QuicConnection(h3QuicConfig(limits), fixedEntropy())).state}`);
  return 0;
};
