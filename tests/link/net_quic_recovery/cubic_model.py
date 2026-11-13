#!/usr/bin/env python3
"""Recompute the CUBIC windows tests/link/net_quic_recovery/cubic.ts pins:

    python3 tests/link/net_quic_recovery/cubic_model.py

An integer port of std/net/quic-recovery.ts's CUBIC (RFC 9438 §4 and §5.8),
in the same units (bytes, milliseconds, 1200-byte datagrams) and with the
same truncations. It guards the arithmetic and catches typos; it shares the
module's reading of the RFC, which the hand-derived K = 5000 ms and
W(1000) = 169280 in cubic.ts check. Python's integers do not overflow, so a
wrong clamp in the module would show here as a different figure.

    W(t)   = W_max + 2 × 1200 × (t − K)³ / 5 × 10⁹, t − K clamped to ±40000,
             the division truncating toward zero
    K      = ∛((W_max − cwnd) × 5 × 10⁹ / 2400), rounded down; 40000 once
             the fall is 25600 datagrams or more
    W_est += α × size × 1200 / (17 × cwnd), α = 9 below cwnd_prior and 17 at
             or past it, the remainder carried
    target = min(max(W(t + RTT), cwnd), 1.5 × cwnd)
    cwnd  += (target − cwnd) × size / cwnd, the remainder carried, when
             W(t) >= W_est; otherwise cwnd = max(cwnd, W_est)

An ACK finding less than half the window in flight grows nothing and starts
idle time, which the next ACK finding it in use adds to the epoch. Every RTT
sample in these scenarios is the same, so smoothed_rtt is that sample.
Each scenario prints the figures its check pins, in the order it pins them.
"""
MSS = 1200
SPAN = 40000
SCALE = 5_000_000_000


def tdiv(a, b):
    """Division truncating toward zero, as an i64 division does."""
    q = abs(a) // abs(b)
    return q if (a >= 0) == (b > 0) else -q


def cbrt(x):
    r = round(x ** (1 / 3)) if x > 0 else 0
    while r ** 3 > x:
        r -= 1
    while (r + 1) ** 3 <= x:
        r += 1
    return min(r, SPAN)


