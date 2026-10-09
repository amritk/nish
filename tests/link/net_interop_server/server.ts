// The Nish interop server: every carrier of `nish/net` behind one readiness
// loop, for the third-party clients of the interop job (`tests/interop/`) and
// for the in-process smoke checks of `checks.ts`.
//
// - HTTP/1.1, plain and over TLS, is `tests/link/net_http1_server`'s loop
//   (`H1Loop`, routes `/hello`, `/echo`, `/big`, `/sink`, `/ws`), which owns
//   a readiness loop of its own; that loop's descriptor is in this one, so a
//   wake here steps it, and its own wait returns at once. It listens on
//   127.0.0.1 and serves the test leaf of `tests/link/net_tls_common`, as its
//   serve mode does.
// - HTTP/2 over TLS is `h2.ts`, in this loop, with the QUIC side's chain and
//   key. `tests/link/net_http2_tls`'s serve mode is not reused: its program
//   writes a body once and never again after `H2_WINDOW`, so a body a
//   flow-control window holds back never finishes, which is four of h2spec's
//   cases.
// - QUIC is one `Http3Server` on UDP, offering `h3` and `hq-interop`, with a
//   `WebTransport` beside each slot's `Http3Connection`; `app.ts` answers
//   them. Its handshakes sign with the key the caller holds, for the chain it
//   was given.
// - With `watchSignals`, SIGTERM or SIGINT stops the loop: `docker stop`.
import { Secret } from "nish:secret";
import { netLocalPort, pollAdd, pollCreate, pollWait, udpBind } from "nish:net";
import { TLS_SIGNATURE_ECDSA_SECP256R1_SHA256 } from "nish/net/tls/codec";
import { QUIC_CONN_STATIC_KEY_SIZE, QuicServerConfig } from "nish/net/quic";
import { QUIC_LISTENER_ENTROPY_SIZE } from "nish/net/quic-listener";
import { H3_ALPN, Http3Config } from "nish/net/http3";
import { Http3Server } from "nish/net/http3-server";
import { WebTransport, WebTransportConfig } from "nish/net/webtransport";
import { H1_ALPN } from "nish/net/http1-server";
import { tcpConfig } from "../net_tls_common/server";
import { testConfig } from "../net_http1_server/checks";
import { H1Loop } from "../net_http1_server/harness";
import { HQ_ALPN, InteropApp } from "./app";
import { InteropFiles } from "./files";
import { H2_LISTEN_TOKEN, H2_SLOT_TOKEN, InteropH2 } from "./h2";

/** The tokens of this loop's descriptors. */
const TOKEN_QUIC: i32 = 1;
const TOKEN_H1: i32 = 2;
const TOKEN_SIGNAL: i32 = 4;

/** What the server is started with. */
export class InteropOptions {
  /** The directory files are served from, or "" for none. */
  www: string = "";
  /** The quic-interop-runner's `TESTCASE`, or "" outside the runner. */
  testcase: string = "";
  /** The address and port QUIC listens on; 0 for any free port. */
  host: string = "::";
  quicPort: i32 = 0;
  /** HTTP/1.1's plain and TLS ports and HTTP/2's, on 127.0.0.1; 0 for any free port. */
  h1Port: i32 = 0;
  h1sPort: i32 = 0;
  h2Port: i32 = 0;
  /**
   * QUIC connections served at once. The runner's lossy cases open one
   * connection per file, and a connection whose CONNECTION_CLOSE was lost
   * keeps its slot until the idle timeout: with 8, eight of those refused
   * every new connection for the rest of the 30 seconds. 64 covers the
   * runner's 50 at about 6.6 MB of memory each (495 MB resident, 122 MB with 8).
   */
  slots: i32 = 64;
}

/** Milliseconds on the monotonic clock. */
const nowMs = (): i64 => monotonicNanos() / toI64(1000000);

/** Fresh random bytes, `n` of them. */
const randomBytes = (n: i32): u8[] => {
  const out: u8[] = new Array<u8>(n);
  crypto.getRandomValues(out);
  return out;
};

/**
 * The quic-interop-runner test cases this server takes, by the `TESTCASE` a
 * server is handed (the runner's `keyupdate`, `multiplexing`, `transferloss`
 * and `blackhole` reach a server as `transfer`, and `handshakeloss` as
 * `multiconnect`), and "" outside the runner. Every other case — resumption,
 * 0-RTT, migration, rebinding, v2, ECN — is out of scope, and the runner is
 * told so by exit 127.
 */
export const supportedTestcase = (name: string): boolean =>
  name === "" ||
  name === "handshake" ||
  name === "transfer" ||
  name === "retry" ||
  name === "chacha20" ||
  name === "multiconnect" ||
  name === "http3";

/**
 * The QUIC configuration: `h3` and `hq-interop`, DATAGRAM frames for
 * WebTransport, a Retry for the runner's `retry` case, and stream limits under
 * the runner's 1,000 for `multiplexing`, which the server raises as streams
 * finish.
 */
