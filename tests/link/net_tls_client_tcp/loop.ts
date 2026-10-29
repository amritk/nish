// A `TlsTcpServer` and a `TlsTcpClient` in one readiness loop over loopback:
// the server accepts into a slot and signs as it is told, the client drives
// its own handshake and authenticates the server itself. A client that opens
// writes "ping", sends a KeyUpdate asking for the server's and writes "!"
// under its new key. The server, once it has read "ping!", answers "pong"
// (after the KeyUpdate it owes) and sends a KeyUpdate asking for the
// client's; the client, once it has read "pong", writes "?" after the
// KeyUpdate it owes, and the server, once it has read that, closes with
// close_notify. The client reads that as the end of the stream and closes
// too. Each end counts the KeyUpdates it read. Every wait
// is bounded: five seconds without a wake is a failure, never a hang.
import { Secret, secret, wipe } from "nish:secret";
import { netAddress, netClose, netLocalPort, pollAdd, pollCreate, pollModify, pollWait, tcpListen } from "nish:net";
import { TlsServerConfig, tlsSignEcdsaP256 } from "nish/net/tls";
import { TlsClientConfig } from "nish/net/tls/client";
import { TLS_RECORD_DATA, TLS_RECORD_DONE, TLS_RECORD_SIGN, TlsRecordServer } from "nish/net/tls/record-server";
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
  /** The KeyUpdates each end read, once it ended; -1 until then. */
  serverUpdates: i32 = -1;
  clientUpdates: i32 = -1;
  /** Whether the client opened, what each end read, and whether the client read the end of the server's stream. */
  opened: boolean = false;
  clientGot: string = "";
  serverGot: string = "";
  clientEnded: boolean = false;
  /** The first thing that went wrong, or empty. */
  failure: string = "";
  buf: u8[];

  constructor(config: TlsServerConfig) {
    this.signing = SIGN_LEAF;
    this.ready = new Array<i32>(16);
    this.buf = new Array<u8>(64);
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
    this.opened = false;
    this.clientGot = "";
    this.serverGot = "";
    this.clientEnded = false;
    this.peerAlert = -1;
    this.sawName = "";
    this.chose = "";
    this.serverUpdates = -1;
    this.clientUpdates = -1;
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
          const wants: i32 = this.talk(client, (events & 5) !== 0 ? client.readable() : client.writable());
          if ((wants & TLS_RECORD_DONE) !== 0) {
            clientDone = true;
            this.clientUpdates = client.conn.keyUpdates;
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

  /** The client's side of the exchange once it has opened; answers its interest. */
  talk(client: TlsTcpClient, interest: i32): i32 {
    let wants: i32 = interest;
    if (client.open() && !this.opened) {
      this.opened = true;
      const ping: u8[] = [0x70, 0x69, 0x6e, 0x67];
      client.write(ping, 0, 4);
      client.keyUpdate(true);
      const bang: u8[] = [0x21];
      client.write(bang, 0, 1);
      wants = client.interest();
    }
    while ((wants & TLS_RECORD_DATA) !== 0) {
      const n: i32 = client.read(this.buf, 0, 64);
      if (n === 0) {
        this.clientEnded = true;
        return client.shutdown();
      }
      if (n < 0) {
        return client.interest();
      }
      this.clientGot = this.clientGot + this.text(n);
      if (this.clientGot === "pong") {
        const ask: u8[] = [0x3f];
        client.write(ask, 0, 1);
      }
      wants = client.interest();
    }
    return wants;
  }

  /** The first `n` bytes of `buf`, as text. */
  text(n: i32): string {
    let out: string = "";
    for (let k: i32 = 0; k < n; k++) {
      out = out + String.fromCharCode(this.buf[k]);
    }
    return out;
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
    while ((wants & TLS_RECORD_DATA) !== 0 && (wants & TLS_RECORD_DONE) === 0) {
      const n: i32 = this.server.read(slot, this.buf, 0, 64);
      if (n <= 0) {
        wants = this.server.shutdown(slot);
        break;
      }
      this.serverGot = this.serverGot + this.text(n);
      if (this.serverGot === "ping!") {
        const pong: u8[] = [0x70, 0x6f, 0x6e, 0x67];
        this.server.write(slot, pong, 0, 4);
        this.server.keyUpdate(slot, true);
      } else if (this.serverGot === "ping!?") {
        wants = this.server.shutdown(slot);
        break;
      }
      wants = this.server.interest(slot);
    }
    if ((wants & TLS_RECORD_DONE) !== 0) {
      const conn: TlsRecordServer = this.server.connection(slot);
      this.peerAlert = conn.peerAlert;
      this.sawName = conn.tls.serverName;
      this.chose = conn.tls.alpn;
      this.serverUpdates = conn.keyUpdates;
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
