// A HostHandle in a program that imports no host module: an i32 of its own
// type, which starts as `0`, compares with `0` either way round, and goes
// through functions and fields unchanged.
type Canvas = HostHandle<"canvas">

class Slot {
  c: Canvas = 0
}

const named = (c: Canvas): boolean => c !== 0

function keep(c: Canvas): Canvas {
  return c
}

export function main(): i32 {
  const slot = new Slot()
  const kept = keep(slot.c)
  console.log(`${kept === 0} ${0 === kept} ${named(kept)}`)
  return 0
}
