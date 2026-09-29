export const keyLength = (path: string): number => {
  const der = readFileBytesSync(path)
  if (der === null) {
    return -1
  }
  return der.length
}
