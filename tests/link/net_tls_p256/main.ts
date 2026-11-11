// secp256r1 on the TLS 1.3 server (`nish/net/tls`): the group it takes from a
// client that does not list x25519, directly from that client's share or
// through a HelloRetryRequest asking for one, and the shares it refuses — a
// point off the curve and one of the wrong length — with `illegal_parameter`.
// The direct case is a whole handshake against `nish/net/tls/client`, whose
// traffic secrets must agree with the server's.
import { Suite } from "nish/testing";
import { p256PublicKey } from "nish/crypto/p256";
import { secret, Secret, wipe } from "nish:secret";
import {
  TLS_ALERT_HANDSHAKE_FAILURE,
  TLS_ALERT_ILLEGAL_PARAMETER,
  TLS_GROUP_SECP256R1,
  TLS_GROUP_X25519,
  TLS_SIGNATURE_ECDSA_SECP256R1_SHA256,
  TLS_VERSION_13,
} from "nish/net/tls/codec";
import { TLS_AES_128_GCM_SHA256 } from "nish/net/tls/schedule";
import { TLS_LEVEL_APPLICATION, TLS_LEVEL_HANDSHAKE, TLS_LEVEL_INITIAL, TLS_STATE_CONNECTED, TlsServer } from "nish/net/tls";
import { TLS_CLIENT_STATE_CONNECTED, TlsClient, TlsClientConfig } from "nish/net/tls/client";
import {
  cat,
  clientHello,
  clientShare,
  extKeyShare,
  extSignatureAlgorithms,
  extSupportedGroups,
  extSupportedVersions,
  sendHello,
} from "../net_tls_common/client";
import { toHex } from "../crypto_x509/hex";
import { secretHex } from "../net_tls_common/secrets";
import { newServer, signWithLeaf, tcpConfig } from "../net_tls_common/server";

const bytes = (start: i32): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < 32; k++) {
    out.push(toU8(start + k));
  }
  return out;
};

/** A valid secp256r1 share: the public point of the scalar 1, 2, ... 32. */
const p256Share = (): u8[] => {
  const key: Secret<u8[]> = secret(bytes(1));
  const point: u8[] | null = p256PublicKey(key);
  wipe(key);
  if (point === null) {
    return [];
  }
  return point;
};

/** A share the size of a point that is not on the curve: 0x04 then 64 bytes of 0x11. */
const offCurve = (): u8[] => {
  const out: u8[] = [toU8(4)];
  for (let k: i32 = 0; k < 64; k++) {
    out.push(toU8(0x11));
  }
  return out;
};

/** A ClientHello listing `groups` and sharing `keys` for `shareGroups`. */
const hello = (groups: i32[], shareGroups: i32[], keys: u8[][]): u8[] =>
  clientHello(
    [TLS_AES_128_GCM_SHA256],
    [
      extSupportedVersions([TLS_VERSION_13]),
      extSupportedGroups(groups),
      extSignatureAlgorithms([TLS_SIGNATURE_ECDSA_SECP256R1_SHA256]),
      extKeyShare(shareGroups, keys),
    ]
  );

/** What a fresh server answers `message` with. */
const refusal = (message: u8[]): i32 => sendHello(newServer(tcpConfig([])), message);

