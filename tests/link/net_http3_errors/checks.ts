// Every connection error `nish/net/http3` raises, each on a fresh
// connection, each asserting the exact code in the CONNECTION_CLOSE the client
// receives (an application close, frame type 0x1d) and that the program was
// told with H3_ERROR: the stream-type errors of §6.2, the critical streams of
// §6.2.1 and RFC 9204 §4.2, frames where they may not be (§7.2.8, §4.1), the
// SETTINGS rules of §7.2.4, frame lengths (§7.1), the identifier rules of §5.2,
// §7.2.3 and §7.2.7, a control frame past its cap, and QPACK's three. The
// checks live here so that `tests/link/net_http3_errors_f64` runs every one
// again under `--number-mode f64`.
import { Suite } from "nish/testing";
import {
  H3_CLOSED_CRITICAL_STREAM,
  H3_EXCESSIVE_LOAD,
  H3_FRAME_CANCEL_PUSH,
  H3_FRAME_DATA,
  H3_FRAME_ERROR,
  H3_FRAME_GOAWAY,
  H3_FRAME_HEADERS,
  H3_FRAME_MAX_PUSH_ID,
  H3_FRAME_PUSH_PROMISE,
  H3_FRAME_SETTINGS,
  H3_FRAME_UNEXPECTED,
  H3_ID_ERROR,
  H3_MISSING_SETTINGS,
  H3_NO_ERROR,
  H3_SETTINGS_ERROR,
  H3_STREAM_CONTROL,
  H3_STREAM_CREATION_ERROR,
  H3_STREAM_PUSH,
  H3_STREAM_QPACK_DECODER,
  H3_STREAM_QPACK_ENCODER,
} from "nish/net/http3-frame";
import { QPACK_DECODER_STREAM_ERROR, QPACK_DECOMPRESSION_FAILED, QPACK_ENCODER_STREAM_ERROR } from "nish/net/qpack";
import { Http3Config } from "nish/net/http3";
import { quicPushStreamError } from "nish/net/quic-frame";
import { bytesOf, fromHex } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import {
  CLIENT_CONTROL,
  CLIENT_DECODER,
  CLIENT_ENCODER,
  H3Limits,
  H3Peer,
  h3Cat,
  h3ClientSettings,
  h3Connect,
  h3Frame,
  h3Hex,
  h3Ready,
  h3Saw,
  h3Varint,
} from "../net_http3/peer";

/** The next unidirectional stream a client opens after its three. */
const NEXT_UNI: i64 = 14;

/** How the connection closed, as `app 0x…` or `transport 0x…`, or `open`. */
const closed = (p: H3Peer): string => {
  if (p.closeCode < 0) {
    return "open";
  }
  return `${p.closeApp ? "app" : "transport"} 0x${h3Hex(p.closeCode)}${h3Saw(p, `error 0x${h3Hex(p.closeCode)}`) ? "" : " (the program was not told)"}`;
};

/** Checks the connection closed with application error `want`. */
const closedWith = (t: Suite, name: string, p: H3Peer, want: i64): void => {
  p.settle();
  t.eqStr(name, closed(p), `app 0x${h3Hex(want)}`);
};

/** A connection whose client has not opened its own streams yet. */
const bare = (): H3Peer => h3Connect(new H3Limits(), new Http3Config());

/** A STOP_SENDING from the client for the server's stream `id`. */
const stopServer = (p: H3Peer, id: i64): void => {
  const payload: u8[] = [];
  quicPushStreamError(payload, id, H3_NO_ERROR, n64(-1));
  p.packet(payload);
};

/** A request's HEADERS frame, a GET of `/`. */
const head = (p: H3Peer): u8[] => {
  const none: string[] = [];
  return p.headers("GET", "/", none, none);
};

/** One frame of `type` with a one-byte payload. */
const one = (type: i64): u8[] => h3Frame(type, [toU8(0)]);

