const board = (): i32 => {
  const cells = new Array<i32>(16)
  let total = 0
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      cells[r * 4 + c] = r - c
      total = total + cells[r * 4 + c]
    }
  }
  return total
}
