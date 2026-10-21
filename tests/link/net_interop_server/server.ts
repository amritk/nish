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
//   `WebTransport` bound beside a slot's `Http3Connection` when the slot is
//   first served as `h3`; `app.ts` answers them. Its handshakes sign with the
//   key the caller holds, for the chain it was given.
// - With `watchSignals`, SIGTERM or SIGINT stops the loop: `docker stop`.
import { Secret } from "nish:secret";
import { netLocalPort, pollAdd, pollCreate, pollWait, udpBind } from "nish:net";
import { TLS_SIGNATURE_ECDSA_SECP256R1_SHA256 } from "nish/net/tls/codec";
import { QUIC_CONN_STATIC_KEY_SIZE, QuicServerConfig } from "nish/net/quic";
import { QUIC_LISTENER_ENTROPY_SIZE } from "nish/net/quic-listener";
import { H3_ALPN, Http3Config } from "nish/net/http3";
import { Http3Server } from "nish/net/http3-server";
import { H1_ALPN, Http1Server, Http1TlsServer } from "nish/net/http1-server";
import { tcpConfig } from "../net_tls_common/server";
import { testConfig } from "../net_http1_server/checks";
import { App, H1Loop, TLS_SLOTS } from "../net_http1_server/harness";
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
   * Connections each pool serves at once: QUIC's, HTTP/2's and both
   * HTTP/1.1 pools', the last two no more than `H1_SLOT_LIMIT`. The runner's
   * lossy cases open one QUIC connection per file, and a connection whose
   * CONNECTION_CLOSE was lost keeps its slot until the idle timeout: with 8,
   * eight of those refused every new connection for the rest of the 30
   * seconds. 64 covers the runner's 50. A slot is built on the first
   * connection accepted into it, so `slots` is a ceiling: every pool at 64
   * slots starts at 10.6 MB resident and at 1024 at 104 MB, most of it
   * QUIC's tables (`bench/README.md`, "Pool memory").
   */
  slots: i32 = 64;
  /**
   * One pool to size from `slots` alone: "h1", "h1s", "h2" or "h3", each
   * other pool at a single slot, so `bench/pool-rss.mjs` can tell the
   * pools' memory apart. "" sizes them all.
   */
  only: string = "";
}

/**
 * The most slots an HTTP/1.1 pool takes: `H1Loop`'s tokens put a plain slot
 * below `TLS_SLOTS` and a TLS slot from it up to the plain listener's token.
 */
const H1_SLOT_LIMIT: i32 = TLS_SLOTS;

/** The slots `pool` gets under `options`. */
export const poolSlots = (options: InteropOptions, pool: string): i32 => {
  if (options.only !== "" && options.only !== pool) {
    return 1;
  }
  if ((pool === "h1" || pool === "h1s") && options.slots > H1_SLOT_LIMIT) {
    return H1_SLOT_LIMIT;
  }
  return options.slots;
};

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

/**
 * HTTP/1.1's loop with each pool sized by `poolSlots`. `H1Loop` takes one
 * size for both pools, so when the two differ it is built at one slot, and
 * each pool wanting more, with the app's slot states, is replaced by one of
 * its own size. A replaced pool's one-slot original stays allocated: about
 * 4 kB for plain HTTP/1.1 and 160 kB for HTTPS/1.1 (bench/README.md, "Pool
 * memory").
 */
const newH1Loop = (options: InteropOptions): H1Loop => {
  const plain: i32 = poolSlots(options, "h1");
  const tls: i32 = poolSlots(options, "h1s");
  if (plain === tls) {
    return new H1Loop(testConfig(), tcpConfig([H1_ALPN]), plain, options.h1Port, options.h1sPort);
  }
  const h1 = new H1Loop(testConfig(), tcpConfig([H1_ALPN]), 1, options.h1Port, options.h1sPort);
  h1.app = new App(plain > tls ? plain : tls);
  if (plain > 1) {
    h1.plain = new Http1Server(testConfig(), h1.plainListener, plain);
  }
  if (tls > 1) {
    h1.secure = new Http1TlsServer(tcpConfig([H1_ALPN]), testConfig(), h1.tlsListener, tls);
  }
  return h1;
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
      poolSlots(options, "h3"),
      randomBytes(QUIC_LISTENER_ENTROPY_SIZE)
    );
    const files = new InteropFiles(options.www);
    this.app = new InteropApp(this.h3, files);
    this.h1 = newH1Loop(options);
    this.h1.serving = true;
    this.h2 = new InteropH2(this.loop, "127.0.0.1", options.h2Port, chain, files, poolSlots(options, "h2"));
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
   * timers due, every slot with news, and what each has to send. The
   * HTTP/2 port resumes under the ticket keys `current` and `previous`, lent
   * for the turn, or `null` while its tickets are off.
   */
  step(wait: i32, key: Secret<u8[]>, current: Secret<u8[]> | null, previous: Secret<u8[]> | null): void {
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
        this.h2.serve(who - H2_SLOT_TOKEN, this.ready[2 * i + 1], key, current, previous);
      } else if (who === TOKEN_SIGNAL) {
        this.stopped = true;
      }
    }
    if (this.udp < 0) {
      return;
    }
    const nanos: i64 = monotonicNanos();
    const now: i64 = nanos / toI64(1000000);
    this.h3.clock(nanos / toI64(1000));
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
