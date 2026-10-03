// A QUIC handshake and a stream echo between aioquic and `nish/net/quic`,
// replayed over loopback by a Nish UDP client.
//
// `record.sh` ran this program as `app serve <port>`, a live server, and
// pointed `aioquic-client.py` at it: aioquic completed the handshake, sent a
// line on a bidirectional stream with FIN, read the echo back and closed. The
// server printed every datagram it received (`c`) and sent (`s`), the stream
// data it echoed (`e`) and how the connection ended (`x`); that transcript is
// `recording.ts`. Run with no arguments, as `npm test` does, this program is
// the replay: a second UDP socket sends the recorded client datagrams to the
// same server code, one at a time, and every datagram the server answers must
// be the recorded one byte for byte. The server's randomness is fixed
// (`server.ts`), and the client's came from aioquic's own bytes, so nothing
// the server sends can differ unless its behaviour did.
//
// Every wait has a five-second timeout, so a lost datagram is a failure, never
// a hung suite.
import { live, replay } from "./replay";

export const main = (): i32 => {
  if (toI32(process.argv.length) > 2 && process.argv[1] === "serve") {
    return live(parseInt(process.argv[2]));
  }
  return replay();
};
