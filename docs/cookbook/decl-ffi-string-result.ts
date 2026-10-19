declare function strerror(errnum: i32): string
declare function getenv(name: string): string | null

const message = (e: i32): u64 => toU64(strerror(e).length)

export const main = (): i32 => {
  const home = getenv("HOME")
  return home === null || message(2) === 25 ? 0 : 1
}