const interopQuicConfig = (chain: u8[][], retry: boolean): QuicServerConfig => {
  return {
    certificateChain: chain,
    alpn: [H3_ALPN, HQ_ALPN],
    signatureScheme: TLS_SIGNATURE_ECDSA_SECP256R1_SHA256,
    maxData: toI64(16777216),
    maxStreamData: toI64(65536),
    maxStreamsBidi: toI64(64),
    maxStreamsUni: toI64(8),
    localStreams: toI64(8),
    maxDatagramFrameSize: toI64(1200),
    maxIdleTimeout: toI64(30000),
    activeConnectionIdLimit: toI64(4),
    statelessResetKey: randomBytes(QUIC_CONN_STATIC_KEY_SIZE),
    retryTokenKey: randomBytes(QUIC_CONN_STATIC_KEY_SIZE),
    retry: retry,
    retryTokenLifetime: toI64(10000),
  };
};

/** The loop and every server in it. */
export class InteropServer {
  h1: H1Loop;
  h2: InteropH2;
  h3: Http3Server;
  app: InteropApp;
  ready: i32[];
  loop: i32 = -1;
  udp: i32 = -1;
  quicPort: i32 = 0;
  /** QUIC connections that have ended, for the log. */
  quicClosed: i32 = 0;
  /** Whether a signal asked the loop to stop. */
  stopped: boolean = false;
  /** Whether each QUIC connection's end is printed. */
  logging: boolean = false;

  /** Every server, listening; `udp` is negative when the QUIC socket could not be bound. */
  constructor(options: InteropOptions, chain: u8[][]) {
    this.ready = new Array<i32>(16);
    this.loop = pollCreate();
    this.udp = udpBind(options.host, options.quicPort, toI32(0));
    this.quicPort = this.udp >= 0 ? netLocalPort(this.udp) : 0;
    const h3Config = new Http3Config();
    h3Config.webtransportSessions = 4;
    this.h3 = new Http3Server(
      interopQuicConfig(chain, options.testcase === "retry"),
      h3Config,
      this.udp,
      options.slots,
      randomBytes(QUIC_LISTENER_ENTROPY_SIZE)
    );
    const wts: WebTransport[] = [];
    for (let slot: i32 = 0; slot < this.h3.size(); slot++) {
      wts.push(new WebTransport(new WebTransportConfig(), this.h3.connection(slot)));
    }
    const files = new InteropFiles(options.www);
    this.app = new InteropApp(this.h3, wts, files);
    this.h1 = new H1Loop(testConfig(), tcpConfig([H1_ALPN]), 16, options.h1Port, options.h1sPort);
    this.h1.serving = true;
    this.h2 = new InteropH2(this.loop, "127.0.0.1", options.h2Port, chain, files, toI32(64));
    if (this.udp >= 0) {
      pollAdd(this.loop, this.udp, 1, TOKEN_QUIC);
    }
    pollAdd(this.loop, this.h1.loop, 1, TOKEN_H1);
  }

  /** Stops the loop on SIGTERM or SIGINT. */
  watchSignals(): void {
    const fd: i32 = signalFd();
    if (fd >= 0) {
      pollAdd(this.loop, fd, 1, TOKEN_SIGNAL);
    }
  }

  /** The line a client reads the ports from. */
  ports(): string {
    return `ports quic ${this.quicPort} h1 ${this.h1.plainPort} h1s ${this.h1.tlsPort} h2 ${this.h2.port}`;
  }

  /**
   * One turn of the loop: waits up to `wait` milliseconds (or less, for
   * QUIC's next timer), steps whichever TCP loop is ready, and runs QUIC —
   * every datagram waiting, signed with `key` where a handshake asks, the
   * timers due, every slot with news, and what each has to send.
   */
  step(wait: i32, key: Secret<u8[]>): void {
    let timeout: i32 = this.h3.timeout(nowMs());
    if (timeout < 0 || timeout > wait) {
      timeout = wait;
    }
    const n: i32 = pollWait(this.loop, this.ready, timeout);
    for (let i: i32 = 0; i < n; i++) {
      const who: i32 = this.ready[2 * i];
      if (who === TOKEN_H1) {
        this.h1.failure = "";
        this.h1.step(toI32(-1));
      } else if (who === H2_LISTEN_TOKEN) {
        this.h2.acceptAll();
      } else if (who >= H2_SLOT_TOKEN) {
        this.h2.serve(who - H2_SLOT_TOKEN, this.ready[2 * i + 1], key);
      } else if (who === TOKEN_SIGNAL) {
        this.stopped = true;
      }
    }
    if (this.udp < 0) {
      return;
    }
    const now: i64 = nowMs();
    this.h3.receive(now, key);
    this.h3.tick(now);
    let slot: i32 = this.h3.ready();
    while (slot >= 0) {
      this.app.serve(slot);
      slot = this.h3.ready();
    }
    this.h3.flush(now);
    const ended: i32 = this.h3.accepted - this.h3.busy();
    while (this.quicClosed < ended) {
      this.quicClosed = this.quicClosed + 1;
      if (this.logging) {
        console.log(`quic connection ${this.quicClosed} closed`);
      }
    }
  }
}
