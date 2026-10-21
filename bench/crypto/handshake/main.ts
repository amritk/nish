// The handshake family's Nish program: one full TLS 1.3 handshake and one
// QUIC v1 handshake, client and server in this one process, each followed by
// one application record echoed back, under the contract in
// bench/crypto/README.md. bench/crypto/run.mjs builds it with `--profile
// speed` and runs
//
//   main <kernel> <size> <iterations>
//
// std/net has the server side of both protocols and no client, so the client
// here is the one tests/link drives them with, imported rather than copied:
// its hello, its x25519 share and secrets, its record and packet protection.
// What this file adds is the order a benchmark needs: one x25519 a side per
// handshake, the leaf's key read out of the Certificate the server sent, and
// the echo. The inputs and the checksum are in this family's README.md.
import { Secret, secret, wipe } from "nish:secret"
import { p256VerifySha256 } from "nish/crypto/p256"
import { X509Certificate, x509DerSignatureRS, x509ParseCertificate } from "nish/crypto/x509"
import { QuicConnection, QuicStreamData } from "nish/net/quic"
import { quicEncodeTransportParameters } from "nish/net/quic-conn-params"
import { QUIC_FRAME_STREAM, quicPushStream } from "nish/net/quic-frame"
import { TlsServer, tlsSignEcdsaP256 } from "nish/net/tls"
import { TLS_EXT_KEY_SHARE } from "nish/net/tls/codec"
import { TLS_CONTENT_APPLICATION_DATA, TLS_CONTENT_HANDSHAKE } from "nish/net/tls/record"
import { TLS_RECORD_SIGN, TLS_RECORD_STATE_OPEN, TlsRecordServer } from "nish/net/tls/record-server"
import { TLS_AES_128_GCM_SHA256 } from "nish/net/tls/schedule"
import { fromHex } from "../../../tests/link/crypto_x509/hex"
import {
  cat,
  clientHello,
  splitMessages,
  standardExtensions,
  transcriptHash,
} from "../../../tests/link/net_tls_common/client"
import {
  leafPrivate,
  serverPrivate,
  serverRandom,
  tcpConfig,
} from "../../../tests/link/net_tls_common/server"
import { clearRecord, splitRecords } from "../../../tests/link/net_tls_record_common/client"
import {
  drain,
  feed,
  join,
  openOne,
  protectionFor,
  range,
  sealOne,
  ZERO,
} from "../../../tests/link/net_tls_record_common/bytes"
import { H, Session, sessionFor } from "../../../tests/link/net_tls_resume/client"
import { quicKeysOf } from "../../../tests/link/net_quic_common/keys"
import {
  CLIENT_SCID,
  QcClient,
  qcAead,
  qcCrypto,
  qcDrain,
  qcExchange,
  qcHandshake,
  qcHello,
  qcInitial,
  qcParams,
  qcReceive,
  qcShort,
} from "../../../tests/link/net_quic_conn/client"
import { QcFound, qcData, qcDefaultConfig, qcFind, qcServer } from "../../../tests/link/net_quic_conn/common"
import { Args, baseOf, fold, foldStart, Inputs, inputs, now, parseArgs, report, tweak } from "../lib/gen"

/** The ALPN the QUIC server in tests/link speaks, and the twins offer. */
const ALPN: string = "nish-echo"

/** A QUIC client's Initial is padded to this many bytes (RFC 9000 §14.1). */
const INITIAL_DATAGRAM: i32 = 1200

/** The credit the QUIC client gives the server's streams. */
const CLIENT_CREDIT: i64 = 65536

/** CertificateVerify's 64 spaces, its context string and the zero byte (RFC 8446 §4.4.3), as hex. */
const SERVER_CONTEXT_HEX: string =
  "20202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020544c5320312e332c2073657276657220436572746966696361746556657269667900"

/** The 16-bit value at `at` in `b`, big-endian, or -1 past its end. */
const u16At = (b: u8[], at: i32): i32 => {
  if (at < 0 || at + 2 > toI32(b.length)) {
    return -1
  }
  return (toI32(b[at]) << 8) | toI32(b[at + 1])
}

/**
 * What the ServerHello `sh` (its 4-byte header included) negotiated, as the
 * checksum folds it: the suite's two bytes, then the key_share group's two.
 * Empty when it carries no key_share.
 */
