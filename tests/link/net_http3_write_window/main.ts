// `Http3Connection.writeData` takes its body as a window `(buf, off, len)` the program
// chose, so a window that does not lie inside its buffer answers H3_INVALID
// (-22) rather than reading past it, before anything about the stream or
// session is asked. Neither call panics, and the program exits 0.
import { Http3Connection } from "nish/net/http3";
import { n64 } from "../net_quic_frame/typed";
import { h3Fresh } from "../net_http3/peer";

export const main = (): i32 => {
  const h3: Http3Connection = h3Fresh();
  const body: u8[] = new Array<u8>(8);
  console.log(`a window inside the buffer, on no stream: ${h3.writeData(n64(0), body, 4, 4, false)}`);
  console.log(`a window outside it: ${h3.writeData(n64(0), body, 4, 8, false)}`);
  return 0;
};
