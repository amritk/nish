// The server both halves of `net_quic_lifecycle_replay` run: a
// `QuicListener` in front of at most one `QuicConnection`, with fixed
// entropy and static keys, and the echo application of
// `net_quic_conn_replay`. What each scenario changes is here too: Retry on,
// a three-second idle timeout, a connection forgotten as a restart would
// forget it, and a key update the server starts. The live server and the
// replay both call `datagram` and `timer`, so a recording is a transcript of
// exactly this code.
import { Secret, secret, wipe } from "nish:secret";
import { quicParseHeader, QuicHeader } from "nish/net/quic-packet";
import {
  QUIC_CONN_CID_LENGTH,
  QUIC_STATE_DRAINING,
  QUIC_STATE_TIMED_OUT,
  QuicConnection,
  QuicServerConfig,
  QuicStreamData,
} from "nish/net/quic";
import { QUIC_LISTEN_ACCEPT, QUIC_LISTEN_STATELESS_RESET, QuicListener, QuicListenerAnswer } from "nish/net/quic-listener";
import { tlsSignEcdsaP256 } from "nish/net/tls";
import { leafPrivate } from "../net_tls_common/server";
import { textOf } from "../crypto_x509/hex";
import { echoConfig, fixedEntropy } from "../net_quic_conn_replay/server";
import { lcKindName, lcListenerEntropy } from "../net_quic_lifecycle/common";

/** What one datagram or timer made the server do: the transcript lines it printed, and the datagrams it sent. */
export class LcServed {
  lines: string[];
  out: u8[][];
  /** Whether the scenario is over. */
  done: boolean = false;

  constructor() {
    this.lines = [];
    this.out = [];
  }
}

/** The configuration of `scenario`: the echo's, with Retry on or a short idle timeout where the scenario needs it. */
const lcScenarioConfig = (scenario: string): QuicServerConfig => {
  const config: QuicServerConfig = echoConfig();
  config.retry = scenario === "retry";
  if (scenario === "idle") {
    config.maxIdleTimeout = toI64(3000);
  }
  return config;
};

/** One scenario's server. */
export class LcServer {
  scenario: string;
  config: QuicServerConfig;
  listener: QuicListener;
  conn: QuicConnection | null = null;

  constructor(scenario: string) {
    this.scenario = scenario;
    this.config = lcScenarioConfig(scenario);
    this.listener = new QuicListener(this.config, lcListenerEntropy());
  }

  /** When the connection's next timer is due, or -1. */
  deadline(): i64 {
    const conn: QuicConnection | null = this.conn;
    return conn === null ? toI64(-1) : conn.deadline();
  }

  /**
   * One datagram from `address` at `now`: to the connection that owns its
   * first packet's DCID, else to the listener, which may make one.
   */
  datagram(datagram: u8[], address: u8[], now: i64): LcServed {
    const served = new LcServed();
    const header: QuicHeader = quicParseHeader(datagram, 0, QUIC_CONN_CID_LENGTH);
    const conn: QuicConnection | null = this.conn;
    if (conn === null || !conn.ownsConnectionId(header.dcid)) {
      const answer: QuicListenerAnswer = this.listener.handle(datagram, address, now);
      served.lines.push(`l ${lcKindName(answer.kind)}`);
      if (toI32(answer.reply.length) > 0) {
        served.out.push(answer.reply);
      }
      if (answer.kind === QUIC_LISTEN_STATELESS_RESET) {
        served.lines.push("x reset");
        served.done = true;
      }
      if (answer.kind !== QUIC_LISTEN_ACCEPT) {
        return served;
      }
      const fresh = new QuicConnection(this.config, fixedEntropy());
      if (answer.retried) {
        fresh.acceptRetry(answer.originalDcid, answer.retryScid);
      }
      this.conn = fresh;
      this.serve(fresh, datagram, now, served);
      return served;
    }
    this.serve(conn, datagram, now, served);
    return served;
  }

  /** Runs the connection's timers at `now`. */
  timer(now: i64): LcServed {
    const served = new LcServed();
    const conn: QuicConnection | null = this.conn;
    if (conn === null) {
      return served;
    }
    conn.handleTimer(now);
    if (conn.state === QUIC_STATE_TIMED_OUT) {
      served.lines.push("x idle");
      served.done = true;
    }
    return served;
  }

  /** The connection's part: receive, sign, echo (starting a key update first where the scenario does), send. */
  serve(conn: QuicConnection, datagram: u8[], now: i64, served: LcServed): void {
    conn.receive(datagram, now);
    const input: u8[] | null = conn.signatureInput();
    if (input !== null) {
      const key: Secret<u8[]> = secret(leafPrivate());
      const signature: u8[] | null = tlsSignEcdsaP256(key, input);
      wipe(key);
      if (signature !== null) {
        conn.sign(signature);
      }
    }
    let finished: boolean = false;
    let data: QuicStreamData | null = conn.readStream();
    while (data !== null) {
      if (this.scenario === "keys" && conn.updateKeys()) {
        served.lines.push(`k the server starts a key update, to phase ${conn.writePhase ? 1 : 0}`);
      }
      served.lines.push(`e stream ${data.streamId}: "${textOf(data.data)}"${data.fin ? " fin" : ""}`);
      conn.writeStream(data.streamId, data.data, data.fin);
      finished = finished || data.fin;
      data = conn.readStream();
    }
    let out: u8[] | null = conn.takeDatagram(now);
    while (out !== null) {
      served.out.push(out);
      out = conn.takeDatagram(now);
    }
    if (conn.state === QUIC_STATE_DRAINING) {
      served.lines.push(`x ${conn.error}`);
      served.done = true;
    } else if (this.scenario === "reset" && finished) {
      // The server loses the connection as a restart would; the static key stays.
      served.lines.push("x forget");
      conn.release();
      this.conn = null;
    }
  }
}
