// What `Http2TlsServer` costs before its first connection, for the ceiling
// `HTTP2_TLS_SERVER_START_BYTES` in `tests/runtime-budgets.js`, which
// `tests/run.js` holds this program's answer to: a pool of 16,384 slots on the
// default `Http2Config` and the test TLS configuration, built on no socket,
// slot 0's connection, which the constructor makes, included. It prints
// `<the pool's bytes> <one chunk>`, read as `net_tls_record_tcp/startup.ts`'s
// are.
import { Http2Config } from "nish/net/http2";
import { H2_ALPN, Http2TlsServer } from "nish/net/http2-tls";
import { TlsServerConfig } from "nish/net/tls";
import { tcpConfig } from "../net_tls_common/server";

export const main = (): i32 => {
  const config: Http2Config = new Http2Config();
  const tls: TlsServerConfig = tcpConfig([H2_ALPN]);
  const mark: i64 = Arena.mark();
  const before: i64 = Arena.used();
  const server: Http2TlsServer = new Http2TlsServer(tls, config, toI32(-1), toI32(16384));
  const built: i64 = Arena.used();
  const oneChunk: boolean = Arena.mark() - mark === built - before;
  console.log(`${built - before} ${oneChunk ? "yes" : "no"}`);
  return server.size() === 16384 && server.busy() === 0 && toI32(server.connections.length) === 1 ? 0 : 1;
};
