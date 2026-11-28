// `WebTransport.sendDatagram` takes a datagram's payload as a window `(buf, off, len)` the program
// chose, so a window that does not lie inside its buffer answers H3_INVALID
// (-22) rather than reading past it, before anything about the stream or
// session is asked. Neither call panics, and the program exits 0.
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
  console.log(`a window outside it: ${wt.sendDatagram(toI64(0), buf, 2, 4)}`);
  return 0;
};
