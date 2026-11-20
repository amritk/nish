// WP41: `mulHigh` written out is the call itself, imported from nish/runtime,
// where a `u64` is a BigInt and the high half is the exact product shifted
// down. Node and the native binary must print the same lines. The literal
// operands of the last line are typed `u64` by the call, so they are BigInts
// in the TypeScript too.
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
  console.log(`${mulHigh(0x100000000000, 0x100000000000)} ${mulHigh(3, 5)}`)
  return 0
}