const negotiated = (sh: u8[]): u8[] => {
  // Header 4, version 2, random 32, then the session id's length byte.
  const session: i32 = 38
  if (session >= toI32(sh.length)) {
    return []
  }
  const suiteAt: i32 = session + 1 + toI32(sh[session])
  // The suite, the compression byte, the extensions' length; then the extensions.
  let at: i32 = suiteAt + 5
  while (at + 4 <= toI32(sh.length)) {
    const type: i32 = u16At(sh, at)
    if (type === TLS_EXT_KEY_SHARE) {
      return [sh[suiteAt], sh[suiteAt + 1], sh[at + 4], sh[at + 5]]
    }
    at = at + 4 + u16At(sh, at + 2)
  }
  return []
}

/**
 * Whether the server's encrypted flight `flight` (EncryptedExtensions,
 * Certificate, CertificateVerify, Finished) carries a P-256 leaf whose key
 * the CertificateVerify signature verifies under, over the transcript
 * `session` holds. The chain is not validated, as no twin validates it: the
 * leaf the tests sign with expired on 2026-01-02.
 */
const certificateVerifies = (session: Session, flight: u8[]): boolean => {
  const messages: u8[][] = splitMessages(flight)
  if (toI32(messages.length) !== 4) {
    return false
  }
  const certificate: u8[] = messages[1]
  // Header 4, the request context's length 1 (empty), the list's length 3, the first entry's length 3.
  const derAt: i32 = 11
  if (toI32(certificate.length) < derAt) {
    return false
  }
  const derLength: i32 = (toI32(certificate[8]) << 16) | (toI32(certificate[9]) << 8) | toI32(certificate[10])
  const leaf: X509Certificate | null = x509ParseCertificate(range(certificate, derAt, derAt + derLength))
  if (leaf === null) {
    return false
  }
  if (!leaf.p256) {
    return false
  }
  const content: u8[] = cat([
    fromHex(SERVER_CONTEXT_HEX),
    transcriptHash(H, cat([session.transcript, messages[0], certificate])),
  ])
  // CertificateVerify: header 4, scheme 2, length 2, then the DER signature.
  const rs: u8[] | null = x509DerSignatureRS(range(messages[2], 8, toI32(messages[2].length)))
  return rs !== null && p256VerifySha256(leaf.publicKey, content, rs)
}

/** The server's CertificateVerify, signed with the leaf's key, which the server never holds itself. */
const signFor = (input: u8[] | null): u8[] => {
  const none: u8[] = []
  if (input === null) {
    return none
  }
  const key: Secret<u8[]> = secret(leafPrivate())
  const signature: u8[] | null = tlsSignEcdsaP256(key, input)
  wipe(key)
  return signature === null ? none : signature
}

/**
 * One TLS 1.3 handshake over a fresh `TlsRecordServer`, then `msg` sealed by
 * the client, read and written back by the server, and opened by the client.
 * Answers what the checksum folds, or empty when a step failed.
 */
const tlsOnce = (msg: u8[]): u8[] => {
  const none: u8[] = []
  const conn = new TlsRecordServer(new TlsServer(tcpConfig([]), serverRandom(), serverPrivate()))
  const hello: u8[] = clientHello([TLS_AES_128_GCM_SHA256], standardExtensions())
  feed(conn, clearRecord(hello))
  if ((conn.interest() & TLS_RECORD_SIGN) !== 0) {
    conn.sign(signFor(conn.signatureInput()))
  }
  const records: u8[][] = splitRecords(drain(conn))
  if (toI32(records.length) < 2 || toI32(records[0][0]) !== TLS_CONTENT_HANDSHAKE) {
    return none
  }
  const sh: u8[] = range(records[0], 5, toI32(records[0].length))
  const session: Session = sessionFor(none, hello, sh)
  const reader = protectionFor(TLS_AES_128_GCM_SHA256, session.serverHandshake)
  const parts: u8[][] = []
  for (let k: i32 = 1; k < toI32(records.length); k++) {
    parts.push(openOne(reader, records[k]).content)
  }
  const flight: u8[] = join(parts)
  if (!certificateVerifies(session, flight)) {
    return none
  }
  session.finishWith(flight)
  if (!session.serverFinished) {
    return none
  }
  feed(
    conn,
    sealOne(
      protectionFor(TLS_AES_128_GCM_SHA256, session.clientHandshake),
      TLS_CONTENT_HANDSHAKE,
      session.finished,
      ZERO
    )
  )
  if (conn.state !== TLS_RECORD_STATE_OPEN) {
    return none
  }
  feed(
    conn,
    sealOne(
      protectionFor(TLS_AES_128_GCM_SHA256, session.clientApplication),
      TLS_CONTENT_APPLICATION_DATA,
      msg,
      ZERO
    )
  )
  const plain: u8[] = []
  for (let k: i32 = 0; k < toI32(msg.length); k++) {
    plain.push(toU8(0))
  }
  const n: i32 = conn.read(plain, ZERO, toI32(plain.length))
  if (n !== toI32(msg.length) || conn.write(plain, ZERO, n) !== n) {
    return none
  }
  const back: u8[][] = splitRecords(drain(conn))
  if (toI32(back.length) !== 1) {
    return none
  }
  return cat([
    negotiated(sh),
    openOne(protectionFor(TLS_AES_128_GCM_SHA256, session.serverApplication), back[0]).content,
  ])
}

