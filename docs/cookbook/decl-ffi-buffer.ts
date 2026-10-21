declare function write(fd: i32, buf: readonly u8[], n: u64): i64

export const main = (): i32 => {
  const bytes: u8[] = [104, 105, 10]
  write(1, bytes, toU64(bytes.length))
  write(1, bytes, 2)
  return 0
}
