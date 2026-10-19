import { readCString } from "nish:unsafe"

declare function realpath(path: string, resolved: CPtr | null): CPtr | null
declare function free(p: CPtr): void

const resolve = (path: string): string => {
  const p = realpath(path, null)
  if (p === null) {
    return ""
  }
  const out = readCString(p)
  free(p)
  return out
}

export const main = (): i32 => (resolve("/").length === 1 ? 0 : 1)
