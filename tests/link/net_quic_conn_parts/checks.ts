// The checks of the three parts `nish/net/quic` is built from:
// `nish/net/quic-conn-params` (transport parameters, against the client's
// parameters RFC 9001 A.2 prints), `nish/net/quic-conn-ack` (received packet
// numbers and the ACK frames written from them) and `nish/net/quic-conn-cid`
// (the connection-ID table). `main.ts` runs them in the default number mode,
// `tests/link/net_quic_conn_parts_f64` under `--number-mode f64`.
import { Suite } from "nish/testing";
import {
  QUIC_ERROR_CONNECTION_ID_LIMIT,
  QUIC_ERROR_NO_ERROR,
  QUIC_ERROR_PROTOCOL_VIOLATION,
  QUIC_ERROR_TRANSPORT_PARAMETER,
} from "nish/net/quic-frame";
import {
  QUIC_TP_ACK_DELAY_EXPONENT,
  QUIC_TP_ACTIVE_CONNECTION_ID_LIMIT,
  QUIC_TP_DISABLE_ACTIVE_MIGRATION,
  QUIC_TP_INITIAL_MAX_DATA,
  QUIC_TP_INITIAL_MAX_STREAMS_BIDI,
  QUIC_TP_INITIAL_SCID,
  QUIC_TP_MAX_ACK_DELAY,
  QUIC_TP_MAX_UDP_PAYLOAD_SIZE,
  QUIC_TP_ORIGINAL_DCID,
  QUIC_TP_STATELESS_RESET_TOKEN,
  QuicTransportParameters,
  quicEncodeTransportParameters,
  quicParseTransportParameters,
} from "nish/net/quic-conn-params";
import { QUIC_ACK_MAX_RANGES, QuicAckRanges } from "nish/net/quic-conn-ack";
import { QuicCidEntry, QuicCidTable } from "nish/net/quic-conn-cid";
import { fromHex, toHex } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";

/** 2^62 − 1, as a product: an `i64` literal past 2^53 is refused. */
const MAX_VARINT: i64 = 1073741824 * 4294967296 - 1;

/** The `quic_transport_parameters` RFC 9001 A.2's client sends (the extension's body). */
const A2_PARAMS: string =
  "0408ffffffffffffffff05048000ffff07048000ffff0801100104800075300901100f088394c8f03e51570806048000ffff";

/** What parsing `hex` as a client's parameters answers, and which parameter it named. */
const refusal = (hex: string, fromServer: boolean): string => {
  const p: QuicTransportParameters = quicParseTransportParameters(fromHex(hex), fromServer);
  return `${p.error} ${p.errorParameter}`;
};

