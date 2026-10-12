# usage: rusage.py THREADS cmd...  -> "wall cpu code stdout-first-line"
import os, sys, time, resource
threads = sys.argv[1]; cmd = sys.argv[2:]
env = dict(os.environ); env["NISH_NUM_THREADS"] = threads
t0 = time.perf_counter()
pid = os.fork()
if pid == 0:
    devnull = os.open("/dev/null", os.O_WRONLY)
    os.dup2(devnull, 2)
    os.execvpe(cmd[0], cmd, env)
_, status, ru = os.wait4(pid, 0)
wall = time.perf_counter() - t0
print(f"{wall:.4f} {ru.ru_utime + ru.ru_stime:.4f} {os.waitstatus_to_exitcode(status)}")
