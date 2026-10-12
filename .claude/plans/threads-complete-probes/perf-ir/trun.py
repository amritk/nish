# Run a command with a timeout and report wall, user+sys CPU, exit, stdout.
# usage: trun.py TIMEOUT THREADS cmd...   -> prints JSON line
import os, sys, time, json, signal, subprocess
timeout = float(sys.argv[1]); threads = sys.argv[2]; cmd = sys.argv[3:]
env = dict(os.environ)
if threads != "-":
    env["NISH_NUM_THREADS"] = threads
t0 = time.perf_counter()
p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
hung = False
try:
    out, err = p.communicate(timeout=timeout)
except subprocess.TimeoutExpired:
    hung = True
    p.kill(); out, err = p.communicate()
wall = time.perf_counter() - t0
ru = os.wait4(p.pid, os.WNOHANG) if False else None
print(json.dumps({"wall": wall, "code": p.returncode, "hung": hung, "out": out.decode(), "err": err.decode()[-400:]}))
