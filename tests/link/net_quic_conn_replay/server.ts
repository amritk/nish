// The echo server both halves of `net_quic_conn_replay` run: one
// `QuicConnection` with fixed entropy, a P-256 certificate, and an
// application that sends every byte a client stream carries straight back on
// it, FIN included. The live server (`main.ts serve`, which `record.sh` points
// aioquic at) and the replay (`main.ts`, which `npm test` runs) both call
// `serveDatagram`, so the recording is a transcript of exactly this code.
import { Secret, secret, wipe } from "nish:secret";
import { TLS_SIGNATURE_ECDSA_SECP256R1_SHA256 } from "nish/net/tls/codec";
import { tlsSignEcdsaP256 } from "nish/net/tls";
import { QUIC_CONN_ENTROPY_SIZE, QuicConnection, QuicServerConfig, QuicStreamData } from "nish/net/quic";
import { leafCertificate, leafPrivate } from "../net_tls_common/server";
import { textOf } from "../crypto_x509/hex";

/** The ALPN protocol the echo speaks; `aioquic-client.py` offers it. */
export const ECHO_ALPN: string = "nish-echo";

/** The entropy every recorded connection is made with: 0x40, 0x41, … */
export const fixedEntropy = (): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < QUIC_CONN_ENTROPY_SIZE; k++) {
    out.push(toU8(0x40 + k));
  }
  return out;
};

/** The configuration: the P-256 leaf, the echo's ALPN, and room for a few short streams. */
export const echoConfig = (): QuicServerConfig => {
  const chain: u8[][] = [leafCertificate()];
  return {
    certificateChain: chain,
    alpn: [ECHO_ALPN],
    signatureScheme: TLS_SIGNATURE_ECDSA_SECP256R1_SHA256,
    maxData: toI64(65536),
    maxStreamData: toI64(16384),
    maxStreamsBidi: toI64(4),
    maxIdleTimeout: toI64(30000),
    activeConnectionIdLimit: toI64(4),
  };
};

/** A connection ready for a client's first Initial. */
export const newEchoConnection = (): QuicConnection => new QuicConnection(echoConfig(), fixedEntropy());

/** What one datagram made the server do: the datagrams it sent back, and the stream data it echoed. */
export class Served {
  out: u8[][];
  echoed: string[];

  constructor() {
    this.out = [];
    this.echoed = [];
  }
}

/**
 * Hands `datagram` to `conn`, signs when the handshake asks, echoes every run
 * of stream data, and collects every datagram the server then sends.
 */
export const serveDatagram = (conn: QuicConnection, datagram: u8[]): Served => {
  const served = new Served();
  conn.receive(datagram);
  const input: u8[] | null = conn.signatureInput();
  if (input !== null) {
    const key: Secret<u8[]> = secret(leafPrivate());
    const signature: u8[] | null = tlsSignEcdsaP256(key, input);
    wipe(key);
    if (signature !== null) {
      conn.sign(signature);
    }
  }
  let data: QuicStreamData | null = conn.readStream();
  while (data !== null) {
    served.echoed.push(`stream ${data.streamId}: "${textOf(data.data)}"${data.fin ? " fin" : ""}`);
    conn.writeStream(data.streamId, data.data, data.fin);
    data = conn.readStream();
  }
  let out: u8[] | null = conn.takeDatagram();
  while (out !== null) {
    served.out.push(out);
    out = conn.takeDatagram();
  }
  return served;
};
