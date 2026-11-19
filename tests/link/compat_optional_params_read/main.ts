// NL2803: an `x?` parameter read anywhere but as the left operand of `??`
// is refused, because the call that leaves it out passes `undefined` in
// TypeScript and `null` here, and `s === null` would tell them apart.
const join = (name: string, suffix?: string): string => {
  return suffix === null ? name : name + suffix
}

export const main = (): i32 => (join("a").length === 1 ? 0 : 1)
