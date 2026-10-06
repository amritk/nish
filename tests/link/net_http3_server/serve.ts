// Serve mode: an `Http3Server` for a third-party client — `curl --http3`,
// the quic-interop-runner's http3 case — on a real clock with real entropy.
// GET /big/<n> answers n bytes of `h3Pattern`, streamed as the send buffer
// drains; any other GET answers `hello from nish/net/http3`; a request with a
// body is answered, once it has ended, with how many bytes it carried.
import { netLocalPort, pollAdd, pollCreate, pollWait, udpBind } from "nish:net";
import { Secret, secret, wipe } from "nish:secret";
import { QUIC_LISTENER_ENTROPY_SIZE } from "nish/net/quic-listener";
import { httpFieldBytes } from "nish/net/http-fields";
import { H3_DATA, H3_END, H3_ERROR, H3_NEED_MORE, H3_REQUEST, H3_WRITABLE, Http3Config, Http3Connection } from "nish/net/http3";
import { Http3Server } from "nish/net/http3-server";
import { textOf } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import { leafPrivate } from "../net_tls_common/server";
import { H3Limits, h3Pattern, h3QuicConfig } from "../net_http3/peer";

/** One response the server is writing. */
class H3Served {
  slot: i32 = 0;
  id: i64 = 0;
  path: string = "";
  out: u8[];
  at: i32 = 0;
  received: i64 = 0;
  done: boolean = false;

  constructor(slot: i32, id: i64, path: string) {
    this.slot = slot;
    this.id = id;
    this.path = path;
    this.out = [];
  }
}

/** The serving loop's state. */
class H3Serving {
  server: Http3Server;
  streams: H3Served[];
  names: u8[][];
  values: u8[][];

  constructor(server: Http3Server) {
    this.server = server;
    this.streams = [];
    this.names = [httpFieldBytes("content-type"), httpFieldBytes("server")];
    this.values = [httpFieldBytes("text/plain"), httpFieldBytes("nish")];
  }

  /** The response being written on `id` in `slot`, or `null`. */
  find(slot: i32, id: i64): H3Served | null {
    for (const s of this.streams) {
      if (s.slot === slot && s.id === id && !s.done) {
        return s;
      }
    }
    return null;
  }

  /** Writes what `s` still owes, as far as the stream takes it, and the FIN after. */
  push(h3: Http3Connection, s: H3Served): void {
    while (s.at < toI32(s.out.length)) {
      const n: i32 = h3.writeData(s.id, s.out, s.at, toI32(s.out.length) - s.at, true);
      if (n <= 0) {
        return;
      }
      s.at = s.at + n;
    }
    s.done = true;
  }

  /** Every event of `slot`'s connection, answered. */
  serve(slot: i32): void {
    const h3: Http3Connection = this.server.connection(slot);
    let event: i32 = h3.next();
    while (event !== H3_NEED_MORE && event !== H3_ERROR) {
      const id: i64 = h3.stream;
      if (event === H3_REQUEST) {
        this.streams.push(new H3Served(slot, id, textOf(h3.fields.path)));
      } else if (event === H3_DATA) {
        const s: H3Served | null = this.find(slot, id);
        if (s !== null) {
          s.received = s.received + toI64(h3.dataLength);
        }
      } else if (event === H3_END) {
        const s: H3Served | null = this.find(slot, id);
        if (s !== null) {
          h3.respond(id, n32(200), this.names, this.values, false);
          if (s.path.startsWith("/big/")) {
            s.out = h3Pattern(parseInt(s.path.slice(n32(5))));
          } else if (s.received > 0) {
            s.out = httpFieldBytes(`received ${s.received} bytes\n`);
          } else {
            s.out = httpFieldBytes("hello from nish/net/http3\n");
          }
          this.push(h3, s);
        }
      } else if (event === H3_WRITABLE) {
        const s: H3Served | null = this.find(slot, id);
        if (s !== null) {
          this.push(h3, s);
        }
      }
      event = h3.next();
    }
  }
}

/** Milliseconds on the monotonic clock. */
const nowMs = (): i64 => monotonicNanos() / n64(1000000);

/** Serves `count` connections on UDP `port` (0 for any), printing `port <p>` first and a line as each ends, then exits. */
export const serve = (count: i32, port: i32): i32 => {
  const fd: i32 = udpBind("::", port, n32(0));
  if (fd < 0) {
    console.log(`bind failed: ${fd}`);
    return 1;
  }
  const limits = new H3Limits();
  limits.maxStreamData = n64(65536);
  limits.maxData = n64(4194304);
  const entropy: u8[] = new Array<u8>(QUIC_LISTENER_ENTROPY_SIZE);
  crypto.getRandomValues(entropy);
  const server = new Http3Server(h3QuicConfig(limits), new Http3Config(), fd, n32(16), entropy);
  const serving = new H3Serving(server);
  const loop: i32 = pollCreate();
  pollAdd(loop, fd, n32(1), n32(0));
  const ready: i32[] = new Array<i32>(8);
  console.log(`port ${netLocalPort(fd)}`);
  let closed: i32 = 0;
  while (closed < count) {
    pollWait(loop, ready, server.timeout(nowMs()));
    const now: i64 = nowMs();
    const key: Secret<u8[]> = secret(leafPrivate());
    server.receive(now, key);
    wipe(key);
    server.tick(now);
    let slot: i32 = server.ready();
    while (slot >= 0) {
      serving.serve(slot);
      slot = server.ready();
    }
    server.flush(now);
    const ended: i32 = server.accepted - server.busy();
    while (closed < ended) {
      closed++;
      console.log(`connection ${closed} closed`);
    }
  }
  return 0;
};
