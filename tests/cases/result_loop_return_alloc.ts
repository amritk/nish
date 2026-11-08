// A function that answers a `Result` in a register returns one straight out
// of a loop pass: from a call whose callee allocates, from a ternary of two
// such calls and from a `??`. Each value is packed before the pass releases,
// so every loop keeps its pass scope and its rewind.
const measure = (i: i32): Result<i32, i32> => {
  const parts = new Array<i32>(0)
  for (let k = 0; k <= i; k++) {
    parts.push(k)
  }
  if (parts.length > 3) {
    return Ok(parts.length * 10)
  }
  return Err(parts.length)
}

const spell = (i: i32): Result<i32, i32> => {
  const s = `n${i}`
  return Ok(s.length)
}

const viaCall = (limit: i32): Result<i32, i32> => {
  for (let i = 0; i < limit; i++) {
    const tag = `pass ${i}`
    if (i === 4 && tag.length > 0) {
      return measure(i)
    }
  }
  return Err(-1)
}

const viaTernary = (limit: i32): Result<i32, i32> => {
  let i = 0
  while (i < limit) {
    const tag = `pass ${i}`
    if (i === 2) {
      return tag.length > 6 ? measure(i) : spell(i * 50)
    }
    i += 1
  }
  return Err(-2)
}

const viaCoalesce = (limit: i32, map: Map<i32, i32>): Result<i32, i32> => {
  for (let i = 0; i < limit; i++) {
    const tag = `pass ${i}`
    if (i === 1 && tag.length > 0) {
      return Ok(map.get(i) ?? 7)
    }
  }
  return measure(1)
}

export const main = (): i32 => {
  const a = viaCall(10)
  console.log(`call ${a.isOk()} ${a.isOk() ? a.value : a.error}`)
  const b = viaTernary(10)
  console.log(`ternary ${b.isOk()} ${b.isOk() ? b.value : b.error}`)
  const map = new Map<i32, i32>()
  const c = viaCoalesce(10, map)
  console.log(`coalesce ${c.isOk()} ${c.isOk() ? c.value : c.error}`)
  const d = viaCall(2)
  console.log(`none ${d.isOk()} ${d.isOk() ? d.value : d.error}`)
  return 0
}
