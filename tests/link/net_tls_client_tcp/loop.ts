// A `TlsTcpServer` and a `TlsTcpClient` in one readiness loop over loopback:
// the server accepts into a slot and signs as it is told, the client drives
// its own handshake and authenticates the server itself. Every wait is
// bounded: five seconds without a wake is a failure, never a hang.
import { Secret, secret, wipe } from "nish:secret";
import { netAddress, netClose, netLocalPort, pollAdd, pollCreate, pollModify, pollWait, tcpListen } from "nish:net";
import { TlsServerConfig, tlsSignEcdsaP256 } from "nish/net/tls";
import { TlsClientConfig } from "nish/net/tls/client";
import { TLS_RECORD_DONE, TLS_RECORD_SIGN, TlsRecordServer } from "nish/net/tls/record-server";
import { TlsClientTrust } from "nish/net/tls/verify";
import { TlsTcpClient, TlsTcpServer } from "nish/net/tls-tcp";
import { leafPrivate, serverPrivate, serverRandom } from "../net_tls_common/server";

const LISTENER: i32 = 1000;
const CLIENT: i32 = 2000;

/** How the server signs its CertificateVerify: with the leaf key, or with the leaf key over other bytes. */
export const SIGN_LEAF: i32 = 0;
export const SIGN_OTHER: i32 = 1;

/** One server, one client at a time, and the loop between them. */
export class Loop {
  loop: i32 = -1;
  listener: i32 = -1;
  port: i32 = 0;
  server: TlsTcpServer;
  signing: i32;
  ready: i32[];
  /** The slot the latest accept took, or -1. */
  slot: i32 = -1;
  /** Whether the server's slot has ended and been closed. */
  serverDone: boolean = false;
  /** What the slot's connection said once it ended: the alert it read, the name it saw, the protocol it chose. */
  peerAlert: i32 = -1;
  sawName: string = "";
  chose: string = "";
  /** The first thing that went wrong, or empty. */
  failure: string = "";

  constructor(config: TlsServerConfig) {
    this.signing = SIGN_LEAF;
    this.ready = new Array<i32>(16);
    this.loop = pollCreate();
    this.listener = tcpListen("127.0.0.1", 0, 4);
    this.port = netLocalPort(this.listener);
    this.server = new TlsTcpServer(config, this.listener, 1);
    pollAdd(this.loop, this.listener, 1, LISTENER);
  }

  /** The server's address, as `nish:net` writes it. */
  address(): u8[] {
    const addr: u8[] = new Array<u8>(18);
    netAddress(addr, "127.0.0.1", this.port);
    return addr;
  }

  /**
   * Runs `config`'s client against the server until both have ended, under
   * `trust`; answers the client, closed.
   */
  run(config: TlsClientConfig, trust: TlsClientTrust): TlsTcpClient {
    this.slot = -1;
    this.serverDone = false;
    const client = new TlsTcpClient(this.address(), config, trust);
    let clientDone: boolean = client.fd() < 0;
    if (!clientDone) {
      pollAdd(this.loop, client.fd(), client.interest() & 3, CLIENT);
    }
    let rounds: i32 = 0;
    while ((!clientDone || (this.slot >= 0 && !this.serverDone)) && rounds < 200) {
      rounds = rounds + 1;
      const n: i32 = pollWait(this.loop, this.ready, 5000);
      if (n <= 0) {
        this.failure = "timed out: a wake was lost";
        break;
      }
      for (let i: i32 = 0; i < n; i++) {
        const who: i32 = this.ready[2 * i];
        const events: i32 = this.ready[2 * i + 1];
        if (who === LISTENER) {
          this.accept();
        } else if (who === CLIENT && !clientDone) {
          const wants: i32 = (events & 5) !== 0 ? client.readable() : client.writable();
          if ((wants & TLS_RECORD_DONE) !== 0) {
            clientDone = true;
            client.close();
          } else {
            pollModify(this.loop, client.fd(), wants & 3, CLIENT);
          }
        } else if (who === this.slot && !this.serverDone) {
          this.serve(events);
        }
      }
    }
    if (!clientDone) {
      client.close();
    }
    return client;
  }

  /** Accepts the waiting connection into the pool's one slot. */
  accept(): void {
    const slot: i32 = this.server.accept(serverRandom(), serverPrivate());
    if (slot >= 0) {
      this.slot = slot;
      pollAdd(this.loop, this.server.fd(slot), 1, slot);
    }
  }

  /** The slot's descriptor is ready: drive it, sign when asked, close it once it is done. */
  serve(events: i32): void {
    const slot: i32 = this.slot;
    let wants: i32 = (events & 5) !== 0 ? this.server.readable(slot) : this.server.writable(slot);
    if ((wants & TLS_RECORD_SIGN) !== 0) {
      wants = this.sign(slot);
    }
    if ((wants & TLS_RECORD_DONE) !== 0) {
      const conn: TlsRecordServer = this.server.connection(slot);
      this.peerAlert = conn.peerAlert;
      this.sawName = conn.tls.serverName;
      this.chose = conn.tls.alpn;
      this.server.close(slot);
      this.serverDone = true;
      return;
    }
    pollModify(this.loop, this.server.fd(slot), wants & 3, slot);
  }

  /** The CertificateVerify, signed the way this loop was told to. */
  sign(slot: i32): i32 {
    const key: Secret<u8[]> = secret(leafPrivate());
    if (this.signing === SIGN_LEAF) {
      const wants: i32 = this.server.signP256(slot, key);
      wipe(key);
      return wants;
    }
    const other: u8[] = [1, 2, 3];
    const signature: u8[] | null = tlsSignEcdsaP256(key, other);
    wipe(key);
    const none: u8[] = [];
    return this.server.sign(slot, signature === null ? none : signature);
  }

  /** Closes every socket the loop made. */
  shutdown(): void {
    netClose(this.listener);
    netClose(this.loop);
  }
}
