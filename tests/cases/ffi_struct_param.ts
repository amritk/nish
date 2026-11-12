// WP27 S4.1: a `declare class` is a C struct, laid out in declaration order with
// natural alignment, and a `declare function` borrows it by pointer. `new`
// zero-fills it; C fills it in; the program reads the fields back.
// `Rlimit` is `struct rlimit` (two `rlim_t`, 64-bit on Linux) and `Timespec`
// is `struct timespec`. `Stamp` embeds a `Timespec` by value between two
// narrower fields, so `clock_gettime` writes through a pointer into its middle.
// `readClock` and `readStamp` lend their parameter on to C, so the parameter is
// written and not `readonly`, and the caller's read after the call sees C's write.
declare class Rlimit {
  cur: u64
  max: u64
}

declare class Timespec {
  sec: i64
  nsec: i64
}

declare class Stamp {
  tag: u8
  at: Timespec
  seq: i32
}

declare function getrlimit(resource: i32, rlim: Rlimit): i32
declare function setrlimit(resource: i32, rlim: Rlimit): i32
declare function clock_gettime(clock: i32, ts: Timespec): i32

const RLIMIT_NOFILE: i32 = 7
const CLOCK_MONOTONIC: i32 = 1

const readClock = (ts: Timespec): i32 => clock_gettime(CLOCK_MONOTONIC, ts)

const readStamp = (stamp: Stamp): i32 => clock_gettime(CLOCK_MONOTONIC, stamp.at)

export const main = (): number => {
  const limit = new Rlimit()
  console.log(limit.cur === 0)
  console.log(getrlimit(RLIMIT_NOFILE, limit))
  console.log(limit.cur > 0 && limit.cur <= limit.max)
  // Lowering the soft limit is always allowed; read it back through a second struct.
  const soft: u64 = limit.cur > 64 ? 64 : limit.cur
  limit.cur = soft
  console.log(setrlimit(RLIMIT_NOFILE, limit))
  const back = new Rlimit()
  console.log(getrlimit(RLIMIT_NOFILE, back))
  console.log(back.cur === soft)

  const stamp = new Stamp()
  stamp.tag = 7
  stamp.seq = 42
  console.log(clock_gettime(CLOCK_MONOTONIC, stamp.at))
  const later = new Timespec()
  console.log(clock_gettime(CLOCK_MONOTONIC, later))
  console.log(later.sec > stamp.at.sec || (later.sec === stamp.at.sec && later.nsec >= stamp.at.nsec))
  console.log(stamp.at.nsec >= 0 && stamp.at.nsec < 1000000000)
  // C wrote the middle; the fields either side are as the program left them.
  console.log(stamp.tag)
  console.log(stamp.seq)

  const lent = new Timespec()
  console.log(readClock(lent))
  console.log(lent.sec > 0 || lent.nsec > 0)
  const relayed = new Stamp()
  console.log(readStamp(relayed))
  console.log(relayed.at.sec > 0 || relayed.at.nsec > 0)
  return 0
}
