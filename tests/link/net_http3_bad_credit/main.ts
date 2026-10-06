// A HEADERS frame is read once all of it is in, so every request stream may
// hold one not yet whole, and QUIC raises the connection's credit only once
// half its window has been read: a window too small for that could stall the
// connection on its own field sections. It is the program's configuration,
// so it panics when the connection is made, with
//
//     Http3Connection: a connection window of 65536, under the 262656 that 16 request streams' field sections need
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { QuicConnection } from "nish/net/quic";
import { Http3Connection } from "nish/net/http3";
import { fixedEntropy } from "../net_quic_conn_replay/server";
import { H3Limits, h3Config, h3QuicConfig } from "../net_http3/peer";

export const main = (): i32 => {
  const limits = new H3Limits();
  console.log(`a megabyte of window holds sixteen sections: ${new Http3Connection(h3Config(), new QuicConnection(h3QuicConfig(limits), fixedEntropy())).state === 0}`);
  limits.maxData = toI64(65536);
  console.log(`unreachable: ${new Http3Connection(h3Config(), new QuicConnection(h3QuicConfig(limits), fixedEntropy())).state}`);
  return 0;
};