/** Transport parameters, both ways. */
const partsParamChecks = (t: Suite): void => {
  const a2: QuicTransportParameters = quicParseTransportParameters(fromHex(A2_PARAMS), false);
  t.eqI64("A.2: the client's parameters parse", a2.error, QUIC_ERROR_NO_ERROR);
  t.eqI64("A.2: initial_max_data is 2^62 - 1", a2.initialMaxData, MAX_VARINT);
  t.ok(
    "A.2: each stream's credit is 65535",
    a2.initialMaxStreamDataBidiLocal === n64(65535) &&
      a2.initialMaxStreamDataBidiRemote === n64(65535) &&
      a2.initialMaxStreamDataUni === n64(65535)
  );
  t.ok("A.2: 16 streams each way", a2.initialMaxStreamsBidi === n64(16) && a2.initialMaxStreamsUni === n64(16));
  t.eqI64("A.2: a 30 s idle timeout", a2.maxIdleTimeout, n64(30000));
  t.ok("A.2: initial_source_connection_id is its SCID", a2.hasInitialScid && toHex(a2.initialScid) === "8394c8f03e515708");
  t.ok(
    "A.2: what it did not send keeps its default",
    a2.maxUdpPayloadSize === n64(65527) &&
      a2.ackDelayExponent === n64(3) &&
      a2.maxAckDelay === n64(25) &&
      a2.activeConnectionIdLimit === n64(2) &&
      !a2.disableActiveMigration &&
      !a2.hasOriginalDcid
  );

  const defaults = new QuicTransportParameters();
  t.eqStr("parameters at their defaults encode to nothing", toHex(quicEncodeTransportParameters(defaults)), "");

  const server = new QuicTransportParameters();
  server.originalDcid = fromHex("8394c8f03e515708");
  server.hasOriginalDcid = true;
  server.maxIdleTimeout = n64(30000);
  server.statelessResetToken = fromHex("000102030405060708090a0b0c0d0e0f");
  server.hasStatelessResetToken = true;
  server.maxUdpPayloadSize = n64(1472);
  server.initialMaxData = n64(65536);
  server.initialMaxStreamDataBidiLocal = n64(1);
  server.initialMaxStreamDataBidiRemote = n64(16384);
  server.initialMaxStreamDataUni = n64(2);
  server.initialMaxStreamsBidi = n64(4);
  server.initialMaxStreamsUni = n64(3);
  server.ackDelayExponent = n64(8);
  server.maxAckDelay = n64(40);
  server.disableActiveMigration = true;
  server.preferredAddress = fromHex("7f000001");
  server.hasPreferredAddress = true;
  server.activeConnectionIdLimit = n64(4);
  server.initialScid = fromHex("4041424344454647");
  server.hasInitialScid = true;
  server.retryScid = fromHex("aa");
  server.hasRetryScid = true;
  const encoded: u8[] = quicEncodeTransportParameters(server);
  t.eqStr(
    "a server's full set encodes in ID order, each as ID, length and value",
    toHex(encoded),
    "00088394c8f03e515708" +
      "01048000753002" +
      "10000102030405060708090a0b0c0d0e0f" +
      "030245c0" +
      "040480010000" +
      "050101" +
      "060480004000" +
      "070102" +
      "080104" +
      "090103" +
      "0a0108" +
      "0b0128" +
      "0c00" +
      "0d047f000001" +
      "0e0104" +
      "0f084041424344454647" +
      "1001aa"
  );
  const back: QuicTransportParameters = quicParseTransportParameters(encoded, true);
  t.ok(
    "and parses back as a server's, every field as it was",
    back.error === QUIC_ERROR_NO_ERROR &&
      toHex(back.originalDcid) === "8394c8f03e515708" &&
      back.maxIdleTimeout === n64(30000) &&
      toHex(back.statelessResetToken) === "000102030405060708090a0b0c0d0e0f" &&
      back.maxUdpPayloadSize === n64(1472) &&
      back.initialMaxData === n64(65536) &&
      back.initialMaxStreamDataBidiLocal === n64(1) &&
      back.initialMaxStreamDataBidiRemote === n64(16384) &&
      back.initialMaxStreamDataUni === n64(2) &&
      back.initialMaxStreamsBidi === n64(4) &&
      back.initialMaxStreamsUni === n64(3) &&
      back.ackDelayExponent === n64(8) &&
      back.maxAckDelay === n64(40) &&
      back.disableActiveMigration &&
      toHex(back.preferredAddress) === "7f000001" &&
      back.activeConnectionIdLimit === n64(4) &&
      toHex(back.initialScid) === "4041424344454647" &&
      toHex(back.retryScid) === "aa"
  );
  const unknown: QuicTransportParameters = quicParseTransportParameters(fromHex("1b0100" + "40ff00" + "0401" + "05"), false);
  t.ok("unknown and reserved parameters are skipped", unknown.error === QUIC_ERROR_NO_ERROR && unknown.initialMaxData === n64(5));

  const tp: i64 = QUIC_ERROR_TRANSPORT_PARAMETER;
  t.eqStr("an ID cut inside its varint is refused", refusal("40", false), `${tp} -1`);
  t.eqStr("a length cut inside its varint is refused", refusal("0440", false), `${tp} ${QUIC_TP_INITIAL_MAX_DATA}`);
  t.eqStr("a value running past the bytes is refused", refusal("040500", false), `${tp} ${QUIC_TP_INITIAL_MAX_DATA}`);
  t.eqStr("a parameter sent twice is refused", refusal("040100" + "040100", false), `${tp} ${QUIC_TP_INITIAL_MAX_DATA}`);
  t.eqStr(
    "original_destination_connection_id from a client is refused",
    refusal("0000", false),
    `${tp} ${QUIC_TP_ORIGINAL_DCID}`
  );
  t.eqStr(
    "a stateless reset token that is not 16 bytes is refused",
    refusal("020100", true),
    `${tp} ${QUIC_TP_STATELESS_RESET_TOKEN}`
  );
  t.eqStr(
    "a connection ID of 21 bytes is refused",
    refusal("0f15" + "000000000000000000000000000000000000000000", false),
    `${tp} ${QUIC_TP_INITIAL_SCID}`
  );
  t.eqStr(
    "disable_active_migration with a value is refused",
    refusal("0c0100", false),
    `${tp} ${QUIC_TP_DISABLE_ACTIVE_MIGRATION}`
  );
  t.eqStr(
    "a varint-valued parameter with a byte after its varint is refused",
    refusal("04020001", false),
    `${tp} ${QUIC_TP_INITIAL_MAX_DATA}`
  );
  t.eqStr("an empty varint-valued parameter is refused", refusal("0400", false), `${tp} ${QUIC_TP_INITIAL_MAX_DATA}`);
  t.eqStr(
    "max_udp_payload_size below 1200 is refused",
    refusal("03024400", false),
    `${tp} ${QUIC_TP_MAX_UDP_PAYLOAD_SIZE}`
  );
  t.eqStr("ack_delay_exponent above 20 is refused", refusal("0a0115", false), `${tp} ${QUIC_TP_ACK_DELAY_EXPONENT}`);
  t.eqStr("max_ack_delay of 2^14 is refused", refusal("0b0480004000", false), `${tp} ${QUIC_TP_MAX_ACK_DELAY}`);
  t.eqStr(
    "active_connection_id_limit below 2 is refused",
    refusal("0e0101", false),
    `${tp} ${QUIC_TP_ACTIVE_CONNECTION_ID_LIMIT}`
  );
  t.eqStr(
    "a stream count past 2^60 is refused",
    refusal("0808d000000000000001", false),
    `${tp} ${QUIC_TP_INITIAL_MAX_STREAMS_BIDI}`
  );
  t.ok(
    "the boundary values are accepted",
    quicParseTransportParameters(fromHex("030244b0" + "0a0114" + "0b027fff" + "0e0102"), false).error === QUIC_ERROR_NO_ERROR
  );
};

