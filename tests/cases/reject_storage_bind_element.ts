// An element of record storage is a place: binding it is refused.
interface Sim {
  tick: i32
}

const sim = new Array<Sim>(2)

export const main = (): void => {
  const s = sim[0]
  console.log(`${s.tick}`)
}
