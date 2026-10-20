// What `Http1Server` costs before its first connection, for the ceiling
// `HTTP1_SERVER_START_BYTES` in `tests/runtime-budgets.js`, which
// `tests/run.js` holds this program's answer to: a pool of 16,384 slots on
// the default `Http1Config`, built on no socket, then the one connection
// `connection(0)` builds for a slot never accepted into. It prints
// `<the pool's bytes> <that connection's bytes> <one chunk>`, the bytes read
// from `Arena.used()`, which counts within the current chunk only: the last
// field says whether the pool fit in the chunk it started in, without which
// its count means nothing.
import { Http1Config, Http1Server } from "nish/net/http1-server";

export const main = (): i32 => {
  const config: Http1Config = new Http1Config();
  const mark: i64 = Arena.mark();
  const before: i64 = Arena.used();
  const server: Http1Server = new Http1Server(config, toI32(-1), toI32(16384));
  const built: i64 = Arena.used();
  const oneChunk: boolean = Arena.mark() - mark === built - before;
  server.connection(toI32(0));
  const one: i64 = Arena.used() - built;
  console.log(`${built - before} ${one} ${oneChunk ? "yes" : "no"}`);
  return server.size() === 16384 && server.busy() === 0 ? 0 : 1;
};
