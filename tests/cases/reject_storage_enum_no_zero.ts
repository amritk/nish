// Storage is zero-filled, so an enum without a zero member is refused.
enum Phase {
  Idle = 1,
  Run = 2,
}

const phases = new Array<Phase>(4)

export const main = (): void => {
  console.log(`${phases.length}`)
}
