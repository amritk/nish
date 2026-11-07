// A HostHandle in a program that imports no host module: an i32 of its own
// type, which starts as `0`, compares with `0` either way round, and goes
// through functions and fields unchanged. A parameter's default may be that
// `0` too.
type Canvas = HostHandle<"canvas">

class Slot {
  c: Canvas = 0
}

const named = (c: Canvas): boolean => c !== 0

function orNone(c: Canvas = 0): boolean {
  return c === 0
}

function keep(c: Canvas): Canvas {
  return c
}

export function main(): i32 {
  const slot = new Slot()
  const kept = keep(slot.c)
  console.log(`${kept === 0} ${0 === kept} ${named(kept)} ${orNone()} ${orNone(kept)}`)
  return 0
}
