// A `WebTransport` layer over an `Http3Connection` whose configuration has
// `webtransportSessions` 0 has no sessions: it answers every request for one
// 501 (`refusals.ts` in `net_webtransport`). `openWebTransport` answers it as
// an `Err` instead, and a cap out of range, which the constructor panics on,
// as an `Err` too.
import { QuicConnection } from "nish/net/quic";
import { Http3Config, Http3Connection } from "nish/net/http3";
import { WebTransport, WebTransportConfig, openWebTransport } from "nish/net/webtransport";
import { fixedEntropy } from "../net_quic_conn_replay/server";
import { WtLimits, wtH3Config, wtQuicConfig } from "../net_webtransport/peer";

/** What `openWebTransport` answered: the layer's free sessions, or its error. */
const opened = (config: WebTransportConfig, h3: Http3Connection): string => {
  const made = openWebTransport(config, h3);
  if (made.ok) {
    return `Ok, ${made.value.freeCount} free`;
  }
  return `Err: ${made.error}`;
};

export const main = (): i32 => {
  const limits = new WtLimits();
  const on = new Http3Connection(wtH3Config(limits), new QuicConnection(wtQuicConfig(limits), fixedEntropy()));
  console.log(`a layer over WebTransport: ${new WebTransport(new WebTransportConfig(), on).freeCount - 2}`);
  console.log(`openWebTransport over WebTransport: ${opened(new WebTransportConfig(), on)}`);
  const wide = new WebTransportConfig();
  wide.maxStreams = 4097;
  console.log(`a maxStreams of 4097: ${opened(wide, on)}`);
  const slow = new WebTransportConfig();
  slow.maxDatagramsPerSecond = 0;
  console.log(`a maxDatagramsPerSecond of 0: ${opened(slow, on)}`);
  limits.datagramFrame = toI64(0);
  const config = new Http3Config();
  config.maxFieldSectionSize = 8192;
  const off = new Http3Connection(config, new QuicConnection(wtQuicConfig(limits), fixedEntropy()));
  console.log(`a layer over WebTransport off has ${new WebTransport(new WebTransportConfig(), off).freeCount} free sessions`);
  console.log(`openWebTransport over WebTransport off: ${opened(new WebTransportConfig(), off)}`);
  return 0;
};
