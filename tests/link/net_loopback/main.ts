// The loopback suite of wp34 §5a: for every carrier — TLS over TCP, HTTP/1.1,
// WebSocket, HTTP/2, QUIC, HTTP/3 and WebTransport — a Nish server on the
// standard library's carrier and a scripted Nish client, on real loopback
// sockets in one `pollWait` loop. Each lane's own case drives its server with
// its own client; this one drives every carrier the way the relay and cs
// will, so two lanes that pass their own vectors but disagree with each other
// fail here. The checks are in `checks.ts`.
import { loopbackChecks } from "./checks";

export const main = (): i32 => loopbackChecks();
