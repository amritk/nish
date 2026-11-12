declare class Timespec {
  sec: i64
  nsec: i64
}
declare class Stamp {
  tag: u8
  at: Timespec
  seq: i32
}
// biome-ignore lint/style/useNamingConvention: the C function's own name
declare function clock_gettime(clock: i32, ts: Timespec): i32

export const main = (): i32 => {
  const stamp = new Stamp()
  stamp.tag = 7
  clock_gettime(1, stamp.at)
  return stamp.at.sec > 0 ? 0 : 1
}