/** The received packet numbers of one space. */
const partsAckChecks = (t: Suite): void => {
  const r = new QuicAckRanges();
  const none: u8[] = [];
  t.ok("nothing received writes no ACK", !r.pushAck(none, n64(0)));
  t.ok("0, 1 and 2 are new", r.record(n64(0), true) && r.record(n64(1), false) && r.record(n64(2), false));
  t.ok("and make one range", r.count === 1 && r.low(n32(0)) === n64(0) && r.high(n32(0)) === n64(2));
  t.ok("2 again is a duplicate", !r.record(n64(2), true));
  t.ok("as is a packet number that is not one", !r.record(n64(-1), true) && !r.record(MAX_VARINT + 1, true));
  t.ok("an ack-eliciting packet makes an ACK due", r.ackPending);
  t.ok("5 starts a second range above", r.record(n64(5), false) && r.count === 2 && r.low(n32(0)) === n64(5));
  t.ok("4 joins it from below", r.record(n64(4), false) && r.count === 2 && r.low(n32(0)) === n64(4));
  t.ok("3 closes the hole and merges them", r.record(n64(3), false) && r.count === 1 && r.high(n32(0)) === n64(5));
  t.ok("7 and 9 make two more", r.record(n64(9), false) && r.record(n64(7), false) && r.count === 3);
  t.ok("8 merges those two", r.record(n64(8), false) && r.count === 2 && r.low(n32(0)) === n64(7) && r.high(n32(0)) === n64(9));
  t.ok("6 merges everything", r.record(n64(6), false) && r.count === 1 && r.largest === n64(9));
  t.ok("contains says what was received", r.contains(n64(0)) && r.contains(n64(9)) && !r.contains(n64(10)));
  r.record(n64(12), true);
  const ack: u8[] = [];
  t.ok("pushAck writes the ranges", r.pushAck(ack, n64(3)));
  t.eqStr("as largest 12, delay 3, one more range: [12, 12] then [0, 9]", toHex(ack), "020c0301000109");
  t.ok("and the ACK is no longer due", !r.ackPending);
  t.ok("an index outside the ranges answers -1", r.low(n32(99)) === n64(-1) && r.high(n32(-1)) === n64(-1));
  r.set(n32(99), n64(1), n64(1));
  t.eqI32("and set outside them changes nothing", r.count, n32(2));

  // Every other packet number, forty of them: only 32 ranges are kept.
  const holes = new QuicAckRanges();
  for (let k: i32 = 0; k < 40; k++) {
    holes.record(toI64(k) * 2, true);
  }
  t.eqI32("forty disjoint packets keep QUIC_ACK_MAX_RANGES ranges", holes.count, QUIC_ACK_MAX_RANGES);
  t.eqI64("and raise the floor over the ones dropped", holes.floor, n64(14));
  t.ok("a packet number at or below the floor reads as received", holes.contains(n64(3)) && !holes.record(n64(13), true));
  t.ok("one above it is still new", holes.record(n64(17), true));
  const lowest = new QuicAckRanges();
  for (let k: i32 = 0; k < 32; k++) {
    lowest.record(toI64(k) * 2 + 100, true);
  }
  t.ok("a new lowest range, with every slot taken, is itself dropped", lowest.record(n64(50), true) && lowest.floor === n64(50) && lowest.count === 32);
};