export const main = (): i32 => {
  const t = new Suite("tls p256");
  const zero: i32 = 0;
  const none: u8[][] = [];
  const noGroups: i32[] = [];
  const p256Only: i32[] = [TLS_GROUP_SECP256R1];

  // --- A client that offers only secp256r1, end to end ----------------------
  const config = new TlsClientConfig("localhost", ["h2"]);
  config.groups = [TLS_GROUP_SECP256R1];
  config.shareGroup = TLS_GROUP_SECP256R1;
  const server: TlsServer = newServer(tcpConfig(["h2"]));
  const client = new TlsClient(config, bytes(1), bytes(0x40), bytes(0x60));
  t.eqI32("a secp256r1-only client starts", client.start(), zero);
  const ch: u8[] = client.takeOutput(TLS_LEVEL_INITIAL);
  t.eqI32("the server takes its ClientHello", server.receive(TLS_LEVEL_INITIAL, ch, zero, toI32(ch.length)), zero);
  t.eqI32("and selects secp256r1", server.group, TLS_GROUP_SECP256R1);
  const sh: u8[] = server.takeOutput(TLS_LEVEL_INITIAL);
  t.contains("its ServerHello's key_share is secp256r1 with a 65-byte point", toHex(sh), "0033004500170041");
  t.eqI32("the server signs", signWithLeaf(server), zero);
  const flight: u8[] = server.takeOutput(TLS_LEVEL_HANDSHAKE);
  t.eqI32("the client reads the ServerHello", client.receive(TLS_LEVEL_INITIAL, sh, zero, toI32(sh.length)), zero);
  t.eqI32("and the flight", client.receive(TLS_LEVEL_HANDSHAKE, flight, zero, toI32(flight.length)), zero);
  t.eqI32("the client authenticates", client.authenticate(true), zero);
  t.eqI32("the client is connected", client.state, TLS_CLIENT_STATE_CONNECTED);
  const fin: u8[] = client.takeOutput(TLS_LEVEL_HANDSHAKE);
  t.eqI32("the server reads Finished", server.receive(TLS_LEVEL_HANDSHAKE, fin, zero, toI32(fin.length)), zero);
  t.eqI32("the server is connected", server.state, TLS_STATE_CONNECTED);
  t.eqStr(
    "both sides derive the same client traffic secret",
    secretHex(client.secrets().clientApplication),
    secretHex(server.secrets().clientApplication)
  );
  t.eqStr(
    "and the same server traffic secret",
    secretHex(client.secrets().serverApplication),
    secretHex(server.secrets().serverApplication)
  );
  t.eqI32("nothing is left at the application level", toI32(server.takeOutput(TLS_LEVEL_APPLICATION).length), zero);

  // --- x25519 first ---------------------------------------------------------
  const both = newServer(tcpConfig([]));
  t.eqI32(
    "a client listing both groups and sharing both is answered",
    sendHello(both, hello([TLS_GROUP_SECP256R1, TLS_GROUP_X25519], [TLS_GROUP_SECP256R1, TLS_GROUP_X25519], [p256Share(), clientShare()])),
    zero
  );
  t.eqI32("over x25519, the server's preference", both.group, TLS_GROUP_X25519);

  // --- A HelloRetryRequest for secp256r1 ------------------------------------
  const retry = newServer(tcpConfig([]));
  t.eqI32("a secp256r1-only client with no share gets an answer", sendHello(retry, hello(p256Only, noGroups, none)), zero);
  const hrr: u8[] = retry.takeOutput(TLS_LEVEL_INITIAL);
  t.contains("a HelloRetryRequest whose key_share names secp256r1", toHex(hrr), "003300020017");
  t.eqI32(
    "the second ClientHello, with a secp256r1 share, is answered",
    sendHello(retry, hello(p256Only, p256Only, [p256Share()])),
    zero
  );
  t.eqI32("over secp256r1", retry.group, TLS_GROUP_SECP256R1);
  t.contains("with a ServerHello sharing a 65-byte point", toHex(retry.takeOutput(TLS_LEVEL_INITIAL)), "0033004500170041");
  t.eqI32("and it signs", signWithLeaf(retry), zero);

  const again = newServer(tcpConfig([]));
  sendHello(again, hello(p256Only, noGroups, none));
  t.eqI32(
    "a second ClientHello still without a secp256r1 share is illegal_parameter",
    sendHello(again, hello([TLS_GROUP_SECP256R1, TLS_GROUP_X25519], [TLS_GROUP_X25519], [clientShare()])),
    TLS_ALERT_ILLEGAL_PARAMETER
  );

  // --- Shares the server refuses --------------------------------------------
  t.eqI32(
    "a secp256r1 share off the curve is illegal_parameter",
    refusal(hello(p256Only, p256Only, [offCurve()])),
    TLS_ALERT_ILLEGAL_PARAMETER
  );
  t.eqI32(
    "a 33-byte secp256r1 share is illegal_parameter",
    refusal(hello(p256Only, p256Only, [cat([bytes(2), [toU8(0)]])])),
    TLS_ALERT_ILLEGAL_PARAMETER
  );
  t.eqI32(
    "a compressed secp256r1 point is illegal_parameter",
    refusal(hello(p256Only, p256Only, [cat([[toU8(2)], bytes(3)])])),
    TLS_ALERT_ILLEGAL_PARAMETER
  );
  t.eqI32(
    "a client listing neither group is handshake_failure",
    refusal(hello([toI32(0x0018)], p256Only, [p256Share()])),
    TLS_ALERT_HANDSHAKE_FAILURE
  );
  return t.done();
};
