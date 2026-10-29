export const replace = (path: string, bytes: readonly u8[]): number => {
  const tmp = `${path}.tmp`
  const written = writeFileBytesSync(tmp, bytes)
  if (written < 0) {
    unlinkSync(tmp)
    return written
  }
  return renameSync(tmp, path)
}

export const echo = (bytes: readonly u8[]): number => writeBytes(bytes, 0, bytes.length)
