// `nish/net/http3-server` when a client's NAT rebinds mid-connection (RFC
// 9000 §9.3): the client of `loopback.ts` moves to a new UDP socket, a new
// port, between two requests, and the server must answer there, validate it
// with a PATH_CHALLENGE the client answers, and send the old port nothing
// more. Written against the carrier's API alone, so the same file built
// against the server before it followed an address change shows the
// response still going to the first port.
import { netLocalPort, udpBind, udpRecvFrom } from "nish:net";
import { Suite } from "nish/testing";
import { QUIC_FRAME_PATH_CHALLENGE, QUIC_FRAME_PATH_RESPONSE, quicPushPathData, quicPushStream } from "nish/net/quic-frame";
import { H3_STREAM_CONTROL, H3_STREAM_QPACK_DECODER, H3_STREAM_QPACK_ENCODER } from "nish/net/http3-frame";
import { n32, n64 } from "../net_quic_frame/typed";
import { QcFound, qcData, qcFind } from "../net_quic_conn/common";
import { qmPlain } from "../net_quic_memory/meter";
import { CLIENT_CONTROL, CLIENT_DECODER, CLIENT_ENCODER, H3Limits, WireWait, h3Cat, h3ClientSettings, h3QuicConfig, h3Varint } from "../net_http3/peer";
import { Lean, LoopServer, leanHandshake, leanPacket } from "./loopback";

/** The bytes of every datagram the client has read from index `from` on. */
const readSince = (l: Lean, from: i32): i32 => {
  let total: i32 = 0;
  for (let k: i32 = from; k < toI32(l.c.datagrams.length); k++) {
    total = total + toI32(l.c.datagrams[k].length);
  }
  return total;
};

/** How many datagrams are waiting on `fd`, read and dropped. */
const drain = (fd: i32): i32 => {
  const rx: u8[] = new Array<u8>(65536);
  const from: u8[] = new Array<u8>(18);
  const meta: i32[] = [n32(0), n32(0)];
  let count: i32 = 0;
  while (udpRecvFrom(fd, rx, n32(0), n32(65536), from, meta) >= 0) {
    count++;
  }
  return count;
};

/** The client's request `index` on stream `4 * index`, ending it. */
const request = (l: Lean, index: i32): void => {
  const payload: u8[] = [];
  quicPushStream(payload, toI64(index) * n64(4), n64(0), l.request, n32(0), toI32(l.request.length), true);
  leanPacket(l, payload, qmPlain());
};

/** The first PATH_CHALLENGE among the client's 1-RTT payloads from index `from` on. */
const challengeSince = (l: Lean, from: i32): QcFound => {
  const payloads: u8[][] = [];
  for (let k: i32 = from; k < toI32(l.c.appPayloads.length); k++) {
    payloads.push(l.c.appPayloads[k]);
  }
  return qcFind(payloads, QUIC_FRAME_PATH_CHALLENGE);
};

/**
 * A client that moves to a new socket between two requests: the second
 * request's response reaches the new port, after a PATH_CHALLENGE there the
 * client answers, and a third request after that is answered there too;
 * nothing more goes to the first port.
 */
const rebound = (t: Suite): void => {
  const limits = new H3Limits();
  const loop = new LoopServer(h3QuicConfig(limits), n32(1), n32(0));
  const l = new Lean(loop);
  if (!leanHandshake(l, limits, qmPlain())) {
    t.fail("a handshake before the rebinding", "the client could not read the server's flight");
    return;
  }
  const control: u8[] = h3Cat([h3Varint(H3_STREAM_CONTROL), h3ClientSettings(n64(-1))]);
  const open: u8[] = [];
  quicPushStream(open, CLIENT_CONTROL, n64(0), control, n32(0), toI32(control.length), false);
  quicPushStream(open, CLIENT_ENCODER, n64(0), h3Varint(H3_STREAM_QPACK_ENCODER), n32(0), n32(1), false);
  quicPushStream(open, CLIENT_DECODER, n64(0), h3Varint(H3_STREAM_QPACK_DECODER), n32(0), n32(1), false);
  leanPacket(l, open, qmPlain());
  const first: i32 = toI32(l.c.datagrams.length);
  request(l, n32(0));
  t.ok("before the rebinding, the first response reaches the client's first port", l.answered === n32(1) && readSince(l, first) > n32(1000));

  // The NAT rebinds: the client's datagrams come from a new port.
  const home: i32 = l.fd;
  l.fd = udpBind("127.0.0.1", n32(0), n32(0));
  l.wait = new WireWait();
  l.wait.watch(loop.server.fd);
  l.wait.watch(l.fd);
  const moved: i32 = toI32(l.c.datagrams.length);
  const movedPayloads: i32 = toI32(l.c.appPayloads.length);
  request(l, n32(1));
  t.ok("after the client's port changes, the next response reaches the new port", l.answered === n32(2) && readSince(l, moved) > n32(1000));
  const port: i32 = toI32(loop.server.addresses[0][16]) * 256 + toI32(loop.server.addresses[0][17]);
  t.eqI32("the slot's address follows the client to it", port, netLocalPort(l.fd));
  const challenge: QcFound = challengeSince(l, movedPayloads);
  t.ok("and the server validates the new port with a PATH_CHALLENGE sent there (§8.2)", challenge.found);
  if (challenge.found) {
    const answer: u8[] = [];
    quicPushPathData(answer, QUIC_FRAME_PATH_RESPONSE, qcData(challenge), n32(0));
    leanPacket(l, answer, qmPlain());
  }
  const after: i32 = toI32(l.c.datagrams.length);
  request(l, n32(2));
  t.ok("answered, the new port carries the next request and its response", l.answered === n32(3) && readSince(l, after) > n32(1000));
  t.eqI32("and nothing after the rebinding went to the first port", drain(home), n32(0));
  loop.server.stop();
};

/** Every check of this file. */
export const rebindChecks = (t: Suite): void => {
  rebound(t);
};
