// NL2605: a compat program whose `nish.compat` leaves out `optional-params`
// refuses an `x?` parameter as before, and names the feature.
const join = (name: string, suffix?: string): string => {
  return name + (suffix ?? "")
}

export const main = (): i32 => (join("a").length === 1 ? 0 : 1)
