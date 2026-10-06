// `Http3Connection.writeData` takes its body as a window `(buf, off, len)` the
// program chose, so a window that does not lie inside its buffer panics
// rather than reading past it, before anything about the stream is asked. It
// panics, on stderr, with
//
//     Http3Connection.writeData: the window [4, 4 + 8) is outside a buffer of 8 bytes
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { Http3Connection } from "nish/net/http3";
import { n64 } from "../net_quic_frame/typed";
import { h3Fresh } from "../net_http3/peer";

export const main = (): i32 => {
  const h3: Http3Connection = h3Fresh();
  const body: u8[] = new Array<u8>(8);
  console.log(`a window inside the buffer, on no stream: ${h3.writeData(n64(0), body, 4, 4, false)}`);
  console.log(`unreachable: ${h3.writeData(n64(0), body, 4, 8, false)}`);
  return 0;
};
