// NL4014: `make` is called at no type, so the checker never typed its body,
// and nothing says whether `--emit-ts` fills its slots with `0`, `0n` or
// `false`.
const make = <T>(like: T[], n: i32): T[] => {
  const out = new Array<T>(n)
  return out
}

export const main = (): number => 0
