// WP34 N12: a child that runs beside the parent. `spawn` answers the pid, or a
// negative errno; `kill` and `waitPid` act on it; the two host facts size the
// pool. `waitPid` without `WNOHANG` and `kill` of the program's own pid may not
// return, so neither declaration carries `willreturn`; the host facts write
// nothing, so a task or a parallel body may read them.
export const supervise = (argv: string[]): i32 => {
  const pid = spawn(argv)
  if (pid <= 0) {
    return pid
  }
  if (kill(pid, 0) !== 0) {
    return -1
  }
  kill(pid, 15)
  return waitPid(pid, 0)[1]
}

export const workers = (): i32 => availableParallelism()

export const budget = (): i64 => totalMemory()
