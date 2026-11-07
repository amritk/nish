// An element of record storage cannot be an argument.
interface Sim {
  tick: i32
}

const sim = new Array<Sim>(2)

const show = (s: Sim): void => {
  console.log(`${s.tick}`)
}

export const main = (): void => {
  show(sim[0])
}
