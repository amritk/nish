// What `Http3Server` costs before its first connection, for the ceiling
// `HTTP3_SERVER_START_BYTES` and the exact `HTTP3_SERVER_SLOT_BYTES` in
// `tests/runtime-budgets.js`, which `tests/run.js` holds this program's
// answer to: a pool of 65,536 slots, the
// most it takes, on the test configuration and no socket, then the one slot
// `connection(0)` builds for a slot never accepted into. It prints
// `<the pool's bytes> <that slot's bytes> <one chunk>`, the bytes read from
// `Arena.used()`, which counts within the current chunk only. The server's
// 64 KB receive buffer alone outgrows a default chunk, so the program first
// makes one chunk large enough for the whole pool and empties it with
// `Arena.reset()`; the last field says whether the pool fit in it, without
// which its count means nothing.
import { QUIC_LISTENER_ENTROPY_SIZE } from "nish/net/quic-listener";
import { Http3Server } from "nish/net/http3-server";
import { h3Config, H3Limits, h3QuicConfig } from "../net_http3/peer";

export const main = (): i32 => {
  const room: u8[] = new Array<u8>(toI32(64 * 1024 * 1024));
  room[0] = 1;
  Arena.reset();
  const mark: i64 = Arena.mark();
  const before: i64 = Arena.used();
  const server: Http3Server = new Http3Server(
    h3QuicConfig(new H3Limits()),
    h3Config(),
    toI32(-1),
    toI32(65536),
    new Array<u8>(QUIC_LISTENER_ENTROPY_SIZE)
  );
  const built: i64 = Arena.used();
  const oneChunk: boolean = Arena.mark() - mark === built - before;
  server.connection(toI32(0));
  const one: i64 = Arena.used() - built;
  console.log(`${built - before} ${one} ${oneChunk ? "yes" : "no"}`);
  return server.size() === 65536 && server.busy() === 0 && server.quics.length === 1 ? 0 : 1;
};
