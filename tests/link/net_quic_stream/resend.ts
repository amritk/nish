// A stream whose resend range was all acknowledged before it went again
// (H3-7 in docs/security/http3.md): `putResend` clears the range, and the
// same `putNextChunk` must go on to the stream's new bytes rather than
// answer an empty packet while they wait. Driven on `QuicStreams` directly,
// as `nish/net/quic` drives it.
import { Suite } from "nish/testing";
import { QuicStreams } from "nish/net/quic-stream";
import { n32, n64 } from "../net_quic_frame/typed";
import { nqText } from "./common";
import { bytesOf } from "../crypto_x509/hex";

/** Every check of this file. */
export const resendChecks = (t: Suite): void => {
  const s = new QuicStreams(n64(4), n64(0), n64(0), n32(1024), n64(65536));
  s.setPeerLimits(n64(65536), n64(1024), n64(1024), n64(1024), n64(4), n64(0));
  const hello: u8[] = bytesOf(nqText(n32(10)));
  s.onStream(n64(0), n64(0), hello, n32(0), n32(10), false);
  const first: u8[] = bytesOf(nqText(n32(100)));
  s.write(n64(0), first, n32(0), n32(100), false);
  const buf: u8[] = new Array<u8>(1200);
  s.beginPacket();
  const sent: i32 = s.putNextChunk(buf, n32(0), n32(1200));
  t.ok("a stream's first 100 bytes go out in one frame", sent > 0 && s.lastOffset === n64(0) && s.lastLength === n32(100));
  // Declared lost, so queued to go again, then acknowledged after all, late.
  s.chunkLost(n64(0), n64(0), n32(100), false);
  s.chunkAcked(n64(0), n64(0), n32(100), false);
  const more: u8[] = bytesOf(nqText(n32(50)));
  s.write(n64(0), more, n32(0), n32(50), false);
  s.beginPacket();
  const next: i32 = s.putNextChunk(buf, n32(0), n32(1200));
  t.ok(
    "with every byte it would send again acknowledged, the next packet carries its 50 new bytes, not nothing",
    next > 0 && s.lastOffset === n64(100) && s.lastLength === n32(50)
  );
};
