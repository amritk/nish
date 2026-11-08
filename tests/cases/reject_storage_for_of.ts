// `for of` would bind an element of record storage.
interface Sim {
  tick: i32
}

const sim = new Array<Sim>(2)

export const main = (): void => {
  for (const s of sim) {
    console.log(`${s.tick}`)
  }
}