/** Unidirectional streams (§6.2, §6.2.1, §6.2.2). */
const streamTypes = (t: Suite): void => {
  let p: H3Peer = h3Ready();
  p.send(NEXT_UNI, h3Cat([h3Varint(H3_STREAM_CONTROL), h3ClientSettings(n64(-1))]), false);
  closedWith(t, "a second control stream: H3_STREAM_CREATION_ERROR", p, H3_STREAM_CREATION_ERROR);
  p = h3Ready();
  p.send(NEXT_UNI, h3Varint(H3_STREAM_QPACK_ENCODER), false);
  closedWith(t, "a second QPACK encoder stream", p, H3_STREAM_CREATION_ERROR);
  p = h3Ready();
  p.send(NEXT_UNI, h3Varint(H3_STREAM_QPACK_DECODER), false);
  closedWith(t, "a second QPACK decoder stream", p, H3_STREAM_CREATION_ERROR);
  p = h3Ready();
  p.send(NEXT_UNI, h3Varint(H3_STREAM_PUSH), false);
  closedWith(t, "a push stream from a client", p, H3_STREAM_CREATION_ERROR);
  p = bare();
  p.send(CLIENT_CONTROL, h3Cat([h3Varint(H3_STREAM_CONTROL), h3Frame(H3_FRAME_GOAWAY, h3Varint(n64(0)))]), false);
  closedWith(t, "a control stream that does not start with SETTINGS: H3_MISSING_SETTINGS", p, H3_MISSING_SETTINGS);
  p = bare();
  p.send(CLIENT_CONTROL, h3Cat([h3Varint(H3_STREAM_CONTROL), h3Frame(n64(0x21), [toU8(1)])]), false);
  closedWith(t, "not even with an unknown frame first", p, H3_MISSING_SETTINGS);
  p = bare();
  p.get(n64(0), "/");
  p.settle();
  t.ok("requests before the client's SETTINGS are no error: they are served", closed(p) === "open" && h3Saw(p, "request 0 GET /"));
};

/** The critical streams, either side's, may not close (§6.2.1, RFC 9204 §4.2). */
const critical = (t: Suite): void => {
  let p: H3Peer = h3Ready();
  const empty: u8[] = [];
  p.send(CLIENT_CONTROL, empty, true);
  closedWith(t, "the client's control stream ends: H3_CLOSED_CRITICAL_STREAM", p, H3_CLOSED_CRITICAL_STREAM);
  p = h3Ready();
  p.cancelOnly(CLIENT_CONTROL, H3_NO_ERROR);
  closedWith(t, "it is reset", p, H3_CLOSED_CRITICAL_STREAM);
  p = h3Ready();
  p.send(CLIENT_ENCODER, empty, true);
  closedWith(t, "the client's QPACK encoder stream ends", p, H3_CLOSED_CRITICAL_STREAM);
  p = h3Ready();
  p.cancelOnly(CLIENT_DECODER, H3_NO_ERROR);
  closedWith(t, "its decoder stream is reset", p, H3_CLOSED_CRITICAL_STREAM);
  p = h3Ready();
  stopServer(p, n64(3));
  closedWith(t, "the client asks the server to stop its control stream", p, H3_CLOSED_CRITICAL_STREAM);
  p = h3Ready();
  stopServer(p, n64(7));
  closedWith(t, "or its QPACK encoder stream", p, H3_CLOSED_CRITICAL_STREAM);
  p = h3Ready();
  stopServer(p, n64(11));
  closedWith(t, "or its decoder stream", p, H3_CLOSED_CRITICAL_STREAM);
};

