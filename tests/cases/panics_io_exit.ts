// Panic sites: `readFileSync`, `writeFileSync` and `appendFileSync` exit
// inside the runtime when the file cannot be read or written, and
// `crypto.getRandomValues` when the system's entropy fails or more than
// 65536 bytes are asked for; `readFileSyncOrNull` answers null instead, and
// is not a site.
const save = (path: string): void => {
  writeFileSync(path, "one\n")
  appendFileSync(path, "two\n")
}

const load = (path: string): string => readFileSync(path)

const tryLoad = (path: string): string => {
  const text = readFileSyncOrNull(path)
  if (text === null) {
    return ""
  }
  return text
}

const fill = (bytes: u8[]): void => {
  crypto.getRandomValues(bytes)
}

export const main = (): number => {
  const path = "build/test/panics_io_exit.txt"
  save(path)
  console.log(load(path).length)
  console.log(tryLoad(path).length)
  const bytes: u8[] = [0, 0, 0, 0]
  fill(bytes)
  console.log(bytes.length)
  return 0
}
