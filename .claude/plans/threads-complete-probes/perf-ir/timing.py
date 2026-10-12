# Interleaved timing: for each workload, ROUNDS rounds, each round runs every
# binary once (order rotated per round); wall from perf_counter, CPU from
# wait4 rusage (user+sys). Reports min / median per binary, and checks every
# run's stdout is the same across binaries.
import os, sys, time, statistics, json
ROUNDS = int(sys.argv[1]); THREADS = sys.argv[2]
T = "/tmp/claude-0/-home-user/495d7503-79d7-5bad-b184-656df3811dd4/scratchpad/pout"
bins = {"main": f"{T}/t-main607", "main-copy": f"{T}/t-main607", "pr": f"{T}/t-probe607"}
workloads = [
    ("contended 200", lambda d, k: [f"{d}/contended" + ("-copy" if k == "main-copy" else ""), "200"]),
    ("stress short 8x500000", lambda d, k: [f"{d}/stress" + ("-copy" if k == "main-copy" else ""), "8", "500000", "0", "0"]),
    ("stress long 8x40000 inner300", lambda d, k: [f"{d}/stress" + ("-copy" if k == "main-copy" else ""), "8", "40000", "300", "0"]),
    ("grain_time n=300000", lambda d, k: [f"{d}/grain_time" + ("-copy" if k == "main-copy" else ""), "300000"]),
]
env = dict(os.environ); env["NISH_NUM_THREADS"] = THREADS
def run(cmd):
    r, w = os.pipe()
    t0 = time.perf_counter()
    pid = os.fork()
    if pid == 0:
        os.dup2(w, 1); os.close(r); os.close(w)
        os.execve(cmd[0], cmd, env)
    os.close(w)
    out = b""
    while True:
        b = os.read(r, 65536)
        if not b: break
        out += b
    os.close(r)
    _, st, ru = os.wait4(pid, 0)
    return time.perf_counter() - t0, ru.ru_utime + ru.ru_stime, os.waitstatus_to_exitcode(st), out.decode()
keys = list(bins)
FILT = sys.argv[3] if len(sys.argv) > 3 else ""
for name, mk in workloads:
    if FILT and FILT not in name: continue
    res = {k: ([], []) for k in keys}; outs = set(); codes = set()
    for rd in range(ROUNDS):
        order = keys[rd % 3:] + keys[:rd % 3]
        for k in order:
            w, c, code, out = run(mk(bins[k], k))
            res[k][0].append(w * 1000); res[k][1].append(c * 1000); outs.add(out.strip()); codes.add(code)
    print(f"== {name} (NISH_NUM_THREADS={THREADS}, {ROUNDS} rounds) outputs={sorted(outs)} codes={sorted(codes)}")
    for k in keys:
        W, C = res[k]
        print(f"  {k:10s} wall min/med {min(W):8.1f} / {statistics.median(W):8.1f} ms   cpu min/med {min(C):8.1f} / {statistics.median(C):8.1f} ms")
    sys.stdout.flush()