/** Frames where they may not be: H3_FRAME_UNEXPECTED (§7.2, §7.2.8, §4.1). */
const unexpected = (t: Suite): void => {
  const onControl: u8[][] = [
    one(H3_FRAME_DATA),
    one(H3_FRAME_HEADERS),
    h3ClientSettings(n64(-1)),
    one(H3_FRAME_PUSH_PROMISE),
    one(n64(0x02)),
    one(n64(0x06)),
    one(n64(0x08)),
    one(n64(0x09)),
  ];
  const controlNames: string[] = ["DATA", "HEADERS", "a second SETTINGS", "PUSH_PROMISE", "PRIORITY (0x02)", "PING (0x06)", "WINDOW_UPDATE (0x08)", "CONTINUATION (0x09)"];
  for (let k: i32 = 0; k < toI32(onControl.length); k++) {
    const p: H3Peer = h3Ready();
    p.send(CLIENT_CONTROL, onControl[k], false);
    closedWith(t, `${controlNames[k]} on the control stream: H3_FRAME_UNEXPECTED`, p, H3_FRAME_UNEXPECTED);
  }
  const onRequest: u8[][] = [
    one(H3_FRAME_DATA),
    one(H3_FRAME_PUSH_PROMISE),
    h3ClientSettings(n64(-1)),
    h3Frame(H3_FRAME_GOAWAY, h3Varint(n64(0))),
    h3Frame(H3_FRAME_MAX_PUSH_ID, h3Varint(n64(0))),
    h3Frame(H3_FRAME_CANCEL_PUSH, h3Varint(n64(0))),
    one(n64(0x02)),
    one(n64(0x09)),
  ];
  const requestNames: string[] = ["DATA before HEADERS", "PUSH_PROMISE", "SETTINGS", "GOAWAY", "MAX_PUSH_ID", "CANCEL_PUSH", "PRIORITY (0x02)", "CONTINUATION (0x09)"];
  for (let k: i32 = 0; k < toI32(onRequest.length); k++) {
    const p: H3Peer = h3Ready();
    p.send(n64(0), onRequest[k], false);
    closedWith(t, `${requestNames[k]} on a request stream: H3_FRAME_UNEXPECTED`, p, H3_FRAME_UNEXPECTED);
  }
  let p: H3Peer = h3Ready();
  p.send(n64(0), h3Cat([head(p), one(H3_FRAME_PUSH_PROMISE)]), false);
  closedWith(t, "PUSH_PROMISE after a request's HEADERS", p, H3_FRAME_UNEXPECTED);
  p = h3Ready();
  const tail: u8[] = h3Frame(H3_FRAME_HEADERS, fromHex("0000c2"));
  p.send(n64(0), h3Cat([head(p), tail, tail]), false);
  closedWith(t, "HEADERS after the trailers", p, H3_FRAME_UNEXPECTED);
  p = h3Ready();
  p.send(n64(0), h3Cat([head(p), tail, h3Frame(H3_FRAME_DATA, bytesOf("late"))]), false);
  closedWith(t, "DATA after the trailers", p, H3_FRAME_UNEXPECTED);
};

/** SETTINGS (§7.2.4) and frame lengths (§7.1). */
const lengths = (t: Suite): void => {
  let p: H3Peer = bare();
  p.send(CLIENT_CONTROL, h3Cat([h3Varint(H3_STREAM_CONTROL), h3Frame(H3_FRAME_SETTINGS, fromHex("0200"))]), false);
  closedWith(t, "SETTINGS with an identifier HTTP/2 used, 0x02: H3_SETTINGS_ERROR", p, H3_SETTINGS_ERROR);
  p = bare();
  p.send(CLIENT_CONTROL, h3Cat([h3Varint(H3_STREAM_CONTROL), h3Frame(H3_FRAME_SETTINGS, fromHex("06010602"))]), false);
  closedWith(t, "SETTINGS with an identifier twice", p, H3_SETTINGS_ERROR);
  p = bare();
  p.send(CLIENT_CONTROL, h3Cat([h3Varint(H3_STREAM_CONTROL), h3Frame(H3_FRAME_SETTINGS, fromHex("0640"))]), false);
  closedWith(t, "SETTINGS whose payload ends inside a value: H3_FRAME_ERROR", p, H3_FRAME_ERROR);
  p = h3Ready();
  p.send(CLIENT_CONTROL, h3Frame(H3_FRAME_GOAWAY, fromHex("0404")), false);
  closedWith(t, "GOAWAY with a byte after its identifier", p, H3_FRAME_ERROR);
  p = h3Ready();
  const empty: u8[] = [];
  p.send(CLIENT_CONTROL, h3Frame(H3_FRAME_MAX_PUSH_ID, empty), false);
  closedWith(t, "an empty MAX_PUSH_ID", p, H3_FRAME_ERROR);
  p = h3Ready();
  p.send(n64(0), h3Cat([head(p), fromHex("0005616263")]), true);
  closedWith(t, "a DATA frame cut short by the stream's end", p, H3_FRAME_ERROR);
  p = h3Ready();
  p.send(n64(0), h3Cat([head(p), fromHex("0041")]), true);
  closedWith(t, "a frame header cut short by the stream's end", p, H3_FRAME_ERROR);
  p = h3Ready();
  p.send(n64(0), fromHex("010a0000d1"), true);
  closedWith(t, "a HEADERS frame cut short by the stream's end", p, H3_FRAME_ERROR);
  p = h3Ready();
  p.send(n64(0), h3Cat([head(p), fromHex("2105")]), true);
  closedWith(t, "an unknown frame cut short by it", p, H3_FRAME_ERROR);
  p = bare();
  const big: u8[] = new Array<u8>(1100);
  p.send(CLIENT_CONTROL, h3Cat([h3Varint(H3_STREAM_CONTROL), h3Frame(H3_FRAME_SETTINGS, big)]), false);
  closedWith(t, "SETTINGS past H3_CONTROL_FRAME_MAX, 1,024 bytes: H3_EXCESSIVE_LOAD", p, H3_EXCESSIVE_LOAD);
  p = h3Ready();
  p.send(CLIENT_CONTROL, h3Frame(H3_FRAME_GOAWAY, big), false);
  closedWith(t, "a GOAWAY that long can only be the wrong length: H3_FRAME_ERROR", p, H3_FRAME_ERROR);
};

