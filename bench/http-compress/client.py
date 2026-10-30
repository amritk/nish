#!/usr/bin/env python3
"""The client for bench/http-compress/run.mjs: one keep-alive HTTP/1.1
connection that asks for `requests` bodies in a fixed random order, each with
`Accept-Encoding: gzip`, checks every answer against the body file (gunzipped
when it came gzip), and prints one JSON line of what the connection's
TCP_INFO counted over those requests.

  client.py <port> <requests> <seed> <body>...

Before it connects it sets TCP_MAXSEG to 1460, the MSS an Ethernet peer
advertises, so the server sends segments of 1448 bytes (1460 less the
timestamp option) over loopback, whose own MTU is 64 KB. TCP_INFO is read
after the connection opens and after the last answer, so the handshake and the
close are not counted.
"""
import gzip
import json
import random
import socket
import struct
import sys
import time

ADVERTISED_MSS = 1460


def tcp_info(sock):
    """The counters of struct tcp_info (linux/tcp.h) this client reads."""
    raw = sock.getsockopt(socket.IPPROTO_TCP, socket.TCP_INFO, 232)
    snd_mss, rcv_mss = struct.unpack_from("<II", raw, 16)
    bytes_received = struct.unpack_from("<Q", raw, 128)[0]
    segs_out, segs_in = struct.unpack_from("<II", raw, 136)
    data_segs_in, data_segs_out = struct.unpack_from("<II", raw, 152)
    return {
        "snd_mss": snd_mss,
        "rcv_mss": rcv_mss,
        "bytes_received": bytes_received,
        "segs_out": segs_out,
        "segs_in": segs_in,
        "data_segs_in": data_segs_in,
        "data_segs_out": data_segs_out,
    }


def read_response(stream):
    """One response from a buffered reader: its fields, lower-cased, and its body."""
    status = stream.readline()
    if not status.startswith(b"HTTP/1.1 200"):
        raise SystemExit(f"bad status line {status!r}")
    fields = {}
    while True:
        line = stream.readline()
        if line in (b"\r\n", b""):
            break
        name, _, value = line.decode("latin-1").partition(":")
        fields[name.strip().lower()] = value.strip()
    body = stream.read(int(fields["content-length"]))
    return fields, body


def main():
    port, requests, seed = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3])
    bodies = [open(path, "rb").read() for path in sys.argv[4:]]
    order = random.Random(seed)
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_MAXSEG, ADVERTISED_MSS)
    sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
    sock.connect(("127.0.0.1", port))
    stream = sock.makefile("rb")
    before = tcp_info(sock)
    gzipped = 0
    varied = 0
    plain_bytes = 0
    started = time.perf_counter()
    for _ in range(requests):
        k = order.randrange(len(bodies))
        sock.sendall(f"GET /{k} HTTP/1.1\r\nHost: bench\r\nAccept-Encoding: gzip\r\n\r\n".encode())
        fields, body = read_response(stream)
        if fields.get("content-encoding") == "gzip":
            gzipped += 1
            body = gzip.decompress(body)
        if "vary" in fields:
            varied += 1
        if body != bodies[k]:
            raise SystemExit(f"body {k} came back as other bytes")
        plain_bytes += len(body)
    elapsed = time.perf_counter() - started
    after = tcp_info(sock)
    sock.close()
    counts = {key: after[key] - before[key] for key in before if key not in ("snd_mss", "rcv_mss")}
    print(
        json.dumps(
            {
                "requests": requests,
                "gzipped": gzipped,
                "varied": varied,
                "plain_bytes": plain_bytes,
                "rcv_mss": after["rcv_mss"],
                "seconds": elapsed,
                **counts,
            }
        )
    )


main()
