const firstPair = (limit: number, target: number): number => {
  outer: for (let i = 0; i < limit; i++) {
    for (let j = 0; j < limit; j++) {
      if (j > i) {
        continue outer
      }
      if (i * j === target) {
        break outer
      }
    }
  }
  return 0
}
