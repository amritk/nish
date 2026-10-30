# bench/gzip/compare's Python comparator: zlib.compressobj with gzip framing
# (wbits 31), which has no reset, so a fresh one per call, and zlib.decompress.
# Same arguments and row format as bench/gzip/main.ts: compare.mjs reads the
# lines.
import sys
import time
import zlib

body = open(sys.argv[1], "rb").read()
calls = int(sys.argv[2])
streams = [open(sys.argv[3], "rb").read(), open(sys.argv[4], "rb").read()]


def gzip(level):
    c = zlib.compressobj(level, zlib.DEFLATED, 31)
    return c.compress(body) + c.flush()


for level, stream in ((1, streams[0]), (6, streams[1])):
    for _ in range(200):
        out = gzip(level)
    t = time.perf_counter_ns()
    for _ in range(calls):
        out = gzip(level)
    print(f"python gzip -{level} {len(body)} {len(out)} {time.perf_counter_ns() - t} {calls}")
    t = time.perf_counter_ns()
    for _ in range(calls):
        if len(zlib.decompress(stream, 31)) != len(body):
            raise SystemExit("gunzip length")
    print(f"python gunzip -{level} {len(body)} {len(stream)} {time.perf_counter_ns() - t} {calls}")