/**
 * One QUIC v1 handshake to 1-RTT with a fresh `QuicConnection`, then `msg`
 * on the client's first bidirectional stream with its FIN, which the server
 * reads and writes back. Answers what the checksum folds, or empty when a
 * step failed.
 */
const quicOnce = (msg: u8[]): u8[] => {
  const none: u8[] = []
  const conn: QuicConnection = qcServer(qcDefaultConfig())
  const scid: u8[] = fromHex(CLIENT_SCID)
  const c = new QcClient(TLS_AES_128_GCM_SHA256, scid)
  const hello: u8[] = qcHello(
    [TLS_AES_128_GCM_SHA256],
    ALPN,
    quicEncodeTransportParameters(qcParams(scid, CLIENT_CREDIT))
  )
  c.before = hello
  qcExchange(conn, c, qcInitial(c, qcCrypto(0, hello), INITIAL_DATAGRAM))
  const sh: u8[] = c.cryptoInitial
  if (toI32(sh.length) === 0) {
    return none
  }
  const session: Session = sessionFor(none, hello, sh)
  const aead: i32 = qcAead(c.suite)
  c.handshakeWrite = quicKeysOf(aead, session.clientHandshake)
  c.handshakeRead = quicKeysOf(aead, session.serverHandshake)
  // The Handshake packets arrived before their keys: open the flight again.
  for (let k: i32 = 0; k < toI32(c.datagrams.length); k++) {
    qcReceive(c, c.datagrams[k])
  }
  const flight: u8[] = c.cryptoHandshake
  if (!certificateVerifies(session, flight)) {
    return none
  }
  session.finishWith(flight)
  if (!session.serverFinished) {
    return none
  }
  c.appWrite = quicKeysOf(aead, session.clientApplication)
  c.appRead = quicKeysOf(aead, session.serverApplication)
  qcExchange(conn, c, qcHandshake(c, qcCrypto(0, session.finished)))
  if (!conn.handshakeComplete) {
    return none
  }
  const frame: u8[] = []
  quicPushStream(frame, 0, 0, msg, 0, toI32(msg.length), true)
  conn.receive(qcShort(c, frame), c.now)
  const data: QuicStreamData | null = conn.readStream()
  if (data === null || conn.writeStream(data.streamId, data.data, true) !== 0) {
    return none
  }
  qcDrain(conn, c)
  const found: QcFound = qcFind(c.appPayloads, QUIC_FRAME_STREAM)
  if (!found.found) {
    return none
  }
  return cat([negotiated(sh), qcData(found)])
}

/** `once` `iterations` times over the message, its first four bytes tweaked by the iteration each time. */
const handshakeLoop = (a: Args, once: (msg: u8[]) => u8[]): i32 => {
  const inp: Inputs = inputs(a.kernel, a.size, 0, 0, 0, a.size)
  const msg: u8[] = inp.msg
  const base: u8[] = baseOf(msg, 0)
  let sum: u32 = foldStart()
  const started: i64 = now()
  for (let i: i32 = 0; i < a.iterations; i++) {
    tweak(msg, 0, base, i)
    const out: u8[] = once(msg)
    if (toI32(out.length) !== 4 + toI32(msg.length)) {
      writeError(`handshake: ${a.kernel} failed at iteration ${i}\n`)
      return 1
    }
    sum = fold(sum, out)
  }
  report(sum, started)
  return 0
}

export const main = (): i32 => {
  const a: Args | null = parseArgs("handshake")
  if (a === null) {
    return 2
  }
  if (a.size < 4) {
    writeError("handshake: the size is the echoed record's length, at least 4\n")
    return 2
  }
  if (a.kernel === "tls13") {
    return handshakeLoop(a, tlsOnce)
  }
  if (a.kernel === "quic") {
    return handshakeLoop(a, quicOnce)
  }
  writeError(`handshake: unknown kernel ${a.kernel}\n`)
  return 2
}
