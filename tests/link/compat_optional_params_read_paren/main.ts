// NL2803: the parenthesised read `(suffix)` is the same read, and is
// refused the same way; only `suffix ?? d` reads it.
const join = (name: string, suffix?: string): string => {
  return (suffix) === null ? name : name + "!"
}

export const main = (): i32 => (join("a").length === 1 ? 0 : 1)
