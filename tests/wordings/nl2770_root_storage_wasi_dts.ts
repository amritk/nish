// A WASI build's loader releases the arena after every call, and only a page
// module emits the keep a loader would call instead.
class Player {
  score: i32 = 0
}

const player = new Array<Player | null>(1)

export const join = (score: i32): i32 => {
  const p = new Player()
  p.score = score
  player[0] = p
  return score
}