class Cubic:
    def __init__(s, cwnd, rtt):
        s.cwnd, s.rtt = cwnd, rtt
        s.ssthresh = 1 << 62
        s.wmax = s.k = s.est = s.carry = s.ccarry = s.prior = 0
        s.epoch = s.idle = s.rec = -1
        s.flight = []  # (pn, sent, size), oldest first

    def loss(s, now):
        c = s.cwnd
        s.rec = now
        s.wmax = c * 17 // 20 if c < s.wmax else c
        s.prior, s.epoch, s.idle = c, -1, -1
        s.ssthresh = c * 7 // 10
        s.cwnd = max(s.ssthresh, 2 * MSS)

    def W(s, t):
        d = max(-SPAN, min(SPAN, t - s.k))
        return s.wmax + tdiv(2 * MSS * d ** 3, SCALE)

    def send(s, pn, now, size=MSS):
        s.flight.append((pn, now, size))

    def ack(s, pn, now):
        inuse = sum(z for _, _, z in s.flight) * 2 >= s.cwnd
        (sent, size), = [(t, z) for p, t, z in s.flight if p == pn]
        s.flight = [f for f in s.flight if f[0] != pn]
        if s.epoch >= 0:
            if not inuse:
                if s.idle < 0:
                    s.idle = now
            elif s.idle >= 0:
                s.epoch += now - s.idle
                s.idle = -1
        if not inuse or (s.rec >= 0 and sent <= s.rec):
            return
        if s.cwnd < s.ssthresh:
            s.cwnd += size
            return
        c = s.cwnd
        if s.epoch < 0:
            s.epoch, s.idle, s.est, s.carry, s.ccarry = now, -1, c, 0, 0
            if s.wmax > c:
                drop = s.wmax - c
                s.k = SPAN if drop >= 25600 * MSS else cbrt(drop * SCALE // (2 * MSS))
            else:
                s.k, s.wmax = 0, c
        num = (17 if s.est >= s.prior else 9) * size * MSS + s.carry
        s.est += num // (17 * c)
        s.carry = num % (17 * c)
        t = now - s.epoch
        if s.W(t) < s.est:
            s.cwnd = max(c, s.est)
            return
        target = min(max(s.W(t + s.rtt), c), c + c // 2)
        num = (target - c) * size + s.ccarry
        s.cwnd = c + num // c
        s.ccarry = num % c


class Clock:
    """cubic.ts's `rcRound`: ACK the last round's packets one at a time, sending after each of the first n."""

    def __init__(s, r):
        s.r, s.next, s.oldest, s.count = r, 4, 4, 0

    def round(s, now, n):
        for i in range(s.count):
            s.r.ack(s.oldest, now)
            s.oldest += 1
            if i < n:
                s.r.send(s.next, now)
                s.next += 1
        for _ in range(s.count, n):
            s.r.send(s.next, now)
            s.next += 1
        s.count = n


def after_loss(rtt, wmax=0):
    """cubic.ts's `rcCubicLoss`: a 200000-byte window losing packet 0 at `rtt`."""
    r = Cubic(200000, rtt)
    r.wmax = wmax
    r.loss(rtt)
    return r


def curve():
    r = after_loss(100)
    c = Clock(r)
    c.round(101, 100)
    w, est = [], []
    for j in range(1, 72):
        c.round(101 + 100 * j, 100)
        if (j - 1) % 10 == 0:
            w.append(r.cwnd)
            est.append(r.est)
    print("curve: K", r.k, "windows at 0..7 s", *w, "| W_est at 0..6 s", *est[:7])


def friendly():
    r = after_loss(10)
    c = Clock(r)
    c.round(11, 100)
    w = []
    for j in range(1, 102):
        c.round(11 + 10 * j, 100)
        if (j - 1) % 50 == 0:
            w.append(r.cwnd)
    print("friendly: windows at 0, 0.5, 1 s", *w)
    # On to where W_est passes cwnd_prior, 200000, and α becomes 1.
    j, last = 101, 0
    while r.est < r.prior:
        j += 1
        before = r.cwnd
        c.round(11 + 10 * j, 100)
        last = r.cwnd - before
    before = r.cwnd
    c.round(11 + 10 * (j + 1), 100)
    print("alpha 1: the round reaching cwnd_prior ends at", 11 + 10 * j, "adding", last, "to", before, "| the next adds", r.cwnd - before)


def idle():
    r = after_loss(100)
    c = Clock(r)
    c.round(101, 100)
    for j in range(1, 11):
        c.round(101 + 100 * j, 100)
    print("idle: ten rounds", r.cwnd, end="")
    c.round(1201, 1)
    print(" draining", r.cwnd, "idle from", r.idle, end="")
    for j in range(12, 22):
        c.round(101 + 100 * j, 100 if j == 21 else 1)
    c.round(2301, 100)
    print(" epoch", r.epoch, "resumed", r.cwnd)


def ceiling():
    r = after_loss(10000)
    c = Clock(r)
    c.round(10001, 100)
    c.round(20001, 100)
    first = r.cwnd
    c.round(30001, 100)
    print("ceiling: K", r.k, "window at t = 0", first, "| at t = 10 s, W(t + RTT)", r.W(10000 + r.rtt), "and the window", r.cwnd)


def large():
    r = Cubic(100_000_000, 100)
    r.ssthresh, r.wmax, r.prior = 70_000_000, 105_000_000, 105_000_000
    for pn in range(127):
        r.send(pn, 0)
    r.send(127, 0, 60_000_000)
    for pn in range(127):
        r.ack(pn, 100)
    print("large: K", r.k, "W(RTT)", r.W(r.rtt), "W_est", r.est, "cwnd after 127 ACKs", r.cwnd)


curve()
friendly()
idle()
ceiling()
large()
