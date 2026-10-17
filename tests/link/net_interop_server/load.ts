// `main h3-load <requests>`: HTTP/3 throughput for `bench/h2load.mjs`, whose
// h2load (Ubuntu's nghttp2 1.59) is built without ngtcp2 and cannot speak
// it. The scripted QUIC client of `client.ts` turns the server's loop itself,
// so both run in this one process, over loopback: one connection, then the
// requests one after another, each a GET of `www/hello.txt` on a fresh
// stream. It prints `h3 <n> requests in <ms> ms, <failed> failed`; the time
// covers the requests, not the handshake. Run it from the repository root.
import { Secret, secret, wipe } from "nish:secret";
import { n32, n64 } from "../net_quic_frame/typed";
import { leafCertificate, leafPrivate } from "../net_tls_common/server";
import { H3Limits, h3ClientParams, h3ClientSettings } from "../net_http3/peer";
import { CONTENT, FILE, openH3, request } from "./checks";
import { decimal } from "./cli";
import { QuicClient, h3Answer } from "./client";
import { InteropOptions, InteropServer } from "./server";

/** Runs `argv[2]` requests; answers the exit code: 2 for a count it cannot read, 1 if the handshake failed. */
export const h3Load = (argv: string[]): i32 => {
  const count: i32 = toI32(argv.length) === 3 ? decimal(argv[2]) : n32(0);
  if (count < 1) {
    console.log("usage: main h3-load <requests>");
    return 2;
  }
  const options = new InteropOptions();
  options.host = "127.0.0.1";
  options.www = "tests/link/net_interop_server/www";
  options.slots = n32(1);
  const key: Secret<u8[]> = secret(leafPrivate());
  const server = new InteropServer(options, [leafCertificate()]);
  const client = new QuicClient(server);
  if (!client.connect("h3", h3ClientParams(new H3Limits()), key)) {
    console.log("h3: the handshake failed");
    wipe(key);
    return 1;
  }
  openH3(client, h3ClientSettings(n64(-1)));
  const noNames: string[] = [];
  let failed: i32 = 0;
  const started: i64 = monotonicNanos();
  for (let k: i32 = 0; k < count; k++) {
    const id: i64 = toI64(4 * k);
    client.send(id, request("GET", FILE, noNames, noNames), true);
    if (!client.turnUntil(key, id, false)) {
      failed++;
      continue;
    }
    const answer = h3Answer(client.stream(id));
    if (answer.status !== "200" || answer.body !== CONTENT) {
      failed++;
    }
  }
  const ms: i64 = (monotonicNanos() - started) / toI64(1000000);
  wipe(key);
  console.log(`h3 ${count} requests in ${ms} ms, ${failed} failed`);
  return 0;
};