/** The connection-ID table. */
const partsCidChecks = (t: Suite): void => {
  const ids = new QuicCidTable(n64(2));
  const none: u8[] = [];
  const c0: u8[] = fromHex("0000000000000000");
  const c1: u8[] = fromHex("1111111111111111");
  const tok: u8[] = fromHex("000102030405060708090a0b0c0d0e0f");
  t.eqI64("the first local ID is sequence 0", ids.addLocal(c0, none), n64(0));
  t.eqI64("the next sequence 1", ids.addLocal(c1, tok), n64(1));
  t.ok("both are active and owned", ids.activeLocal() === 2 && ids.ownsLocal(c0) && ids.ownsLocal(c1));
  const next: QuicCidEntry | null = ids.nextUnannounced();
  t.ok("sequence 1 still has to be announced; sequence 0 never does", next !== null && next.sequence === n64(1));
  if (next !== null) {
    next.announced = true;
  }
  t.ok("and once it is, none is left", ids.nextUnannounced() === null);
  t.eqI64("retiring a sequence number never issued is PROTOCOL_VIOLATION", ids.retireLocal(n64(2), c0), QUIC_ERROR_PROTOCOL_VIOLATION);
  t.eqI64("so is a negative one", ids.retireLocal(n64(-1), c0), QUIC_ERROR_PROTOCOL_VIOLATION);
  t.eqI64(
    "so is retiring the ID the packet was sent to (RFC 9000 §19.16)",
    ids.retireLocal(n64(1), c1),
    QUIC_ERROR_PROTOCOL_VIOLATION
  );
  t.eqI64("retiring another is fine", ids.retireLocal(n64(1), c0), QUIC_ERROR_NO_ERROR);
  t.ok("and it is no longer owned", !ids.ownsLocal(c1) && ids.activeLocal() === 1);
  t.eqI64("retiring it twice is fine too", ids.retireLocal(n64(1), c1), QUIC_ERROR_NO_ERROR);

  const peer = new QuicCidTable(n64(2));
  t.eqStr("before the peer gave an ID there is none to send to", toHex(peer.currentPeer()), "");
  t.eqI64("the peer's first SCID is sequence 0", peer.addPeer(n64(0), n64(0), fromHex("aa"), none), QUIC_ERROR_NO_ERROR);
  t.eqI64("a NEW_CONNECTION_ID adds sequence 1", peer.addPeer(n64(1), n64(0), fromHex("bb"), tok), QUIC_ERROR_NO_ERROR);
  t.eqI64("the same frame again is fine", peer.addPeer(n64(1), n64(0), fromHex("bb"), tok), QUIC_ERROR_NO_ERROR);
  t.eqI64("sequence 1 with another ID is PROTOCOL_VIOLATION", peer.addPeer(n64(1), n64(0), fromHex("cc"), tok), QUIC_ERROR_PROTOCOL_VIOLATION);
  t.eqI64("sequence 1 with another token is too", peer.addPeer(n64(1), n64(0), fromHex("bb"), c0), QUIC_ERROR_PROTOCOL_VIOLATION);
  t.eqI64("an ID under a second sequence number is too", peer.addPeer(n64(2), n64(0), fromHex("bb"), tok), QUIC_ERROR_PROTOCOL_VIOLATION);
  t.ok("two are active, and the oldest is the one sent to", peer.activePeer() === 2 && toHex(peer.currentPeer()) === "aa");
  const sentTo: string = toHex(peer.currentPeer());
  const owedBefore: i32 = toI32(peer.retirePending.length);
  t.eqI64(
    "a third active ID passes the limit of 2: CONNECTION_ID_LIMIT_ERROR",
    peer.addPeer(n64(2), n64(0), fromHex("dd"), tok),
    QUIC_ERROR_CONNECTION_ID_LIMIT
  );
  t.ok(
    "and the refused ID is not added: two are still active, with nothing more owed",
    peer.activePeer() === 2 && toI32(peer.retirePending.length) === owedBefore
  );
  t.eqStr("and the ID sent to is unchanged", toHex(peer.currentPeer()), sentTo);

  const moving = new QuicCidTable(n64(2));
  moving.addPeer(n64(0), n64(0), fromHex("aa"), none);
  moving.addPeer(n64(1), n64(0), fromHex("bb"), tok);
  t.eqI64("Retire Prior To 2 retires both older IDs", moving.addPeer(n64(2), n64(2), fromHex("cc"), tok), QUIC_ERROR_NO_ERROR);
  t.ok("so only the new one is active and sent to", moving.activePeer() === 1 && toHex(moving.currentPeer()) === "cc");
  t.ok("and 0 then 1 are queued to retire", moving.takeRetire() === n64(0) && moving.takeRetire() === n64(1) && moving.takeRetire() === n64(-1));
  t.eqI64("an ID that arrives already below Retire Prior To is retired at once", moving.addPeer(n64(1), n64(0), fromHex("dd"), tok), QUIC_ERROR_NO_ERROR);
  t.ok("and queued", moving.takeRetire() === n64(1) && moving.activePeer() === 1);
  moving.addPeer(n64(3), n64(3), fromHex("e3"), tok);
  moving.addPeer(n64(4), n64(4), fromHex("e4"), tok);
  moving.addPeer(n64(5), n64(5), fromHex("e5"), tok);
  t.eqI64("four queued retirements, twice the limit, are allowed", moving.addPeer(n64(6), n64(6), fromHex("e6"), tok), QUIC_ERROR_NO_ERROR);
  const before: string = toHex(moving.currentPeer());
  const owed: i32 = toI32(moving.retirePending.length);
  t.eqI64(
    "a fifth is CONNECTION_ID_LIMIT_ERROR (RFC 9000 §5.1.2)",
    moving.addPeer(n64(7), n64(7), fromHex("e7"), tok),
    QUIC_ERROR_CONNECTION_ID_LIMIT
  );
  t.ok("and the refused frame leaves the table within its bounds", toI64(moving.activePeer()) <= n64(2) && toI32(moving.retirePending.length) === owed);
  t.eqStr("with the ID sent to unchanged", toHex(moving.currentPeer()), before);
  moving.prune();
  t.eqStr("prune leaves it as it was", toHex(moving.currentPeer()), "e6");
};

/** Runs every check and answers the exit code. */
export const quicConnPartsChecks = (): i32 => {
  const t = new Suite("quic connection parts");
  partsParamChecks(t);
  partsAckChecks(t);
  partsCidChecks(t);
  return t.done();
};
