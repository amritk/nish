// `WebTransport.sendDatagram` reads `buf[off .. off + len)`, so a window
// outside the buffer is the program's mistake and panics, with
//
//     WebTransport.sendDatagram: the window [2, 2 + 4) is outside a buffer of 4 bytes
//
// and exits 1, before any session is looked at. The link harness compares
// stdout and the exit code only, so the message is named here rather than pinned.
import { QuicConnection } from "nish/net/quic";
import { Http3Connection } from "nish/net/http3";
import { WebTransport } from "nish/net/webtransport";
import { fixedEntropy } from "../net_quic_conn_replay/server";
import { WtLimits, wtConfig, wtH3Config, wtQuicConfig } from "../net_webtransport/peer";

export const main = (): i32 => {
  const limits = new WtLimits();
  const wt = new WebTransport(wtConfig(limits), new Http3Connection(wtH3Config(limits), new QuicConnection(wtQuicConfig(limits), fixedEntropy())));
  const buf: u8[] = [1, 2, 3, 4];
  console.log(`a window inside its buffer: ${wt.sendDatagram(toI64(0), buf, 0, 4)}`);
  console.log(`unreachable: ${wt.sendDatagram(toI64(0), buf, 2, 4)}`);
  return 0;
};
