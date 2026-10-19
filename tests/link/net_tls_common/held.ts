// The plain view of the secrets `TlsServer` holds in its `TlsSecretPool`s:
// each copy is made through `expose` (`secretCopy`), so a test reads the
// bytes the server derived without a field of the server ever being plain
// (docs/LANGUAGE.md, "Secrets").
import {
  TLS_LEVEL_APPLICATION,
  TLS_LEVEL_HANDSHAKE,
  TLS_SECRET_EXPORTER,
  TLS_SECRET_RESUMPTION,
  TlsSecretPool,
  TlsServer,
} from "nish/net/tls";
import { expose } from "nish:secret";
import { TlsRecordServer } from "nish/net/tls/record-server";
import { SHA384_SIZE } from "nish/crypto/sha512";
import { secretCopy, secretHex } from "./secrets";

/** A copy of the client's traffic secret `server` reads `level` under, or `null` while it is not known. */
export const readCopy = (server: TlsServer, level: i32): u8[] | null => {
  if (!server.readKnown(level)) {
    return null;
  }
  if (level === TLS_LEVEL_HANDSHAKE) {
    return secretCopy(server.secrets().clientHandshake);
  }
  return level === TLS_LEVEL_APPLICATION ? secretCopy(server.secrets().clientApplication) : null;
};

/** A copy of the server's traffic secret it writes `level` under, or `null` while it is not known. */
export const writeCopy = (server: TlsServer, level: i32): u8[] | null => {
  if (!server.writeKnown(level)) {
    return null;
  }
  if (level === TLS_LEVEL_HANDSHAKE) {
    return secretCopy(server.secrets().serverHandshake);
  }
  return level === TLS_LEVEL_APPLICATION ? secretCopy(server.secrets().serverApplication) : null;
};

/** The hex of the exporter master secret, or "" before `sign` derives it. */
export const exporterHex = (server: TlsServer): string =>
  server.known(TLS_SECRET_EXPORTER) ? secretHex(server.secrets().exporter) : "";

/** The hex of the resumption master secret, or "" until the client's Finished makes it the connection's. */
export const resumptionHex = (server: TlsServer): string =>
  server.known(TLS_SECRET_RESUMPTION) ? secretHex(server.secrets().resumption) : "";

/** The hex of the client's traffic secret `conn` keeps for KeyUpdate, or "" before it is known. */
export const readTrafficHex = (conn: TlsRecordServer): string => {
  if (conn.readHash === SHA384_SIZE) {
    return secretHex(conn.readTraffic384);
  }
  return conn.readHash === 0 ? "" : secretHex(conn.readTraffic256);
};

/** The hex of the server's traffic secret `conn` keeps for KeyUpdate, or "" before it is known. */
export const writeTrafficHex = (conn: TlsRecordServer): string => {
  if (conn.writeHash === SHA384_SIZE) {
    return secretHex(conn.writeTraffic384);
  }
  return conn.writeHash === 0 ? "" : secretHex(conn.writeTraffic256);
};

/** 1 when any byte of `bytes` is set, for `expose` to run. */
const setOf = (bytes: u8[]): i32 => {
  for (const b of bytes) {
    if (toI32(b) !== 0) {
      return 1;
    }
  }
  return 0;
};

/** How many of `pool`'s nine arrays hold a byte that is not zero, each `Secret` read through `expose`. */
export const poolHeld = (pool: TlsSecretPool): i32 =>
  expose(pool.handshake, setOf) +
  expose(pool.clientHandshake, setOf) +
  expose(pool.serverHandshake, setOf) +
  expose(pool.clientApplication, setOf) +
  expose(pool.serverApplication, setOf) +
  expose(pool.exporter, setOf) +
  expose(pool.resumption, setOf) +
  setOf(pool.clientFinished) +
  setOf(pool.toBeSigned);
