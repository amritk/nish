class Stepper {
  n: i32 = 0
  step(): Result<boolean, i32> {
    this.n += 1
    if (this.n <= 3) {
      return Ok(true)
    }
    return Ok(false)
  }
}

export const main = (): i32 => {
  const q = new Stepper()
  let r = q.step()
  while (r.isOk() && r.value) {
    r = q.step()
  }
  const s = new Array<u8>(64)
  s.fill(255)
  console.log(`${s.length} ${r.isOk()} ${r.isErr()}`)
  return 0
}
