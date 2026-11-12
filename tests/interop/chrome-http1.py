"""Chrome speaks HTTP/1.1 and WebSocket to the Nish interop server.

The interop job runs this with Playwright's own Chromium against the
server's HTTP/1.1 ports: `<h1s port>`, over TLS, and `<h1 port>`, plain.
The TLS port signs with the test leaf of `tests/link/net_tls_common`, not
the chain `--certs` names, so Chrome trusts it by
`--ignore-certificate-errors-spki-list`: the script reads the certificate
from that port with ALPN http/1.1 and pins the base64 SHA-256 of its
SubjectPublicKeyInfo.

On each port, a navigation to `/hello` must answer 200 with its body over
`http/1.1` (Chrome offers h2 too over TLS; the server must choose
http/1.1), a `fetch` POST to `/echo` must come back byte for byte, and a
WebSocket to `/ws` (`wss:` from the TLS page, `ws:` from the plain one)
must echo a text message and a binary one. The script prints each result
and exits 0 only if all of them hold.

    python3 chrome-http1.py <h1 port> <h1s port>
"""

import base64
import hashlib
import importlib.util
import pathlib
import socket
import ssl
import sys

from playwright.sync_api import sync_playwright

# The SubjectPublicKeyInfo reader of chrome-resume.py, whose name is not a module's.
_resume = importlib.util.spec_from_file_location("chrome_resume", pathlib.Path(__file__).with_name("chrome-resume.py"))
_module = importlib.util.module_from_spec(_resume)
_resume.loader.exec_module(_module)
spki = _module.spki

HELLO = "hello from nish/net/http1\n"
BODY = "a body Chrome posts, " * 50

# Runs in the page: a POST echoed, then a WebSocket that sends a text and a binary
# message and answers what came back, or the first error.
PAGE_CHECKS = """async ([wsUrl, body]) => {
  const echoed = await (await fetch('/echo', { method: 'POST', body })).text();
  const ws = await new Promise((resolve, reject) => {
    const s = new WebSocket(wsUrl);
    s.binaryType = 'arraybuffer';
    const got = [];
    s.onerror = () => reject(new Error('websocket error'));
    s.onclose = (e) => reject(new Error(`websocket closed ${e.code}`));
    s.onmessage = (e) => {
      got.push(typeof e.data === 'string' ? `text ${e.data}` : `binary ${Array.from(new Uint8Array(e.data)).join(',')}`);
      if (got.length === 2) {
        s.onclose = null;
        s.close(1000);
        resolve(got);
      }
    };
    s.onopen = () => {
      s.send('hello over a websocket');
      s.send(new Uint8Array([0, 1, 2, 253, 254, 255]));
    };
    setTimeout(() => reject(new Error('websocket: no echo in ten seconds')), 10000);
  });
  return { echoed, ws };
}"""

WS_WANT = ["text hello over a websocket", "binary 0,1,2,253,254,255"]


def certificate_of(port: int) -> bytes:
    """The leaf certificate the server presents on `port` to a client offering http/1.1, unverified."""
    context = ssl.create_default_context()
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE
    context.set_alpn_protocols(["http/1.1"])
    with socket.create_connection(("127.0.0.1", port), timeout=10) as raw:
        with context.wrap_socket(raw) as tls:
            if tls.selected_alpn_protocol() != "http/1.1":
                raise RuntimeError(f"ALPN on port {port} chose {tls.selected_alpn_protocol()!r}")
            return tls.getpeercert(binary_form=True)


def check(what: str, got: object, want: object) -> bool:
    ok = got == want
    print(f"{'PASS' if ok else 'FAIL'}  {what}: {got!r}" + ("" if ok else f", wanted {want!r}"))
    return ok


def lane(page, origin: str, ws_url: str) -> bool:
    """The navigation, the POST and the WebSocket of one port; true if every one held."""
    response = page.goto(f"{origin}/hello")
    protocol = page.evaluate("performance.getEntriesByType('navigation')[0].nextHopProtocol")
    ok = check(f"GET {origin}/hello", (response.status, response.text()) if response else None, (200, HELLO))
    ok = check(f"over {origin}", protocol, "http/1.1") and ok
    try:
        result = page.evaluate(PAGE_CHECKS, [ws_url, BODY])
    except Exception as error:  # the page's rejection, with its message
        print(f"FAIL  POST {origin}/echo and WebSocket {ws_url}: {error}")
        return False
    ok = check(f"POST {origin}/echo, {len(BODY)} bytes", result["echoed"] == BODY, True) and ok
    return check(f"WebSocket {ws_url} echoes", result["ws"], WS_WANT) and ok


def main() -> int:
    h1_port, h1s_port = int(sys.argv[1]), int(sys.argv[2])
    pin = base64.b64encode(hashlib.sha256(spki(certificate_of(h1s_port))).digest()).decode("ascii")
    print(f"spki sha256 {pin}")
    with sync_playwright() as p:
        browser = p.chromium.launch(args=[f"--ignore-certificate-errors-spki-list={pin}"])
        print(f"chrome {browser.version}")
        page = browser.new_page()
        page.route("**/favicon.ico", lambda route: route.abort())
        ok = lane(page, f"https://127.0.0.1:{h1s_port}", f"wss://127.0.0.1:{h1s_port}/ws")
        ok = lane(page, f"http://127.0.0.1:{h1_port}", f"ws://127.0.0.1:{h1_port}/ws") and ok
        browser.close()
    print("PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
