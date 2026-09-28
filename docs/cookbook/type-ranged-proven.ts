const lookup = (table: i32[], i: integer<0, 255>): i32 => {
  if (table.length < 256) {
    return 0
  }
  return table[i]
}

const sumTable = (table: i32[]): i32 => {
  let sum = 0
  for (let i = 0; i < 256; i++) {
    sum = sum + lookup(table, i)
  }
  return sum
}
