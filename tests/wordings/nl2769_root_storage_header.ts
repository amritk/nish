// A native shim releases the arena after a call that passes a string, which
// would free the name a root keeps.
class Player {
  name: string = ""
}

const player = new Array<Player | null>(1)

export const join = (name: string): i32 => {
  const p = new Player()
  p.name = name
  player[0] = p
  return name.length
}

export const nameLength = (): i32 => {
  const p = player[0]
  return p === null ? 0 : p.name.length
}
