// WP41: `mulHigh` written out is the call itself, imported from nish/runtime,
// where a `u64` is a BigInt and the high half is the exact product shifted
// down. Node and the native binary must print the same lines.
const pairs = (): u64[] => {
  const all: u64 = ~toU64(0)
  const k32: u64 = 4294967296
  return [toU64(0), toU64(1), k32 - toU64(1), k32, k32 + toU64(1), toU64(1) << toU64(63), all]
}

export const main = (): number => {
  const xs = pairs()
  for (const a of xs) {
    const row: string[] = []
    for (const b of xs) {
      row.push(`${mulHigh(a, b)}`)
    }
    console.log(row.join(" "))
  }
  return 0
}
