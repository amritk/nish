"""Measure `std/math.ts`'s `tan`, `atan2` and `hypot` against mpmath.

    python3 bench/math-ulp/ulp.py <operands-output>

reads the lines `bench/math-ulp/operands.ts` prints and reports, per function,
the largest error in ulps of the exact result (mpmath at 200 bits and more)
over every finite nonzero answer, and how many special answers (a NaN, zero or
infinite operand or result) differ from JavaScript's bit for bit -- the
reference for those is `node bench/math-ulp/ref.mjs`, which this runs. The
protocol is in bench/README.md ("Math accuracy"); not run in CI.

    python3 bench/math-ulp/ulp.py --samples

prints instead the operand tables of `tests/cases/math_ulp_samples.ts`: a few
hundred operands per function, drawn across every reduction branch, each with
its correctly rounded result and the side of that result the exact value lies
on (1 above, -1 below, 0 exact).
"""

import math
import os
import random
import struct
import subprocess
import sys
import tempfile
from fractions import Fraction
from multiprocessing import Pool

import mpmath
from mpmath import mp, mpf


def from_bits(s):
    return struct.unpack("<d", struct.pack("<q", int(s)))[0]


def exact(kind, a):
    if kind == "T":
        # Enough bits to keep the reduction of the largest double exact.
        mp.prec = 200 + max(0, math.frexp(a[0])[1])
        return mpmath.tan(mpf(a[0]))
    mp.prec = 300
    if kind == "A":
        return mpmath.atan2(mpf(a[0]), mpf(a[1]))
    return mpmath.sqrt(mpf(a[0]) ** 2 + mpf(a[1]) ** 2)


def ulp_error(got, ex):
    e = int(mpmath.floor(mpmath.log(abs(ex), 2)))
    return float(abs(mpf(got) - ex) / mpf(2) ** max(e - 52, -1074))


def work(chunk):
    worst = {}
    mismatches = []
    for line, ref in chunk:
        p = line.split()
        kind = p[0]
        a = [from_bits(s) for s in p[1:-1]]
        got = from_bits(p[-1])
        want = from_bits(ref)
        special = not all(math.isfinite(v) and v != 0 for v in a) or not math.isfinite(want) or want == 0
        if special or not math.isfinite(got):
            if not (int(p[-1]) == int(ref) or (math.isnan(got) and math.isnan(want))):
                mismatches.append((kind, line, ref))
            continue
        err = ulp_error(got, exact(kind, a))
        if err > worst.get(kind, (-1.0, ""))[0]:
            worst[kind] = (err, line)
    return worst, mismatches


def measure(path):
    lines = open(path).read().split("\n")[:-1]
    here = os.path.dirname(os.path.abspath(__file__))
    with tempfile.NamedTemporaryFile(suffix=".txt") as out:
        subprocess.run(["node", os.path.join(here, "ref.mjs"), path, out.name], check=True)
        refs = open(out.name).read().split("\n")[:-1]
    pairs = list(zip(lines, refs))
    chunks = [pairs[i : i + 5000] for i in range(0, len(pairs), 5000)]
    worst = {}
    mismatches = []
    with Pool() as pool:
        for w, m in pool.imap_unordered(work, chunks):
            mismatches += m
            for k, v in w.items():
                if v[0] > worst.get(k, (-1.0, ""))[0]:
                    worst[k] = v
    for kind, name in (("T", "tan"), ("A", "atan2"), ("H", "hypot")):
        err, line = worst.get(kind, (0.0, ""))
        count = sum(1 for m in mismatches if m[0] == kind)
        print(f"{name:6s} max {err:.4f} ulp  special mismatches {count}  worst: {line}")
    for kind, line, ref in mismatches[:10]:
        print("MISMATCH", line, "javascript", ref)
    print("lines", len(pairs))
    return 1 if mismatches else 0


def rounded(ex):
    """The double nearest an mpmath value, ties to even, and the side of it the
    exact value lies on: 1 above, -1 below, 0 when the double is exact."""
    # A Fraction's float is correctly rounded, subnormals included.
    sign, man, exp, _ = mpmath.mpf(ex)._mpf_
    q = Fraction(-int(man) if sign else int(man)) * Fraction(2) ** int(exp)
    r = float(q)
    return r, (q > Fraction(r)) - (q < Fraction(r))


