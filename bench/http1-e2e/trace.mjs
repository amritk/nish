// Kernel time per syscall for a set of pids, from tracefs, as one JSON object.
//
//   node trace.mjs <seconds> <pid,pid,...> <raw trace file>
//   node trace.mjs --parse <raw trace file> [pid,pid,...]
//
// Traces raw_syscalls:sys_enter/sys_exit and sched:sched_switch for the pids'
// threads in a tracefs instance of its own (so the global trace is left as it
// was), for <seconds>. A syscall's CPU time is exit minus enter, less the time
// its thread was switched out between them: epoll_wait's sleep is not CPU. The
// switch-outs are counted by the syscall they happened in and by prev_state, so
// a switch-out inside epoll_wait (S, the thread parked) can be told from one
// that preempted it (R). Some switch-ins never reach the buffer (about one in
// seven on the x86 box, prev a task outside the pid filter): a thread's next
// syscall event closes its off-CPU time then, and the count of those is
// reported, since the few µs between the real switch-in and that event are
// counted as off CPU. Needs tracefs (mount -t tracefs nodev
// /sys/kernel/tracing) and root; tracing slows every syscall a little, so
// README.md reads these figures for their split, not their sum.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import readline from "node:readline"

const NAMES =
  {
    x64: {
      0: "read",
      1: "write",
      3: "close",
      20: "writev",
      44: "sendto",
      45: "recvfrom",
      46: "sendmsg",
      47: "recvmsg",
      202: "futex",
      232: "epoll_wait",
      233: "epoll_ctl",
      281: "epoll_pwait",
      288: "accept4",
      441: "epoll_pwait2",
    },
    arm64: {
      21: "epoll_ctl",
      22: "epoll_pwait",
      57: "close",
      63: "read",
      64: "write",
      66: "writev",
      98: "futex",
      206: "sendto",
      207: "recvfrom",
      211: "sendmsg",
      212: "recvmsg",
      242: "accept4",
      441: "epoll_pwait2",
    },
  }[process.arch] ?? {}
const T = "/sys/kernel/tracing"

const tids = (pids) =>
  pids.flatMap((p) => {
    try {
      return fs.readdirSync(`/proc/${p}/task`).map(Number)
    } catch {
      return [Number(p)]
    }
  })

const record = (seconds, pids, file) => {
  if (!fs.existsSync(`${T}/instances`)) {
    console.log(JSON.stringify({ error: `no tracefs at ${T}` }))
    process.exit(3)
  }
  const inst = `${T}/instances/http1-e2e`
  if (!fs.existsSync(inst)) {
    fs.mkdirSync(inst)
  }
  const w = (f, v) => fs.writeFileSync(`${inst}/${f}`, v)
  w("tracing_on", "0")
  w("trace", "")
  w("trace_clock", "mono")
  w("buffer_size_kb", "65536")
  w("set_event_pid", tids(pids).join(" "))
  for (const e of ["raw_syscalls/sys_enter", "raw_syscalls/sys_exit", "sched/sched_switch"]) {
    w(`events/${e}/enable`, "1")
  }
  w("tracing_on", "1")
  spawnSync("sleep", [String(seconds)])
  w("tracing_on", "0")
  // tracefs reports size 0, so copyFile would copy nothing: read to EOF.
  fs.writeFileSync(file, fs.readFileSync(`${inst}/trace`))
  w("events/enable", "0")
  w("set_event_pid", "")
  w("trace", "")
  fs.rmdirSync(inst)
}

const parse = async (file, pids, seconds) => {
  // Without pids, the threads whose syscalls the pid-filtered trace holds.
  const watch = new Set(tids(pids).map(String))
  const learn = pids.length === 0
  let inferred = 0
  const st = {} // per tid: { nr, enter, offSince, offInCall, on }
  const stateOf = (tid) => {
    st[tid] ??= {}
    return st[tid]
  }
  const calls = {} // name -> { n, cpu_ns, wall_ns }
  const switches = {} // "<syscall>/<state>" -> n
  let first = null
  let last = null
  const re = /^\s*.+?-(\d+)\s+\[\d+\]\s+\S+\s+([\d.]+): (sys_enter|sys_exit|sched_switch): (.*)$/
  const lines = readline.createInterface({ input: fs.createReadStream(file) })
  for await (const line of lines) {
    const m = re.exec(line)
    if (!m) {
      continue
    }
    const t = Math.round(Number(m[2]) * 1e9)
    first ??= t
    last = t
    if (m[3] === "sched_switch") {
      const prev = /prev_pid=(\d+) .*prev_state=(\S+) ==> .*next_pid=(\d+)/.exec(m[4])
      if (!prev) {
        continue
      }
      if (watch.has(prev[1])) {
        const s = stateOf(prev[1])
        s.offSince = t
        const where = s.nr === undefined ? "user" : (NAMES[s.nr] ?? `nr${s.nr}`)
        const k = `${where}/${prev[2]}`
        switches[k] = (switches[k] ?? 0) + 1
      }
      if (watch.has(prev[3])) {
        const s = stateOf(prev[3])
        if (s.offSince !== undefined && s.nr !== undefined) {
          s.offInCall = (s.offInCall ?? 0) + (t - s.offSince)
        }
        s.offSince = undefined
      }
      continue
    }
    const tid = m[1]
    if (learn) {
      watch.add(tid)
    }
    if (!watch.has(tid)) {
      continue
    }
    const nr = Number(/NR (-?\d+)/.exec(m[4])?.[1])
    const s = stateOf(tid)
    if (s.offSince !== undefined) {
      // Running again with no switch-in on record.
      if (s.nr !== undefined) {
        s.offInCall = (s.offInCall ?? 0) + (t - s.offSince)
      }
      s.offSince = undefined
      inferred++
    }
    if (m[3] === "sys_enter") {
      s.nr = nr
      s.enter = t
      s.offInCall = 0
    } else if (s.nr === nr && s.enter !== undefined) {
      const name = NAMES[nr] ?? `nr${nr}`
      // biome-ignore lint/style/useNamingConvention: field names of the results JSON
      calls[name] ??= { n: 0, cpu_ns: 0, wall_ns: 0 }
      const c = calls[name]
      c.n++
      c.wall_ns += t - s.enter
      c.cpu_ns += t - s.enter - (s.offInCall ?? 0)
      s.nr = undefined
      s.enter = undefined
    }
  }
  return {
    source: "tracefs raw_syscalls + sched_switch (substitute, not a hardware counter)",
    seconds,
    // biome-ignore lint/style/useNamingConvention: field names of the results JSON
    traced_ns: last === null ? 0 : last - first,
    calls,
    switches,
    // biome-ignore lint/style/useNamingConvention: field names of the results JSON
    switch_ins_inferred: inferred,
  }
}

if (process.argv[2] === "--parse") {
  const pids = process.argv[4] ? process.argv[4].split(",") : []
  console.log(JSON.stringify(await parse(process.argv[3], pids, null)))
} else {
  const [seconds, pids, file] = process.argv.slice(2)
  record(Number(seconds), pids.split(","), file)
  console.log(JSON.stringify(await parse(file, pids.split(","), Number(seconds))))
}
