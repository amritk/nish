"""Chrome against the Nish interop server, over WebTransport.

The interop job runs this with Playwright's own Chromium. The page is the
server's HTTP/1.1 `/hello` on localhost, which is a secure context, as
WebTransport requires. From it Chrome opens a WebTransport session over
HTTP/3 to the server's QUIC port, pinning the server's minted certificate
by `serverCertificateHashes` (the SHA-256 the server wrote to `--hash-file`).
It echoes a datagram, then a bidirectional stream, and closes the session.
The script exits 0 when both come back byte for byte.

    python3 chrome-webtransport.py <h1 port> <quic port> <hash file>
"""

import json
import sys

from playwright.sync_api import sync_playwright

ECHO = """
async ({ port, hash }) => {
  const pinned = new Uint8Array(hash.match(/../g).map((h) => parseInt(h, 16)));
  const wt = new WebTransport(`https://127.0.0.1:${port}/echo`, {
    serverCertificateHashes: [{ algorithm: "sha-256", value: pinned }],
  });
  await wt.ready;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  // A datagram may be lost, so it goes again every 200 ms until one comes back.
  const writer = wt.datagrams.writable.getWriter();
  const reader = wt.datagrams.readable.getReader();
  let datagram = null;
  for (let attempt = 0; attempt < 25 && datagram === null; attempt++) {
    await writer.write(encoder.encode("ping from chrome"));
    const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 200));
    const got = await Promise.race([reader.read(), timeout]);
    if (got !== null) {
      datagram = decoder.decode(got.value);
    }
  }

  const stream = await wt.createBidirectionalStream();
  const out = stream.writable.getWriter();
  await out.write(encoder.encode("a bidirectional stream from chrome"));
  await out.close();
  const parts = [];
  const input = stream.readable.getReader();
  while (true) {
    const { value, done } = await input.read();
    if (done) {
      break;
    }
    parts.push(decoder.decode(value, { stream: true }));
  }
  wt.close({ closeCode: 0, reason: "done" });
  return { datagram, stream: parts.join("") };
}
"""


def main() -> int:
    h1_port, quic_port, hash_file = sys.argv[1], int(sys.argv[2]), sys.argv[3]
    with open(hash_file, encoding="ascii") as f:
        pinned = f.read().strip()
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.on("console", lambda message: print(f"console: {message.text}"))
        page.goto(f"http://localhost:{h1_port}/hello")
        result = page.evaluate(ECHO, {"port": quic_port, "hash": pinned})
        print(f"chrome {browser.version}: {json.dumps(result)}")
        browser.close()
    ok = result["datagram"] == "ping from chrome" and result["stream"] == "a bidirectional stream from chrome"
    print("PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
