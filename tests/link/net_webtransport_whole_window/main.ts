// `Http3Connection.writeDataWhole` writes `buf[off .. off + len)` as one DATA
// frame, so a window outside the buffer is the program's mistake and panics,
// with
//
//     Http3Connection.writeDataWhole: the window [4, 4 + 1) is outside a buffer of 4 bytes
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { QuicConnection } from "nish/net/quic";
import { Http3Connection } from "nish/net/http3";
import { fixedEntropy } from "../net_quic_conn_replay/server";
import { WtLimits, wtH3Config, wtQuicConfig } from "../net_webtransport/peer";

export const main = (): i32 => {
  const limits = new WtLimits();
  const h3 = new Http3Connection(wtH3Config(limits), new QuicConnection(wtQuicConfig(limits), fixedEntropy()));
  const buf: u8[] = [1, 2, 3, 4];
  console.log(`a window inside its buffer: ${h3.writeDataWhole(toI64(0), buf, 0, 4, false)}`);
  console.log(`unreachable: ${h3.writeDataWhole(toI64(0), buf, 4, 1, false)}`);
  return 0;
};
