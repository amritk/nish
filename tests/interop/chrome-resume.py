"""Chrome resumes a TLS 1.3 session with the Nish interop server.

The interop job runs this with Playwright's own Chromium, against the
server's HTTP/2 port with session tickets on. Chrome trusts the server's
certificate by `--ignore-certificate-errors-spki-list`: the script reads the
certificate from the HTTP/2 port, checks that its SHA-256 is the one the
server wrote to `--hash-file`, the hash the WebTransport lane pins, and pins
the base64 SHA-256 of its SubjectPublicKeyInfo. That read is a handshake of
its own, so the script waits for the server to log it before it counts.

Then two navigations to `/close`, which the server answers and follows with
GOAWAY, so the first connection is gone before the second navigation and
Chrome must open a new one. The verdict comes from the server's log, which
the job streams to `<log file>`, not from Chrome: the first navigation's
handshake must be `tls: full`, its connection must be closed before the
second navigation, and the second navigation's handshake must be
`tls: resumed`. The script exits 0 only then.

    python3 chrome-resume.py <h2 port> <hash file> <log file>
"""

import base64
import hashlib
import socket
import ssl
import sys
import time

from playwright.sync_api import sync_playwright

CLOSED = "h2 connection closed"


def der_item(der: bytes, at: int) -> tuple[int, int, int]:
    """The DER item at `at`: its tag, where its contents start, and where it ends."""
    tag = der[at]
    length = der[at + 1]
    start = at + 2
    if length & 0x80:
        count = length & 0x7F
        length = int.from_bytes(der[start : start + count], "big")
        start += count
    return tag, start, start + length


def spki(certificate: bytes) -> bytes:
    """The SubjectPublicKeyInfo of a DER certificate, whole."""
    _, tbs, _ = der_item(certificate, 0)
    _, at, _ = der_item(certificate, tbs)
    # version [0] when present, serial, signature, issuer, validity, subject
    tag, _, end = der_item(certificate, at)
    skip = 5 if tag == 0xA0 else 4
    for _ in range(skip):
        at = end
        _, _, end = der_item(certificate, at)
    at = end
    _, _, end = der_item(certificate, at)
    return certificate[at:end]


def certificate_of(port: int) -> bytes:
    """The leaf certificate the server presents on `port`, unverified."""
    context = ssl.create_default_context()
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE
    context.set_alpn_protocols(["h2"])
    with socket.create_connection(("127.0.0.1", port), timeout=10) as raw:
        with context.wrap_socket(raw) as tls:
            return tls.getpeercert(binary_form=True)


def log_lines(path: str) -> list[str]:
    with open(path, encoding="utf-8", errors="replace") as f:
        return [line.strip() for line in f]


def handshakes_since(path: str, seen: int, want_closed: bool) -> tuple[list[str], int]:
    """
    The `tls:` lines the log gained after its first `seen` lines, once at
    least one has come (and, with `want_closed`, a connection-closed line
    after it), waiting up to ten seconds; and the log's new length.
    """
    deadline = time.monotonic() + 10
    while True:
        lines = log_lines(path)
        new = lines[seen:]
        tls = [line for line in new if line.startswith("tls: ")]
        closed = any(line.startswith(CLOSED) for line in new)
        if (tls and (closed or not want_closed)) or time.monotonic() > deadline:
            # A moment more, so a handshake Chrome opens on the side shows up too.
            time.sleep(0.5)
            lines = log_lines(path)
            return [line for line in lines[seen:] if line.startswith("tls: ")], len(lines)
        time.sleep(0.1)


def main() -> int:
    h2_port, hash_file, log_file = int(sys.argv[1]), sys.argv[2], sys.argv[3]
    with open(hash_file, encoding="ascii") as f:
        pinned = f.read().strip()
    seen = len(log_lines(log_file))
    certificate = certificate_of(h2_port)
    _, seen = handshakes_since(log_file, seen, False)
    if hashlib.sha256(certificate).hexdigest() != pinned:
        print(f"FAIL  the certificate on port {h2_port} is not the one in {hash_file}")
        return 1
    pin = base64.b64encode(hashlib.sha256(spki(certificate)).digest()).decode("ascii")
    print(f"spki sha256 {pin}")

    url = f"https://127.0.0.1:{h2_port}/close"
    with sync_playwright() as p:
        browser = p.chromium.launch(args=[f"--ignore-certificate-errors-spki-list={pin}"])
        page = browser.new_page()
        # A favicon request would be one more connection to account for.
        page.route("**/favicon.ico", lambda route: route.abort())
        first = page.goto(url)
        body = first.text() if first is not None else ""
        protocol = page.evaluate("performance.getEntriesByType('navigation')[0].nextHopProtocol")
        print(f"chrome {browser.version}: first navigation {first.status if first else 'none'} {protocol} {body.strip()!r}")
        full, seen = handshakes_since(log_file, seen, True)
        second = page.goto(url)
        body = second.text() if second is not None else ""
        protocol = page.evaluate("performance.getEntriesByType('navigation')[0].nextHopProtocol")
        print(f"chrome {browser.version}: second navigation {second.status if second else 'none'} {protocol} {body.strip()!r}")
        resumed, seen = handshakes_since(log_file, seen, False)
        browser.close()
    print(f"server, first navigation: {full}")
    print(f"server, second navigation: {resumed}")
    ok = full == ["tls: full"] and resumed == ["tls: resumed"]
    print("PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
