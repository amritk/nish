// Version Negotiation, Retry, key update both ways, the idle timeout and the
// stateless reset between aioquic and `nish/net/quic-listener` with
// `nish/net/quic`, each replayed over loopback by a Nish UDP client.
//
// `record.sh` ran this program as `app serve <port> <scenario>`, a live
// server, and pointed `aioquic-client.py` at it for each scenario:
//
// - `version`: aioquic opens in QUIC version 2, which the server does not
//   speak; it answers Version Negotiation, and aioquic completes a handshake
//   and an echo in version 1.
// - `retry`: the server answers the first Initial with a Retry, and aioquic
//   comes back with the token and completes a handshake and an echo.
// - `keys`: aioquic updates its keys and sends a line, which the server
//   follows; after a probe timeout the server starts an update of its own
//   before echoing a second line, which aioquic follows.
// - `idle`: after an echo aioquic falls silent, and the server closes the
//   connection, silently, when its three-second idle timeout passes.
// - `reset`: after an echo the server forgets the connection as a restart
//   would, and answers aioquic's next packet with a stateless reset, which the
//   client script recognises by the token the server gave it.
//
// The server printed every datagram it received (`c`: the time, the client's
// address and the bytes), each timer it ran (`t`), what the listener decided
// (`l`), the stream data it echoed (`e`), the key update it started (`k`),
// every datagram it sent (`s`) and how the scenario ended (`x`); those
// transcripts are the `recording-*.ts` files. Run with no arguments, as
// `npm test` does, this program is the replay: a second UDP socket sends the
// recorded client datagrams to the same server code at their recorded times,
// and every line the server prints and every datagram it sends must be the
// recorded one, byte for byte. The server's entropy and static keys are fixed
// (`server.ts`), and the client's bytes came from aioquic, so nothing can
// differ unless the server's behaviour did.
//
// Every wait has a five-second timeout, so a lost datagram is a failure, never
// a hung suite.
import { lcLive, lcReplay } from "./replay";

export const main = (): i32 => {
  if (toI32(process.argv.length) > 3 && process.argv[1] === "serve") {
    return lcLive(parseInt(process.argv[2]), process.argv[3]);
  }
  return lcReplay();
};
