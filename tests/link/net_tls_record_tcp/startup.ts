// What `TlsTcpServer` costs before its first connection, for the ceiling
// `TLS_TCP_START_BYTES` in `tests/runtime-budgets.js`, which `tests/run.js`
// holds this program's answer to: a pool of 16,384 slots on the test
// configuration, built on no socket. It prints `<the pool's bytes> <one
// chunk>`, the bytes read from `Arena.used()`, which counts within the
// current chunk only: the last field says whether the pool fit in the chunk
// it started in, without which its count means nothing.
import { TlsServerConfig } from "nish/net/tls";
import { TlsTcpServer } from "nish/net/tls-tcp";
import { tcpConfig } from "../net_tls_common/server";

export const main = (): i32 => {
  const config: TlsServerConfig = tcpConfig([]);
  const mark: i64 = Arena.mark();
  const before: i64 = Arena.used();
  const server: TlsTcpServer = new TlsTcpServer(config, toI32(-1), toI32(16384));
  const built: i64 = Arena.used();
  const oneChunk: boolean = Arena.mark() - mark === built - before;
  console.log(`${built - before} ${oneChunk ? "yes" : "no"}`);
  return server.size() === 16384 && server.busy() === 0 && toI32(server.connections.length) === 0 ? 0 : 1;
};
