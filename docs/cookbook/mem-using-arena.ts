const longest = (rows: i32, keep: string): string => {
  let best = 0
  for (let i = 0; i < rows; i++) {
    using a = arena()
    const label = `row ${i}`
    if (label.length > 8) {
      break
    }
    best = label.length > best ? label.length : best
  }
  return best > 4 ? keep : "short"
}