/** Identifiers that move the wrong way (§5.2, §7.2.7, §7.2.3): H3_ID_ERROR. */
const identifiers = (t: Suite): void => {
  let p: H3Peer = h3Ready();
  p.send(CLIENT_CONTROL, h3Cat([h3Frame(H3_FRAME_GOAWAY, h3Varint(n64(8))), h3Frame(H3_FRAME_GOAWAY, h3Varint(n64(12)))]), false);
  closedWith(t, "a client's GOAWAY whose push ID rises: H3_ID_ERROR", p, H3_ID_ERROR);
  p = h3Ready();
  p.send(CLIENT_CONTROL, h3Cat([h3Frame(H3_FRAME_MAX_PUSH_ID, h3Varint(n64(5))), h3Frame(H3_FRAME_MAX_PUSH_ID, h3Varint(n64(3)))]), false);
  closedWith(t, "a MAX_PUSH_ID that falls", p, H3_ID_ERROR);
  p = h3Ready();
  p.send(CLIENT_CONTROL, h3Frame(H3_FRAME_CANCEL_PUSH, h3Varint(n64(0))), false);
  closedWith(t, "CANCEL_PUSH with no push ID allowed", p, H3_ID_ERROR);
  p = h3Ready();
  p.send(CLIENT_CONTROL, h3Cat([h3Frame(H3_FRAME_MAX_PUSH_ID, h3Varint(n64(5))), h3Frame(H3_FRAME_CANCEL_PUSH, h3Varint(n64(6)))]), false);
  closedWith(t, "CANCEL_PUSH past the MAX_PUSH_ID", p, H3_ID_ERROR);
};

/** QPACK's errors are connection errors (RFC 9204 §6). */
const qpack = (t: Suite): void => {
  let p: H3Peer = h3Ready();
  p.send(CLIENT_ENCODER, [toU8(0x21)], false);
  closedWith(t, "a Set Dynamic Table Capacity above 0: QPACK_ENCODER_STREAM_ERROR", p, QPACK_ENCODER_STREAM_ERROR);
  p = h3Ready();
  p.send(CLIENT_ENCODER, fromHex("c00161"), false);
  closedWith(t, "an Insert With Name Reference", p, QPACK_ENCODER_STREAM_ERROR);
  p = h3Ready();
  p.send(CLIENT_DECODER, [toU8(0x80)], false);
  closedWith(t, "a Section Acknowledgment on the decoder stream: QPACK_DECODER_STREAM_ERROR", p, QPACK_DECODER_STREAM_ERROR);
  p = h3Ready();
  p.send(CLIENT_DECODER, [toU8(0x01)], false);
  closedWith(t, "an Insert Count Increment", p, QPACK_DECODER_STREAM_ERROR);
  p = h3Ready();
  p.send(n64(0), h3Frame(H3_FRAME_HEADERS, fromHex("0100d1")), true);
  closedWith(t, "a field section with a Required Insert Count: QPACK_DECOMPRESSION_FAILED", p, QPACK_DECOMPRESSION_FAILED);
  p = h3Ready();
  p.send(n64(0), h3Frame(H3_FRAME_HEADERS, fromHex("0000ff2c")), true);
  closedWith(t, "a static index past 98", p, QPACK_DECOMPRESSION_FAILED);
  p = h3Ready();
  const empty: u8[] = [];
  p.send(n64(0), h3Frame(H3_FRAME_HEADERS, empty), true);
  closedWith(t, "an empty HEADERS frame, which has no section prefix", p, QPACK_DECOMPRESSION_FAILED);
};

/** Every check, in one suite. */
export const errorChecks = (): i32 => {
  const t = new Suite("http3 errors");
  streamTypes(t);
  critical(t);
  unexpected(t);
  lengths(t);
  identifiers(t);
  qpack(t);
  return t.done();
};
