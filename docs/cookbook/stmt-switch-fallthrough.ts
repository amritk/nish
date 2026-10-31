const points = (stars: number): number => {
  let total = 0
  switch (stars) {
    // biome-ignore lint/suspicious/noFallthroughSwitchClause: the fallthrough is the point
    case 3:
      total = 100
    // biome-ignore lint/suspicious/noFallthroughSwitchClause: the fallthrough is the point
    case 2:
      total |= 10
    case 1:
      total |= 1
      break
    default:
      total = -1
  }
  return total
}