def draws():
    """(kind, operands) across each function's branches; a fixed seed."""
    g = random.Random(844)
    out = []

    def lu(lo, hi):
        e = g.randint(lo, hi)
        v = math.ldexp(1.0 + g.getrandbits(52) / 2.0**52, e)
        return -v if g.random() < 0.5 else v

    def nudge(x, d):
        return struct.unpack("<d", struct.pack("<q", struct.unpack("<q", struct.pack("<d", x))[0] + d))[0]

    # tan: below pi/4 (no reduction); Cody-Waite with no, one and both
    # refinements (beside multiples of pi/2); Payne-Hanek past 2^20 * pi/2.
    out += [("T", (lu(-30, -1),)) for _ in range(40)]
    out += [("T", (g.uniform(-1647099.0, 1647099.0),)) for _ in range(60)]
    for _ in range(60):
        k = g.randint(1, 600000)
        out.append(("T", (nudge(k * (math.pi / 2), g.randint(-3, 3)),)))
    out += [("T", (lu(21, 1023),)) for _ in range(80)]
    for d in range(-4, 5):
        out.append(("T", (nudge(math.ldexp(6381956970095103.0, 797), d),)))
    for _ in range(20):
        k = float(g.randint(10**9, 10**12))
        out.append(("T", (nudge(k * (math.pi / 2), g.randint(-3, 3)),)))
    # atan2: |y/x| in each of atan's five intervals (id -1 and 0..3), every
    # quadrant, far-apart exponents and a tiny x.
    for lo, hi in ((0.0, 0.4375), (0.4375, 0.6875), (0.6875, 1.1875), (1.1875, 2.4375), (2.4375, 1e6)):
        for _ in range(48):
            x = lu(-200, 200)
            out.append(("A", (x * g.uniform(lo, hi) * g.choice((-1.0, 1.0)), x)))
    out += [("A", (lu(-1000, 1000), lu(-1000, 1000))) for _ in range(40)]
    out += [("A", (lu(-60, 60), lu(-1022, -1000))) for _ in range(20)]
    # atan2 with a subnormal x (the rescale by 2^1023 when its high word is 0),
    # and with both operands subnormal.
    def sub():
        v = math.ldexp(max(1, g.randint(1, 2**52 - 1) >> g.randint(0, 51)), -1074)
        return -v if g.random() < 0.5 else v

    out += [("A", (3e-320, 4e-320)), ("A", (-5e-324, 1e-310))]
    out += [("A", (lu(-1074, 60), sub())) for _ in range(20)]
    out += [("A", (sub(), sub())) for _ in range(20)]
    # atan2 where plain fdlibm (an uncompensated quotient and pi - (z - pi_lo))
    # answers the double past the exact value's neighbour, 1.12 to 1.22 ulp off:
    # the worst of 30,000 draws with x < 0 or |y/x| beside an interval edge.
    hard = (
        (137768.8239278642, -51187.6838868487),
        (31.517608247237735, -11.445081511445295),
        (210.83916966352572, -72.91759115449184),
        (-8619.04378461657, 34138.832752146816),
        (9.279620559638634e-06, -3.3184029198349453e-06),
        (1550068.4961635876, -477159.3694825106),
        (-0.00010998855276162424, -3.721846483860442e-05),
        (-13.336796314225001, -4.610170132512149),
        (4.308533249751299, -1.4862773688891364),
        (-0.056809069831333076, -0.024810489499997326),
        (-0.00023627813689758873, -8.94030526268767e-05),
        (-0.001391832202215449, -0.000503429464750885),
    )
    out += [("A", a) for a in hard]
    # hypot: close and far exponents in the core, b tiny beside a (to 2^-60),
    # and both rescales.
    for _ in range(60):
        a = lu(-100, 100)
        out.append(("H", (a, a * g.uniform(-1.0, 1.0))))
    for _ in range(60):
        a = lu(-100, 100)
        out.append(("H", (a, a * math.ldexp(g.uniform(-1.0, 1.0), -g.randint(20, 60)))))
    out += [("H", (lu(500, 1023), lu(500, 1023))) for _ in range(60)]
    out += [("H", (lu(-1074, -500), lu(-1074, -500))) for _ in range(60)]
    out += [("H", (lu(-1022, 1023), lu(-1022, 1023))) for _ in range(60)]
    return out


def samples():
    names = {"T": "tan", "A": "atan2", "H": "hypot"}
    tables = {"T": [], "A": [], "H": []}
    for kind, a in draws():
        tables[kind].append((a, *rounded(exact(kind, list(a)))))
    for kind in ("T", "A", "H"):
        name = names[kind]
        rows = tables[kind]
        ops = len(rows[0][0])
        for i in range(ops):
            print(f"const {name}In{i}: f64[] = [{', '.join(repr(r[0][i]) for r in rows)}]")
        print(f"const {name}Want: f64[] = [{', '.join(repr(r[1]) for r in rows)}]")
        print(f"const {name}Side: i32[] = [{', '.join(str(r[2]) for r in rows)}]")
    return 0


if __name__ == "__main__":
    if sys.argv[1:] == ["--samples"]:
        sys.exit(samples())
    sys.exit(measure(sys.argv[1]))
