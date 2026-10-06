// One real exchange with a `wtransport` 0.7.0 client (the Rust crate on
// quinn and rustls, the one cs's relay runs on today), recorded by `main.ts
// record` (`record.ts`) on 2026-10-06 over loopback and replayed here, byte
// for byte, by a Nish client against the Nish server. The client:
//
//     let connection = Endpoint::client(config)?.connect("https://127.0.0.1:53378/golden").await?;
//     connection.send_datagram(b"datagram from wtransport")?;      // echoed
//     let (mut send, mut recv) = connection.open_bi().await?.await?;
//     send.write_all(b"bidi from wtransport").await?; send.finish().await?;   // echoed on it
//     let mut uni = connection.open_uni().await?.await?;
//     uni.write_all(b"uni from wtransport").await?; uni.finish().await?;     // echoed on the server's
//     connection.send_datagram(b"close")?;                     // the server closes: 7, "bye"
//     connection.closed().await;
//
// Two things in what it sends differ from run to run, and the recording
// holds one sample of each: the order of its SETTINGS, which it builds from a
// hash map, and the port in `:authority`. Everything else was the same over
// three runs. What the server sends back is deterministic, and is pinned
// here byte for byte. What the recording shows of wtransport 0.7:
//
// - It opens only its control stream (2) — no QPACK encoder or decoder
//   stream, which RFC 9204 allows at dynamic table capacity 0 — so its
//   WebTransport unidirectional stream is 6.
// - Its SETTINGS are QPACK 0 and 0, SETTINGS_ENABLE_CONNECT_PROTOCOL 1,
//   SETTINGS_ENABLE_WEBTRANSPORT (0x2b603742, draft-02) 1,
//   SETTINGS_WEBTRANSPORT_MAX_SESSIONS (0xc671706a, draft-07) 1 and
//   SETTINGS_H3_DATAGRAM (0x33) 1.
// - Its CONNECT carries no `origin` and no `sec-webtransport-http3-draft02`.
// - It answers the server's CLOSE_WEBTRANSPORT_SESSION by closing the whole
//   QUIC connection with H3_NO_ERROR (0x100), its RESET_STREAM of the CONNECT
//   stream discarded with the rest of its streams.
import { Suite } from "nish/testing";
import { quicPushConnectionClose } from "nish/net/quic-frame";
import { H3_NO_ERROR } from "nish/net/http3-frame";
import { fromHex, textOf } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import { WtLimits, WtPeer, wtConnect, wtHexOf, wtLogged } from "./peer";

/** The recording: what the client sent on each stream, and its datagrams. */
const WT_GOLDEN_CONTROL: string = "000416ab60374201080101000700c0000000c671706a013301";
const WT_GOLDEN_CONNECT: string =
  "01310000508b089d5c0b8170dc6d965d7bcf51856263d1216a2f00b95d8749c87a3f89f058d360ea4567b13f5f07849d29ad1f";
const WT_GOLDEN_BIDI: string = "404100626964692066726f6d20777472616e73706f7274";
const WT_GOLDEN_UNI: string = "405400756e692066726f6d20777472616e73706f7274";
const WT_GOLDEN_DATAGRAM: string = "00646174616772616d2066726f6d20777472616e73706f7274";
const WT_GOLDEN_CLOSE_DATAGRAM: string = "00636c6f7365";

/** The client's datagram `hex`, sent as recorded. */
const replayDatagram = (p: WtPeer, hex: string): void => {
  p.rawDatagram(fromHex(hex));
};

/** The recording, replayed. */
const replay = (t: Suite): void => {
  const limits = new WtLimits();
  limits.sessions = n32(1);
  const p: WtPeer = wtConnect(limits);
  p.send(n64(2), fromHex(WT_GOLDEN_CONTROL), false);
  t.ok("wtransport's SETTINGS are read: draft-02 and draft-07 WebTransport, HTTP datagrams, extended CONNECT", p.h3.settingsSeen && p.h3.peer.enableWebtransport === n64(1) && p.h3.peer.webtransportMaxSessions === n64(1) && p.h3.peer.h3Datagram === n64(1) && p.h3.peer.enableConnectProtocol === n64(1));
  p.send(n64(0), fromHex(WT_GOLDEN_CONNECT), false);
  p.settle();
  wtLogged(t, "its CONNECT is a session", p, ["session 0 /golden"]);
  t.eqStr("whose fields are wtransport's", `${textOf(p.wt.fields.method)} ${textOf(p.wt.fields.scheme)} ${textOf(p.wt.fields.authority)} ${textOf(p.wt.fields.protocol)}`, "CONNECT https 127.0.0.1:53378 webtransport");
  t.eqStr(
    "the server's SETTINGS, byte for byte",
    wtHexOf(p.stream(n64(3)).data),
    "0004190100070006600008013301ab60374201c0000000c671706a01",
  );
  t.eqStr("its QPACK streams' types", `${wtHexOf(p.stream(n64(7)).data)} ${wtHexOf(p.stream(n64(11)).data)}`, "02 03");
  t.eqStr(
    "the 200, byte for byte: :status 200 by static index, sec-webtransport-http3-draft: draft02 as Huffman literals",
    wtHexOf(p.stream(n64(0)).data),
    "011f0000d92f0d4148b782c69b07522b3d895a74a6b65692c1ca9f8592c1ca900b",
  );
  replayDatagram(p, WT_GOLDEN_DATAGRAM);
  t.eqStr("the datagram comes back as it went", wtHexOf(p.datagrams[0]), WT_GOLDEN_DATAGRAM);
  p.send(n64(4), fromHex(WT_GOLDEN_BIDI), true);
  p.settle();
  t.eqStr("the bidirectional stream is echoed on itself", `${textOf(p.stream(n64(4)).data)} ${p.stream(n64(4)).fin}`, "bidi from wtransport true");
  p.send(n64(6), fromHex(WT_GOLDEN_UNI), true);
  p.settle();
  t.eqStr("the unidirectional one on the server's stream 15: 0x54, session 0, the bytes, FIN", `${wtHexOf(p.stream(n64(15)).data)} ${p.stream(n64(15)).fin}`, `${WT_GOLDEN_UNI} true`);
  p.echo = false;
  replayDatagram(p, WT_GOLDEN_CLOSE_DATAGRAM);
  wtLogged(t, "the program saw every part of it", p, ["session 0 /golden", "datagram 0 24", "stream 4 bidi of 0", "end 4", "stream 6 uni of 0", "end 6", "datagram 0 5"]);
  const bye: u8[] = fromHex("627965");
  t.eqI32("the server closes the session: 7, \"bye\"", p.wt.close(n64(0), n64(7), bye, n32(0), n32(3)), n32(0));
  p.settle();
  t.eqStr(
    "CLOSE_WEBTRANSPORT_SESSION in a DATA frame after the 200, byte for byte, and the FIN",
    `${wtHexOf(p.stream(n64(0)).data).slice(n32(66))} ${p.stream(n64(0)).fin}`,
    "000a68430700000007627965 true",
  );
  const close: u8[] = [];
  quicPushConnectionClose(close, true, H3_NO_ERROR, n64(0), fromHex(""));
  p.packet(close);
  t.eqStr("wtransport closes the connection with H3_NO_ERROR, and the program is told", p.log[toI32(p.log.length) - 1], "error 0x100");
};

export const goldenChecks = (t: Suite): void => {
  replay(t);
};
