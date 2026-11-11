export const main = (): number => {
  const fd = fileOpen("big.log")
  if (fd < 0) {
    return 1
  }
  const size = fileSize(fd)
  const buf: u8[] = new Array<u8>(4096)
  let pos: i64 = toI64(0)
  let n = fileReadAt(fd, buf, 0, buf.length, pos)
  while (n > 0) {
    pos = pos + toI64(n)
    n = fileReadAt(fd, buf, 0, buf.length, pos)
  }
  fileClose(fd)
  return pos === size ? 0 : 2
}
