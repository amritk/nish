// What `Http1TlsServer` costs before its first connection, for the ceiling
// `HTTP1_TLS_SERVER_START_BYTES` in `tests/runtime-budgets.js`, which
// `tests/run.js` holds this program's answer to: a pool of 16,384 slots on the
// default `Http1Config` and the test TLS configuration, built on no socket.
// It prints `<the pool's bytes> <one chunk>`, read as
// `net_tls_record_tcp/startup.ts`'s are.
import { Http1Config, Http1TlsServer } from "nish/net/http1-server";
import { TlsServerConfig } from "nish/net/tls";
import { tcpConfig } from "../net_tls_common/server";

export const main = (): i32 => {
  const config: Http1Config = new Http1Config();
  const tls: TlsServerConfig = tcpConfig(["http/1.1"]);
  const mark: i64 = Arena.mark();
  const before: i64 = Arena.used();
  const server: Http1TlsServer = new Http1TlsServer(tls, config, toI32(-1), toI32(16384));
  const built: i64 = Arena.used();
  const oneChunk: boolean = Arena.mark() - mark === built - before;
  console.log(`${built - before} ${oneChunk ? "yes" : "no"}`);
  return server.size() === 16384 && server.busy() === 0 && toI32(server.connections.length) === 0 ? 0 : 1;
};
