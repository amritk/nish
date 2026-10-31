const points = (stars: number): number => {
  let total = 0
  switch (stars) {
    case 3:
      total = 100
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
