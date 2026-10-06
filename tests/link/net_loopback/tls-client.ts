// The Nish TLS 1.3 client the TCP checks speak through: `net_tls_common`'s
// ClientHello and handshake arithmetic and `net_tls_record_common`'s record
// protection, on a socket of the loop. It is the handshake the HTTP/2 lane's
// own client performs (`net_http2_tls/checks.ts`, whose class is not
// exported), restated over `TcpLoop`, and after it a byte stream: what it
// sends is sealed into records of at most 16,000 bytes, and what the server
// sends is opened record by record into `plain`, its alerts noted.
import { TLS_CHACHA20_POLY1305_SHA256 } from "nish/net/tls/schedule";
import { TLS_CONTENT_ALERT, TLS_CONTENT_APPLICATION_DATA, TLS_CONTENT_HANDSHAKE, TlsRecordProtection } from "nish/net/tls/record";
import { TLS_GROUP_X25519, TLS_SIGNATURE_ECDSA_SECP256R1_SHA256, TLS_VERSION_13 } from "nish/net/tls/codec";
import { leafPublic } from "../net_tls_common/server";
import { clientFinish, clientHello, clientShare, extAlpn, extKeyShare, extSignatureAlgorithms, extSupportedGroups, extSupportedVersions } from "../net_tls_common/client";
import { Opened, ZERO, join, openOne, protectionFor, range, sealOne } from "../net_tls_record_common/bytes";
import { clearRecord, clientKeysFor } from "../net_tls_record_common/client";
import { TcpLoop } from "./tcp";

/** The suite every client here offers. */
const SUITE: i32 = TLS_CHACHA20_POLY1305_SHA256;

/** The most plaintext the client seals into one record. */
const RECORD: i32 = 16000;

/** One client: its socket in the loop, its record keys, and what the server has sent it. */
export class TlsClient {
  lp: TcpLoop;
  index: i32 = -1;
  read: TlsRecordProtection;
  write: TlsRecordProtection;
  /** Whether the server's CertificateVerify and Finished both verified. */
  verified: boolean = false;
  /** The alerts the server sent, as `level description`. */
  alerts: string[];
  /** Application data opened and not yet taken. */
  plain: u8[];

  constructor(lp: TcpLoop) {
    this.lp = lp;
    this.read = new TlsRecordProtection();
    this.write = new TlsRecordProtection();
    this.alerts = [];
    this.plain = [];
  }

  /** Connects and completes a TLS 1.3 handshake offering `alpn` (none when empty); false when anything went wrong. */
  handshake(alpn: string[]): boolean {
    this.index = this.lp.connect();
    if (this.index < 0) {
      return false;
    }
    const extensions: u8[][] = [
      extSupportedVersions([TLS_VERSION_13]),
      extSupportedGroups([TLS_GROUP_X25519]),
      extSignatureAlgorithms([TLS_SIGNATURE_ECDSA_SECP256R1_SHA256]),
      extKeyShare([TLS_GROUP_X25519], [clientShare()]),
    ];
    if (toI32(alpn.length) > 0) {
      extensions.push(extAlpn(alpn));
    }
    const hello: u8[] = clientHello([SUITE], extensions);
    this.lp.send(this.index, clearRecord(hello));
    const serverHello: u8[] = this.lp.nextRecord(this.index);
    if (toI32(serverHello.length) < 5) {
      return false;
    }
    const helloBody: u8[] = range(serverHello, toI32(5), toI32(serverHello.length));
    const keys = clientKeysFor(32, hello, helloBody);
    const flight: Opened = openOne(protectionFor(SUITE, keys.serverHandshake), this.lp.nextRecord(this.index));
    const view = clientFinish(32, hello, helloBody, flight.content, leafPublic());
    this.verified = view.signatureVerifies && view.serverFinishedVerifies;
    keys.finishWith(flight.content);
    this.read.install(SUITE, keys.serverApplication);
    this.write.install(SUITE, keys.clientApplication);
    this.lp.send(this.index, sealOne(protectionFor(SUITE, keys.clientHandshake), TLS_CONTENT_HANDSHAKE, keys.finished, ZERO));
    return this.verified;
  }

  /** Seals `bytes` into application-data records and sends them, running the loop while the socket is full. */
  send(bytes: u8[]): void {
    const records: u8[][] = [];
    for (let at: i32 = 0; at < toI32(bytes.length); at += RECORD) {
      const end: i32 = at + RECORD < toI32(bytes.length) ? at + RECORD : toI32(bytes.length);
      records.push(sealOne(this.write, TLS_CONTENT_APPLICATION_DATA, range(bytes, at, end), ZERO));
    }
    this.lp.send(this.index, join(records));
  }

  /** Sends the client's close_notify. */
  closeNotify(): void {
    this.lp.send(this.index, sealOne(this.write, TLS_CONTENT_ALERT, [toU8(1), toU8(0)], ZERO));
  }

  /** Opens the next record the server sends; false on a timeout or the end of the stream. */
  pump(): boolean {
    const record: u8[] = this.lp.nextRecord(this.index);
    if (toI32(record.length) === 0) {
      return false;
    }
    const opened: Opened = openOne(this.read, record);
    if (opened.type === TLS_CONTENT_ALERT && toI32(opened.content.length) === 2) {
      this.alerts.push(`${opened.content[0]} ${opened.content[1]}`);
    } else if (opened.type === TLS_CONTENT_APPLICATION_DATA) {
      for (const b of opened.content) {
        this.plain.push(b);
      }
    } else {
      this.alerts.push(`record ${opened.type} alert ${opened.alert}`);
    }
    return true;
  }

  /** Opens records until `plain` holds at least `n` bytes, an alert arrives, or the stream ends. */
  awaitPlain(n: i32): boolean {
    while (toI32(this.plain.length) < n && toI32(this.alerts.length) === 0) {
      if (!this.pump()) {
        return false;
      }
    }
    return toI32(this.plain.length) >= n;
  }

  /** The first `n` bytes of `plain`, taken out. */
  take(n: i32): u8[] {
    const out: u8[] = range(this.plain, ZERO, n);
    this.plain = range(this.plain, n, toI32(this.plain.length));
    return out;
  }

  /** Opens records until an alert arrives or the stream ends; answers the alerts joined. */
  awaitAlert(): string {
    while (toI32(this.alerts.length) === 0) {
      if (!this.pump()) {
        break;
      }
    }
    return this.alerts.join(",");
  }
}
